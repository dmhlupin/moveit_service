// routes/manage/helpers.js
// Общие хелперы для роутов /manage/*

// ============================================================
// ЭКРАНИРОВАНИЕ
// ============================================================

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}

// ============================================================
// ФОРМАТИРОВАНИЕ
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

// ============================================================
// HTML-ХЕЛПЕРЫ ДЛЯ /manage
// ============================================================

function sortableTh(column, label, currentSort, currentOrder, query, extraClass = '') {
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

  const cls = (isActive ? 'sortable-header active' : 'sortable-header')
    + (extraClass ? ' ' + extraClass : '');
  return `<th class="${cls}">
    <a href="/manage?${params.toString()}">${label}${arrow}</a>
  </th>`;
}

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

// ============================================================
// 5.11.3-view: хелперы для renderManage (единый источник правды
// для колонок, опций фильтров и строк таблицы).
// ============================================================

/**
 * Описание колонок таблицы /manage.
 * Единый источник правды: th + td + colspan.
 * role: 'admin' | 'supervisor' | 'mol' — учитывается в колонках,
 *       которые видны не всем.
 */
function getManageColumns(currentRole) {
  const showCheckbox    = (currentRole === 'admin' || currentRole === 'mol');
  const showResponsible = (currentRole === 'admin' || currentRole === 'supervisor');

  const cols = [];

  if (showCheckbox) {
    cols.push({
      key: 'checkbox',
      width: '40px',
      th: '<th style="width: 40px; text-align: center;">...'
    });
  }

  cols.push({ key: 'id',         width: '60px',  th: null, td: 'id' });
  cols.push({ key: 'inventory',  width: '130px', th: null, td: 'inventory' });
  // 🆕 5.15.4
    // 🆕 5.15.4
  cols.push({ key: 'quantity',   width: '80px',  th: null, td: 'quantity' });
  cols.push({ key: 'model',      width: '240px', th: null, td: 'model',      cls: 'th-model' });
  cols.push({ key: 'corporate',  width: '120px', th: null, td: 'corporate' });
  cols.push({ key: 'category',   width: '140px', th: null, td: 'category' });
  cols.push({ key: 'type',       width: '140px', th: null, td: 'type' });
  cols.push({ key: 'description', width: '240px', th: null, td: 'description' });
  cols.push({ key: 'location',   width: '180px', th: null, td: 'location' });
  cols.push({ key: 'status',     width: '130px', th: null, td: 'status' });
  cols.push({ key: 'assigned',   width: '170px', th: null, td: 'assigned' });

  if (showResponsible) {
    cols.push({ key: 'responsible', width: '160px', th: null, td: 'responsible' });
  }

  return cols;
}

/**
 * Собирает <thead> /manage: сортируемые и статичные <th>.
 * @param {Array} cols — из getManageColumns
 * @param {Function} th — sortableTh (с extraClass)
 */
function renderTableHead(cols, th) {
  return cols.map(c => {
    let inner = c.th;
    if (!inner) {
      switch (c.key) {
        case 'id':          inner = th('id', 'ID'); break;
        case 'inventory':   inner = th('inventory_number', 'Инв. №'); break;
        case 'model':       inner = th('model_name', 'Модель', 'th-model'); break;
        case 'corporate':   inner = th('corporate_id', 'Корп. ИД'); break;
        case 'category':    inner = th('category', 'Категория'); break;
        case 'type':        inner = th('type', 'Тип'); break;
        case 'description': inner = th('description', 'Описание'); break; // 🆕
        case 'location':    inner = th('location', 'Место хранения'); break;
        case 'status':      inner = th('status', 'Статус'); break;
        case 'assigned':    inner = th('assigned', 'Назначена'); break;   // 🆕
        case 'responsible': inner = th('responsible', 'Ответственный МОЛ'); break;
        case 'quantity':    inner = th('quantity_accounted', 'Учёт', 'th-center'); break;
        default: return '';
      }
    }
    // 5.11.3.2: data-col + width
    const widthStyle = c.width ? ` style="width: ${c.width}"` : '';
    if (inner.startsWith('<th')) {
      // replace('<th', ...) вставляет атрибуты сразу после <th
      // при этом style уже может быть внутри inner — тогда объединим
      if (inner.includes('style=')) {
        // если style уже есть (checkbox, assigned, description) — оставляем
        return inner.replace('<th', `<th data-col="${c.key}"`);
      }
      return inner.replace('<th', `<th data-col="${c.key}"${widthStyle}`);
    }
    return `<th data-col="${c.key}"${widthStyle}>${inner}</th>`;
  }).join('\n');
}

/**
 * Одна строка таблицы /manage.
 * @param {Object} item — equipment из getEquipmentWithLocation
 * @param {Object} ctx — { currentRole, currentUserId, canBulkMove,
 *                         canEditThis, isLocked, rowClass, lockIcon,
 *                         statusLabel, statusClass, assignedInfo,
 *                         categoryCell, typeCell, cellInfo, responsibleCell }
 */
function renderEquipmentRow(item, ctx) {
  return `
    <tr class="${ctx.rowClass}" onclick="openEquipmentCard(${item.id})">
      ${ctx.canBulkMove ? `
        <td data-col="checkbox" onclick="event.stopPropagation()" style="text-align: center;">
          ${ctx.isLocked
            ? '<input type="checkbox" class="row-checkbox" disabled title="Техника закреплена за другим МОЛом — нельзя переместить" style="opacity: 0.3; cursor: not-allowed;">'
            : `<input type="checkbox" class="row-checkbox" value="${item.id}" onclick="event.stopPropagation(); updateSelectedCount()">`}
        </td>
      ` : ''}
      <td data-col="id">${item.id}</td>
      <td data-col="inventory">${ctx.lockIcon}${ctx.fixedAssetIcon}<strong>${escapeHtml(item.inventory_number || '—')}</strong></td>
      <td data-col="quantity" style="text-align: center;">${ctx.quantityCell}</td>
      <td data-col="model" class="th-model" title="${escapeHtml(item.model_name || '')}">${escapeHtml(item.model_name || '—')}</td>
      <td data-col="corporate">${escapeHtml(item.model_corporate_id || '—')}</td>
      <td data-col="category">${ctx.categoryCell}</td>
      <td data-col="type">${ctx.typeCell}</td>
      <td data-col="description" class="cell-description" title="${escapeHtml(item.description || '')}">${escapeHtml(item.description || '—')}</td>
      <td data-col="location">${ctx.cellInfo}</td>
      <td data-col="status"><span class="status-badge ${ctx.statusClass}">${ctx.statusLabel}</span></td>
      <td data-col="assigned">${ctx.assignedInfo}</td>
      ${(ctx.responsibleCell || '').replace('<td>', '<td data-col="responsible">')}
    </tr>
  `;
}
/**
 * Пустая строка (ничего не найдено).
 */
function renderEmptyRow(cols) {
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

module.exports = {
  escapeHtml,
  escapeAttr,
  getInitials,
  formatDate,
  formatDateTime,
  sortableTh,
  renderManagePagination,
  getManageColumns,
  renderTableHead,
  renderEquipmentRow,
  renderEmptyRow,
};