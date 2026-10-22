// routes/manage/users.js
// API пользователей + рендер страниц управления доступом.

const fs = require('fs');
const path = require('path');

const {
  getAllUsers,
  getUserById,
  getUserWithDetails,
  getAllUsersWithDetails,
  createUserWithPassword,
  checkUserExists,
  deleteUserWithEquipmentReturn,
  updateUserPassword,
  setUserActive,
} = require('../../database/db');

const { hashPassword, generateTempPassword, validateUsername, validateEmail } = require('../../utils/auth');
const { logAction } = require('../../utils/logger');
const { renderPageFor } = require('../../utils/layout');
const { escapeHtml, escapeAttr, getInitials, formatDate } = require('./helpers');

// ============================================================
// СТРАНИЦЫ
// ============================================================

async function renderAdminUsers(req, res) {
  try {
    const q = req.query || {};

    // === ПАГИНАЦИЯ ===
    const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];
    const DEFAULT_PAGE_SIZE = 20;
    const requestedLimit = parseInt(q.limit, 10);
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE;
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    // === ФИЛЬТРЫ ===
    const ALLOWED_ROLES = ['admin', 'supervisor', 'mol', 'user'];
    const ALLOWED_STATUSES = ['active', 'blocked'];

    const filters = {
      search: (q.search || '').trim() || null,
      role:   ALLOWED_ROLES.includes(q.role) ? q.role : null,
      status: ALLOWED_STATUSES.includes(q.status) ? q.status : null,
      limit: pageSize,
      offset,
      include_total: true,
    };

    const result = await getAllUsersWithDetails(filters);
    const users = result.items || [];
    const totalFiltered = result.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-users.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // === ДАННЫЕ ===
    let userRows = '';
    users.forEach(user => {
      const equipmentCount = user.active_equipment_count || 0;
      const hasEquipment = equipmentCount > 0;
      const isActive = user.is_active === 1;

      const roleLabels = {
        admin:      { label: '👑 Админ',       cls: 'role-admin' },
        supervisor: { label: '👁️ Супервизор', cls: 'role-supervisor' },
        mol:        { label: '🧑‍💼 МОЛ',        cls: 'role-mol' },
        user:       { label: '👤 Пользователь', cls: 'role-user' },
      };
      const roleInfo = roleLabels[user.role] || { label: user.role, cls: 'role-user' };
      const roleBadge = `<span class="role-badge ${roleInfo.cls}">${escapeHtml(roleInfo.label)}</span>`;

      const statusBadge = isActive
        ? '<span class="status-badge status-available">Активен</span>'
        : '<span class="status-badge status-retired">Заблокирован</span>';

      const lastLogin = user.last_login
        ? escapeHtml(formatDate(user.last_login))
        : '<span style="color: #a0aec0;">никогда</span>';

      userRows += `
        <tr class="user-row-clickable ${!isActive ? 'row-blocked' : ''}" onclick="viewUser(${user.id})">
          <td>${user.id}</td>
          <td>
            <div class="user-cell">
              <span class="user-avatar">${escapeHtml(getInitials(user.full_name || user.username))}</span>
              <div>
                <div class="user-name">${escapeHtml(user.full_name || user.username)}</div>
                <div class="user-username">@${escapeHtml(user.username)}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td>${escapeHtml(user.department || '—')}</td>
          <td>${roleBadge}</td>
          <td><span class="badge-count ${hasEquipment ? 'has-items' : 'no-items'}">${equipmentCount}</span></td>
          <td>${statusBadge}</td>
          <td style="font-size: 12px; color: #666;">${lastLogin}</td>
        </tr>
      `;
    });

    if (users.length === 0) {
      userRows = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 40px; margin-bottom: 10px;">🔍</div>
            <div>Пользователи не найдены</div>
            <div style="font-size: 12px; margin-top: 5px;">Попробуйте изменить фильтры</div>
          </td>
        </tr>
      `;
    }
    html = html.replace('{{user_rows}}', userRows);

    // === СКРЫТЫЕ ===
    html = html.replace(/\{\{current_user_id\}\}/g, req.session.userId || 0);

    // === ФИЛЬТРЫ: роли ===
    const roleOptions = [
      { value: '', label: 'Все роли' },
      { value: 'admin', label: '👑 Админ' },
      { value: 'supervisor', label: '👁️ Супервизор' },
      { value: 'mol', label: '🧑‍💼 МОЛ' },
      { value: 'user', label: '👤 Пользователь' },
    ];
    let roleOpts = '';
    roleOptions.forEach(opt => {
      const sel = opt.value === (filters.role || '') ? 'selected' : '';
      roleOpts += `<option value="${opt.value}" ${sel}>${opt.label}</option>`;
    });
    html = html.replace('{{filter_role_options}}', roleOpts);

    // === ФИЛЬТРЫ: статус ===
    const statusOptions = [
      { value: '', label: 'Все статусы' },
      { value: 'active', label: '✅ Активен' },
      { value: 'blocked', label: '🚫 Заблокирован' },
    ];
    let statusOpts = '';
    statusOptions.forEach(opt => {
      const sel = opt.value === (filters.status || '') ? 'selected' : '';
      statusOpts += `<option value="${opt.value}" ${sel}>${opt.label}</option>`;
    });
    html = html.replace('{{filter_status_options}}', statusOpts);

    // === ФИЛЬТРЫ: поиск ===
    html = html.replace(/\{\{search_value\}\}/g, escapeHtml(filters.search || ''));

    // === РАЗМЕР СТРАНИЦЫ ===
    let pageSizeOptions = '';
    ALLOWED_PAGE_SIZES.forEach(size => {
      const sel = size === pageSize ? 'selected' : '';
      pageSizeOptions += `<option value="${size}" ${sel}>${size}</option>`;
    });
    html = html.replace('{{page_size_options}}', pageSizeOptions);

    // === ПАГИНАЦИЯ ===
    html = html.replace('{{pagination}}', renderUsersPagination({
      page, totalPages, totalFiltered, query: q,
    }));

    renderPageFor(req, res, {
      title: 'Управление доступом – MoveIT service',
      content: html,
      pageCss: [
        '/css/manage/table.css',
        '/css/manage/card.css',
        '/css/manage/actions.css',
        '/css/manage/modals.css',
        '/css/manage/responsive.css',
      ],
      pageJs: [
        '/js/equipment-view.js',
        '/js/admin-users.js',
      ],
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки страницы управления доступом:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

function renderAddUser(req, res) {
  try {
    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-user-add.html');
    const content = fs.readFileSync(htmlPath, 'utf8');

    renderPageFor(req, res, {
      title: 'Добавить пользователя – MoveIT service',
      content,
      pageJs: '/js/admin-user-add.js',
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки страницы добавления пользователя:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

async function renderEditUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserById(id);

    if (!user) {
      return res.status(404).send('Пользователь не найден');
    }

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-user-edit.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    content = content.replace(/\{\{id\}\}/g, user.id);
    content = content.replace(/\{\{username\}\}/g, escapeHtml(user.username || ''));
    content = content.replace(/\{\{email\}\}/g, escapeHtml(user.email || ''));
    content = content.replace(/\{\{full_name\}\}/g, escapeHtml(user.full_name || ''));
    content = content.replace(/\{\{department\}\}/g, escapeHtml(user.department || ''));
    content = content.replace(/\{\{phone\}\}/g, escapeHtml(user.phone || ''));
    content = content.replace(/\{\{role\}\}/g, user.role || 'user');

    const { db } = require('../../database/db');

    const allWarehouses = await new Promise((resolve, reject) => {
      db.all(`SELECT id, name, is_default FROM warehouses WHERE is_active = 1 ORDER BY is_default DESC, name`,
        (err, rows) => err ? reject(err) : resolve(rows || []));
    });
    const allOffices = await new Promise((resolve, reject) => {
      db.all(`SELECT id, name, is_default FROM offices WHERE is_active = 1 ORDER BY is_default DESC, name`,
        (err, rows) => err ? reject(err) : resolve(rows || []));
    });
    const userWarehouseIds = await new Promise((resolve, reject) => {
      db.all(`SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ?`, [id],
        (err, rows) => err ? reject(err) : resolve((rows || []).map(r => r.warehouse_id)));
    });
    const userOfficeIds = await new Promise((resolve, reject) => {
      db.all(`SELECT office_id FROM office_responsibles WHERE user_id = ?`, [id],
        (err, rows) => err ? reject(err) : resolve((rows || []).map(r => r.office_id)));
    });

    let warehouseCheckboxes = '';
    if (allWarehouses.length === 0) {
      warehouseCheckboxes = '<div class="mol-empty">Нет активных складов</div>';
    } else {
      allWarehouses.forEach(w => {
        const checked = userWarehouseIds.includes(w.id) ? 'checked' : '';
        const star = w.is_default ? ' ⭐' : '';
        warehouseCheckboxes += `
          <label class="mol-checkbox-item">
            <input type="checkbox" value="${w.id}" ${checked}>
            <span>${escapeHtml(w.name)}${star}</span>
          </label>
        `;
      });
    }

    let officeCheckboxes = '';
    if (allOffices.length === 0) {
      officeCheckboxes = '<div class="mol-empty">Нет активных офисов</div>';
    } else {
      allOffices.forEach(o => {
        const checked = userOfficeIds.includes(o.id) ? 'checked' : '';
        const star = o.is_default ? ' ⭐' : '';
        officeCheckboxes += `
          <label class="mol-checkbox-item">
            <input type="checkbox" value="${o.id}" ${checked}>
            <span>${escapeHtml(o.name)}${star}</span>
          </label>
        `;
      });
    }

    content = content.replace('{{warehouse_checkboxes}}', warehouseCheckboxes);
    content = content.replace('{{office_checkboxes}}', officeCheckboxes);

    renderPageFor(req, res, {
      title: 'Редактировать пользователя – MoveIT service',
      content,
      pageJs: '/js/admin-user-edit.js',
    });
  } catch (error) {
    console.error('❌ Ошибка при загрузке страницы редактирования пользователя:', error);
    res.status(500).send('Ошибка при загрузке страницы');
  }
}

// ============================================================
// API
// ============================================================

async function getUsersAPI(req, res) {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getUserByIdAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getUserDetailsAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserWithDetails(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const { getUserActiveEquipment, getUserEquipmentHistory } = require('../../database/db');
    const activeEquipment = await getUserActiveEquipment(id);
    const history = await getUserEquipmentHistory(id);

    const stats = {
      active: activeEquipment.length,
      total: history.length,
      returned: history.filter(h => h.returned_date).length,
    };

    delete user.password_hash;
    res.json({ user, stats, activeEquipment, history: history.slice(0, 30) });
  } catch (error) {
    console.error('❌ Ошибка получения деталей:', error);
    res.status(500).json({ error: error.message });
  }
}

async function addUserAPI(req, res) {
  try {
    const { username, email, full_name, department, phone, role } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Логин и email обязательны' });
    }

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      return res.status(400).json({ error: usernameCheck.errors.join('. ') });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.errors.join('. ') });
    }

    const existing = await checkUserExists(username.trim(), email.trim());
    if (existing) {
      if (existing.username === username.trim()) {
        return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
      }
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const ALLOWED_ROLES = ['admin', 'supervisor', 'mol', 'user'];
    const userRole = ALLOWED_ROLES.includes(role) ? role : 'user';
    const tempPassword = generateTempPassword(12);
    const passwordHash = await hashPassword(tempPassword);

    const result = await createUserWithPassword({
      username: username.trim(),
      email: email.trim(),
      full_name: (full_name || '').trim(),
      department: (department || '').trim(),
      phone: (phone || '').trim(),
      password_hash: passwordHash,
      role: userRole,
      must_change_password: 1,
    });

    await logAction({
      req, action: 'user_create', entityType: 'user', entityId: result.id,
      details: JSON.stringify({ username: username.trim(), role: userRole }),
    });

    res.json({
      success: true,
      message: 'Пользователь создан успешно',
      data: { id: result.id, username: username.trim(), email: email.trim(), full_name, role: userRole },
      tempPassword,
      warning: 'Сохраните пароль! Он больше не будет показан.',
    });
  } catch (error) {
    console.error('❌ Ошибка создания пользователя:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateUserAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { username, email, full_name, department, phone, role } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Логин и email обязательны' });
    }

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      return res.status(400).json({ error: usernameCheck.errors.join('. ') });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.errors.join('. ') });
    }

    const existing = await checkUserExists(username.trim(), email.trim(), id);
    if (existing) {
      if (existing.username === username.trim()) {
        return res.status(400).json({ error: 'Логин уже используется' });
      }
      return res.status(400).json({ error: 'Email уже используется' });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const ALLOWED_ROLES = ['admin', 'supervisor', 'mol', 'user'];
    const newRole = ALLOWED_ROLES.includes(role) ? role : user.role;

    if (user.role === 'admin' && newRole === 'user') {
      const { db } = require('../../database/db');
      const adminCount = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`,
          (err, row) => err ? reject(err) : resolve(row.count));
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Нельзя изменить роль последнего администратора' });
      }
    }

    const { db } = require('../../database/db');
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users
         SET username = ?, email = ?, full_name = ?, department = ?, phone = ?, role = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [username.trim(), email.trim(), full_name || '', department || '', phone || '', newRole, id],
        function(err) { if (err) reject(err); else resolve(this.changes); }
      );
    });

    if (newRole === 'mol') {
      const warehouseIds = Array.isArray(req.body.warehouse_ids)
        ? req.body.warehouse_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
        : [];
      const officeIds = Array.isArray(req.body.office_ids)
        ? req.body.office_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
        : [];

      await new Promise((resolve, reject) => {
        db.run('DELETE FROM warehouse_responsibles WHERE user_id = ?', [id],
          (err) => err ? reject(err) : resolve());
      });
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM office_responsibles WHERE user_id = ?', [id],
          (err) => err ? reject(err) : resolve());
      });

      for (const wid of warehouseIds) {
        await new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO warehouse_responsibles (warehouse_id, user_id) VALUES (?, ?)',
            [wid, id], (err) => err ? reject(err) : resolve());
        });
      }
      for (const oid of officeIds) {
        await new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO office_responsibles (office_id, user_id) VALUES (?, ?)',
            [oid, id], (err) => err ? reject(err) : resolve());
        });
      }
    } else {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM warehouse_responsibles WHERE user_id = ?', [id],
          (err) => err ? reject(err) : resolve());
      });
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM office_responsibles WHERE user_id = ?', [id],
          (err) => err ? reject(err) : resolve());
      });
    }

    await logAction({
      req, action: 'user_update', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: username.trim(), role_changed: user.role !== newRole }),
    });

    res.json({ success: true, message: 'Пользователь обновлён успешно' });
  } catch (error) {
    console.error('❌ Ошибка обновления:', error);
    res.status(500).json({ error: error.message });
  }
}

