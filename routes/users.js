// routes/users.js
const fs = require('fs');
const path = require('path');
const { getUsersWithEquipment, getStats } = require('../database/db');
const { renderPageFor } = require('../utils/layout');

/**
 * GET /users — страница просмотра пользователей
 */
async function renderUsers(req, res) {
  try {
    const users = await getUsersWithEquipment();
    const stats = await getStats();

    const htmlPath = path.join(__dirname, '..', 'views', 'users.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // ===== Статистика =====
    html = html.replace(/\{\{total_users\}\}/g, stats.total_users || 0);
    html = html.replace(/\{\{total_equipment\}\}/g, stats.total_equipment || 0);
    html = html.replace(/\{\{assigned_equipment\}\}/g, stats.assigned_equipment || 0);
    html = html.replace(/\{\{available_equipment\}\}/g, stats.available_equipment || 0);

    // ===== Кнопки для админа =====
    const isAdmin = req.session?.role === 'admin';
    const adminActions = isAdmin
      ? '<a href="/admin/user/add" class="btn btn-success">➕ Добавить пользователя</a>'
      : '';
    html = html.replace('{{admin_actions}}', adminActions);

    // ===== Таблица =====
    let tableRows = '';
    if (users.length === 0) {
      tableRows = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <span class="emoji">📭</span>
              <h3>Пользователей нет</h3>
              <p>Создайте первого пользователя через админ-панель</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      users.forEach(user => {
        const equipmentCount = user.equipment_count || 0;
        const equipmentList = user.equipment_list || '—';
        const fullName = user.full_name || user.username;
        const initials = getInitials(fullName);

        tableRows += `
          <tr data-search="${escapeAttr(
            [user.full_name, user.username, user.email, user.department, user.phone]
              .filter(Boolean).join(' ')
          )}">
            <td><span class="id-badge">${user.id}</span></td>
            <td>
              <div class="user-cell">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                  <div class="user-name">${escapeHtml(fullName)}</div>
                </div>
              </div>
            </td>
            <td><span class="text-mono">${escapeHtml(user.username)}</span></td>
            <td>${escapeHtml(user.email) || '—'}</td>
            <td>${escapeHtml(user.department) || '—'}</td>
            <td>${escapeHtml(user.phone) || '—'}</td>
            <td style="text-align: center;">
              <span class="badge ${equipmentCount > 0 ? 'badge-success' : 'badge-muted'}">
                ${equipmentCount}
              </span>
            </td>
            <td class="equipment-list-cell">${escapeHtml(equipmentList)}</td>
          </tr>
        `;
      });
    }
    html = html.replace('{{user_rows}}', tableRows);

    // ===== Сборка страницы с layout =====
    renderPageFor(req, res, {
      title: 'Пользователи — MoveIT service',
      content: html,
      pageCss: '/css/users.css',
      pageJs: '/js/users.js',
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки страницы пользователей:', error);
    res.status(500).send('Ошибка при загрузке страницы пользователей');
  }
}

// ============================================================
// УТИЛИТЫ
// ============================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(p => p);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

module.exports = renderUsers;