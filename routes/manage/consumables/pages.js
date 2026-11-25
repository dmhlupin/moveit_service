// routes/manage/consumables/pages.js
// ============================================================
// GET /manage/consumables — список остатков номенклатуры (5.16.2b).
//
// Отличия от renderEquipmentKindPage:
//   - данные из getItems (items + item_models), а не getEquipmentWithLocation;
//   - фильтры: поиск, склад, категория, тип, «только ниже минимума»,
//     «показывать неактивные»;
//   - нет bulk-actions / карточки техники;
//   - справочники для фильтров — через database/modules/items/models.js
//     (getItemCategories / getItemTypes / getItemWarehouses), без прямых db.all.
// ============================================================

const fs = require('fs');
const path = require('path');

const {
  getItems,
  buildItemScope,
  getItemCategories,
  getItemTypes,
  getItemWarehouses,
} = require('../../../database/db');

const { renderPageFor } = require('../../../utils/layout');
const {
  escapeHtml,
  sortableTh,
  renderManagePagination,
} = require('../helpers');

const {
  getConsumableColumns,
  renderConsumableTableHead,
  renderConsumableRow,
  renderConsumableEmptyRow,
  buildConsumablePageActions,
} = require('./helpers');

const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

const ALLOWED_SORTS = [
  'id', 'model_name', 'corporate_id', 'category', 'type',
  'unit', 'warehouse', 'quantity', 'min_quantity', 'status',
];

const BASE_PATH = '/manage/consumables';

// ============================================================
// GET /manage/consumables
// ============================================================

async function renderConsumablesPage(req, res) {
  try {
    const currentRole   = req.session.role || 'user';
    const currentUserId = req.session.userId || 0;
    const user = { id: currentUserId, role: currentRole };
    const q = req.query || {};

    // ---------- Пагинация / сортировка ----------
    const requestedLimit = parseInt(q.limit, 10);
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE;
    const page = Math.max(1, parseInt(q.page, 10) || 1);

    const sort  = ALLOWED_SORTS.includes(q.sort) ? q.sort : 'model_name';
    const order = (String(q.order).toLowerCase() === 'desc') ? 'desc' : 'asc';

    // ---------- Фильтры ----------
    const filters = {
      kind: 'consumable',                 // 5.16.2b: только расходники
      search:       (q.search       || '').trim() || null,
      warehouse_id: q.warehouse_id ? parseInt(q.warehouse_id, 10) : null,
      category_id:  q.category_id  ? parseInt(q.category_id, 10)  : null,
      type_id:      q.type_id      ? parseInt(q.type_id, 10)      : null,
      low_stock:    q.low_stock === '1',
      // «показывать неактивные» = is_active НЕ фильтруем (undefined)
      is_active:    q.show_inactive === '1' ? undefined : 1,
    };

    // ---------- Scope для МОЛ ----------
    const scopeWhere = buildItemScope(user);

    // ---------- Данные ----------
    const [rows, warehouses, categories, types] = await Promise.all([
      getItems(filters, scopeWhere),
      getItemWarehouses(),
      getItemCategories(),
      getItemTypes(),
    ]);

    // Клиентская пагинация (getItems пока без limit/offset — объём небольшой).
    // При росте > 500 позиций — вынести в SQL (5.16.2d).
    const totalFiltered = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    // ---------- Шаблон ----------
    const htmlPath = path.join(__dirname, '..', '..', '..', 'views', 'manage-consumables.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // ---------- Скаляры ----------
    html = html.replace(/\{\{current_role\}\}/g,    currentRole);
    html = html.replace(/\{\{current_user_id\}\}/g, currentUserId);
    html = html.replace(/\{\{total_items\}\}/g,     totalFiltered);
    html = html.replace(/\{\{base_path\}\}/g,       BASE_PATH);

    // ---------- page_actions ----------
    html = html.replace('{{page_actions}}', buildConsumablePageActions(currentRole));

    // ---------- Фильтры ----------
    html = html.replace('{{filter_search}}',            escapeHtml(filters.search || ''));
    html = html.replace('{{filter_warehouse_options}}', buildWarehouseOptions(warehouses, filters.warehouse_id));
    html = html.replace('{{filter_category_options}}',  buildCategoryOptions(categories, filters.category_id));
    html = html.replace('{{filter_type_options}}',      buildTypeOptions(types, filters));
    html = html.replace(/\{\{filter_low_stock_checked\}\}/g,     filters.low_stock ? 'checked' : '');
    html = html.replace(/\{\{filter_show_inactive_checked\}\}/g, (q.show_inactive === '1') ? 'checked' : '');
    html = html.replace('{{page_size_options}}', buildPageSizeOptions(ALLOWED_PAGE_SIZES, pageSize));

    // ---------- Таблица ----------
    const cols = getConsumableColumns(currentRole);
    const th = (col, label, extraClass) => sortableTh(col, label, sort, order, q, extraClass || '', BASE_PATH);

    html = html.replace('{{table_head}}', renderConsumableTableHead(cols, th));

    let rowsHtml = '';
    if (pageRows.length === 0) {
      rowsHtml = renderConsumableEmptyRow(cols);
    } else {
      pageRows.forEach(item => {
        rowsHtml += renderConsumableRow(item, { role: currentRole, basePath: BASE_PATH });
      });
    }
    html = html.replace('{{consumable_rows}}', rowsHtml);

    // ---------- Пагинация ----------
    html = html.replace('{{pagination}}', renderManagePagination({
      page, totalPages, totalFiltered, query: q, basePath: BASE_PATH,
    }));

    // ---------- Рендер ----------
    renderPageFor(req, res, {
      title: 'Расходные материалы – MoveIT service',
      content: html,
      pageCss: [
        '/css/manage/table.css',
        '/css/manage/actions.css',
        '/css/manage/modals.css',
        '/css/manage/responsive.css',
      ],
      pageJs: [
        '/js/manage/helpers.js',
        '/js/manage/columns.js',
        '/js/manage-consumables/filters.js',
        '/js/manage-consumables/init.js',
      ],
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки расходников:', error);
    res.status(500).send('Ошибка при загрузке расходников');
  }
}

// ============================================================
// view-хелперы (только форматирование option-ов)
// ============================================================

function buildWarehouseOptions(warehouses, selectedId) {
  let html = '<option value="">Все склады</option>';
  warehouses.forEach(w => {
    const sel = String(w.id) === String(selectedId) ? 'selected' : '';
    html += `<option value="${w.id}" ${sel}>${escapeHtml(w.name)}</option>`;
  });
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
  const filtered = filters.category_id
    ? types.filter(t => Number(t.category_id) === filters.category_id)
    : types;
  filtered.forEach(t => {
    const sel = String(t.id) === String(filters.type_id) ? 'selected' : '';
    html += `<option value="${t.id}" ${sel}>${t.icon || '📦'} ${escapeHtml(t.name)}</option>`;
  });
  return html;
}

function buildPageSizeOptions(sizes, currentPageSize) {
  return sizes.map(size => {
    const sel = size === currentPageSize ? 'selected' : '';
    return `<option value="${size}" ${sel}>${size}</option>`;
  }).join('');
}

module.exports = {
  renderConsumablesPage,
};