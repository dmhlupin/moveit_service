// routes/manage/consumables/helpers.js
// ============================================================
// Рендер-хелперы для /manage/consumables (расходники, 5.16.2b).
// Сущность — остаток номенклатуры (items + item_models).
// Отличия от equipment-kinds/helpers.js:
//   - нет чекбоксов (bulk-actions для остатков не нужны);
//   - колонки: Номенклатура / Ед. / Склад / Остаток / Мин. / Статус;
//   - нет «Назначена» / «Ответственный МОЛ» (нет экземпляров);
//   - статус считается: ⚠️ «Ниже минимума» / ✅ «В норме» / 💤 «Неактивна».
// ============================================================

const { escapeHtml } = require('../helpers');

/**
 * Колонки таблицы расходников.
 * @param {string} role — 'admin' | 'supervisor' | 'mol'
 * @returns {Array<{ key, width, td }>}
 */
function getConsumableColumns(role) {
  const canEdit = (role === 'admin' || role === 'mol');

  const cols = [
    { key: 'id',          width: '60px',  td: 'id' },
    { key: 'model',       width: '260px', td: 'model', cls: 'th-model' },
    { key: 'corporate',   width: '130px', td: 'corporate' },
    { key: 'category',    width: '150px', td: 'category' },
    { key: 'type',        width: '150px', td: 'type' },
    { key: 'unit',        width: '80px',  td: 'unit' },
    { key: 'warehouse',   width: '180px', td: 'warehouse' },
    { key: 'quantity',    width: '110px', td: 'quantity' },
    { key: 'min_quantity',width: '110px', td: 'min_quantity' },
    { key: 'status',      width: '160px', td: 'status' },
  ];

  if (canEdit) {
    cols.push({ key: 'actions', width: '130px', td: 'actions' });
  }

  return cols;
}

/**
 * <thead> для расходников.
 * @param {Array} cols — из getConsumableColumns
 * @param {Function} th — sortableTh с basePath
 */
function renderConsumableTableHead(cols, th) {
  const LABELS = {
    id:           ['id',          'ID'],
    model:        ['model_name',  'Номенклатура', 'th-model'],
    corporate:    ['corporate_id','Корп. ИД'],
    category:     ['category',    'Категория'],
    type:         ['type',        'Тип'],
    unit:         ['unit',        'Ед.'],
    warehouse:    ['warehouse',   'Склад'],
    quantity:     ['quantity',    'Остаток'],
    min_quantity: ['min_quantity','Мин. остаток'],
    status:       ['status',      'Статус'],
    actions:      [null,          'Действия'],
  };

  return cols.map(c => {
    const widthStyle = c.width ? ` style="width: ${c.width}"` : '';
    const label = LABELS[c.key];
    if (!label) return '';

    if (c.key === 'actions') {
      return `<th data-col="actions"${widthStyle}>Действия</th>`;
    }

    const [sortKey, text, cls] = label;
    const inner = th(sortKey, text, cls || '');
    return inner.replace('<th', `<th data-col="${c.key}"${widthStyle}`);
  }).join('\n');
}

/**
 * Строка таблицы расходников.
 * @param {Object} item — из getItems
 * @param {Object} ctx  — { role, basePath }
 */
function renderConsumableRow(item, ctx) {
  const canEdit = (ctx.role === 'admin' || ctx.role === 'mol');

  // Статус
  const isLow = (Number(item.min_quantity) > 0
                 && Number(item.quantity) <= Number(item.min_quantity));
  let statusLabel, statusClass;
  if (!item.is_active) {
    statusLabel = '💤 Неактивна';
    statusClass = 'status-inactive';
  } else if (isLow) {
    statusLabel = '⚠️ Ниже минимума';
    statusClass = 'status-warning';
  } else {
    statusLabel = '✅ В норме';
    statusClass = 'status-ok';
  }

  // Категория / Тип
  const categoryCell = item.category_name
    ? `<span class="catalog-badge">${escapeHtml(item.category_name)}</span>`
    : '<span style="color:#cbd5e0;">—</span>';
  const typeCell = item.type_name
    ? `<span class="catalog-badge type">${escapeHtml(item.type_name)}</span>`
    : '<span style="color:#cbd5e0;">—</span>';

  // Количество — с единицей
  const qtyText = `${formatNumber(item.quantity)} <span style="color:var(--text-muted);font-size:11px;">${escapeHtml(item.unit || '')}</span>`;
  const minText = Number(item.min_quantity) > 0
    ? formatNumber(item.min_quantity)
    : '<span style="color:#cbd5e0;">—</span>';

  // Действия
  let actionsCell = '';
  if (canEdit) {
    actionsCell = `
      <td data-col="actions" onclick="event.stopPropagation()">
        <button type="button" class="btn btn-ghost btn-sm"
                onclick="openConsumableEdit(${item.id})" title="Редактировать">✏️</button>
        <button type="button" class="btn btn-ghost btn-sm"
                onclick="deleteConsumable(${item.id})" title="Удалить">🗑️</button>
      </td>
    `;
  }

  return `
    <tr class="equipment-row" data-id="${item.id}">
      <td data-col="id">${item.id}</td>
      <td data-col="model" class="th-model" title="${escapeHtml(item.model_name || '')}">${escapeHtml(item.model_name || '—')}</td>
      <td data-col="corporate">${escapeHtml(item.corporate_id || '—')}</td>
      <td data-col="category">${categoryCell}</td>
      <td data-col="type">${typeCell}</td>
      <td data-col="unit">${escapeHtml(item.unit || '—')}</td>
      <td data-col="warehouse">${escapeHtml(item.warehouse_name || '—')}</td>
      <td data-col="quantity">${qtyText}</td>
      <td data-col="min_quantity">${minText}</td>
      <td data-col="status"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      ${actionsCell}
    </tr>
  `;
}

function renderConsumableEmptyRow(cols) {
  return `
    <tr class="empty-row">
      <td colspan="${cols.length}" style="text-align:center;padding:40px;color:var(--text-muted);">
        <div style="font-size:40px;margin-bottom:10px;">🧴</div>
        <div>Расходников не найдено</div>
        <div style="font-size:12px;margin-top:5px;">Попробуйте изменить фильтры или добавьте позицию</div>
      </td>
    </tr>
  `;
}

/**
 * Кнопки в page_actions: «Добавить позицию» + переходы.
 */
function buildConsumablePageActions(role) {
  let html = '';

  if (role === 'admin' || role === 'mol') {
    html += `<button type="button" class="btn btn-success btn-sm" onclick="openConsumableCreate()">➕ Добавить позицию</button>`;
  }

  html += `<a href="/manage/fixed-assets" class="btn btn-ghost btn-sm">🏦 ОС</a>`;
  html += `<a href="/manage/tangible"    class="btn btn-ghost btn-sm">📦 ТМЦ</a>`;
  html += `<a href="/manage/low-value"   class="btn btn-ghost btn-sm">🏷️ Малоценка</a>`;
  html += `<a href="/manage"             class="btn btn-ghost btn-sm" title="Сводный реестр">🧾 Все ТМЦ</a>`;

  return html;
}

function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  // Целое — без дробной части, дробное — до 2 знаков
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

module.exports = {
  getConsumableColumns,
  renderConsumableTableHead,
  renderConsumableRow,
  renderConsumableEmptyRow,
  buildConsumablePageActions,
  formatNumber,
};