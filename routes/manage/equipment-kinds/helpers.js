// routes/manage/equipment-kinds/helpers.js
// ============================================================
// Рендер-хелперы для страниц разделов (ОС / ТМЦ / малоценка).
// Отдельно от routes/manage/helpers.js, чтобы не ломать /manage:
//   - getKindColumns(kind, role)  — колонки раздела (без «Учёт», «ОС»;
//                                    для fixed_asset + дата ввода + стоимость)
//   - renderKindTableHead(cols, th)
//   - renderKindEquipmentRow(item, ctx)
//   - renderKindEmptyRow(cols)
//   - buildKindPageActions(role, kind, meta)  — ссылки на другие разделы
//
// Переиспользует escapeHtml / getInitials из routes/manage/helpers.js.
// ============================================================

const {
  escapeHtml,
  getInitials,
} = require('../helpers');

const KIND_LABELS = {
  fixed_asset: '🏦 Основные средства',
  tangible:    '📦 ТМЦ на кол. учёте',
  low_value:   '🏷️ Малоценка',
};

/**
 * Колонки таблицы раздела.
 * @param {string} kind — 'fixed_asset' | 'tangible' | 'low_value'
 * @param {string} role — 'admin' | 'supervisor' | 'mol'
 * @returns {Array<{ key, width, th, td, cls? }>}
 */
function getKindColumns(kind, role) {
  const showCheckbox    = (role === 'admin' || role === 'mol');
  const showResponsible = (role === 'admin' || role === 'supervisor');
  const showOsFields    = (kind === 'fixed_asset');

  const cols = [];

  if (showCheckbox) {
    cols.push({
      key: 'checkbox',
      width: '40px',
      th: '<th style="width: 40px; text-align: center;">...</th>',
    });
  }

  cols.push({ key: 'id',          width: '60px',  th: null, td: 'id' });
  cols.push({ key: 'inventory',   width: '130px', th: null, td: 'inventory' });
  cols.push({ key: 'model',       width: '240px', th: null, td: 'model', cls: 'th-model' });
  cols.push({ key: 'corporate',   width: '120px', th: null, td: 'corporate' });
  cols.push({ key: 'category',    width: '140px', th: null, td: 'category' });
  cols.push({ key: 'type',        width: '140px', th: null, td: 'type' });
  cols.push({ key: 'description', width: '240px', th: null, td: 'description' });

  if (showOsFields) {
    cols.push({ key: 'commissioning_date', width: '120px', th: null, td: 'commissioning_date' });
    cols.push({ key: 'initial_cost',       width: '120px', th: null, td: 'initial_cost' });
  }

  cols.push({ key: 'location',   width: '180px', th: null, td: 'location' });
  cols.push({ key: 'status',     width: '130px', th: null, td: 'status' });
  cols.push({ key: 'assigned',   width: '170px', th: null, td: 'assigned' });

  if (showResponsible) {
    cols.push({ key: 'responsible', width: '160px', th: null, td: 'responsible' });
  }

  return cols;
}

/**
 * <thead> для раздела.
 * @param {Array} cols — из getKindColumns
 * @param {Function} th — sortableTh с basePath
 */
function renderKindTableHead(cols, th) {
  return cols.map(c => {
    let inner = c.th;
    if (!inner) {
      switch (c.key) {
        case 'id':                 inner = th('id', 'ID'); break;
        case 'inventory':          inner = th('inventory_number', 'Инв. №'); break;
        case 'model':              inner = th('model_name', 'Модель', 'th-model'); break;
        case 'corporate':          inner = th('corporate_id', 'Корп. ИД'); break;
        case 'category':           inner = th('category', 'Категория'); break;
        case 'type':               inner = th('type', 'Тип'); break;
        case 'description':        inner = th('description', 'Описание'); break;
        case 'commissioning_date': inner = th('commissioning_date', 'Дата ввода'); break;
        case 'initial_cost':       inner = th('initial_cost', 'Стоимость'); break;
        case 'location':           inner = th('location', 'Место хранения'); break;
        case 'status':             inner = th('status', 'Статус'); break;
        case 'assigned':           inner = th('assigned', 'Назначена'); break;
        case 'responsible':        inner = th('responsible', 'Ответственный МОЛ'); break;
        default: return '';
      }
    }
    const widthStyle = c.width ? ` style="width: ${c.width}"` : '';
    if (inner.startsWith('<th')) {
      if (inner.includes('style=')) {
        return inner.replace('<th', `<th data-col="${c.key}"`);
      }
      return inner.replace('<th', `<th data-col="${c.key}"${widthStyle}`);
    }
    return `<th data-col="${c.key}"${widthStyle}>${inner}</th>`;
  }).join('\n');
}

