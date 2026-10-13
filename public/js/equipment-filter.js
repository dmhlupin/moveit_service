// ============================================================
// ПОИСК С ДЕБАУНСОМ
// ============================================================

let searchDebounceTimer = null;

function onSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        applyFilters({ resetPage: true });
    }, 300);
}

function onSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchDebounceTimer);
        applyFilters({ resetPage: true });
    }
}

// ============================================================
// ФИЛЬТРАЦИЯ (через URL, сервер)
// ============================================================

function applyFilters(options = {}) {
    const params = new URLSearchParams();

    const categoryId = document.getElementById('filterCategory')?.value;
    const typeId = document.getElementById('filterType')?.value;
    const warehouseId = document.getElementById('filterWarehouse')?.value;
    const workplaceId = document.getElementById('filterWorkplace')?.value;
    const status = document.getElementById('filterStatus')?.value;
    const search = document.getElementById('filterSearch')?.value.trim();

    if (categoryId) params.set('category_id', categoryId);
    if (typeId) params.set('type_id', typeId);
    if (warehouseId) params.set('warehouse_id', warehouseId);
    if (workplaceId) params.set('workplace_id', workplaceId);
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    // При смене фильтра — всегда на 1-ю страницу
    // (page в URL не задаём — сервер по умолчанию = 1)

    const qs = params.toString();
    window.location.href = '/equipment' + (qs ? '?' + qs : '');
}

// ... resetFilters, filterUnplaced — без изменений ...

function resetFilters() {
    window.location.href = '/equipment';
}

function filterUnplaced() {
    window.location.href = '/equipment?status=unplaced';
}

// ============================================================
// ПРОСМОТР КАРТОЧКИ ТЕХНИКИ
// (без изменений — viewEquipmentFromList, renderEquipmentCard,
//  closeViewEquipmentModal, getInitials, escapeHtml)
// ============================================================


// ============================================================
// ПРОСМОТР КАРТОЧКИ ТЕХНИКИ
// ============================================================

/**
 * Открыть карточку техники
 */
async function viewEquipmentFromList(equipmentId) {
    try {
        const response = await fetch(`/api/admin/equipment/${equipmentId}/details`);
        
        if (!response.ok) {
            showToast('❌ Ошибка загрузки', 'error');
            return;
        }
        
        const data = await response.json();
        
        if (!data.equipment) {
            showToast('❌ Техника не найдена', 'error');
            return;
        }
        
        renderEquipmentCard(data);
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showToast('❌ Ошибка соединения', 'error');
    }
}

/**
 * Отрисовать карточку техники
 */
