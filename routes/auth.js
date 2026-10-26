// routes/auth.js
const fs = require('fs');
const path = require('path');
const { 
  getUserByUsernameWithPassword,
  getUserById,
  updateUserPassword,
  updateLastLogin
} = require('../database/db');
const { 
  hashPassword, 
  verifyPassword, 
  validatePassword 
} = require('../utils/auth');
const { logAction } = require('../utils/logger');
const { requireAuth, requireGuest, checkPasswordChange } = require('../middleware/auth');

// ===== СТРАНИЦЫ =====

/**
 * GET /login — страница входа
 */
function renderLogin(req, res) {
  const htmlPath = path.join(__dirname, '..', 'views', 'login.html');
  fs.readFile(htmlPath, 'utf8', (err, html) => {
    if (err) {
      console.error('Ошибка загрузки login.html:', err);
      res.status(500).send('Ошибка загрузки страницы');
      return;
    }
    res.send(html);
  });
}

/**
 * GET /change-password — страница смены пароля
 */
function renderChangePassword(req, res) {
  const htmlPath = path.join(__dirname, '..', 'views', 'change-password.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Флаг обязательной смены
  const mustChange = req.session.mustChangePassword ? 'true' : 'false';
  html = html.replace(/\{\{mustChangePassword\}\}/g, mustChange);
  
  // Данные пользователя
  const username = req.session.username || '';
  const fullName = req.session.fullName || username;
  const role = req.session.role || 'user';

  // 5.11.2-auth: инициалы вместо эмодзи-иконки роли, полный набор ролей
  const roleTexts = {
    admin:      'Администратор',
    supervisor: 'Супервизор',
    mol:        'МОЛ',
    user:       'Пользователь',
  };
  const roleText = roleTexts[role] || role;

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(p => p);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const userInitials = getInitials(fullName);

  html = html.replace(/\{\{username\}\}/g, username);
  html = html.replace(/\{\{fullName\}\}/g, fullName);
  html = html.replace(/\{\{roleText\}\}/g, roleText);
  html = html.replace(/\{\{userInitials\}\}/g, userInitials);
  
  res.send(html);
}

// ===== API =====

/**
 * POST /api/auth/login — вход в систему
 */
async function loginAPI(req, res) {
  try {
    const { username, password } = req.body;
    
    // Валидация входных данных
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Введите логин и пароль' 
      });
    }
    
    // Ищем пользователя
    const user = await getUserByUsernameWithPassword(username.trim());
    
    // Логируем неудачную попытку (пользователь не найден)
    if (!user) {
      await logAction({
        req,
        action: 'login_failed',
        details: JSON.stringify({ username, reason: 'user_not_found' }),
        username: username
      });
      
      return res.status(401).json({ 
        error: 'Неверный логин или пароль' 
      });
    }
    
    // Проверяем пароль
    const passwordValid = await verifyPassword(password, user.password_hash);
    
    if (!passwordValid) {
      await logAction({
        req,
        action: 'login_failed',
        userId: user.id,
        username: user.username,
        details: JSON.stringify({ reason: 'invalid_password' })
      });
      
      return res.status(401).json({ 
        error: 'Неверный логин или пароль' 
      });
    }
    
    // Проверяем, что пользователь активен
    if (!user.is_active) {
      await logAction({
        req,
        action: 'login_failed',
        userId: user.id,
        username: user.username,
        details: JSON.stringify({ reason: 'user_blocked' })
      });
      
      return res.status(403).json({ 
        error: 'Ваша учётная запись заблокирована. Обратитесь к администратору.' 
      });
    }
    
    // Успешный вход — сохраняем данные в сессию
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.fullName = user.full_name;
    req.session.mustChangePassword = user.must_change_password === 1;

    // 🆕 Сохраняем версию БД — для проверки валидности сессии
    try {
      const { getDbVersion } = require('../database/db');
      const dbVersion = await getDbVersion();
      req.session.dbVersion = dbVersion;
    } catch (err) {
      console.warn('⚠️ Не удалось получить версию БД:', err.message);
    }
    
    // Обновляем время последнего входа
    await updateLastLogin(user.id);
    
    // Логируем успешный вход
    await logAction({
      req,
      action: 'login',
      userId: user.id,
      username: user.username,
      details: JSON.stringify({ role: user.role })
    });
    
    // Определяем куда редиректить
    let redirectUrl;
    if (user.must_change_password === 1) {
        redirectUrl = '/change-password';
    } else if (user.role === 'admin') {
        redirectUrl = '/';        // ← админ → дашборд
    } else {
        redirectUrl = '/profile'; // ← пользователь → профиль
    }
    
    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      redirect: redirectUrl,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        mustChangePassword: user.must_change_password === 1
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка входа:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера. Попробуйте позже.' 
    });
  }
}

