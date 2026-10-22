// public/js/manage/helpers.js
// Общие хелперы для модулей /manage.
// getInitials убран (5.8.1.7): дублировал public/js/layout.js.
// deleteId / deleteType убраны (5.8.1.7): модалка удаления переехала
// в equipment-card/modals.js со своим pendingDeleteId.

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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCurrentRole() {
    const el = document.getElementById('currentRole');
    return el ? el.value : 'user';
}

// Совместимость с inline-обработчиками (`onclick="searchTable(...)"`)
// Оставлена как заглушка — теперь фильтры серверные.
function searchTable() {
    // no-op: серверный поиск через applyFilters()
}