function renderEquipmentCard(data) {
    const { equipment, stats, history, location } = data;
    
    // Форматирование дат
    const purchaseDate = equipment.purchase_date
        ? new Date(equipment.purchase_date).toLocaleDateString('ru-RU')
        : '—';
    const warrantyDate = equipment.warranty_until
        ? new Date(equipment.warranty_until).toLocaleDateString('ru-RU')
        : '—';
    
    // Проверка гарантии
    const warrantyExpired = equipment.warranty_until && new Date(equipment.warranty_until) < new Date();
    const warrantyBadge = warrantyExpired
        ? '<span class="badge badge-danger">⚠️ Истекла</span>'
        : (equipment.warranty_until ? '<span class="badge badge-success">✅ Действует</span>' : '');
    
    // Статус
    const statusLabels = {
        'available': { label: 'Доступна', class: 'badge-success', icon: '✅' },
        'placed': { label: 'На месте', class: 'badge-accent', icon: '🪑' },
        'assigned': { label: 'Назначена', class: 'badge-info', icon: '👤' },
        'maintenance': { label: 'В ремонте', class: 'badge-warning', icon: '🔧' },
        'retired': { label: 'Списана', class: 'badge-danger', icon: '❌' }
    };
    const statusInfo = statusLabels[equipment.status] || statusLabels.available;
    const statusBadge = `<span class="badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>`;
    
    // Категория / тип
    const categoryHtml = equipment.category_name
        ? `<span class="badge badge-muted">📁 ${escapeHtml(equipment.category_name)}</span>`
        : '';
    const typeHtml = equipment.type_name
        ? `<span class="badge badge-muted">📦 ${escapeHtml(equipment.type_name)}</span>`
        : '';
    
    // 🆕 Текущее расположение: пользователь / рабочее место / ячейка / ничего
    let locationHtml = '';
    const loc = location || { type: 'none' };

    if (loc.type === 'user' && loc.user) {
        const u = loc.user;
        const initials = getInitials(u.full_name || u.username);
        const assignedDate = new Date(u.assigned_date).toLocaleDateString('ru-RU');
        locationHtml = `
            <div class="current-user-card">
                <div class="current-user-avatar">${initials}</div>
                <div class="current-user-info">
                    <div class="current-user-name">${escapeHtml(u.full_name || u.username)}</div>
                    <div class="current-user-dept">${escapeHtml(u.department || 'Без отдела')} · @${escapeHtml(u.username)}</div>
                    <div class="current-user-date">📅 Выдано: ${assignedDate}</div>
                </div>
                <span class="current-user-status">Активно</span>
            </div>
        `;
    } else if (loc.type === 'workplace') {
        const officeLabel = loc.office_name ? escapeHtml(loc.office_name) : '';
        const roomLabel = loc.room_name ? escapeHtml(loc.room_name) : '';
        const wpLabel = escapeHtml(loc.workplace_name || 'Рабочее место');
        const wpCode = loc.workplace_code ? ` [${escapeHtml(loc.workplace_code)}]` : '';
        const link = loc.office_id
            ? `/admin/workplaces/${loc.office_id}?highlightWorkplace=${loc.workplace_id}`
            : '#';

        locationHtml = `
            <div class="current-location-card">
                <div class="current-location-avatar">🪑</div>
                <div class="current-location-info">
                    <div class="current-location-name">${wpLabel}${wpCode}</div>
                    <div class="current-location-path">
                        ${officeLabel ? `🏛️ ${officeLabel}` : ''}
                        ${roomLabel ? ` / 🚪 ${roomLabel}` : ''}
                    </div>
                    <div class="current-location-actions">
                        <a href="${link}" class="btn btn-sm btn-ghost" title="Открыть в дереве офиса">
                            🔗 Открыть в дереве офиса
                        </a>
                    </div>
                </div>
                <span class="current-location-badge">На месте</span>
            </div>
        `;
    } else if (loc.type === 'cell') {
        const warehouseLabel = loc.warehouse_name ? escapeHtml(loc.warehouse_name) : '';
        const zoneLabel = loc.zone_name ? escapeHtml(loc.zone_name) : '';
        const rackLabel = loc.rack_name ? escapeHtml(loc.rack_name) : '';
        const cellLabel = escapeHtml(loc.cell_name || 'Ячейка');
        const cellCode = loc.cell_code ? ` [${escapeHtml(loc.cell_code)}]` : '';
        const link = loc.warehouse_id
            ? `/admin/warehouses/${loc.warehouse_id}`
            : '#';

        locationHtml = `
            <div class="current-location-card">
                <div class="current-location-avatar">📦</div>
                <div class="current-location-info">
                    <div class="current-location-name">${cellLabel}${cellCode}</div>
                    <div class="current-location-path">
                        ${warehouseLabel ? `🏢 ${warehouseLabel}` : ''}
                        ${zoneLabel ? ` / 📍 ${zoneLabel}` : ''}
                        ${rackLabel ? ` / 🗄️ ${rackLabel}` : ''}
                    </div>
                    <div class="current-location-actions">
                        <a href="${link}" class="btn btn-sm btn-ghost" title="Открыть дерево склада">
                            🔗 Открыть дерево склада
                        </a>
                    </div>
                </div>
                <span class="current-location-badge">На складе</span>
            </div>
        `;
    } else {
        locationHtml = `
            <div class="empty-equipment">
                <span class="empty-icon">📭</span>
                <p>Не размещено: ни на складе, ни на рабочем месте</p>
            </div>
        `;
    }
    
    // История
    let historyHtml = '';
    if (history.length === 0) {
        historyHtml = '<p style="color: var(--text-muted); text-align: center; padding: 15px;">История пуста</p>';
    } else {
        historyHtml = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Пользователь</th>
                        <th>Отдел</th>
                        <th>Выдано</th>
                        <th>Возвращено</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
        `;
        history.forEach(h => {
            const assignedDate = h.assigned_date
                ? new Date(h.assigned_date).toLocaleDateString('ru-RU')
                : '—';
            const returnedDate = h.returned_date
                ? new Date(h.returned_date).toLocaleDateString('ru-RU')
                : '—';
            const statusBadge = h.status === 'active'
                ? '<span class="badge badge-info">Активна</span>'
                : '<span class="badge badge-success">Возвращена</span>';
            
            historyHtml += `
                <tr>
                    <td>
                        <div class="history-user">
                            <span class="history-user-avatar">${getInitials(h.full_name || h.username)}</span>
                            <span>${escapeHtml(h.full_name || h.username)}</span>
                        </div>
                    </td>
                    <td>${escapeHtml(h.department || '—')}</td>
                    <td>${assignedDate}</td>
                    <td>${returnedDate}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
        historyHtml += '</tbody></table>';
    }
    
    // Собираем
    const body = document.getElementById('viewEquipmentBody');
    body.innerHTML = `
        <div class="equipment-header-card">
            <div class="equipment-header-icon">🔧</div>
            <div class="equipment-header-info">
                <h2>${escapeHtml(equipment.model_name || '—')}</h2>
                <div class="equipment-header-inv">
                    ${equipment.model_corporate_id ? escapeHtml(equipment.model_corporate_id) + ' · ' : ''}${escapeHtml(equipment.inventory_number || '—')}
                </div>
                <div class="equipment-header-badges">
                    ${statusBadge}
                    ${categoryHtml}
                    ${typeHtml}
                </div>
            </div>
        </div>
        
        <div class="user-stats">
            <div class="user-stat">
                <div class="user-stat-number active">${stats.active}</div>
                <div class="user-stat-label">Сейчас назначена</div>
            </div>
            <div class="user-stat">
                <div class="user-stat-number total">${stats.total}</div>
                <div class="user-stat-label">Всего выдач</div>
            </div>
            <div class="user-stat">
                <div class="user-stat-number returned">${stats.returned}</div>
                <div class="user-stat-label">Возвращено</div>
            </div>
        </div>
        
        <div class="user-detail-section">
            <h4>📋 Информация о технике</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Модель</label>
                    <div class="value">${escapeHtml(equipment.model_name || '—')}</div>
                </div>
                <div class="detail-item">
                    <label>Corporate ID</label>
                    <div class="value">${escapeHtml(equipment.model_corporate_id || '—')}</div>
                </div>
                <div class="detail-item">
                    <label>Производитель</label>
                    <div class="value">${escapeHtml(equipment.model_manufacturer || '—')}</div>
                </div>
                <div class="detail-item">
                    <label>Серийный номер</label>
                    <div class="value">${escapeHtml(equipment.serial_number || '—')}</div>
                </div>
                <div class="detail-item">
                    <label>Дата покупки</label>
                    <div class="value">${purchaseDate}</div>
                </div>
                <div class="detail-item">
                    <label>Гарантия до</label>
                    <div class="value">${warrantyDate} ${warrantyBadge}</div>
                </div>
            </div>
            ${equipment.description ? `
                <div class="detail-item" style="margin-top: 12px;">
                    <label>Описание</label>
                    <div class="value">${escapeHtml(equipment.description)}</div>
                </div>
            ` : ''}
        </div>
        
        <div class="user-detail-section">
            <h4>📍 Текущее расположение</h4>
            ${locationHtml}
        </div>
        
        <div class="user-detail-section">
            <h4>📜 История использования (${stats.total})</h4>
            ${historyHtml}
        </div>
    `;
    
    document.getElementById('viewEquipmentModal').classList.add('active');
}

function closeViewEquipmentModal() {
    const modal = document.getElementById('viewEquipmentModal');
    if (modal) modal.classList.remove('active');
}

/**
 * Получить инициалы
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(p => p);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Экранирование HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) {
        searchInput.addEventListener('input', onSearchInput);
        searchInput.addEventListener('keydown', onSearchKeydown);

        // 🆕 2.11.12-fix2: если в URL есть ?search= — ставим фокус
        // и курсор в конец, чтобы можно было продолжать печатать.
        const params = new URLSearchParams(window.location.search);
        const searchValue = params.get('search');
        if (searchValue) {
            searchInput.focus();
            const len = searchInput.value.length;
            searchInput.setSelectionRange(len, len);
        }
    }
});

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================
// escapeHtml уже объявлена выше (после getInitials)

// Закрытие модалки по Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeViewEquipmentModal();
    }
});

// Закрытие модалки по клику на оверлей
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        if (e.target.id === 'viewEquipmentModal') {
            closeViewEquipmentModal();
        }
    }
});