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
} = require('./helpers');

// ============================================================
// GET /manage
// ============================================================

async function renderManage(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const currentRole = req.session.role;
    const q = req.query || {};

    const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];
    const DEFAULT_PAGE_SIZE = 10;
    const requestedLimit = parseInt(q.limit, 10);
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE;
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    const ALLOWED_SORTS = [
      'id', 'inventory_number', 'model_name', 'corporate_id',
      'category', 'type', 'status', 'responsible', 'location',
      'created_at', 'purchase_date',
    ];
    const sort = ALLOWED_SORTS.includes(q.sort) ? q.sort : 'id';
    const order = (String(q.order).toLowerCase() === 'desc') ? 'desc' : 'asc';

    const filters = {
      category_id:  q.category_id  ? parseInt(q.category_id, 10)  : null,
      type_id:      q.type_id      ? parseInt(q.type_id, 10)      : null,
      status:       q.status       || null,
      mol_id:       q.mol_id       ? parseInt(q.mol_id, 10)       : null,
      corporate_id: (q.corporate_id || '').trim() || null,
      model_name:   (q.model_name   || '').trim() || null,
      search:       (q.search       || '').trim() || null,
      sort, order,
      limit: pageSize, offset, include_total: true,
    };

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

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'manage.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    html = html.replace(/\{\{total_equipment\}\}/g, stats.total_equipment || 0);
    html = html.replace(/\{\{available_equipment\}\}/g, stats.available_equipment || 0);
    html = html.replace(/\{\{assigned_equipment\}\}/g, stats.assigned_equipment || 0);
    html = html.replace(/\{\{total_users\}\}/g, stats.total_users || 0);

    html = html.replace(/\{\{current_role\}\}/g, currentRole || 'user');
    html = html.replace(/\{\{current_user_id\}\}/g, req.session.userId || 0);

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

    const responsibleTh = (currentRole === 'admin' || currentRole === 'supervisor')
      ? '<th style="width: 150px;">Ответственный МОЛ</th>'
      : '';
    html = html.replace('{{responsible_th}}', responsibleTh);

    let categoryOptions = '<option value="">Все категории</option>';
    categories.forEach(c => {
      const sel = String(c.id) === String(filters.category_id) ? 'selected' : '';
      categoryOptions += `<option value="${c.id}" ${sel}>${c.icon || '📁'} ${escapeHtml(c.name)}</option>`;
    });
    html = html.replace('{{filter_category_options}}', categoryOptions);

    let typeOptions = '<option value="">Все типы</option>';
    const filteredTypes = filters.category_id
      ? types.filter(t => Number(t.category_id) === filters.category_id)
      : types;
    filteredTypes.forEach(t => {
      const sel = String(t.id) === String(filters.type_id) ? 'selected' : '';
      typeOptions += `<option value="${t.id}" ${sel}>${t.icon || '📦'} ${escapeHtml(t.name)}</option>`;
    });
    html = html.replace('{{filter_type_options}}', typeOptions);

    let molOptions = '';
    if (currentRole === 'admin') {
      molOptions = '<option value="">Все МОЛы</option>';
      mols.forEach(m => {
        const sel = String(m.id) === String(filters.mol_id) ? 'selected' : '';
        molOptions += `<option value="${m.id}" ${sel}>${escapeHtml(m.full_name || m.username)}</option>`;
      });
    }
    html = html.replace('{{filter_mol_options}}', molOptions);

    html = html.replace(/\{\{filter_corporate_id\}\}/g, escapeHtml(filters.corporate_id || ''));
    html = html.replace(/\{\{filter_model_name\}\}/g, escapeHtml(filters.model_name || ''));
    html = html.replace(/\{\{filter_search\}\}/g, escapeHtml(filters.search || ''));

    let pageSizeOptions = '';
    ALLOWED_PAGE_SIZES.forEach(size => {
      const sel = size === pageSize ? 'selected' : '';
      pageSizeOptions += `<option value="${size}" ${sel}>${size}</option>`;
    });
    html = html.replace('{{page_size_options}}', pageSizeOptions);

    const th = (col, label) => sortableTh(col, label, sort, order, q);

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
        const canBulkMove = (currentRole === 'admin' || currentRole === 'mol');
        const statusClass = `status-${item.status}`;

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

    html = html.replace('{{pagination}}', renderManagePagination({
      page, totalPages, totalFiltered, query: q,
    }));

    renderPageFor(req, res, {
      title: 'Учёт ТМЦ – MoveIT service',
      content: html,
      pageCss: [                      // стало
        '/css/manage/table.css',
        '/css/manage/card.css',
        '/css/manage/actions.css',
        '/css/manage/modals.css',
        '/css/manage/responsive.css',
      ],
      pageJs: [
        '/js/manage/helpers.js',
        '/js/manage/equipment-card.js',
        '/js/manage/equipment-actions.js',
        '/js/manage/bulk-actions.js',
        '/js/manage/filters.js',
        '/js/manage/init.js',
      ],
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки страницы учёта ТМЦ:', error);
    res.status(500).send('Ошибка при загрузке страницы учёта ТМЦ');
  }
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