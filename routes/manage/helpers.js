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

module.exports = {
  escapeHtml,
  escapeAttr,
  getInitials,
  formatDate,
  formatDateTime,
  sortableTh,
  renderManagePagination,
};