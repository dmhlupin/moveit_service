// middleware/auth.js

const { validateSessionUser, getDbVersion } = require('../database/db');

/**
 * Middleware: требуется авторизация
 * Если пользователь не авторизован — редирект на /login
 * Для API-запросов возвращает 401 JSON
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Если это API-запрос — возвращаем JSON
  if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept || '').includes('application/json')) {
    return res.status(401).json({ 
      error: 'Требуется авторизация',
      code: 'UNAUTHORIZED'
    });
  }
  
  // Иначе редирект на страницу входа с сохранением исходного URL
  const returnUrl = encodeURIComponent(req.originalUrl);
  res.redirect(`/login?returnUrl=${returnUrl}`);
}

// ============================================================
// MIDDLEWARE ПО РОЛЯМ (Этап 4)
// ============================================================
// Иерархия ролей:
//   admin      — всё
//   supervisor — read-only ко всему (без логов)
//   mol        — работает только со «своим»
//   user       — только /profile и PDF
//
// Правило: requireXxx используется ПОСЛЕ requireAuth (или вместо него,
// если уже проверяет userId — сейчас requireAdmin/requireMol/…
// сами проверяют наличие сессии для API-ответа 401).
// ============================================================

/**
 * Внутренняя функция: проверка «есть ли у пользователя одна из ролей».
 * Возвращает true, если роль подходит.
 */
function hasAnyRole(req, roles) {
  if (!req.session || !req.session.userId) return false;
  return roles.includes(req.session.role);
}

/**
 * Ответ 403 «Доступ запрещён» — унифицированный для страниц и API.
 */
