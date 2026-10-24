const fs = require('fs');
const path = require('path');

const {
  getUserById,
  getAllUsersWithDetails,
  getWarehousesForFilter,
  getOfficesForFilter,
  getUserWarehouseResponsibles,
  getUserOfficeResponsibles,
  // + то, что реально используется в renderAdminUsers / renderEditUser
  //   (getUserWithDetails? getAllWarehouses? getAllOffices?
  //    — проверь по факту, но в renderEditUser уже используется require('../../database/db').db)
} = require('../../../database/db');

const { renderPageFor } = require('../../../utils/layout');
const { escapeHtml, escapeAttr, getInitials, formatDate } = require('../helpers');

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

    const htmlPath = path.join(__dirname, '..', '..','..', 'views', 'admin-users.html');
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
    const htmlPath = path.join(__dirname, '..', '..','..', 'views', 'admin-user-add.html');
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

    const htmlPath = path.join(__dirname, '..', '..','..', 'views', 'admin-user-edit.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    content = content.replace(/\{\{id\}\}/g, user.id);
    content = content.replace(/\{\{username\}\}/g, escapeHtml(user.username || ''));
    content = content.replace(/\{\{email\}\}/g, escapeHtml(user.email || ''));
    content = content.replace(/\{\{full_name\}\}/g, escapeHtml(user.full_name || ''));
    content = content.replace(/\{\{department\}\}/g, escapeHtml(user.department || ''));
    content = content.replace(/\{\{phone\}\}/g, escapeHtml(user.phone || ''));
    content = content.replace(/\{\{role\}\}/g, user.role || 'user');

    const allWarehouses = await getWarehousesForFilter({ role: 'admin' });
    const allOffices = await getOfficesForFilter({ role: 'admin' });
    const userWarehouseIds = await getUserWarehouseResponsibles(id);
    const userOfficeIds = await getUserOfficeResponsibles(id);

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
};