/**
 * POST /api/auth/logout — выход из системы
 */
async function logoutAPI(req, res) {
  try {
    // Логируем выход
    if (req.session && req.session.userId) {
      await logAction({
        req,
        action: 'logout'
      });
    }
    
    // Уничтожаем сессию
    req.session.destroy((err) => {
      if (err) {
        console.error('Ошибка удаления сессии:', err);
        return res.status(500).json({ error: 'Ошибка выхода' });
      }
      
      res.clearCookie('equipment.sid');
      res.json({ 
        success: true, 
        message: 'Вы вышли из системы',
        redirect: '/login'
      });
    });
  } catch (error) {
    console.error('❌ Ошибка выхода:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * GET /logout — выход через GET (для удобства)
 */
function logoutRedirect(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Ошибка выхода:', err);
    }
    res.clearCookie('equipment.sid');
    res.redirect('/login');
  });
}

/**
 * POST /api/auth/change-password — смена пароля
 */
async function changePasswordAPI(req, res) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        error: 'Требуется авторизация' 
      });
    }
    
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Валидация входных данных
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        error: 'Заполните все поля' 
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        error: 'Новый пароль и подтверждение не совпадают' 
      });
    }
    
    // Валидация нового пароля
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.errors.join('. ') 
      });
    }
    
    // Получаем пользователя
    const user = await getUserByUsernameWithPassword(req.session.username);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'Пользователь не найден' 
      });
    }
    
    // Проверяем текущий пароль
    const passwordValid = await verifyPassword(currentPassword, user.password_hash);
    
    if (!passwordValid) {
      return res.status(401).json({ 
        error: 'Неверный текущий пароль' 
      });
    }
    
    // Проверяем, что новый пароль отличается от старого
    const samePassword = await verifyPassword(newPassword, user.password_hash);
    if (samePassword) {
      return res.status(400).json({ 
        error: 'Новый пароль должен отличаться от текущего' 
      });
    }
    
    // Хешируем и сохраняем новый пароль
    const newHash = await hashPassword(newPassword);
    await updateUserPassword(user.id, newHash, 0); // 0 = больше не требуется смена
    
    // Обновляем флаг в сессии
    req.session.mustChangePassword = false;
    
    // Логируем смену пароля
    await logAction({
      req,
      action: 'password_change',
      userId: user.id,
      username: user.username
    });
    
    res.json({ 
      success: true, 
      message: 'Пароль успешно изменён',
      redirect: user.role === 'admin' ? '/' : '/profile'
    });
    
  } catch (error) {
    console.error('❌ Ошибка смены пароля:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера. Попробуйте позже.' 
    });
  }
}

/**
 * GET /api/auth/me — получить текущего пользователя
 */
async function getCurrentUserAPI(req, res) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        error: 'Не авторизован' 
      });
    }
    
    const user = await getUserById(req.session.userId);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'Пользователь не найден' 
      });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      department: user.department,
      phone: user.phone,
      role: user.role,
      isActive: user.is_active === 1,
      mustChangePassword: user.must_change_password === 1,
      lastLogin: user.last_login
    });
  } catch (error) {
    console.error('❌ Ошибка получения текущего пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  // Страницы
  renderLogin,
  renderChangePassword,
  logoutRedirect,
  // API
  loginAPI,
  logoutAPI,
  changePasswordAPI,
  getCurrentUserAPI
};