async function deleteUserAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'Нельзя удалить себя' });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.role === 'admin') {
      const { db } = require('../../database/db');
      const adminCount = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`,
          (err, row) => err ? reject(err) : resolve(row.count));
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
      }
    }

    const result = await deleteUserWithEquipmentReturn(id);

    await logAction({
      req, action: 'user_delete', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: user.username, equipment_returned: result.equipment_returned }),
    });

    res.json({
      success: true,
      message: `Пользователь удалён. Возвращено техники: ${result.equipment_returned}`,
      data: result,
    });
  } catch (error) {
    console.error('❌ Ошибка удаления:', error);
    res.status(500).json({ error: error.message });
  }
}

async function resetUserPasswordAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const tempPassword = generateTempPassword(12);
    const passwordHash = await hashPassword(tempPassword);
    await updateUserPassword(id, passwordHash, 1);

    await logAction({
      req, action: 'user_password_reset', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: user.username }),
    });

    res.json({
      success: true,
      message: `Пароль пользователя "${user.full_name || user.username}" сброшен`,
      tempPassword,
      warning: 'Передайте пароль пользователю. Он должен сменить его при следующем входе.',
    });
  } catch (error) {
    console.error('❌ Ошибка сброса пароля:', error);
    res.status(500).json({ error: error.message });
  }
}

async function blockUserAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'Нельзя заблокировать себя' });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.role === 'admin') {
      const { db } = require('../../database/db');
      const adminCount = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`,
          (err, row) => err ? reject(err) : resolve(row.count));
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Нельзя заблокировать последнего администратора' });
      }
    }

    await setUserActive(id, false);

    await logAction({
      req, action: 'user_block', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: user.username }),
    });

    res.json({ success: true, message: `Пользователь "${user.full_name || user.username}" заблокирован` });
  } catch (error) {
    console.error('❌ Ошибка блокировки:', error);
    res.status(500).json({ error: error.message });
  }
}

