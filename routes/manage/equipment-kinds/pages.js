// routes/manage/equipment-kinds/pages.js
// ============================================================
// Страницы разделов: /manage/fixed-assets, /manage/tangible,
// /manage/low-value + заглушка /manage/consumables.
//
// Общий рендер-движок. Отличия от /manage:
//   - kind жёстко зашит в фильтр (getEquipmentWithLocation({ kind }));
//   - нет фильтров «Учёт» / «ОС» (они константа раздела);
//   - в таблице нет колонки «Учёт» и значка 🏦;
//   - для fixed_asset — колонки «Дата ввода» / «Стоимость»;
//   - сортировка / пагинация сохраняют basePath раздела.
// ============================================================

const fs = require('fs');
const path = require('path');

const {
  getEquipmentWithLocation,
  getAllCategories,
  getAllTypes,
  getMolsForFilter,
  getStats,
} = require('../../../database/db');

const { renderPageFor } = require('../../../utils/layout');
const {
  escapeHtml,
  getInitials,
  sortableTh,
  renderManagePagination,
} = require('../helpers');

const {
  getKindColumns,
  renderKindTableHead,
  renderKindEquipmentRow,
  renderKindEmptyRow,
  buildKindPageActions,
} = require('./helpers');

const { getKindMeta, EQUIPMENT_KINDS } = require('../../../database/modules/equipment/helpers');

const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

const ALLOWED_SORTS = [
  'id', 'inventory_number', 'model_name', 'corporate_id',
  'category', 'type', 'description', 'location', 'status',
  'assigned', 'responsible', 'created_at', 'purchase_date',
  'commissioning_date', 'initial_cost',
];

// ============================================================
// GET /manage/fixed-assets | /manage/tangible | /manage/low-value
// ============================================================

