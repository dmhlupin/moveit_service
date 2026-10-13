// routes/profile.js
const fs = require('fs');
const path = require('path');
const {
  getUserById,
  getUserActiveEquipment,
  getUserEquipmentHistory,
  getUserStats,
  updateUserProfile,
} = require('../database/db');
const { renderPage, renderPageFor } = require('../utils/layout');
const { logAction } = require('../utils/logger');

/**
 * GET /profile — личный кабинет пользователя
 */
async function renderProfile(req, res) {
  try {
    const userId = req.session.userId;

    const [user, activeEquipment, history, stats] = await Promise.all([
      getUserById(userId),
      getUserActiveEquipment(userId),
      getUserEquipmentHistory(userId),
      getUserStats(userId),
    ]);

    if (!user) {
      return res.redirect('/logout');
    }

    const htmlPath = path.join(__dirname, '..', 'views', 'profile.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // ===== Данные пользователя =====
    const roleText = user.role === 'admin' ? 'Администратор' : 'Пользователь';

    html = html.replace(/\{\{user\.username\}\}/g, escapeHtml(user.username || ''));
    html = html.replace(/\{\{user\.email\}\}/g, escapeHtml(user.email || ''));
    html = html.replace(/\{\{user\.full_name\}\}/g, escapeHtml(user.full_name || ''));
    html = html.replace(/\{\{user\.department\}\}/g, escapeHtml(user.department || ''));
    html = html.replace(/\{\{user\.phone\}\}/g, escapeHtml(user.phone || ''));
    html = html.replace(/\{\{user\.role_text\}\}/g, roleText);
    html = html.replace(/\{\{user\.last_login\}\}/g, user.last_login || 'никогда');

    // ===== Статистика =====
    html = html.replace(/\{\{stats\.active_equipment\}\}/g, stats.active_equipment || 0);
    html = html.replace(/\{\{stats\.total_equipment\}\}/g, stats.total_equipment || 0);
    html = html.replace(/\{\{stats\.returned_equipment\}\}/g, stats.returned_equipment || 0);

    // ===== Активная техника =====
    let activeRows = '';
    if (activeEquipment.length === 0) {
      activeRows = emptyRow(6, 'У вас нет активной техники');
    } else {
      activeEquipment.forEach(item => {
        activeRows += `
          <tr>
            <td><strong class="font-mono">${escapeHtml(item.inventory_number) || '—'}</strong></td>
            <td>${escapeHtml(item.model_name) || '—'}</td>
            <td>${escapeHtml(item.model_corporate_id) || '—'}</td>
            <td>${escapeHtml(item.model_manufacturer) || '—'}</td>
            <td>${formatDate(item.assigned_date)}</td>
            <td>${escapeHtml(item.condition_on_assign) || '—'}</td>
          </tr>
        `;
      });
    }
    html = html.replace('{{active_equipment_rows}}', activeRows);

    // ===== История =====
    let historyRows = '';
    if (history.length === 0) {
      historyRows = emptyRow(6, 'История пуста');
    } else {
      history.forEach(item => {
        const statusBadge = item.status === 'active'
          ? '<span class="badge badge-info">Активна</span>'
          : '<span class="badge badge-success">Возвращена</span>';

        historyRows += `
          <tr>
            <td><strong class="font-mono">${escapeHtml(item.inventory_number) || '—'}</strong></td>
            <td>${escapeHtml(item.model_name) || '—'}</td>
            <td>${escapeHtml(item.model_corporate_id) || '—'}</td>
            <td>${formatDate(item.assigned_date)}</td>
            <td>${item.returned_date ? formatDate(item.returned_date) : '—'}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      });
    }
    html = html.replace('{{history_rows}}', historyRows);

    // ===== Сборка страницы =====
    // ===== Сборка страницы =====
    renderPageFor(req, res, {
        title: 'Профиль – MoveIT service',
        content: html,
        pageCss: '/css/profile.css',
        pageJs: '/js/profile.js',
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки профиля:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

/**
 * POST /api/profile/update — обновление профиля
 */
async function updateProfileAPI(req, res) {
  try {
    const userId = req.session.userId;
    const { email, full_name, department, phone } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    await updateUserProfile(userId, {
      email: email.trim(),
      full_name: (full_name || '').trim(),
      department: (department || '').trim(),
      phone: (phone || '').trim(),
    });

    req.session.fullName = full_name;

    await logAction({
      req,
      action: 'profile_update',
      userId: userId,
      details: JSON.stringify({ fields: Object.keys(req.body) }),
    });

    res.json({
      success: true,
      message: 'Профиль обновлён успешно',
    });
  } catch (error) {
    console.error('❌ Ошибка обновления профиля:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        error: 'Этот email уже используется другим пользователем',
      });
    }

    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// ============================================================
// УТИЛИТЫ
// ============================================================

function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function emptyRow(colspan, text) {
  return `
    <tr>
      <td colspan="${colspan}">
        <div class="empty-state">
          <span class="emoji">📭</span>
          <p>${text}</p>
        </div>
      </td>
    </tr>
  `;
}

module.exports = {
  renderProfile,
  updateProfileAPI,
};