async function unblockUserAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await setUserActive(id, true);

    await logAction({
      req, action: 'user_unblock', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: user.username }),
    });

    res.json({ success: true, message: `Пользователь "${user.full_name || user.username}" разблокирован` });
  } catch (error) {
    console.error('❌ Ошибка разблокировки:', error);
    res.status(500).json({ error: error.message });
  }
}

// Пагинация страницы с таблицей пользователей

function renderUsersPagination({ page, totalPages, totalFiltered, query }) {
  if (totalPages <= 1) {
    return `<div class="pagination"><span class="pagination-info">Всего: ${totalFiltered}</span></div>`;
  }
  const buildUrl = (p) => {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([k, v]) => {
      if (k !== 'page' && v) params.set(k, v);
    });
    params.set('page', p);
    return '/admin/users?' + params.toString();
  };
  let html = '<div class="pagination">';
  html += `<span class="pagination-info">Страница ${page} из ${totalPages} (всего: ${totalFiltered})</span>`;
  html += '<div class="pagination-buttons">';
  if (page > 1) html += `<a href="${buildUrl(page - 1)}" class="pagination-btn">← Назад</a>`;
  if (page < totalPages) html += `<a href="${buildUrl(page + 1)}" class="pagination-btn">Вперёд →</a>`;
  html += '</div></div>';
  return html;
}

module.exports = {
  renderAdminUsers,
  renderAddUser,
  renderEditUser,
  getUsersAPI,
  getUserByIdAPI,
  getUserDetailsAPI,
  addUserAPI,
  updateUserAPI,
  deleteUserAPI,
  resetUserPasswordAPI,
  blockUserAPI,
  unblockUserAPI,
};