/**
 * Строка таблицы раздела.
 * @param {Object} item — equipment из getEquipmentWithLocation
 * @param {Object} ctx  — см. buildKindRowContext в pages.js
 */
function renderKindEquipmentRow(item, ctx) {
  const isOs = (ctx.kind === 'fixed_asset');

  // Для малоценки инв. № не показываем (его нет) — только ID экземпляра
  const invCell = (ctx.kind === 'low_value')
    ? `<span style="color: var(--text-muted); font-size: 11px;">#${item.id}</span>`
    : `<strong>${escapeHtml(item.inventory_number || '—')}</strong>`;

  return `
    <tr class="${ctx.rowClass}" onclick="openEquipmentCard(${item.id})">
      ${ctx.canBulkMove ? `
        <td data-col="checkbox" onclick="event.stopPropagation()" style="text-align: center;">
          ${ctx.isLocked
            ? '<input type="checkbox" class="row-checkbox" disabled title="Техника закреплена за другим МОЛом" style="opacity: 0.3; cursor: not-allowed;">'
            : `<input type="checkbox" class="row-checkbox" value="${item.id}" onclick="event.stopPropagation(); updateSelectedCount()">`}
        </td>
      ` : ''}
      <td data-col="id">${item.id}</td>
      <td data-col="inventory">${ctx.lockIcon || ''}${invCell}</td>
      <td data-col="model" class="th-model" title="${escapeHtml(item.model_name || '')}">${escapeHtml(item.model_name || '—')}</td>
      <td data-col="corporate">${escapeHtml(item.model_corporate_id || '—')}</td>
      <td data-col="category">${ctx.categoryCell}</td>
      <td data-col="type">${ctx.typeCell}</td>
      <td data-col="description" class="cell-description" title="${escapeHtml(item.description || '')}">${escapeHtml(item.description || '—')}</td>
      ${isOs ? `
        <td data-col="commissioning_date">${escapeHtml(item.commissioning_date || '—')}</td>
        <td data-col="initial_cost">${item.initial_cost != null ? Number(item.initial_cost).toLocaleString('ru-RU') + ' ₽' : '—'}</td>
      ` : ''}
      <td data-col="location">${ctx.cellInfo}</td>
      <td data-col="status"><span class="status-badge ${ctx.statusClass}">${ctx.statusLabel}</span></td>
      <td data-col="assigned">${ctx.assignedInfo}</td>
      ${(ctx.responsibleCell || '').replace('<td>', '<td data-col="responsible">')}
    </tr>
  `;
}

function renderKindEmptyRow(cols) {
  return `
    <tr class="empty-row">
      <td colspan="${cols.length}" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div style="font-size: 40px; margin-bottom: 10px;">🔍</div>
        <div>Ничего не найдено</div>
        <div style="font-size: 12px; margin-top: 5px;">Попробуйте изменить фильтры</div>
      </td>
    </tr>
  `;
}

/**
 * Ссылки в page_actions: «Добавить в раздел» + переходы между разделами.
 * @param {string} role
 * @param {string} kind — текущий
 * @param {Object} meta — { title, icon, basePath }
 */
function buildKindPageActions(role, kind, meta) {
  let html = '';

  // Добавление — только admin / mol
  if (role === 'admin' || role === 'mol') {
    html += `<a href="/manage/add?kind=${kind}" class="btn btn-success btn-sm">➕ Добавить</a>`;
  }

  // Переходы между разделами — для всех, кто видит /manage
  const others = Object.entries(KIND_LABELS).filter(([k]) => k !== kind);
  others.forEach(([k, label]) => {
    const basePath = (k === 'fixed_asset') ? '/manage/fixed-assets'
                   : (k === 'tangible')    ? '/manage/tangible'
                   :                         '/manage/low-value';
    html += `<a href="${basePath}" class="btn btn-ghost btn-sm">${label}</a>`;
  });
  html += `<a href="/manage/consumables" class="btn btn-ghost btn-sm">🧴 Расходники</a>`;
  html += `<a href="/manage" class="btn btn-ghost btn-sm" title="Сводный реестр">🧾 Все ТМЦ</a>`;

  return html;
}

module.exports = {
  KIND_LABELS,
  getKindColumns,
  renderKindTableHead,
  renderKindEquipmentRow,
  renderKindEmptyRow,
  buildKindPageActions,
};