// routes/admin.js
// Админ-панель: управление техникой, пользователями, логами

const fs = require('fs');
const path = require('path');
const {
  // Equipment
  getAllEquipment,
  getEquipmentById,
  getEquipmentWithUsers,
  getEquipmentWithLocation,
  addEquipment,
  updateEquipment,
  deleteEquipment,
  assignEquipment,
  returnEquipmentByEquipmentId,
  // Equipment models
  getAllModels,
  // Users
  getAllUsers,
  getUserById,
  getUserWithDetails,
  getAllUsersWithDetails,
  createUserWithPassword,
  checkUserExists,
  deleteUserWithEquipmentReturn,
  updateUserPassword,
  setUserActive,
  getMolsForFilter,   // 🆕
    // Catalog
  getAllCategories,     // 🆕
  getAllTypes,          // 🆕
  // Logs
  getActivityLogs,
  getActivityLogsCount,
  getUniqueActions,
  getActivityStats,
  getActivityByDay,
  cleanOldLogs,
  // Stats
  getStats,
  // Move
  moveEquipmentToCellDetailed,
  getEquipmentMoves,
  checkCellAvailability,
} = require('../database/db');

// Утилиты
const { 
  hashPassword, 
  generateTempPassword,
  validateUsername,
  validateEmail,
} = require('../utils/auth');

const { logAction } = require('../utils/logger');

// Layout
const { renderPage, renderPageFor } = require('../utils/layout');

const {
  canAccessEquipment,
  canEditEquipment,
  canEditWarehouse,
  canEditOffice,
  canMoveEquipmentTo,   // 🆕
} = require('../utils/permissions');

// ============================================================
// СТРАНИЦЫ
// ============================================================

/**
 * GET /admin — страница «Учёт ТМЦ».
 * Пользователи больше не рендерятся здесь (переехали в /admin/users).
 */

