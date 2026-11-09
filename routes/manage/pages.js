// routes/manage/pages.js
// Рендер страницы /manage + формы техники (add/edit).

const fs = require('fs');
const path = require('path');

const {
  getAllModels,
  getAllUsers,
  getEquipmentById,
  getEquipmentWithLocation,
  getAllCategories,
  getAllTypes,
  getMolsForFilter,
  getStats,
} = require('../../database/db');

const { renderPage, renderPageFor } = require('../../utils/layout');
const {
  escapeHtml,
  getInitials,
  sortableTh,
  renderManagePagination,
  getManageColumns,
  renderTableHead,
  renderEquipmentRow,
  renderEmptyRow,
} = require('./helpers');

// ============================================================
// GET /manage
// ============================================================

async function renderManage(req, res) {
  try {
    const currentRole = req.session.role || 'user';
    const currentUserId = req.session.userId || 0;
    const scope = { userId: currentUserId, role: currentRole };
    const q = req.query || {};

    // ---------- Пагинация / сортировка ----------
    const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];
    const DEFAULT_PAGE_SIZE = 10;
    const requestedLimit = parseInt(q.limit, 10);
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE;
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    const ALLOWED_SORTS = [
      'id', 'inventory_number', 'model_name', 'corporate_id',
      'category', 'type', 'description', 'location', 'status', 
      'assigned', 'responsible', 'created_at', 'purchase_date',
    ];
    const sort = ALLOWED_SORTS.includes(q.sort) ? q.sort : 'id';
    const order = (String(q.order).toLowerCase() === 'desc') ? 'desc' : 'asc';

    // ---------- Фильтры ----------
    const filters = {
      category_id:  q.category_id  ? parseInt(q.category_id, 10)  : null,
      type_id:      q.type_id      ? parseInt(q.type_id, 10)      : null,
      status:       q.status       || null,
      mol_id:       q.mol_id       ? parseInt(q.mol_id, 10)       : null,
      corporate_id: (q.corporate_id || '').trim() || null,
      model_name:   (q.model_name   || '').trim() || null,
      search:       (q.search       || '').trim() || null,
      only_mine:    q.only_mine === '1',
      unplaced:     q.unplaced === '1' || q.unplaced === 'true',
      stale:        q.stale === '1' || q.stale === 'true',
      warehouse_id: q.warehouse_id ? parseInt(q.warehouse_id, 10) : null,
      sort, order,
      limit: pageSize, offset, include_total: true,
    };

    // ---------- Данные ----------
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

    // ---------- Шаблон ----------
    const htmlPath = path.join(__dirname, '..', '..', 'views', 'manage.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const partialPath = path.join(__dirname, '..', '..', 'views', 'partials', 'equipment-card.html');
    const equipmentCardPartial = fs.readFileSync(partialPath, 'utf8');

    // ---------- Скаляры ----------
    html = html.replace(/\{\{total_equipment\}\}/g, stats.total_equipment || 0);
    html = html.replace(/\{\{available_equipment\}\}/g, stats.available_equipment || 0);
    html = html.replace(/\{\{assigned_equipment\}\}/g, stats.assigned_equipment || 0);
    html = html.replace(/\{\{total_users\}\}/g, stats.total_users || 0);
    html = html.replace(/\{\{current_role\}\}/g, currentRole);
    html = html.replace(/\{\{current_user_id\}\}/g, currentUserId);

    // ---------- page_actions ----------
    html = html.replace('{{page_actions}}', buildPageActions(currentRole));

    // ---------- Фильтры: опции ----------
    html = html.replace('{{filter_category_options}}', buildCategoryOptions(categories, filters.category_id));
    html = html.replace('{{filter_type_options}}',     buildTypeOptions(types, filters));
    html = html.replace('{{filter_mol_options}}',      buildMolOptions(mols, filters, currentRole));
    html = html.replace('{{filter_only_mine_block}}',  buildOnlyMineBlock(filters, currentRole));

    html = html.replace(/\{\{filter_corporate_id\}\}/g, escapeHtml(filters.corporate_id || ''));
    html = html.replace(/\{\{filter_model_name\}\}/g,   escapeHtml(filters.model_name || ''));
    html = html.replace(/\{\{filter_search\}\}/g,       escapeHtml(filters.search || ''));
    html = html.replace(/\{\{filter_unplaced_checked\}\}/g, filters.unplaced ? 'checked' : '');
    html = html.replace(/\{\{filter_stale_checked\}\}/g, filters.stale ? 'checked' : '');

    html = html.replace('{{page_size_options}}', buildPageSizeOptions(ALLOWED_PAGE_SIZES, pageSize));

    // ---------- Таблица: колонки / шапка / строки ----------
    const cols = getManageColumns(currentRole);
    const th = (col, label, extraClass) => sortableTh(col, label, sort, order, q, extraClass || '');

    html = html.replace('{{table_head}}', renderTableHead(cols, th));

    let equipmentRows = '';
    if (equipment.length === 0) {
      equipmentRows = renderEmptyRow(cols);
    } else {
      equipment.forEach(item => {
        equipmentRows += renderEquipmentRow(item, buildRowContext(item, currentRole, currentUserId));
      });
    }
    html = html.replace('{{equipment_rows}}', equipmentRows);

    // ---------- Пагинация / прочее ----------
    html = html.replace('{{pagination}}', renderManagePagination({
      page, totalPages, totalFiltered, query: q,
    }));
    html = html.replace('{{open_equipment_id}}', q.open_equipment ? parseInt(q.open_equipment, 10) || '' : '');
    html = html.replace('{{equipment_card_partial}}', equipmentCardPartial);

    renderPageFor(req, res, {
      title: 'Учёт ТМЦ – MoveIT service',
      content: html,
      pageCss: [
        '/css/manage/table.css',
        '/css/manage/card.css',
        '/css/manage/actions.css',
        '/css/manage/modals.css',
        '/css/manage/responsive.css',
      ],
      pageJs: [
        '/js/manage/helpers.js',
        '/js/equipment-card/loader.js',
        '/js/equipment-card/render.js',
        '/js/equipment-card/actions.js',
        '/js/equipment-card/modals.js',
        '/js/equipment-card/index.js',
        '/js/manage/bulk-actions.js',
        '/js/manage/filters.js',
        '/js/manage/init.js',
        '/js/manage/columns.js',   // 🆕 5.11.3.2
      ],
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки страницы учёта ТМЦ:', error);
    res.status(500).send('Ошибка при загрузке страницы учёта ТМЦ');
  }
}

// ============================================================
// view-хелперы для renderManage (5.11.3-view)
// ============================================================

function buildPageActions(currentRole) {
  let html = '';
  if (currentRole === 'admin' || currentRole === 'supervisor') {
    html += `<a href="/admin/catalog" class="btn btn-ghost btn-sm" title="Управление категориями и типами">📚 Справочник</a>`;
    html += `<a href="/admin/warehouses" class="btn btn-ghost btn-sm" title="Управление складами">🏢 Склады</a>`;
    html += `<a href="/admin/inventory" class="btn btn-ghost btn-sm" title="Инвентаризация">📊 Инвентаризация</a>`;
  }
  if (currentRole === 'admin') {
    html += `<a href="/manage/import" class="btn btn-success btn-sm">📥 Импорт</a>`;
    html += `<a href="/admin/logs" class="btn btn-ghost btn-sm">📈 Логи</a>`;
  }
  return html;
}

function buildCategoryOptions(categories, selectedId) {
  let html = '<option value="">Все категории</option>';
  categories.forEach(c => {
    const sel = String(c.id) === String(selectedId) ? 'selected' : '';
    html += `<option value="${c.id}" ${sel}>${c.icon || '📁'} ${escapeHtml(c.name)}</option>`;
  });
  return html;
}

function buildTypeOptions(types, filters) {
  let html = '<option value="">Все типы</option>';
  const filteredTypes = filters.category_id
    ? types.filter(t => Number(t.category_id) === filters.category_id)
    : types;
  filteredTypes.forEach(t => {
    const sel = String(t.id) === String(filters.type_id) ? 'selected' : '';
    html += `<option value="${t.id}" ${sel}>${t.icon || '📦'} ${escapeHtml(t.name)}</option>`;
  });
  return html;
}

function buildMolOptions(mols, filters, currentRole) {
  if (currentRole !== 'admin') return '';
  let html = '<option value="">Все МОЛы</option>';
  mols.forEach(m => {
    const sel = String(m.id) === String(filters.mol_id) ? 'selected' : '';
    html += `<option value="${m.id}" ${sel}>${escapeHtml(m.full_name || m.username)}</option>`;
  });
  return html;
}

function buildOnlyMineBlock(filters, currentRole) {
  if (currentRole !== 'mol') return '';
  const onlyMineOptions = `
    <option value="">Все ТМЦ</option>
    <option value="1" ${filters.only_mine ? 'selected' : ''}>Только мои</option>
  `;
  return `
    <div class="filter-group">
      <label>Показать</label>
      <select id="filterOnlyMine">
        ${onlyMineOptions}
      </select>
    </div>
  `;
}

function buildPageSizeOptions(sizes, currentPageSize) {
  let html = '';
  sizes.forEach(size => {
    const sel = size === currentPageSize ? 'selected' : '';
    html += `<option value="${size}" ${sel}>${size}</option>`;
  });
  return html;
}

function buildRowContext(item, currentRole, currentUserId) {
  const canBulkMove = (currentRole === 'admin' || currentRole === 'mol');

  const canEditThis = currentRole === 'admin'
    || (currentRole === 'mol' && Number(item.responsible_user_id) === Number(currentUserId));

  const isLocked = currentRole === 'mol' && !canEditThis;
  const rowClass = `equipment-row-clickable${isLocked ? ' row-locked' : ''}`;
  const lockIcon = isLocked
    ? '<span class="lock-icon" title="Техника закреплена за другим МОЛом — только просмотр">🔒</span>'
    : '';

  // Назначена
  let assignedInfo = '—';
  if (item.status === 'assigned' && item.user_name) {
    const initials = getInitials(item.user_name);
    assignedInfo = `
      <div class="assigned-cell">
        <span class="assigned-avatar">${initials}</span>
        <div class="assigned-info">
          <div class="assigned-name">${escapeHtml(item.user_name)}</div>
          ${item.user_department ? `<div class="assigned-dept">${escapeHtml(item.user_department)}</div>` : ''}
        </div>
      </div>
    `;
  } else if (item.status === 'assigned') {
    assignedInfo = '<span style="color: #a0aec0; font-size: 12px;">не найдено</span>';
  }

  // Категория / Тип
  const categoryCell = item.category_name
    ? `<span class="catalog-badge">${item.category_icon || '📁'} ${escapeHtml(item.category_name)}</span>`
    : '<span style="color: #cbd5e0;">—</span>';
  const typeCell = item.type_name
    ? `<span class="catalog-badge type">${item.type_icon || '📦'} ${escapeHtml(item.type_name)}</span>`
    : '<span style="color: #cbd5e0;">—</span>';

  // Место хранения
  let cellInfo = '<span style="color: #cbd5e0;">—</span>';
  if (item.cell_id) {
    cellInfo = `<div class="location-cell" title="${escapeHtml(item.warehouse_name || '')} → ${escapeHtml(item.zone_name || '')} → ${escapeHtml(item.rack_name || '')} → ${escapeHtml(item.cell_name || '')}">
        <div class="location-cell-code">${escapeHtml(item.cell_code || item.cell_name || '')}</div>
        <div class="location-path" style="font-size: 10px;">${escapeHtml(item.warehouse_name || '')}</div>
      </div>`;
  } else if (item.workplace_id) {
    const wpLabel = `${escapeHtml(item.workplace_name || 'Место')}${item.workplace_code ? ` [${escapeHtml(item.workplace_code)}]` : ''}`;
    const officeLabel = escapeHtml(item.office_name || '');
    const link = item.office_id
      ? `/admin/workplaces/${item.office_id}?highlightWorkplace=${item.workplace_id}`
      : '#';
    cellInfo = `<div class="location-cell">
        <a href="${link}" class="location-cell-code" style="background: var(--purple-bg); color: var(--purple); text-decoration: none;" title="Открыть в дереве офиса">🪑 ${wpLabel}</a>
        <div class="location-path" style="font-size: 10px;">${officeLabel}</div>
      </div>`;
  }

  // Статус
  const statusLabels = {
    available:   '✅ Доступна',
    placed:      '🪑 На рабочем месте',
    assigned:    '👤 Назначена',
    maintenance: '🔧 В ремонте',
    retired:     '❌ Списана',
  };
  const statusLabel = statusLabels[item.status] || item.status;
  const statusClass = `status-${item.status}`;

  // Ответственный МОЛ (для admin / supervisor)
  let responsibleCell = '';
  if (currentRole === 'admin' || currentRole === 'supervisor') {
    if (item.responsible_user_name) {
      const initials = getInitials(item.responsible_user_name);
      responsibleCell = `<td>
        <div class="assigned-cell">
          <span class="assigned-avatar">${initials}</span>
          <div class="assigned-info">
            <div class="assigned-name">${escapeHtml(item.responsible_user_name)}</div>
          </div>
        </div>
      </td>`;
    }else {
      responsibleCell = `<td><span style="color: #cbd5e0;">—</span></td>`;
    }
  }

  return {
    canBulkMove, isLocked, rowClass, lockIcon,
    assignedInfo, categoryCell, typeCell, cellInfo,
    statusLabel, statusClass, responsibleCell,
  };
}

// ============================================================
// GET /manage/add, GET /manage/edit/:id
// ============================================================

async function renderAddEquipment(req, res) {
  try {
    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-add.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    const models = await getAllModels();
    let modelOptions = '<option value="">— Выберите модель —</option>';
    models.forEach(m => {
      const manufacturer = m.manufacturer ? ` · ${escapeHtml(m.manufacturer)}` : '';
      const category = m.category_name ? ` · ${escapeHtml(m.category_name)}` : '';
      const type = m.type_name ? ` / ${escapeHtml(m.type_name)}` : '';
      modelOptions += `<option value="${m.id}">${escapeHtml(m.corporate_id)} · ${escapeHtml(m.name)}${manufacturer}${category}${type}</option>`;
    });
    content = content.replace('{{model_options}}', modelOptions);

    const currentRole = req.session.role || 'user';
    content = content.replace(/\{\{current_role\}\}/g, currentRole);

        // 🆕 5.15.3: дефолты для новой техники
    content = content.replace(/\{\{is_quantity_accounted_checked\}\}/g, 'checked'); // по умолчанию ✓
    content = content.replace(/\{\{is_fixed_asset_checked\}\}/g, '');
    content = content.replace(/\{\{is_quantity_accounted_disabled\}\}/g, '');
    content = content.replace(/\{\{fixed_asset_block_style\}\}/g, 'display: none;');
    content = content.replace(/\{\{commissioning_date\}\}/g, '');
    content = content.replace(/\{\{initial_cost\}\}/g, '');
    content = content.replace(/\{\{useful_life_months\}\}/g, '');

    if (currentRole === 'admin') {
      const users = await getAllUsers();
      const mols = users.filter(u => u.role === 'mol' && u.is_active === 1);
      let molOptions = '<option value="">— Выберите МОЛ —</option>';
      mols.forEach(m => {
        molOptions += `<option value="${m.id}">${escapeHtml(m.full_name || m.username)}</option>`;
      });
      content = content.replace('{{mol_options}}', molOptions);
      content = content.replace(/\{\{mol_field_class\}\}/g, '');
    } else {
      content = content.replace('{{mol_options}}', '');
      content = content.replace(/\{\{mol_field_class\}\}/g, 'hidden');
    }

    renderPageFor(req, res, {
      title: 'Добавить технику – MoveIT service',
      content,
      pageCss: '/css/admin-add.css',
      pageJs: '/js/admin-add.js',
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки страницы добавления:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

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

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-edit.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    content = content.replace(/\{\{id\}\}/g, equipment.id);
    content = content.replace(/\{\{inventory_number\}\}/g, escapeHtml(equipment.inventory_number || ''));
    content = content.replace(/\{\{serial_number\}\}/g, escapeHtml(equipment.serial_number || ''));
    content = content.replace(/\{\{purchase_date\}\}/g, equipment.purchase_date || '');
    content = content.replace(/\{\{warranty_until\}\}/g, equipment.warranty_until || '');
    content = content.replace(/\{\{status\}\}/g, equipment.status || 'available');
    content = content.replace(/\{\{description\}\}/g, escapeHtml(equipment.description || ''));
    content = content.replace(/\{\{cell_id\}\}/g, equipment.cell_id || '');
    content = content.replace(/\{\{workplace_id\}\}/g, equipment.workplace_id || '');
    content = content.replace(/\{\{selected_model_id\}\}/g, equipment.model_id || '');

        // 🆕 5.15.3: количественный учёт + ОС
    content = content.replace(
      /\{\{is_quantity_accounted_checked\}\}/g,
      equipment.is_quantity_accounted ? 'checked' : ''
    );
    content = content.replace(
      /\{\{is_fixed_asset_checked\}\}/g,
      equipment.is_fixed_asset ? 'checked' : ''
    );
    content = content.replace(
      /\{\{is_fixed_asset_disabled\}\}/g,
      '' // в edit чекбокс ОС всегда доступен
    );
    content = content.replace(
      /\{\{is_quantity_accounted_disabled\}\}/g,
      equipment.is_fixed_asset ? 'disabled' : ''
    );
    content = content.replace(
      /\{\{commissioning_date\}\}/g,
      escapeHtml(equipment.commissioning_date || '')
    );
    content = content.replace(
      /\{\{initial_cost\}\}/g,
      equipment.initial_cost != null ? equipment.initial_cost : ''
    );
    content = content.replace(
      /\{\{useful_life_months\}\}/g,
      equipment.useful_life_months != null ? equipment.useful_life_months : ''
    );
    content = content.replace(
      /\{\{fixed_asset_block_style\}\}/g,
      equipment.is_fixed_asset ? '' : 'display: none;'
    );

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

    const currentRole = req.session.role || 'user';
    content = content.replace(/\{\{current_role\}\}/g, currentRole);

    if (currentRole === 'admin') {
      const allUsers = await getAllUsers();
      const mols = allUsers.filter(u => u.role === 'mol' && u.is_active === 1);
      let molOptions = '';
      mols.forEach(m => {
        const selected = String(m.id) === String(equipment.responsible_user_id) ? 'selected' : '';
        molOptions += `<option value="${m.id}" ${selected}>${escapeHtml(m.full_name || m.username)}</option>`;
      });
      content = content.replace('{{mol_options}}', molOptions);
      content = content.replace(/\{\{mol_field_class\}\}/g, '');
    } else {
      content = content.replace('{{mol_options}}', '');
      content = content.replace(/\{\{mol_field_class\}\}/g, 'hidden');
    }

    const responsibleName = equipment.responsible_user_name
      ? escapeHtml(equipment.responsible_user_name)
      : '—';
    content = content.replace(/\{\{info_responsible\}\}/g, responsibleName);

    const infoStatus = statusLabels[equipment.status] || equipment.status || '—';
    content = content.replace(/\{\{info_inventory\}\}/g, escapeHtml(equipment.inventory_number || '—'));
    content = content.replace(/\{\{info_model_name\}\}/g, escapeHtml(equipment.model_name || '—'));
    content = content.replace(/\{\{info_corporate_id\}\}/g, escapeHtml(equipment.model_corporate_id || '—'));
    content = content.replace(/\{\{info_manufacturer\}\}/g, escapeHtml(equipment.model_manufacturer || '—'));
    content = content.replace(/\{\{info_category\}\}/g, equipment.category_name
      ? `${equipment.category_icon || '📁'} ${escapeHtml(equipment.category_name)}`
      : '—');
    content = content.replace(/\{\{info_type\}\}/g, equipment.type_name
      ? `${equipment.type_icon || '📦'} ${escapeHtml(equipment.type_name)}`
      : '—');
    content = content.replace(/\{\{info_serial\}\}/g, escapeHtml(equipment.serial_number || '—'));
    content = content.replace(/\{\{info_status\}\}/g, escapeHtml(infoStatus));
        content = content.replace(/\{\{info_quantity_accounted\}\}/g,
      equipment.is_quantity_accounted ? '✅ Да' : '❌ Нет (малоценка)');
    content = content.replace(/\{\{info_fixed_asset\}\}/g,
      equipment.is_fixed_asset
        ? `🏦 Да (с ${escapeHtml(equipment.commissioning_date || '—')})`
        : '—');

    const users = await getAllUsers();
    let userOptions = '';
    users.forEach(user => {
      const fullName = user.full_name || user.username;
      const dept = user.department ? ` (${user.department})` : '';
      userOptions += `<option value="${user.id}">${escapeHtml(fullName)}${escapeHtml(dept)}</option>`;
    });
    content = content.replace('{{user_options}}', userOptions);

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

module.exports = {
  renderManage,
  renderAddEquipment,
  renderEditEquipment,
};