async function renderEquipmentKindPage(req, res, kind) {
  try {
    const meta = getKindMeta(kind);
    if (!meta) {
      return res.status(404).send('Раздел не найден');
    }

    const currentRole   = req.session.role || 'user';
    const currentUserId = req.session.userId || 0;
    const scope = { userId: currentUserId, role: currentRole };
    const q = req.query || {};

    // ---------- Пагинация / сортировка ----------
    const requestedLimit = parseInt(q.limit, 10);
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE;
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * pageSize;

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
      // 🆕 5.16.1: фильтр по виду
      kind,
    };

    // ---------- Данные ----------
    const [result, categories, types, mols] = await Promise.all([
      getEquipmentWithLocation(filters, scope),
      getAllCategories(),
      getAllTypes(),
      currentRole === 'admin' ? getMolsForFilter() : Promise.resolve([]),
    ]);

    const equipment = result.items || [];
    const totalFiltered = result.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

    // ---------- Шаблон ----------
    const htmlPath = path.join(__dirname, '..', '..', '..', 'views', 'manage-kind.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const partialPath = path.join(__dirname, '..', '..', '..', 'views', 'partials', 'equipment-card.html');
    const equipmentCardPartial = fs.readFileSync(partialPath, 'utf8');

    // ---------- Шапка / kind-мета ----------
    html = html.replace(/\{\{kind_title\}\}/g,       escapeHtml(meta.title));
    html = html.replace(/\{\{kind_icon\}\}/g,        meta.icon);
    html = html.replace(/\{\{kind_description\}\}/g, escapeHtml(meta.description));
    html = html.replace(/\{\{kind_base_path\}\}/g,   meta.basePath);
    html = html.replace(/\{\{kind\}\}/g,             kind);

    // ---------- Скаляры ----------
    html = html.replace(/\{\{total_equipment\}\}/g,    totalFiltered);
    html = html.replace(/\{\{current_role\}\}/g,       currentRole);
    html = html.replace(/\{\{current_user_id\}\}/g,    currentUserId);

    // ---------- page_actions ----------
    html = html.replace('{{page_actions}}', buildKindPageActions(currentRole, kind, meta));

    const addBtn = (currentRole === 'admin' || currentRole === 'mol')
        ? `<a href="/manage/add?kind=${kind}" class="btn btn-success btn-sm">Добавить</a>`
        : '';
    html = html.replace('{{add_button}}', addBtn);

    // ---------- Фильтры ----------
    html = html.replace('{{filter_category_options}}', buildCategoryOptions(categories, filters.category_id));
    html = html.replace('{{filter_type_options}}',     buildTypeOptions(types, filters));
    html = html.replace('{{filter_mol_options}}',      buildMolOptions(mols, filters, currentRole));
    html = html.replace('{{filter_only_mine_block}}',  buildOnlyMineBlock(filters, currentRole));

    html = html.replace(/\{\{filter_corporate_id\}\}/g, escapeHtml(filters.corporate_id || ''));
    html = html.replace(/\{\{filter_model_name\}\}/g,   escapeHtml(filters.model_name || ''));
    html = html.replace(/\{\{filter_search\}\}/g,       escapeHtml(filters.search || ''));
    html = html.replace(/\{\{filter_unplaced_checked\}\}/g, filters.unplaced ? 'checked' : '');
    html = html.replace(/\{\{filter_stale_checked\}\}/g,    filters.stale ? 'checked' : '');
    html = html.replace('{{page_size_options}}', buildPageSizeOptions(ALLOWED_PAGE_SIZES, pageSize));

    // ---------- Таблица ----------
    const cols = getKindColumns(kind, currentRole);
    const th = (col, label, extraClass) => sortableTh(col, label, sort, order, q, extraClass || '', meta.basePath);

    html = html.replace('{{table_head}}', renderKindTableHead(cols, th));

    let rows = '';
    if (equipment.length === 0) {
      rows = renderKindEmptyRow(cols);
    } else {
      equipment.forEach(item => {
        rows += renderKindEquipmentRow(item, buildKindRowContext(item, currentRole, currentUserId, kind));
      });
    }
    html = html.replace('{{equipment_rows}}', rows);

    // ---------- Пагинация / прочее ----------
    html = html.replace('{{pagination}}', renderManagePagination({
      page, totalPages, totalFiltered, query: q, basePath: meta.basePath,
    }));
    html = html.replace('{{open_equipment_id}}', q.open_equipment ? parseInt(q.open_equipment, 10) || '' : '');
    html = html.replace('{{equipment_card_partial}}', equipmentCardPartial);

    renderPageFor(req, res, {
      title: `${meta.title} – MoveIT service`,
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
        '/js/manage-kind/filters.js',
        '/js/manage/init.js',
      ],
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки раздела:', error);
    res.status(500).send('Ошибка при загрузке раздела');
  }
}

// ============================================================
// GET /manage/consumables — заглушка (5.16.2)
// ============================================================

function renderConsumablesStub(req, res) {
  const html = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🧴 Расходные материалы</h1>
        <div class="page-subtitle">Раздел в разработке</div>
      </div>
      <div class="page-actions">
        <a href="/manage" class="btn btn-ghost btn-sm">🧾 Все ТМЦ</a>
      </div>
    </div>

    <div class="table-container" style="padding: 40px; text-align: center;">
      <div style="font-size: 60px; margin-bottom: 16px;">🚧</div>
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
        Раздел «Расходные материалы» появится в 5.16.2
      </div>
      <div style="color: var(--text-secondary); font-size: 14px;">
        Здесь будет отдельная таблица <code>consumables</code> с остатками и минимальными запасами.
      </div>
    </div>
  `;

  renderPageFor(req, res, {
    title: 'Расходные материалы – MoveIT service',
    content: html,
    pageCss: ['/css/manage/table.css'],
  });
}

// ============================================================
// view-хелперы (локальные копии из pages.js — не тянем /manage)
// ============================================================

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
  return `
    <div class="filter-group">
      <label>Показать</label>
      <select id="filterOnlyMine">
        <option value="">Все ТМЦ</option>
        <option value="1" ${filters.only_mine ? 'selected' : ''}>Только мои</option>
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

/**
 * Контекст строки для раздела.
 * Отличия от buildRowContext (/manage):
 *   - нет quantityCell / fixedAssetIcon (в разделах константа);
 *   - kind передаётся в renderKindEquipmentRow для условных колонок.
 */
function buildKindRowContext(item, currentRole, currentUserId, kind) {
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
        <a href="${link}" class="location-cell-code" style="background: var(--purple-bg); color: var(--purple); text-decoration: none;">🪑 ${wpLabel}</a>
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

  // Ответственный МОЛ
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
    } else {
      responsibleCell = `<td><span style="color: #cbd5e0;">—</span></td>`;
    }
  }

  return {
    kind,
    canBulkMove, isLocked, rowClass, lockIcon,
    assignedInfo, categoryCell, typeCell, cellInfo,
    statusLabel, statusClass, responsibleCell,
  };
}

module.exports = {
  renderEquipmentKindPage,
  renderConsumablesStub,
};