function denyAccess(req, res, message = 'Недостаточно прав') {
  if (
    req.path.startsWith('/api/') ||
    req.xhr ||
    (req.headers.accept || '').includes('application/json')
  ) {
    return res.status(403).json({
      error: message,
      code: 'FORBIDDEN'
    });
  }

  return res.status(403).send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Доступ запрещён</title>
      <link rel="stylesheet" href="/css/style.css">
      <style>
        body { display: flex; align-items: center; justify-content: center;
               min-height: 100vh; background: #f0f2f5; }
        .container { background: white; padding: 60px 50px; border-radius: 16px;
                     box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                     max-width: 500px; text-align: center; }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #e53e3e; margin-bottom: 15px; }
        p { color: #666; margin-bottom: 25px; }
        .btn { display: inline-block; padding: 12px 30px; background: #667eea;
               color: white; text-decoration: none; border-radius: 8px; }
        .btn:hover { background: #5a67d8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🚫</div>
        <h1>Доступ запрещён</h1>
        <p>${message}</p>
        <a href="/profile" class="btn">← В личный кабинет</a>
      </div>
    </body>
    </html>
  `);
}

/**
 * Требуется роль администратора.
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(401).json({ error: 'Требуется авторизация', code: 'UNAUTHORIZED' });
    }
    return res.redirect('/login');
  }
  if (req.session.role !== 'admin') {
    return denyAccess(req, res, 'У вас недостаточно прав. Требуется роль администратора');
  }
  next();
}

/**
 * 🆕 Требуется роль supervisor ИЛИ admin.
 * Используется для read-only роутов: /admin (просмотр), /equipment,
 * /admin/inventory, /users, дашборд.
 */
function requireSupervisor(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(401).json({ error: 'Требуется авторизация', code: 'UNAUTHORIZED' });
    }
    return res.redirect('/login');
  }
  if (!hasAnyRole(req, ['admin', 'supervisor'])) {
    return denyAccess(req, res, 'У вас недостаточно прав. Требуется роль супервизора');
  }
  next();
}

/**
 * 🆕 Требуется роль mol ИЛИ admin.
 * Используется для операций редактирования «в своих границах».
 * Дополнительные проверки «это его склад / его техника» —
 * через utils/permissions.js уже внутри роутов.
 */
function requireMol(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(401).json({ error: 'Требуется авторизация', code: 'UNAUTHORIZED' });
    }
    return res.redirect('/login');
  }
  if (!hasAnyRole(req, ['admin', 'mol'])) {
    return denyAccess(req, res, 'У вас недостаточно прав. Требуется роль МОЛ');
  }
  next();
}

/**
 * 🆕 Гибкий middleware: requireRole(['admin', 'mol']).
 */
function requireRole(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Error('requireRole: передайте непустой массив ролей');
  }
  return function (req, res, next) {
    if (!req.session || !req.session.userId) {
      if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept || '').includes('application/json')) {
        return res.status(401).json({ error: 'Требуется авторизация', code: 'UNAUTHORIZED' });
      }
      return res.redirect('/login');
    }
    if (!hasAnyRole(req, roles)) {
      return denyAccess(req, res, `Недостаточно прав. Требуется одна из ролей: ${roles.join(', ')}`);
    }
    next();
  };
}

/**
 * Middleware: только для неавторизованных
 * Если пользователь уже вошёл — редирект на главную
 * Используется на странице /login
 */
function requireGuest(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  next();
}

/**
 * Middleware: передаёт данные пользователя в res.locals
 * для использования в шаблонах
 */
function loadUser(req, res, next) {
  if (req.session && req.session.userId) {
    const role = req.session.role;
    res.locals.user = {
      id: req.session.userId,
      username: req.session.username,
      role,
      fullName: req.session.fullName
    };
    res.locals.isAuthenticated = true;
    res.locals.isAdmin       = role === 'admin';
    res.locals.isSupervisor  = role === 'supervisor';
    res.locals.isMol         = role === 'mol';
    res.locals.isUser        = role === 'user';
  } else {
    res.locals.user = null;
    res.locals.isAuthenticated = false;
    res.locals.isAdmin = false;
    res.locals.isSupervisor = false;
    res.locals.isMol = false;
    res.locals.isUser = false;
  }
  next();
}

/**
 * Middleware: проверяет, что пользователь должен сменить пароль
 * Если must_change_password = 1 — редирект на страницу смены пароля
 * (кроме самой страницы смены пароля и API для смены пароля)
 */
function checkPasswordChange(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next();
  }
  
  // Разрешаем доступ к странице смены пароля и выходу
  const allowedPaths = [
    '/change-password',
    '/api/auth/change-password',
    '/logout',
    '/api/auth/logout'
  ];
  
  if (allowedPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  if (req.session.mustChangePassword) {
    if (req.path.startsWith('/api/') || req.xhr) {
      return res.status(403).json({
        error: 'Необходимо сменить пароль',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }
    return res.redirect('/change-password');
  }
  
  next();
}



/**
 * Middleware: синхронизация сессии с БД
 * 
 * Проверяет:
 * - существует ли ещё пользователь
 * - активен ли он
 * - не изменилась ли его роль
 * - не изменился ли логин
 * - не пересоздана ли БД (версия)
 */
async function syncSession(req, res, next) {
  // Пропускаем неавторизованные запросы
  if (!req.session || !req.session.userId) {
    return next();
  }
  
  try {
    // 🆕 Проверяем версию БД
    const currentDbVersion = await getDbVersion();
    
    if (req.session.dbVersion && currentDbVersion && req.session.dbVersion !== currentDbVersion) {
      console.log(`🔒 Сессия устарела: версия БД изменилась`);
      return destroySession(req, res, 
        'Данные приложения были обновлены. Войдите заново.', 
        'DB_VERSION_CHANGED'
      );
    }
    
    // Загружаем пользователя
    const user = await validateSessionUser(req.session.userId);
    
    // Пользователь удалён
    if (!user) {
      return destroySession(req, res, 'Сессия устарела. Войдите заново.', 'USER_NOT_FOUND');
    }
    
    // Пользователь заблокирован
    if (!user.is_active) {
      return destroySession(req, res, 'Ваша учётная запись заблокирована.', 'USER_BLOCKED');
    }
    
    // Роль изменилась
    if (user.role !== req.session.role) {
      return destroySession(req, res, 'Ваша роль изменилась. Войдите заново.', 'ROLE_CHANGED');
    }
    
    // Логин изменился
    if (user.username !== req.session.username) {
      return destroySession(req, res, 'Данные учётной записи изменились. Войдите заново.', 'USERNAME_CHANGED');
    }
    
    // Обновляем поля сессии
    req.session.fullName = user.full_name;
    req.session.mustChangePassword = user.must_change_password === 1;
    req.session.dbVersion = currentDbVersion;  // ← сохраняем версию
    
    next();
  } catch (error) {
    console.error('❌ Ошибка проверки сессии:', error);
    next();
  }
}
/**
 * Уничтожить сессию и вернуть ответ
 */
function destroySession(req, res, message, code) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Ошибка уничтожения сессии:', err);
    }
    res.clearCookie('equipment.sid');
    
    // Для API — JSON
    if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(401).json({ 
        error: message,
        code: code,
        redirect: '/login'
      });
    }
    
    // Для страниц — редирект
    res.redirect('/login?reason=' + code);
  });
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireSupervisor,   // 🆕
  requireMol,          // 🆕
  requireRole,         // 🆕
  requireGuest,
  loadUser,
  checkPasswordChange,
  syncSession // Новое
};