async function renderAdmin(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const currentRole = req.session.role;
    const q = req.query || {};

    // === ПАГИНАЦИЯ ===
    const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];
    const DEFAULT_PAGE_SIZE = 10;
    const requestedLimit = parseInt(q.limit, 10);
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE;
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    // === СОРТИРОВКА ===
    const ALLOWED_SORTS = [
      'id', 'inventory_number', 'model_name', 'corporate_id',
      'category', 'type', 'status', 'responsible', 'location',
      'created_at', 'purchase_date',
    ];
    const sort = ALLOWED_SORTS.includes(q.sort) ? q.sort : 'id';
    const order = (String(q.order).toLowerCase() === 'desc') ? 'desc' : 'asc';

    // === ФИЛЬТРЫ ===
    const filters = {
      category_id:  q.category_id  ? parseInt(q.category_id, 10)  : null,
      type_id:      q.type_id      ? parseInt(q.type_id, 10)      : null,
      status:       q.status       || null,
      mol_id:       q.mol_id       ? parseInt(q.mol_id, 10)       : null,
      corporate_id: (q.corporate_id || '').trim() || null,
      model_name:   (q.model_name   || '').trim() || null,
      search:       (q.search       || '').trim() || null,
      sort,
      order,
      limit: pageSize,
      offset,
      include_total: true,
    };

    // === ДАННЫЕ ===
    const [stats, result, categories, types, mols] = await Promise.all([
      getStats(scope),
      getEquipmentWithLocation(filters, scope),
      getAllCategories(),
      getAllTypes(),
      currentRole === 'admin' ? getMolsForFilter() : Promise.resolve([]),
    ]);

    const equipment = result.items || [];
    const totalFiltered = result.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

    const htmlPath = path.join(__dirname, '..', 'views', 'manage.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // === СТАТИСТИКА ===
    html = html.replace(/\{\{total_equipment\}\}/g, stats.total_equipment || 0);
    html = html.replace(/\{\{available_equipment\}\}/g, stats.available_equipment || 0);
    html = html.replace(/\{\{assigned_equipment\}\}/g, stats.assigned_equipment || 0);
    html = html.replace(/\{\{total_users\}\}/g, stats.total_users || 0);

    // === РОЛЬ ===
    html = html.replace(/\{\{current_role\}\}/g, currentRole || 'user');
    html = html.replace(/\{\{current_user_id\}\}/g, req.session.userId || 0);

    // === PAGE ACTIONS ===
    let pageActions = '';
    if (currentRole === 'admin' || currentRole === 'supervisor') {
      pageActions += `<a href="/admin/catalog" class="btn btn-ghost btn-sm" title="Управление категориями и типами">📚 Справочник</a>`;
      pageActions += `<a href="/admin/warehouses" class="btn btn-ghost btn-sm" title="Управление складами">🏢 Склады</a>`;
      pageActions += `<a href="/admin/inventory" class="btn btn-ghost btn-sm" title="Инвентаризация">📊 Инвентаризация</a>`;
    }
    if (currentRole === 'admin') {
      pageActions += `<a href="/manage/import" class="btn btn-success btn-sm">📥 Импорт</a>`;
      pageActions += `<a href="/admin/logs" class="btn btn-ghost btn-sm">📈 Логи</a>`;
    }
    html = html.replace('{{page_actions}}', pageActions);

    // === КОЛОНКА «Ответственный МОЛ» ===
    const responsibleTh = (currentRole === 'admin' || currentRole === 'supervisor')
      ? '<th style="width: 150px;">Ответственный МОЛ</th>'
      : '';
    html = html.replace('{{responsible_th}}', responsibleTh);

    // === ФИЛЬТРЫ ===
    // Категории
    let categoryOptions = '<option value="">Все категории</option>';
    categories.forEach(c => {
      const sel = String(c.id) === String(filters.category_id) ? 'selected' : '';
      categoryOptions += `<option value="${c.id}" ${sel}>${c.icon || '📁'} ${escapeHtml(c.name)}</option>`;
    });
    html = html.replace('{{filter_category_options}}', categoryOptions);

    // Типы (по выбранной категории)
    let typeOptions = '<option value="">Все типы</option>';
    const filteredTypes = filters.category_id
      ? types.filter(t => Number(t.category_id) === filters.category_id)
      : types;
    filteredTypes.forEach(t => {
      const sel = String(t.id) === String(filters.type_id) ? 'selected' : '';
      typeOptions += `<option value="${t.id}" ${sel}>${t.icon || '📦'} ${escapeHtml(t.name)}</option>`;
    });
    html = html.replace('{{filter_type_options}}', typeOptions);

    // МОЛы (только admin)
    let molOptions = '';
    if (currentRole === 'admin') {
      molOptions = '<option value="">Все МОЛы</option>';
      mols.forEach(m => {
        const sel = String(m.id) === String(filters.mol_id) ? 'selected' : '';
        molOptions += `<option value="${m.id}" ${sel}>${escapeHtml(m.full_name || m.username)}</option>`;
      });
    }
    html = html.replace('{{filter_mol_options}}', molOptions);

    // Значения текстовых полей
    html = html.replace(/\{\{filter_corporate_id\}\}/g, escapeHtml(filters.corporate_id || ''));
    html = html.replace(/\{\{filter_model_name\}\}/g, escapeHtml(filters.model_name || ''));
    html = html.replace(/\{\{filter_search\}\}/g, escapeHtml(filters.search || ''));

    // Селект размера страницы
    let pageSizeOptions = '';
    ALLOWED_PAGE_SIZES.forEach(size => {
      const sel = size === pageSize ? 'selected' : '';
      pageSizeOptions += `<option value="${size}" ${sel}>${size}</option>`;
    });
    html = html.replace('{{page_size_options}}', pageSizeOptions);

    // === СОРТИРУЕМЫЕ ЗАГОЛОВКИ ===
    const th = (col, label) => sortableTh(col, label, sort, order, q);

    // === Плейсхолдер отрисовки чекбокса в таблице техники ===
    const thCheckbox = (currentRole === 'admin' || currentRole === 'mol')
      ? `<th style="width: 40px; text-align: center;">
          <input type="checkbox" id="selectAll" onclick="toggleSelectAll(this)">
        </th>`
      : '';
    html = html.replace('{{th_checkbox}}', thCheckbox);

    html = html.replace('{{th_id}}',          th('id', 'ID'));
    html = html.replace('{{th_inventory}}',   th('inventory_number', 'Инв. №'));
    html = html.replace('{{th_model}}',       th('model_name', 'Модель'));
    html = html.replace('{{th_corporate}}',   th('corporate_id', 'Корп. ИД'));
    html = html.replace('{{th_category}}',    th('category', 'Категория'));
    html = html.replace('{{th_type}}',        th('type', 'Тип'));
    html = html.replace('{{th_location}}',    th('location', 'Место хранения'));
    html = html.replace('{{th_status}}',      th('status', 'Статус'));
    html = html.replace('{{th_assigned}}',    '<th style="width: 170px;">Назначена</th>');
    html = html.replace('{{th_responsible}}',
      (currentRole === 'admin' || currentRole === 'supervisor')
      ? th('responsible', 'Ответственный МОЛ')
      : ''
    );

    // === СТРОКИ ТАБЛИЦЫ ===
    let equipmentRows = '';

    if (equipment.length === 0) {
      const colspan = (currentRole === 'admin' || currentRole === 'supervisor') ? 10 : 9;
      equipmentRows = `
        <tr>
          <td colspan="${colspan}" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 40px; margin-bottom: 10px;">🔍</div>
            <div>Ничего не найдено</div>
            <div style="font-size: 12px; margin-top: 5px;">Попробуйте изменить фильтры</div>
          </td>
        </tr>
      `;
    } else {
      equipment.forEach(item => {
        const canBulkMove = (currentRole === 'admin' || currentRole === 'mol');  // может ли юзер видеть чекбксы группового перемещения
        const statusClass = `status-${item.status}`;

        const canEditThis = currentRole === 'admin'
          || (currentRole === 'mol' && Number(item.responsible_user_id) === Number(req.session.userId));

        // Информация о назначении
        let assignedInfo = '—';
        if (item.status === 'assigned' && item.user_name) {
          const initials = getInitials(item.user_name);
          assignedInfo = `
            <div class="assigned-cell">
              <span class="assigned-avatar">${initials}</span>
              <div class="assigned-info">
                <div class="assigned-name">${item.user_name}</div>
                ${item.user_department ? `<div class="assigned-dept">${item.user_department}</div>` : ''}
              </div>
            </div>
          `;
        } else if (item.status === 'assigned') {
          assignedInfo = '<span style="color: #a0aec0; font-size: 12px;">не найдено</span>';
        }

        const categoryCell = item.category_name
          ? `<span class="catalog-badge">${item.category_icon || '📁'} ${item.category_name}</span>`
          : '<span style="color: #cbd5e0;">—</span>';

        const typeCell = item.type_name
          ? `<span class="catalog-badge type">${item.type_icon || '📦'} ${item.type_name}</span>`
          : '<span style="color: #cbd5e0;">—</span>';

        let cellInfo = '<span style="color: #cbd5e0;">—</span>';
        if (item.cell_id) {
          cellInfo = `<div class="location-cell" title="${item.warehouse_name} → ${item.zone_name} → ${item.rack_name} → ${item.cell_name}">
              <div class="location-cell-code">${item.cell_code || item.cell_name}</div>
              <div class="location-path" style="font-size: 10px;">${item.warehouse_name}</div>
            </div>`;
        } else if (item.workplace_id) {
          const wpLabel = `${item.workplace_name || 'Место'}${item.workplace_code ? ` [${item.workplace_code}]` : ''}`;
          const officeLabel = item.office_name || '';
          const link = item.office_id
            ? `/admin/workplaces/${item.office_id}?highlightWorkplace=${item.workplace_id}`
            : '#';
          cellInfo = `<div class="location-cell">
              <a href="${link}" class="location-cell-code" style="background: var(--purple-bg); color: var(--purple); text-decoration: none;" title="Открыть в дереве офиса">🪑 ${wpLabel}</a>
              <div class="location-path" style="font-size: 10px;">${officeLabel}</div>
            </div>`;
        }

        const statusLabels = {
          'available':   '✅ Доступна',
          'placed':      '🪑 На рабочем месте',
          'assigned':    '👤 Назначена',
          'maintenance': '🔧 В ремонте',
          'retired':     '❌ Списана',
        };
        const statusLabel = statusLabels[item.status] || item.status;

        // Ответственный МОЛ — ячейка (admin / supervisor)
        let responsibleCell = '';
        if (currentRole === 'admin' || currentRole === 'supervisor') {
          if (item.responsible_user_name) {
            const initials = getInitials(item.responsible_user_name);
            responsibleCell = `<td>
              <div class="assigned-cell">
                <span class="assigned-avatar" style="background: linear-gradient(135deg, var(--purple) 0%, var(--accent) 100%);">${initials}</span>
                <div class="assigned-info">
                  <div class="assigned-name">${item.responsible_user_name}</div>
                </div>
              </div>
            </td>`;
          } else {
            responsibleCell = `<td><span style="color: #cbd5e0;">—</span></td>`;
          }
        }

        equipmentRows += `
          <tr class="equipment-row-clickable" onclick="viewEquipment(${item.id})">
            ${canBulkMove ? `
              <td onclick="event.stopPropagation()" style="text-align: center;">
                <input type="checkbox" class="row-checkbox" value="${item.id}" onclick="event.stopPropagation(); updateSelectedCount()">
              </td>
            ` : ''}
            <td>${item.id}</td>
            <td><strong>${item.inventory_number || '—'}</strong></td>
            <td>${item.model_name || '—'}</td>
            <td>${item.model_corporate_id || '—'}</td>
            <td>${categoryCell}</td>
            <td>${typeCell}</td>
            <td>${cellInfo}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td>${assignedInfo}</td>
            ${responsibleCell}
          </tr>
        `;
      });
    }
    html = html.replace('{{equipment_rows}}', equipmentRows);

    // === ПАГИНАЦИЯ ===
    html = html.replace('{{pagination}}', renderManagePagination({
      page, totalPages, totalFiltered, query: q,
    }));

    // === РЕНДЕР (через renderPageFor) ===
    renderPageFor(req, res, {
      title: 'Учёт ТМЦ – MoveIT service',
      content: html,
      pageCss: '/css/manage.css',
      pageJs: '/js/manage.js',
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки страницы учёта ТМЦ:', error);
    res.status(500).send('Ошибка при загрузке страницы учёта ТМЦ');
  }
}

/**
 * GET /admin/users — управление доступом (только admin).
 * Рендерит список пользователей с CRUD-действиями.
 */
async function renderAdminUsers(req, res) {
  try {
    const users = await getAllUsersWithDetails();

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-users.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    let userRows = '';
    users.forEach(user => {
      const equipmentCount = user.active_equipment_count || 0;
      const hasEquipment = equipmentCount > 0;
      const isActive = user.is_active === 1;

      // 🆕 Роль — 4 варианта
      const roleLabels = {
        admin:      { label: '👑 Админ',       cls: 'role-admin' },
        supervisor: { label: '👁️ Супервизор', cls: 'role-supervisor' },
        mol:        { label: '🧑‍💼 МОЛ',        cls: 'role-mol' },
        user:       { label: '👤 Пользователь', cls: 'role-user' },
      };
      const roleInfo = roleLabels[user.role] || { label: user.role, cls: 'role-user' };
      const roleBadge = `<span class="role-badge ${roleInfo.cls}">${roleInfo.label}</span>`;

      const statusBadge = isActive
        ? '<span class="status-badge status-available">Активен</span>'
        : '<span class="status-badge status-retired">Заблокирован</span>';

      const lastLogin = user.last_login
        ? formatDate(user.last_login)
        : '<span style="color: #a0aec0;">никогда</span>';

      const blockButton = isActive
        ? `<button onclick="blockUser(${user.id})" class="btn-icon btn-warning" title="Заблокировать">🚫</button>`
        : `<button onclick="unblockUser(${user.id})" class="btn-icon btn-success" title="Разблокировать">✅</button>`;

      userRows += `
        <tr class="${!isActive ? 'row-blocked' : ''}">
          <td>${user.id}</td>
          <td>
            <div class="user-cell">
              <span class="user-avatar">${getInitials(user.full_name || user.username)}</span>
              <div>
                <div class="user-name">${user.full_name || user.username}</div>
                <div class="user-username">@${user.username}</div>
              </div>
            </div>
          </td>
          <td>${user.email}</td>
          <td>${user.department || '—'}</td>
          <td>${roleBadge}</td>
          <td><span class="badge-count ${hasEquipment ? 'has-items' : 'no-items'}">${equipmentCount}</span></td>
          <td>${statusBadge}</td>
          <td style="font-size: 12px; color: #666;">${lastLogin}</td>
          <td>
            <div class="action-buttons">
              <button onclick="viewUser(${user.id})" class="btn-icon btn-info" title="Просмотр">👁️</button>
              <button onclick="editUser(${user.id})" class="btn-icon btn-edit" title="Редактировать">✏️</button>
              <button onclick="resetUserPassword(${user.id}, '${user.username}')" class="btn-icon btn-warning" title="Сбросить пароль">🔑</button>
              ${blockButton}
              <button onclick="deleteUser(${user.id}, '${escapeAttr(user.full_name || user.username)}')" class="btn-icon btn-delete" title="Удалить">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });
    html = html.replace('{{user_rows}}', userRows);

    const fullHtml = renderPage({
      title: 'Управление доступом – MoveIT service',
      content: html,
      pageCss: '/css/admin.css',
      pageJs: '/js/admin-users.js',
      user: { id: req.session.userId, role: req.session.role, username: req.session.username, fullName: req.session.fullName },
    });

    res.send(fullHtml);
  } catch (error) {
    console.error('❌ Ошибка загрузки страницы управления доступом:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

// ============================================================
// API — ТЕХНИКА
// ============================================================

async function getEquipmentAPI(req, res) {
  try {
    const equipment = await getAllEquipment();
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getEquipmentByIdAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const equipment = await getEquipmentById(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/equipment — создать экземпляр.
 * Принимает: model_id, inventory_number, serial_number,
 *            status, cell_id, workplace_id,
 *            purchase_date, warranty_until, description.
 */
async function addEquipmentAPI(req, res) {
  try {
    const {
      model_id,
      inventory_number,
      serial_number,
      status,
      description,
      purchase_date,
      warranty_until,
      cell_id,
      workplace_id,
    } = req.body;

    if (!model_id) {
      return res.status(400).json({ error: 'Модель ТМЦ обязательна' });
    }

    // 🆕 Этап 4: определяем ответственного МОЛ.
    //   admin — из формы (responsible_user_id);
    //   mol   — всегда он сам;
    //   иначе — null (не должно случаться на этом роуте).
    let responsibleUserId = null;
    if (req.session.role === 'mol') {
      responsibleUserId = req.session.userId;
    } else if (req.body.responsible_user_id) {
      responsibleUserId = parseInt(req.body.responsible_user_id, 10);
    }

    const result = await addEquipment({
      model_id: parseInt(model_id, 10),
      inventory_number: inventory_number || null,
      serial_number: serial_number || null,
      status: status || 'available',
      description: description || null,
      purchase_date: purchase_date || null,
      warranty_until: warranty_until || null,
      cell_id: cell_id ? parseInt(cell_id, 10) : null,
      workplace_id: workplace_id ? parseInt(workplace_id, 10) : null,
      responsible_user_id: responsibleUserId,   // 🆕
    });

    await logAction({
      req,
      action: 'equipment_create',
      entityType: 'equipment',
      entityId: result.id,
      details: JSON.stringify({
        inventory_number: inventory_number || null,
        model_id: parseInt(model_id, 10),
      }),
    });

    res.json({
      success: true,
      message: 'Техника добавлена успешно',
      data: result,
    });
  } catch (error) {
    if (error.message.includes('уже используется')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('Модель не найдена')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        error: 'Инвентарный или серийный номер уже используется',
      });
    }
    console.error('❌ Ошибка создания техники:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * PUT /api/admin/equipment/:id — обновить экземпляр.
 * Принимает те же поля + assign_user_id / assign_condition (при status=assigned).
 */
async function updateEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const {
      model_id,
      inventory_number,
      serial_number,
      status,
      description,
      purchase_date,
      warranty_until,
      cell_id,
      workplace_id,
      assign_user_id,
      assign_condition,
      responsible_user_id,   // 🆕 Этап 4
    } = req.body;

    if (!model_id) {
      return res.status(400).json({ error: 'Модель ТМЦ обязательна' });
    }

    // Получаем текущую технику
    const existing = await getEquipmentById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    // 🆕 Этап 4: МОЛ может редактировать только свои экземпляры.
    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canEditEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const oldStatus = existing.status;
    const oldResponsibleId = existing.responsible_user_id;

    // 🆕 Этап 4: определяем ответственного МОЛа.
    //   admin — из формы (может быть null, чтобы снять ответственного);
    //   mol   — всегда он сам (не даём снять/сменить);
    //   supervisor / user — не должно случаться (роут под requireRole).
    let finalResponsibleId = undefined;   // undefined = «не трогать»
    if (req.session.role === 'admin') {
      // Пустая строка / отсутствие поля → null (снять ответственного)
      finalResponsibleId = responsible_user_id
        ? parseInt(responsible_user_id, 10)
        : null;
    } else if (req.session.role === 'mol') {
      finalResponsibleId = req.session.userId;
    }
    // Для supervisor / user — оставляем undefined (не трогаем),
    // но эти роли до сюда не дойдут из-за requireRole.

    // Финальные значения места
    let finalCellId = cell_id ? parseInt(cell_id, 10) : null;
    let finalWorkplaceId = workplace_id ? parseInt(workplace_id, 10) : null;

    // Взаимоисключение
    if (finalWorkplaceId) finalCellId = null;
    if (finalCellId) finalWorkplaceId = null;

    // assigned — без места
    if (status === 'assigned') {
      finalCellId = null;
      finalWorkplaceId = null;
    }

    // maintenance / retired — нельзя на рабочем месте
    if (status === 'maintenance' || status === 'retired') {
      finalWorkplaceId = null;
    }

    // Согласование статуса и расположения
    let finalStatus = status || 'available';
    if (finalStatus === 'placed' && !finalWorkplaceId) {
      finalStatus = 'available';
    } else if (finalStatus === 'available' && finalWorkplaceId) {
      finalStatus = 'placed';
    }

    // Проверка ячейки — только если реально меняется
    if (finalCellId && finalCellId !== existing.cell_id) {
      const result = await checkCellAvailability(finalCellId, id);

      if (!result.ok) {
        if (result.reason === 'cell_not_found') {
          return res.status(400).json({ error: 'Ячейка не найдена' });
        }
        if (result.reason === 'is_full') {
          return res.status(400).json({
            error: `Ячейка ${result.label} отмечена как заполненная`,
          });
        }
        if (result.reason === 'over_capacity') {
          return res.status(400).json({
            error: `Ячейка ${result.label} переполнена (${result.cell.current_count}/${result.cell.capacity})`,
          });
        }
        return res.status(400).json({
          error: `Ячейка недоступна (${result.reason})`,
        });
      }
    }

    // 🆕 5.0.7: проверка доступности склада / офиса для МОЛа
    // Смотрим на ИТОГОВОЕ состояние: кто ответственный + где лежит.
    const finalMolId = (finalResponsibleId !== undefined)
      ? finalResponsibleId
      : existing.responsible_user_id;

    const molChanged  = (finalResponsibleId !== undefined) && (finalResponsibleId !== existing.responsible_user_id);
    const cellChanged = finalCellId !== existing.cell_id;
    const wpChanged   = finalWorkplaceId !== existing.workplace_id;

    // Проверяем, только если реально меняется МОЛ / место
    if (finalMolId && (molChanged || cellChanged || wpChanged)) {
      if (finalCellId) {
        const targetCheck = await canMoveEquipmentTo(
          { id: req.session.userId, role: req.session.role },
          { responsible_user_id: finalMolId },
          { type: 'cell', id: finalCellId }
        );
        if (!targetCheck.ok) {
          return res.status(400).json({
            error: targetCheck.reason || 'Склад недоступен для выбранного МОЛа',
          });
        }
      }
      if (finalWorkplaceId) {
        const targetCheck = await canMoveEquipmentTo(
          { id: req.session.userId, role: req.session.role },
          { responsible_user_id: finalMolId },
          { type: 'workplace', id: finalWorkplaceId }
        );
        if (!targetCheck.ok) {
          return res.status(400).json({
            error: targetCheck.reason || 'Офис недоступен для выбранного МОЛа',
          });
        }
      }
    }

    // Назначение (status=assigned + assign_user_id)
    let assignmentResult = null;
    if (status === 'assigned' && assign_user_id) {
      if (oldStatus === 'assigned') {
        // Сначала возвращаем старую технику, чтобы assignEquipment смог сработать
        try {
          await returnEquipmentByEquipmentId(
            id,
            'Возвращена при переназначении',
            'Автовозврат: переназначение'
          );
        } catch (error) {
          console.warn('⚠️ Не удалось вернуть технику перед переназначением:', error.message);
        }
      }

      try {
        assignmentResult = await assignEquipment(
          parseInt(assign_user_id, 10),
          id,
          assign_condition || 'В хорошем состоянии',
          'Назначено через редактирование техники'
        );

        await logAction({
          req,
          action: 'equipment_assign',
          entityType: 'equipment',
          entityId: id,
          details: JSON.stringify({
            inventory_number: inventory_number || null,
            user_id: assign_user_id,
          }),
        });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    // 🆕 Если старый статус был assigned, а новый — не assigned,
    // нужно сначала вернуть технику, чтобы модуль updateEquipment
    // не обнулил cell_id / workplace_id.
    const willAutoReturn = oldStatus === 'assigned' && finalStatus !== 'assigned';
    if (willAutoReturn) {
      try {
        await returnEquipmentByEquipmentId(
          id,
          'Возвращена при смене статуса',
          'Автовозврат: смена статуса'
        );
      } catch (error) {
        console.warn('⚠️ Не удалось вернуть технику перед сменой статуса:', error.message);
      }
    }

    // Обновляем
    const result = await updateEquipment(id, {
      model_id: parseInt(model_id, 10),
      inventory_number: inventory_number || null,
      serial_number: serial_number || null,
      status: finalStatus,
      description: description || null,
      purchase_date: purchase_date || null,
      warranty_until: warranty_until || null,
      cell_id: finalCellId,
      workplace_id: finalWorkplaceId,
      responsible_user_id: finalResponsibleId,   // 🆕
    });

    if (willAutoReturn) {
      await logAction({
        req,
        action: 'equipment_return',
        entityType: 'equipment',
        entityId: id,
        details: JSON.stringify({
          inventory_number: inventory_number || null,
        }),
      });
    }

    await logAction({
      req,
      action: 'equipment_update',
      entityType: 'equipment',
      entityId: id,
      details: JSON.stringify({
        inventory_number: inventory_number || null,
        status_changed: oldStatus !== finalStatus,
        responsible_changed: oldResponsibleId !== finalResponsibleId,   // 🆕
      }),
    });

    res.json({
      success: true,
      message: 'Техника обновлена успешно',
      data: result,
      assignment: assignmentResult,
      returned: willAutoReturn,
    });
  } catch (error) {
    console.error('❌ Ошибка обновления:', error);
    if (error.message === 'Техника не найдена') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('уже используется')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('Модель не найдена')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
}

async function deleteEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const userForPerm = { id: req.session.userId, role: req.session.role };

    // 🆕 Этап 4: МОЛ может удалять только свои экземпляры.
    if (!(await canEditEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const result = await deleteEquipment(id);
    
    if (result.deleted === 0) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }
    
    await logAction({
      req,
      action: 'equipment_delete',
      entityType: 'equipment',
      entityId: id,
    });
    
    res.json({ 
      success: true, 
      message: 'Техника удалена успешно' 
    });
  } catch (error) {
    if (error.message.includes('назначена пользователю')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

// ============================================================
// СТРАНИЦЫ ТЕХНИКИ
// ============================================================

/**
 * GET /admin/add — страница добавления техники.
 * Подгружает список моделей для селекта.
 */
async function renderAddEquipment(req, res) {
  try {
    const htmlPath = path.join(__dirname, '..', 'views', 'admin-add.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // Список моделей для селекта
    const models = await getAllModels();
    let modelOptions = '<option value="">— Выберите модель —</option>';
    models.forEach(m => {
      const manufacturer = m.manufacturer ? ` · ${escapeHtml(m.manufacturer)}` : '';
      const category = m.category_name ? ` · ${escapeHtml(m.category_name)}` : '';
      const type = m.type_name ? ` / ${escapeHtml(m.type_name)}` : '';
      modelOptions += `<option value="${m.id}">${escapeHtml(m.corporate_id)} · ${escapeHtml(m.name)}${manufacturer}${category}${type}</option>`;
    });
    content = content.replace('{{model_options}}', modelOptions);

        // 🆕 Этап 4: роль пользователя + ответственный МОЛ.
    const currentRole = req.session.role || 'user';
    content = content.replace(/\{\{current_role\}\}/g, currentRole);

    if (currentRole === 'admin') {
      // admin видит селект МОЛов
      const users = await getAllUsers();
      const mols = users.filter(u => u.role === 'mol' && u.is_active === 1);
      let molOptions = '';
      mols.forEach(m => {
        molOptions += `<option value="${m.id}">${escapeHtml(m.full_name || m.username)}</option>`;
      });
      content = content.replace('{{mol_options}}', molOptions);
      content = content.replace(/\{\{mol_field_class\}\}/g, '');
    } else {
      // mol — селект скрыт
      content = content.replace('{{mol_options}}', '');
      content = content.replace(/\{\{mol_field_class\}\}/g, 'hidden');
    }

    // 🆕 Этап 4: селект «Ответственный МОЛ» — только для админа.
    // Для МОЛ поле скрыто (он сам ответственный).
    if (req.session.role === 'admin') {
      const { getAllUsers } = require('../database/db');
      const allUsers = await getAllUsers();
      const mols = allUsers.filter(u => u.role === 'mol' && u.is_active === 1);
      let molOptions = '<option value="">— Выберите МОЛ —</option>';
      mols.forEach(m => {
        molOptions += `<option value="${m.id}">${escapeHtml(m.full_name || m.username)}</option>`;
      });
      content = content.replace('{{mol_options}}', molOptions);
    } else {
      content = content.replace('{{mol_options}}', '');
    }

    const fullHtml = renderPage({
      title: 'Добавить технику – MoveIT service',
      content,
      pageCss: '/css/admin-add.css',
      pageJs: '/js/admin-add.js',
    });

    res.send(fullHtml);
  } catch (error) {
    console.error('❌ Ошибка загрузки страницы добавления:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

/**
 * GET /admin/edit/:id — страница редактирования техники.
 * Подгружает список моделей и данные текущего экземпляра.
 */
async function renderEditEquipment(req, res) {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).send('Неверный ID');
    }

    const equipment = await getEquipmentById(id);

    if (!equipment) {
      return res.status(404).send('Техника не найдена');
    }

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-edit.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // ============================================================
    // СКАЛЯРНЫЕ ПЛЕЙСХОЛДЕРЫ
    // ============================================================

    content = content.replace(/\{\{id\}\}/g, equipment.id);
    content = content.replace(/\{\{inventory_number\}\}/g, escapeHtml(equipment.inventory_number || ''));
    content = content.replace(/\{\{serial_number\}\}/g, escapeHtml(equipment.serial_number || ''));
    content = content.replace(/\{\{purchase_date\}\}/g, equipment.purchase_date || '');
    content = content.replace(/\{\{warranty_until\}\}/g, equipment.warranty_until || '');
    content = content.replace(/\{\{status\}\}/g, equipment.status || 'available');
    content = content.replace(/\{\{description\}\}/g, escapeHtml(equipment.description || ''));

    // Место
    content = content.replace(/\{\{cell_id\}\}/g, equipment.cell_id || '');
    content = content.replace(/\{\{workplace_id\}\}/g, equipment.workplace_id || '');

    // Модель (model_id — текущее значение)
    content = content.replace(/\{\{selected_model_id\}\}/g, equipment.model_id || '');

    // ============================================================
    // СТАТУСЫ
    // ============================================================

    const statusLabels = {
      'available':   '✅ Доступна',
      'placed':      '🪑 На месте',
      'assigned':    '👤 Назначена',
      'maintenance': '🔧 В ремонте',
      'retired':     '❌ Списана',
    };
    const statuses = ['available', 'placed', 'assigned', 'maintenance', 'retired'];

    let statusOptions = '';
    statuses.forEach(s => {
      const selected = s === equipment.status ? 'selected' : '';
      statusOptions += `<option value="${s}" ${selected}>${statusLabels[s]}</option>`;
    });
    content = content.replace('{{status_options}}', statusOptions);

    // ============================================================
    // СПИСОК МОДЕЛЕЙ
    // ============================================================

    const models = await getAllModels();
    let modelOptions = '<option value="">— Выберите модель —</option>';
    models.forEach(m => {
      const selected = String(m.id) === String(equipment.model_id) ? 'selected' : '';
      const manufacturer = m.manufacturer ? ` · ${escapeHtml(m.manufacturer)}` : '';
      const category = m.category_name ? ` · ${escapeHtml(m.category_name)}` : '';
      const type = m.type_name ? ` / ${escapeHtml(m.type_name)}` : '';
      modelOptions += `<option value="${m.id}" ${selected}>${escapeHtml(m.corporate_id)} · ${escapeHtml(m.name)}${manufacturer}${category}${type}</option>`;
    });
    content = content.replace('{{model_options}}', modelOptions);

    // ============================================================
    // 🆕 ЭТАП 4: РОЛЬ ПОЛЬЗОВАТЕЛЯ + ОТВЕТСТВЕННЫЙ МОЛ
    // ============================================================

    const currentRole = req.session.role || 'user';
    content = content.replace(/\{\{current_role\}\}/g, currentRole);

    if (currentRole === 'admin') {
      // admin видит селект МОЛов
      const { getAllUsers } = require('../database/db');
      const allUsers = await getAllUsers();
      const mols = allUsers.filter(u => u.role === 'mol' && u.is_active === 1);

      let molOptions = '';
      mols.forEach(m => {
        const selected = String(m.id) === String(equipment.responsible_user_id)
          ? 'selected' : '';
        molOptions += `<option value="${m.id}" ${selected}>${escapeHtml(m.full_name || m.username)}</option>`;
      });

      content = content.replace('{{mol_options}}', molOptions);
      content = content.replace(/\{\{mol_field_class\}\}/g, '');
    } else {
      // mol (и любые другие роли) — селект скрыт
      content = content.replace('{{mol_options}}', '');
      content = content.replace(/\{\{mol_field_class\}\}/g, 'hidden');
    }

    // Информационная строка «Ответственный» в правой колонке
    const responsibleName = equipment.responsible_user_name
      ? escapeHtml(equipment.responsible_user_name)
      : '—';
    content = content.replace(/\{\{info_responsible\}\}/g, responsibleName);

    // ============================================================
    // ПРАВАЯ КОЛОНКА — ИНФО О ТЕКУЩЕМ ЭКЗЕМПЛЯРЕ
    // ============================================================

    const infoStatus = statusLabels[equipment.status] || equipment.status || '—';

    content = content.replace(/\{\{info_inventory\}\}/g, escapeHtml(equipment.inventory_number || '—'));
    content = content.replace(/\{\{info_model_name\}\}/g, escapeHtml(equipment.model_name || '—'));
    content = content.replace(/\{\{info_corporate_id\}\}/g, escapeHtml(equipment.model_corporate_id || '—'));
    content = content.replace(/\{\{info_manufacturer\}\}/g, escapeHtml(equipment.model_manufacturer || '—'));
    content = content.replace(/\{\{info_category\}\}/g,
      equipment.category_name
        ? `${equipment.category_icon || '📁'} ${escapeHtml(equipment.category_name)}`
        : '—'
    );
    content = content.replace(/\{\{info_type\}\}/g,
      equipment.type_name
        ? `${equipment.type_icon || '📦'} ${escapeHtml(equipment.type_name)}`
        : '—'
    );
    content = content.replace(/\{\{info_serial\}\}/g, escapeHtml(equipment.serial_number || '—'));
    content = content.replace(/\{\{info_status\}\}/g, escapeHtml(infoStatus));

    // ============================================================
    // ПОЛЬЗОВАТЕЛИ ДЛЯ НАЗНАЧЕНИЯ
    // ============================================================

    const users = await getAllUsers();
    let userOptions = '';
    users.forEach(user => {
      const fullName = user.full_name || user.username;
      const dept = user.department ? ` (${user.department})` : '';
      userOptions += `<option value="${user.id}">${escapeHtml(fullName)}${escapeHtml(dept)}</option>`;
    });
    content = content.replace('{{user_options}}', userOptions);

    // ============================================================
    // РЕНДЕР СТРАНИЦЫ
    // ============================================================

    renderPageFor(req, res, {
      title: 'Редактировать технику – MoveIT service',
      content,
      pageCss: '/css/admin-edit.css',
      pageJs: '/js/admin-edit.js',
    });
  } catch (error) {
    console.error('❌ Ошибка при загрузке страницы редактирования:', error);
    res.status(500).send('Ошибка при загрузке страницы');
  }
}

// ============================================================
// API — ПОЛЬЗОВАТЕЛИ
// ============================================================
// (без изменений)

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
    
    const { getUserActiveEquipment, getUserEquipmentHistory } = require('../database/db');
    const activeEquipment = await getUserActiveEquipment(id);
    const history = await getUserEquipmentHistory(id);
    
    const stats = {
      active: activeEquipment.length,
      total: history.length,
      returned: history.filter(h => h.returned_date).length
    };
    
    delete user.password_hash;
    
    res.json({
      user,
      stats,
      activeEquipment,
      history: history.slice(0, 30)
    });
  } catch (error) {
    console.error('❌ Ошибка получения деталей:', error);
    res.status(500).json({ error: error.message });
  }
}

async function addUserAPI(req, res) {
  try {
    const { username, email, full_name, department, phone, role } = req.body;
    
    if (!username || !email) {
      return res.status(400).json({ 
        error: 'Логин и email обязательны' 
      });
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
      must_change_password: 1
    });
    
    await logAction({
      req,
      action: 'user_create',
      entityType: 'user',
      entityId: result.id,
      details: JSON.stringify({ 
        username: username.trim(), 
        role: userRole 
      })
    });
    
    res.json({ 
      success: true, 
      message: 'Пользователь создан успешно',
      data: {
        id: result.id,
        username: username.trim(),
        email: email.trim(),
        full_name: full_name,
        role: userRole
      },
      tempPassword: tempPassword,
      warning: 'Сохраните пароль! Он больше не будет показан.'
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
      return res.status(400).json({ 
        error: 'Логин и email обязательны' 
      });
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
      const { db } = require('../database/db');
      const adminCount = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      
      if (adminCount <= 1) {
        return res.status(400).json({ 
          error: 'Нельзя изменить роль последнего администратора' 
        });
      }
    }
    
    const { db } = require('../database/db');
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users 
         SET username = ?, email = ?, full_name = ?, department = ?, phone = ?, role = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [username.trim(), email.trim(), full_name || '', department || '', phone || '', newRole, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    // 🆕 Этап 4: если роль = mol — обновляем привязки складов и офисов.
    if (newRole === 'mol') {
      const warehouseIds = Array.isArray(req.body.warehouse_ids)
        ? req.body.warehouse_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
        : [];
      const officeIds = Array.isArray(req.body.office_ids)
        ? req.body.office_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
        : [];

      // Удаляем старые связки
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM warehouse_responsibles WHERE user_id = ?', [id],
          (err) => err ? reject(err) : resolve());
      });
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM office_responsibles WHERE user_id = ?', [id],
          (err) => err ? reject(err) : resolve());
      });

      // Вставляем новые
      for (const wid of warehouseIds) {
        await new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO warehouse_responsibles (warehouse_id, user_id) VALUES (?, ?)',
            [wid, id],
            (err) => err ? reject(err) : resolve());
        });
      }
      for (const oid of officeIds) {
        await new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO office_responsibles (office_id, user_id) VALUES (?, ?)',
            [oid, id],
            (err) => err ? reject(err) : resolve());
        });
      }
    } else {
      // При смене роли с mol на что-то другое — снимаем все привязки
      // const oldUser = await getUserById(id);
      // (oldUser был загружен выше как `user`, но перезагружаем на всякий случай)
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
      req,
      action: 'user_update',
      entityType: 'user',
      entityId: id,
      details: JSON.stringify({ 
        username: username.trim(),
        role_changed: user.role !== newRole
      })
    });
    
    res.json({ 
      success: true, 
      message: 'Пользователь обновлён успешно'
    });
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
      const { db } = require('../database/db');
      const adminCount = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      
      if (adminCount <= 1) {
        return res.status(400).json({ 
          error: 'Нельзя удалить последнего администратора' 
        });
      }
    }
    
    const result = await deleteUserWithEquipmentReturn(id);
    
    await logAction({
      req,
      action: 'user_delete',
      entityType: 'user',
      entityId: id,
      details: JSON.stringify({ 
        username: user.username,
        equipment_returned: result.equipment_returned 
      })
    });
    
    res.json({ 
      success: true, 
      message: `Пользователь удалён. Возвращено техники: ${result.equipment_returned}`,
      data: result
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
      req,
      action: 'user_password_reset',
      entityType: 'user',
      entityId: id,
      details: JSON.stringify({ username: user.username })
    });
    
    res.json({ 
      success: true, 
      message: `Пароль пользователя "${user.full_name || user.username}" сброшен`,
      tempPassword: tempPassword,
      warning: 'Передайте пароль пользователю. Он должен сменить его при следующем входе.'
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
      const { db } = require('../database/db');
      const adminCount = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      
      if (adminCount <= 1) {
        return res.status(400).json({ 
          error: 'Нельзя заблокировать последнего администратора' 
        });
      }
    }
    
    await setUserActive(id, false);
    
    await logAction({
      req,
      action: 'user_block',
      entityType: 'user',
      entityId: id,
      details: JSON.stringify({ username: user.username })
    });
    
    res.json({ 
      success: true, 
      message: `Пользователь "${user.full_name || user.username}" заблокирован`
    });
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
      req,
      action: 'user_unblock',
      entityType: 'user',
      entityId: id,
      details: JSON.stringify({ username: user.username })
    });
    
    res.json({ 
      success: true, 
      message: `Пользователь "${user.full_name || user.username}" разблокирован`
    });
  } catch (error) {
    console.error('❌ Ошибка разблокировки:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// СТРАНИЦЫ ПОЛЬЗОВАТЕЛЕЙ
// ============================================================

function renderAddUser(req, res) {
  try {
    const htmlPath = path.join(__dirname, '..', 'views', 'admin-user-add.html');
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

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-user-edit.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    content = content.replace(/\{\{id\}\}/g, user.id);
    content = content.replace(/\{\{username\}\}/g, escapeHtml(user.username || ''));
    content = content.replace(/\{\{email\}\}/g, escapeHtml(user.email || ''));
    content = content.replace(/\{\{full_name\}\}/g, escapeHtml(user.full_name || ''));
    content = content.replace(/\{\{department\}\}/g, escapeHtml(user.department || ''));
    content = content.replace(/\{\{phone\}\}/g, escapeHtml(user.phone || ''));
    content = content.replace(/\{\{role\}\}/g, user.role || 'user');

    // 🆕 Этап 4: чекбоксы складов и офисов для роли mol.
    const { db } = require('../database/db');

    const allWarehouses = await new Promise((resolve, reject) => {
      db.all(`SELECT id, name, is_default FROM warehouses WHERE is_active = 1 ORDER BY is_default DESC, name`,
        (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    const allOffices = await new Promise((resolve, reject) => {
      db.all(`SELECT id, name, is_default FROM offices WHERE is_active = 1 ORDER BY is_default DESC, name`,
        (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    const userWarehouseIds = await new Promise((resolve, reject) => {
      db.all(`SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ?`,
        [id],
        (err, rows) => err ? reject(err) : resolve((rows || []).map(r => r.warehouse_id)));
    });

    const userOfficeIds = await new Promise((resolve, reject) => {
      db.all(`SELECT office_id FROM office_responsibles WHERE user_id = ?`,
        [id],
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
// ЛОГИ
// ============================================================

async function renderLogs(req, res) {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action || null,
      search: req.query.search || null,
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const logs = await getActivityLogs(filters);
    const totalCount = await getActivityLogsCount(filters);
    const stats = await getActivityStats(30);
    const users = await getAllUsers();
    const actions = await getUniqueActions();

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-logs.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    content = content.replace(/\{\{stats\.total\}\}/g, stats.total || 0);
    content = content.replace(/\{\{stats\.unique_users\}\}/g, stats.unique_users || 0);
    content = content.replace(/\{\{stats\.logins\}\}/g, stats.logins || 0);
    content = content.replace(/\{\{stats\.failed_logins\}\}/g, stats.failed_logins || 0);
    content = content.replace(/\{\{stats\.equipment_actions\}\}/g, stats.equipment_actions || 0);
    content = content.replace(/\{\{stats\.user_actions\}\}/g, stats.user_actions || 0);
    content = content.replace(/\{\{stats\.deletes\}\}/g, stats.deletes || 0);

    let userOptions = '<option value="">Все пользователи</option>';
    users.forEach(u => {
      const selected = filters.userId === u.id ? 'selected' : '';
      userOptions += `<option value="${u.id}" ${selected}>${escapeHtml(u.full_name || u.username)}</option>`;
    });
    content = content.replace('{{user_options}}', userOptions);

    const actionNames = {
      'login': '🔐 Вход',
      'logout': '🚪 Выход',
      'login_failed': '❌ Неудачный вход',
      'password_change': '🔑 Смена пароля',
      'profile_update': '👤 Обновление профиля',
      'user_create': '➕ Создание пользователя',
      'user_update': '✏️ Редактирование пользователя',
      'user_delete': '🗑️ Удаление пользователя',
      'user_block': '🚫 Блокировка пользователя',
      'user_unblock': '✅ Разблокировка пользователя',
      'user_password_reset': '🔑 Сброс пароля',
      'equipment_create': '➕ Добавление техники',
      'equipment_update': '✏️ Редактирование техники',
      'equipment_delete': '🗑️ Удаление техники',
      'equipment_assign': '📦 Назначение техники',
      'equipment_return': '↩️ Возврат техники',
      'equipment_move': '🔄 Перемещение техники',
      'model_create': '🧩 Создание модели',
      'model_update': '🧩 Редактирование модели',
      'model_delete': '🧩 Удаление модели',
      'category_create': '📁 Создание категории',
      'category_update': '📁 Редактирование категории',
      'category_delete': '📁 Удаление категории',
      'type_create': '📦 Создание типа',
      'type_update': '📦 Редактирование типа',
      'type_delete': '📦 Удаление типа',
      'warehouse_create': '🏢 Создание склада',
      'warehouse_update': '🏢 Редактирование склада',
      'warehouse_delete': '🏢 Удаление склада',
      'warehouse_set_default': '⭐ Склад по умолчанию',
      'zone_create': '📍 Создание зоны',
      'zone_update': '📍 Редактирование зоны',
      'zone_delete': '📍 Удаление зоны',
      'rack_create': '🗄️ Создание стеллажа',
      'rack_update': '🗄️ Редактирование стеллажа',
      'rack_delete': '🗄️ Удаление стеллажа',
      'cell_create': '📦 Создание ячейки',
      'cell_update': '📦 Редактирование ячейки',
      'cell_delete': '📦 Удаление ячейки',
    };

    let actionOptions = '<option value="">Все действия</option>';
    actions.forEach(a => {
      const selected = filters.action === a.action ? 'selected' : '';
      const label = actionNames[a.action] || a.action;
      actionOptions += `<option value="${a.action}" ${selected}>${label} (${a.count})</option>`;
    });
    content = content.replace('{{action_options}}', actionOptions);

    content = content.replace(/\{\{filter\.search\}\}/g, escapeHtml(filters.search || ''));
    content = content.replace(/\{\{filter\.dateFrom\}\}/g, filters.dateFrom || '');
    content = content.replace(/\{\{filter\.dateTo\}\}/g, filters.dateTo || '');

    let logRows = '';
    if (logs.length === 0) {
      logRows = `
        <tr>
          <td colspan="6" class="empty-row">
            <div class="empty-state">
              <span class="emoji">📭</span>
              <h3>Логи не найдены</h3>
              <p>Попробуйте изменить фильтры</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      logs.forEach(log => {
        let actionClass = 'log-action-default';
        if (log.action.includes('delete')) actionClass = 'log-action-delete';
        else if (log.action.includes('create')) actionClass = 'log-action-create';
        else if (log.action.includes('update')) actionClass = 'log-action-update';
        else if (log.action === 'login') actionClass = 'log-action-login';
        else if (log.action === 'login_failed') actionClass = 'log-action-failed';
        else if (log.action.includes('block')) actionClass = 'log-action-block';
        else if (log.action === 'equipment_move') actionClass = 'log-action-move';

        const actionLabel = actionNames[log.action] || log.action;

        let detailsHtml = '—';
        if (log.details) {
          try {
            const parsed = JSON.parse(log.details);
            detailsHtml = Object.entries(parsed)
              .map(([k, v]) => `<span class="log-detail-key">${escapeHtml(k)}:</span> <span class="log-detail-value">${escapeHtml(String(v))}</span>`)
              .join('<br>');
          } catch {
            detailsHtml = escapeHtml(log.details);
          }
        }

        const userName = log.user_full_name || log.username || '—';
        const userInitials = getInitials(log.user_full_name || log.username);

        logRows += `
          <tr>
            <td class="log-date">${formatDateTime(log.created_at)}</td>
            <td>
              <div class="log-user">
                <span class="log-avatar">${userInitials}</span>
                <div>
                  <div class="log-user-name">${escapeHtml(userName)}</div>
                  ${log.user_department ? `<div class="log-user-dept">${escapeHtml(log.user_department)}</div>` : ''}
                </div>
              </div>
            </td>
            <td><span class="log-action ${actionClass}">${actionLabel}</span></td>
            <td class="log-entity">
              ${log.entity_type ? `<span class="log-entity-type">${escapeHtml(log.entity_type)}</span>` : ''}
              ${log.entity_id ? `<span class="log-entity-id">#${log.entity_id}</span>` : ''}
              ${!log.entity_type && !log.entity_id ? '—' : ''}
            </td>
            <td class="log-details">${detailsHtml}</td>
            <td class="log-ip">${log.ip_address || '—'}</td>
          </tr>
        `;
      });
    }
    content = content.replace('{{log_rows}}', logRows);

    const totalPages = Math.ceil(totalCount / filters.limit);
    const currentPage = Math.floor(filters.offset / filters.limit) + 1;

    let pagination = '';
    if (totalPages > 1) {
      pagination = `<div class="pagination">`;
      pagination += `<span class="pagination-info">Страница ${currentPage} из ${totalPages} (всего: ${totalCount})</span>`;
      pagination += `<div class="pagination-buttons">`;

      const buildQuery = (offset) => {
        const params = new URLSearchParams();
        if (filters.userId) params.set('userId', filters.userId);
        if (filters.action) params.set('action', filters.action);
        if (filters.search) params.set('search', filters.search);
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
        params.set('limit', filters.limit);
        params.set('offset', offset);
        return '?' + params.toString();
      };

      if (filters.offset > 0) {
        pagination += `<a href="/admin/logs${buildQuery(filters.offset - filters.limit)}" class="pagination-btn">← Назад</a>`;
      }

      if (filters.offset + filters.limit < totalCount) {
        pagination += `<a href="/admin/logs${buildQuery(filters.offset + filters.limit)}" class="pagination-btn">Вперёд →</a>`;
      }

      pagination += `</div></div>`;
    } else {
      pagination = `<div class="pagination"><span class="pagination-info">Всего: ${totalCount} записей</span></div>`;
    }
    content = content.replace('{{pagination}}', pagination);

    renderPageFor(req, res, {
      title: 'Логи активности – MoveIT service',
      content,
      pageCss: '/css/logs.css',
      pageJs: '/js/logs.js',
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки логов:', error);
    res.status(500).send('Ошибка загрузки страницы логов');
  }
}

async function getLogsAPI(req, res) {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action || null,
      search: req.query.search || null,
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };
    
    const logs = await getActivityLogs(filters);
    const total = await getActivityLogsCount(filters);
    
    res.json({ logs, total, filters });
  } catch (error) {
    console.error('❌ Ошибка API логов:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getLogsStatsAPI(req, res) {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 30;
    const stats = await getActivityStats(days);
    const byDay = await getActivityByDay(14);
    
    res.json({ stats, byDay });
  } catch (error) {
    console.error('❌ Ошибка статистики:', error);
    res.status(500).json({ error: error.message });
  }
}

async function cleanLogsAPI(req, res) {
  try {
    const days = req.body.days ? parseInt(req.body.days) : 90;
    
    if (days < 30) {
      return res.status(400).json({ 
        error: 'Нельзя удалять логи младше 30 дней' 
      });
    }
    
    const result = await cleanOldLogs(days);
    
    await logAction({
      req,
      action: 'logs_clean',
      details: JSON.stringify({ days, deleted: result.deleted })
    });
    
    res.json({ 
      success: true, 
      message: `Удалено ${result.deleted} старых записей`,
      deleted: result.deleted
    });
  } catch (error) {
    console.error('❌ Ошибка очистки логов:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// ДЕТАЛИ ТЕХНИКИ (карточка)
// ============================================================

async function getEquipmentDetailsAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }

    // 🆕 Scope по роли: mol видит только свои экземпляры.
    // Для admin/supervisor scope пустой — видят всё.
    const scope = { userId: req.session.userId, role: req.session.role };
    const equipment = await getEquipmentById(id, scope);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    // canAccessEquipment — проверка ДОСТУПА НА ПРОСМОТР (не редактирование).
    // Для supervisor вернёт true (read-only), для mol — true если
    // экземпляр его ИЛИ лежит в его складе/офисе.
    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canAccessEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }
    
    const { getEquipmentHistory } = require('../database/db');
    // ...
    const history = await getEquipmentHistory(id);
    
    const activeAssignment = history.find(h => h.status === 'active');
    
    const stats = {
      total: history.length,
      active: activeAssignment ? 1 : 0,
      returned: history.filter(h => h.status === 'returned').length,
      current_user: activeAssignment ? {
        id: activeAssignment.user_id,
        full_name: activeAssignment.full_name,
        username: activeAssignment.username,
        department: activeAssignment.department,
        email: activeAssignment.email,
        assigned_date: activeAssignment.assigned_date,
        condition_on_assign: activeAssignment.condition_on_assign
      } : null
    };

    let location = { type: 'none' };

    if (activeAssignment) {
      location = {
        type: 'user',
        user: stats.current_user,
      };
    } else if (equipment.workplace_id) {
      location = {
        type: 'workplace',
        workplace_id: equipment.workplace_id,
        workplace_name: equipment.workplace_name,
        workplace_code: equipment.workplace_code,
        room_id: equipment.room_id,
        room_name: equipment.room_name,
        office_id: equipment.office_id,
        office_name: equipment.office_name,
      };
    } else if (equipment.cell_id) {
      location = {
        type: 'cell',
        cell_id: equipment.cell_id,
        cell_name: equipment.cell_name,
        cell_code: equipment.cell_code,
        rack_name: equipment.rack_name,
        zone_name: equipment.zone_name,
        warehouse_id: equipment.warehouse_id,
        warehouse_name: equipment.warehouse_name,
      };
    }

    res.json({
      equipment,
      stats,
      location,
      history
    });
  } catch (error) {
    console.error('❌ Ошибка получения деталей техники:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(p => p);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

function formatDateTime(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return dateString;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 🆕 5.0.4: Сортируемый заголовок таблицы.
 */
function sortableTh(column, label, currentSort, currentOrder, query) {
  const isActive = currentSort === column;
  const nextOrder = isActive && currentOrder === 'asc' ? 'desc' : 'asc';
  const arrow = isActive ? (currentOrder === 'asc' ? ' ▲' : ' ▼') : '';

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (k !== 'sort' && k !== 'order' && k !== 'page' && v) {
      params.set(k, v);
    }
  }
  params.set('sort', column);
  params.set('order', nextOrder);

  const cls = isActive ? 'sortable-header active' : 'sortable-header';
  return `<th class="${cls}">
    <a href="/manage?${params.toString()}">${label}${arrow}</a>
  </th>`;
}

/**
 * 🆕 5.0.4: Пагинация для /manage.
 */
function renderManagePagination({ page, totalPages, totalFiltered, query }) {
  if (totalPages <= 1) {
    return `<div class="pagination"><span class="pagination-info">Всего: ${totalFiltered}</span></div>`;
  }
  const buildUrl = (p) => {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([k, v]) => {
      if (k !== 'page' && v) params.set(k, v);
    });
    params.set('page', p);
    return '/manage?' + params.toString();
  };
  let html = '<div class="pagination">';
  html += `<span class="pagination-info">Страница ${page} из ${totalPages} (всего: ${totalFiltered})</span>`;
  html += '<div class="pagination-buttons">';
  if (page > 1) html += `<a href="${buildUrl(page - 1)}" class="pagination-btn">← Назад</a>`;
  if (page < totalPages) html += `<a href="${buildUrl(page + 1)}" class="pagination-btn">Вперёд →</a>`;
  html += '</div></div>';
  return html;
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}

// ============================================================
// API — ПЕРЕМЕЩЕНИЕ ТЕХНИКИ
// ============================================================

async function moveEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }
    
    const { cell_id, notes } = req.body;
    
    const equipment = await getEquipmentById(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }
    
    if (equipment.status === 'assigned') {
      return res.status(400).json({ 
        error: 'Нельзя переместить назначенную технику. Сначала верните её.' 
      });
    }

    // 🆕 5.0.6: проверка доступности целевого склада для МОЛа
    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (cell_id) {
      const targetCheck = await canMoveEquipmentTo(
        userForPerm,
        equipment,
        { type: 'cell', id: parseInt(cell_id, 10) }
      );
      if (!targetCheck.ok) {
        return res.status(400).json({ error: targetCheck.reason });
      }
    }
    
    const result = await moveEquipmentToCellDetailed(
      id,
      cell_id ? parseInt(cell_id) : null,
      req.session.userId,
      req.session.username
    );
    
    if (result.already_there) {
      return res.json({ 
        success: true, 
        message: 'Техника уже в этой ячейке',
        data: result 
      });
    }
    
    await logAction({
      req,
      action: 'equipment_move',
      entityType: 'equipment',
      entityId: id,
      details: JSON.stringify({
        inventory_number: result.inventory_number,
        model_name: result.model_name,
        from_cell: result.from_cell_code || result.from_cell_name || null,
        to_cell: result.to_cell_code || result.to_cell_name || null,
        to_warehouse: result.to_warehouse_name || null,
        to_zone: result.to_zone_name || null,
        to_rack: result.to_rack_name || null,
        notes: notes || null
      })
    });
    
    let message = '✅ Техника перемещена';
    if (result.from_cell_code && result.to_cell_code) {
      message = `✅ Перемещено из ${result.from_cell_code} в ${result.to_cell_code}`;
    } else if (!result.from_cell_code && result.to_cell_code) {
      message = `✅ Техника размещена в ${result.to_cell_code}`;
    } else if (result.from_cell_code && !result.to_cell_code) {
      message = `✅ Техника убрана из ячейки ${result.from_cell_code}`;
    }
    
    res.json({ 
      success: true, 
      message,
      data: result 
    });
  } catch (error) {
    console.error('❌ Ошибка перемещения:', error);
    if (error.message.includes('переполнена') || 
        error.message.includes('Нельзя переместить') ||
        error.message.includes('не найдена')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

async function getEquipmentMovesAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }
    
    const moves = await getEquipmentMoves(id);
    res.json(moves);
  } catch (error) {
    console.error('❌ Ошибка получения истории:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

module.exports = {
  // Страницы
  renderManage: renderAdmin,
  renderAdminUsers,     // 🆕
  renderLogs,
  
  // API техники
  getEquipmentAPI,
  getEquipmentByIdAPI,
  getEquipmentDetailsAPI,
  addEquipmentAPI,
  updateEquipmentAPI,
  deleteEquipmentAPI,
  
  // Страницы техники
  renderAddEquipment,
  renderEditEquipment,
  
  // API пользователей
  getUsersAPI,
  getUserByIdAPI,
  addUserAPI,
  updateUserAPI,
  deleteUserAPI,
  resetUserPasswordAPI,
  blockUserAPI,
  unblockUserAPI,
  getUserDetailsAPI,
  
  // Страницы пользователей
  renderAddUser,
  renderEditUser,
  
  // Логи
  getLogsAPI,
  getLogsStatsAPI,
  cleanLogsAPI,

  // Перемещение
  moveEquipmentAPI,
  getEquipmentMovesAPI,
};