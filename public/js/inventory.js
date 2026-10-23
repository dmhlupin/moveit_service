// public/js/inventory.js
// Логика страницы инвентаризации

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let summary = [];
let totals = {};
let currentWarehouseId = null;
let currentWarehouse = null;

let officesSummary = [];         // 🆕 5.9.3
let currentOfficeId = null;      // 🆕 5.9.3
let currentOffice = null;        // 🆕 5.9.3

let usersSummary = [];           // 🆕 5.9.4
let currentUserIdInv = null;     // 🆕 5.9.4
let currentUserInv = null;       // 🆕 5.9.4

let byLevelData = {
    level: '',
    id: 0,
    sub: {},        // 🆕 5.9.6: { zone_id, rack_id, cell_id, room_id, workplace_id }
    rows: [],
    breadcrumbs: [], // 🆕 5.9.6
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    await loadSummary();
    await loadTotals();
    await loadSpecialSummary();
    await loadOfficesSummary();
    await loadUsersSummary();          // 🆕 5.9.4
});

/**
 * Загрузить сводку по складам
 */
async function loadSummary() {
    const container = document.getElementById('warehouseSummary');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';
    
    try {
        const response = await fetch('/api/admin/inventory/summary');
        summary = await response.json();
        
        renderSummary();
    } catch (error) {
        console.error('❌ Ошибка загрузки сводки:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось получить сводку по складам</p>
            </div>
        `;
    }
}

/**
 * Загрузить общие итоги
 */
async function loadTotals() {
    try {
        const response = await fetch('/api/admin/inventory/totals');
        totals = await response.json();
        
        updateTotals();
        updateWarning();
    } catch (error) {
        console.error('❌ Ошибка загрузки итогов:', error);
    }
}

/**
 * 🆕 2.11.15: загрузить сводку по виртуальным складам
 * (maintenance — в ремонте, retired — списано)
 */
async function loadSpecialSummary() {
    const container = document.getElementById('specialSummary');
    if (!container) return;

    container.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';

    try {
        const response = await fetch('/api/admin/inventory/special');
        const data = await response.json();
        renderSpecialSummary(data);
    } catch (error) {
        console.error('❌ Ошибка загрузки виртуальных складов:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось получить сводку по ремонту и списанию</p>
            </div>
        `;
    }
}

// ============================================================
// 5.9.3: СВОДКА ПО ОФИСАМ
// ============================================================

async function loadOfficesSummary() {
    const container = document.getElementById('officesSummary');
    if (!container) return;

    container.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';

    try {
        const response = await fetch('/api/admin/inventory/offices-summary');
        officesSummary = await response.json();
        renderOfficesSummary();
    } catch (error) {
        console.error('❌ Ошибка загрузки сводки по офисам:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось получить сводку по офисам</p>
            </div>
        `;
    }
}

function renderOfficesSummary() {
    const container = document.getElementById('officesSummary');
    if (!container) return;

    if (officesSummary.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>Нет активных офисов</h3>
                <p>Добавьте офис в админ-панели</p>
            </div>
        `;
        return;
    }

    container.innerHTML = officesSummary.map(o => renderOfficeCard(o)).join('');
}

function renderOfficeCard(o) {
    const percent = o.fill_percent || 0;
    let fillClass = 'low';
    if (percent >= 90) fillClass = 'full';
    else if (percent >= 60) fillClass = 'high';
    else if (percent >= 30) fillClass = 'medium';

    const cardClasses = ['warehouse-summary-card', 'office-summary-card'];
    if (o.is_default) cardClasses.push('is-default');

    return `
        <div class="${cardClasses.join(' ')}" onclick="openOfficeDetail(${o.id})">
            <div class="ws-header">
                <div class="ws-title">
                    <div class="ws-name">
                        🏛️ ${escapeHtml(o.name)}
                        ${o.is_default ? '<span class="ws-badge">⭐ По умолчанию</span>' : ''}
                    </div>
                    ${o.address ? `<div class="ws-address">📍 ${escapeHtml(o.address)}</div>` : ''}
                </div>
            </div>

            <div class="ws-progress">
                <div class="ws-progress-label">
                    <span>Заполненность мест</span>
                    <span><strong>${o.equipment_count}</strong> из <strong>${o.workplaces_count}</strong></span>
                </div>
                <div class="ws-progress-bar">
                    <div class="ws-progress-fill ${fillClass}" style="width: ${percent}%"></div>
                </div>
            </div>

            <div class="ws-stats">
                <div class="ws-stat">
                    <div class="ws-stat-value zones">${o.rooms_count || 0}</div>
                    <div class="ws-stat-label">🚪 Каб.</div>
                </div>
                <div class="ws-stat">
                    <div class="ws-stat-value racks">${o.workplaces_count || 0}</div>
                    <div class="ws-stat-label">🪑 Мест</div>
                </div>
                <div class="ws-stat">
                    <div class="ws-stat-value equipment">${o.equipment_count || 0}</div>
                    <div class="ws-stat-label">🔧 Техн.</div>
                </div>
            </div>

            <div class="ws-actions" onclick="event.stopPropagation()">
                <button onclick="openOfficeDetail(${o.id})" class="btn btn-primary btn-sm">
                    📋 Открыть инвентаризацию
                </button>
                <a href="/admin/workplaces/${o.id}" class="btn btn-ghost btn-sm btn-icon-only" title="Дерево офиса">
                    🏛️
                </a>
            </div>
        </div>
    `;
}

// ============================================================
// 5.9.4: СВОДКА ПО ПОЛЬЗОВАТЕЛЯМ
// ============================================================

async function loadUsersSummary() {
    const container = document.getElementById('usersSummary');
    if (!container) return;

    container.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';

    try {
        const response = await fetch('/api/admin/inventory/users-summary');
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error(data?.error || 'Некорректный ответ API');
        }
        usersSummary = data;
        renderUsersSummary();
    } catch (error) {
        console.error('❌ Ошибка загрузки сводки по пользователям:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось получить сводку по пользователям</p>
            </div>
        `;
    }
}

function renderUsersSummary() {
    const container = document.getElementById('usersSummary');
    if (!container) return;

    if (usersSummary.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>Нет пользователей с активной техникой</h3>
                <p>Назначьте технику пользователям в /manage</p>
            </div>
        `;
        return;
    }

    container.innerHTML = usersSummary.map(u => renderUserCard(u)).join('');
}

function renderUserCard(u) {
    const count = u.active_equipment_count || 0;
    const initials = typeof getInitials === 'function'
        ? getInitials(u.full_name || u.username)
        : (u.username || '?').slice(0, 2).toUpperCase();

    return `
        <div class="warehouse-summary-card user-summary-card" onclick="openUserDetail(${u.id})">
            <div class="ws-header">
                <div class="ws-title">
                    <div class="ws-name">
                        <span class="user-summary-avatar">${escapeHtml(initials)}</span>
                        ${escapeHtml(u.full_name || u.username)}
                    </div>
                    <div class="ws-address">
                        @${escapeHtml(u.username)}
                        ${u.department ? ` · ${escapeHtml(u.department)}` : ''}
                    </div>
                </div>
            </div>

            <div class="user-summary-count">
                <span class="user-summary-count-number">${count}</span>
                <span class="user-summary-count-label">единиц техники</span>
            </div>

            <div class="ws-actions" onclick="event.stopPropagation()">
                <button onclick="openUserDetail(${u.id})" class="btn btn-primary btn-sm">
                    📋 Открыть
                </button>
            </div>
        </div>
    `;
}

/**
 * 🆕 2.11.15: отрисовать блок виртуальных складов
 */
function renderSpecialSummary(data) {
    const container = document.getElementById('specialSummary');
    if (!container) return;

    const maintenance = data.maintenance || { total: 0, with_cell: 0, without_cell: 0, by_warehouse: [] };
    const retired     = data.retired     || { total: 0, with_cell: 0, without_cell: 0, by_warehouse: [] };

    container.innerHTML = `
        ${renderSpecialCard('maintenance', maintenance, '🔧', 'В ремонте', 'maintenance')}
        ${renderSpecialCard('retired',     retired,     '📦', 'Списано',   'retired')}
    `;
}

/**
 * 🆕 2.11.15: карточка одного виртуального склада
 */
function renderSpecialCard(key, bucket, icon, title, statusSlug) {
    const total = bucket.total || 0;
    const withCell = bucket.with_cell || 0;
    const withoutCell = bucket.without_cell || 0;
    const byWarehouse = bucket.by_warehouse || [];

    // Разбивка по складам
    let warehouseList = '';
    if (byWarehouse.length === 0) {
        warehouseList = `<div class="special-empty">Нет техники на складах</div>`;
    } else {
        warehouseList = byWarehouse.map(w => `
            <a href="/equipment?status=${statusSlug}&warehouse_id=${w.warehouse_id}"
               class="special-warehouse-link"
               title="Показать всю технику этого статуса на складе «${escapeHtml(w.warehouse_name)}»">
                <span class="special-warehouse-name">🏢 ${escapeHtml(w.warehouse_name)}</span>
                <span class="special-warehouse-count">${w.count}</span>
            </a>
        `).join('');
    }

    const isEmpty = total === 0;

    return `
        <div class="special-card special-card-${key}${isEmpty ? ' is-empty' : ''}">
            <div class="special-card-header">
                <span class="special-card-icon">${icon}</span>
                <span class="special-card-title">${title}</span>
            </div>

            <div class="special-card-total">
                <a href="/equipment?status=${statusSlug}" class="special-total-link">
                    <span class="special-total-number">${total}</span>
                    <span class="special-total-label">единиц</span>
                </a>
            </div>

            <div class="special-card-breakdown">
                <div class="special-breakdown-item">
                    <span class="special-breakdown-label">📦 На складах:</span>
                    <span class="special-breakdown-value">${withCell}</span>
                </div>
                <div class="special-breakdown-item">
                    <span class="special-breakdown-label">❔ Без ячейки:</span>
                    <span class="special-breakdown-value">${withoutCell}</span>
                </div>
            </div>

            ${byWarehouse.length > 0 ? `
                <div class="special-card-warehouses">
                    <div class="special-warehouses-title">По складам:</div>
                    ${warehouseList}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Обновить карточки итогов
 */
function updateTotals() {
    const setText = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = value || 0;
    };
    
    setText('[data-stat="warehouses"]', totals.total_warehouses);
    setText('[data-stat="zones"]', totals.total_zones);
    setText('[data-stat="racks"]', totals.total_racks);
    setText('[data-stat="cells"]', totals.total_cells);
    setText('[data-stat="on_stock"]', totals.equipment_on_stock);
    setText('[data-stat="assigned"]', totals.equipment_assigned);
}

/**
 * Показать/скрыть warning о технике без ячейки
 */
function updateWarning() {
    const block = document.getElementById('warningBlock');
    const count = document.getElementById('warningCount');
    
    if (!block || !count) return;
    
    const withoutCell = totals.available_without_cell || 0;
    
    if (withoutCell > 0) {
        count.textContent = withoutCell;
        block.style.display = 'flex';
    } else {
        block.style.display = 'none';
    }
}

// ============================================================
// ОТРИСОВКА СВОДКИ
// ============================================================

function renderSummary() {
    const container = document.getElementById('warehouseSummary');
    if (!container) return;
    
    if (summary.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>Нет активных складов</h3>
                <p>Добавьте склад в админ-панели</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = summary.map(w => renderWarehouseCard(w)).join('');
}

function renderWarehouseCard(w) {
    // Класс прогресс-бара
    const percent = w.fill_percent || 0;
    let fillClass = 'low';
    if (percent >= 90) fillClass = 'full';
    else if (percent >= 60) fillClass = 'high';
    else if (percent >= 30) fillClass = 'medium';
    
    const cardClasses = ['warehouse-summary-card'];
    if (w.is_default) cardClasses.push('is-default');
    
    return `
        <div class="${cardClasses.join(' ')}" onclick="openWarehouseDetail(${w.id})">
            <div class="ws-header">
                <div class="ws-title">
                    <div class="ws-name">
                        ${escapeHtml(w.name)}
                        ${w.is_default ? '<span class="ws-badge">⭐ По умолчанию</span>' : ''}
                    </div>
                    ${w.address ? `<div class="ws-address">📍 ${escapeHtml(w.address)}</div>` : ''}
                </div>
            </div>
            
            <div class="ws-progress">
                <div class="ws-progress-label">
                    <span>Заполненность</span>
                    <span><strong>${w.equipment_count}</strong> из <strong>${w.total_capacity || w.cells_count}</strong></span>
                </div>
                <div class="ws-progress-bar">
                    <div class="ws-progress-fill ${fillClass}" style="width: ${percent}%"></div>
                </div>
            </div>
            
            <div class="ws-stats">
                <div class="ws-stat">
                    <div class="ws-stat-value zones">${w.zones_count || 0}</div>
                    <div class="ws-stat-label">📍 Зон</div>
                </div>
                <div class="ws-stat">
                    <div class="ws-stat-value racks">${w.racks_count || 0}</div>
                    <div class="ws-stat-label">🗄️ Стелл.</div>
                </div>
                <div class="ws-stat">
                    <div class="ws-stat-value cells">${w.cells_count || 0}</div>
                    <div class="ws-stat-label">📦 Ячеек</div>
                </div>
                <div class="ws-stat">
                    <div class="ws-stat-value equipment">${w.equipment_count || 0}</div>
                    <div class="ws-stat-label">🔧 Техн.</div>
                </div>
            </div>
            
            <div class="ws-actions" onclick="event.stopPropagation()">
                <button onclick="openWarehouseDetail(${w.id})" class="btn btn-primary btn-sm">
                    📋 Открыть инвентаризацию
                </button>
                <a href="/admin/warehouses/${w.id}" class="btn btn-ghost btn-sm btn-icon-only" title="Дерево склада">
                    🏢
                </a>
            </div>
        </div>
    `;
}

// ============================================================
// ДЕТАЛИ СКЛАДА (модалка)
// ============================================================

async function openWarehouseDetail(warehouseId) {
    currentWarehouseId = warehouseId;
    
    const modal = document.getElementById('warehouseDetailModal');
    const title = document.getElementById('warehouseDetailTitle');
    const body = document.getElementById('warehouseDetailBody');
    
    // Находим склад в сводке
    currentWarehouse = summary.find(w => w.id === warehouseId);
    
    title.textContent = `🏢 ${currentWarehouse?.name || 'Склад'}`;
    body.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';
    modal.classList.add('active');
    
    try {
        // Загружаем инвентаризацию и заполненность параллельно
        const [inventory, occupancy] = await Promise.all([
            fetch(`/api/admin/warehouses/${warehouseId}/inventory`).then(r => r.json()),
            fetch(`/api/admin/warehouses/${warehouseId}/occupancy`).then(r => r.json()),
        ]);
        
        renderWarehouseDetail(inventory, occupancy);
    } catch (error) {
        console.error('❌ Ошибка загрузки деталей склада:', error);
        body.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось получить данные склада</p>
            </div>
        `;
    }
}

function renderWarehouseDetail(inventory, occupancy) {
    const body = document.getElementById('warehouseDetailBody');
    const w = currentWarehouse;

    const statusLabel = (s) => ({
        available:   '✅ Доступна',
        placed:      '🪑 На месте',
        assigned:    '👤 Назначена',
        maintenance: '🔧 В ремонте',
        retired:     '❌ Списана',
    }[s] || s);


    // Заголовок
    let html = `
        <div class="wh-detail-header">
            <div class="wh-detail-icon">🏢</div>
            <div class="wh-detail-info">
                <h2>${escapeHtml(w.name)}</h2>
                ${w.address ? `<div class="wh-detail-address">📍 ${escapeHtml(w.address)}</div>` : ''}
            </div>
        </div>
        
        <div class="detail-tabs">
            <button class="detail-tab active" onclick="switchDetailTab('equipment', event)">
                🔧 Техника (${inventory.length})
            </button>
            <button class="detail-tab" onclick="switchDetailTab('occupancy', event)">
                📍 Заполненность (${occupancy.length})
            </button>
        </div>
        
        <!-- Вкладка: Техника -->
        <div id="detailTabEquipment" class="detail-tab-content active">
    `;
    
    if (inventory.length === 0) {
        html += `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>На складе нет техники</h3>
                <p>Техника появится, если ей назначить ячейку</p>
            </div>
        `;
    } else {
        html += `
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Инв. номер</th>
                        <th>Модель</th>
                        <th>Корп. ИД</th>
                        <th>Категория</th>
                        <th>Тип</th>
                        <th>Место хранения</th>
                        <th>МОЛ</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        inventory.forEach(eq => {
            const location = eq.cell_code 
                ? `${escapeHtml(eq.zone_name)} → ${escapeHtml(eq.rack_name)} → <strong>${escapeHtml(eq.cell_code)}</strong>`
                : `${escapeHtml(eq.zone_name)} → ${escapeHtml(eq.rack_name)} → ${escapeHtml(eq.cell_name)}`;
            
            html += `
                <tr class="equipment-row-link" onclick="openEquipmentCardFromInventory(${eq.id})">
                    <td><strong>${escapeHtml(eq.inventory_number || '—')}</strong></td>
                    <td>${escapeHtml(eq.model_name || '—')}</td>
                    <td>${escapeHtml(eq.model_corporate_id || '—')}</td>
                    <td>${eq.category_icon || '📁'} ${escapeHtml(eq.category_name || '—')}</td>
                    <td>${eq.type_icon || '📦'} ${escapeHtml(eq.type_name || '—')}</td>
                    <td style="font-size: 12px;">${location}</td>
                    <td style="font-size: 12px;">${escapeHtml(eq.responsible_user_name || '—')}</td>
                    <td><span class="status-badge status-${eq.status}">${statusLabel(eq.status)}</span></td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    html += `
        </div>
        
        <!-- Вкладка: Заполненность -->
        <div id="detailTabOccupancy" class="detail-tab-content">
    `;
    
    if (occupancy.length === 0) {
        html += `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>Нет ячеек</h3>
                <p>В этом складе пока нет ячеек хранения</p>
            </div>
        `;
    } else {
        occupancy.forEach(c => {
            const percent = c.percent || 0;
            const manualFull = c.is_full === 1;
            const capacityReached = c.capacity > 0 && c.current_count >= c.capacity;
            const isFull = manualFull || capacityReached;
            let fillColor = 'var(--border-light)';
            if (isFull || percent >= 90) fillColor = 'var(--danger)';
            else if (percent >= 60) fillColor = 'var(--warning)';
            else if (percent > 0) fillColor = 'var(--success)';
            
            const capacityText = isFull
                ? `🔴 ${c.current_count}${c.capacity > 0 ? ` / ${c.capacity}` : ''}`
                : (c.capacity > 0 
                    ? `${c.current_count} / ${c.capacity}`
                    : `${c.current_count}`);
            
            html += `
                <div class="occupancy-item">
                    <div class="occupancy-cell">
                        <div class="occupancy-code">${escapeHtml(c.code || '—')}</div>
                        <div class="occupancy-name">${escapeHtml(c.name)} · ${escapeHtml(c.rack_name)}</div>
                    </div>
                    <div class="occupancy-bar">
                        <div class="occupancy-bar-fill" style="width: ${percent}%; background: ${fillColor};"></div>
                    </div>
                    <div class="occupancy-count">${capacityText}</div>
                </div>
            `;
        });
    }
    
    html += `
        </div>
        
        <!-- Кнопки внизу -->
        <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
            <a href="/admin/warehouses/${currentWarehouseId}" class="btn btn-primary">
                🏢 Дерево склада
            </a>
            <button onclick="exportInventory(${currentWarehouseId})" class="btn btn-success">
                📥 Экспорт в CSV
            </button>
        </div>
    `;
    
    body.innerHTML = html;
}

function closeWarehouseDetailModal() {
    document.getElementById('warehouseDetailModal').classList.remove('active');
    currentWarehouseId = null;
    currentWarehouse = null;
}

// ============================================================
// 5.9.3: ДЕТАЛИ ОФИСА (модалка)
// ============================================================

async function openOfficeDetail(officeId) {
    currentOfficeId = officeId;
    currentOffice = officesSummary.find(o => o.id === officeId);

    const modal = document.getElementById('officeDetailModal');
    const title = document.getElementById('officeDetailTitle');
    const body = document.getElementById('officeDetailBody');

    title.textContent = `🏛️ ${currentOffice?.name || 'Офис'}`;
    body.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';
    modal.classList.add('active');

    try {
        const [equipment, occupancy] = await Promise.all([
            fetch(`/api/admin/offices/${officeId}/equipment`).then(r => r.json()),
            fetch(`/api/admin/offices/${officeId}/occupancy`).then(r => r.json()),
        ]);

        renderOfficeDetail(equipment, occupancy);
    } catch (error) {
        console.error('❌ Ошибка загрузки деталей офиса:', error);
        body.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось получить данные офиса</p>
            </div>
        `;
    }
}

function renderOfficeDetail(equipment, occupancy) {
    const body = document.getElementById('officeDetailBody');
    const o = currentOffice;

    const statusLabel = (s) => ({
        available:   '✅ Доступна',
        placed:      '🪑 На месте',
        assigned:    '👤 Назначена',
        maintenance: '🔧 В ремонте',
        retired:     '❌ Списана',
    }[s] || s);

    let html = `
        <div class="wh-detail-header">
            <div class="wh-detail-icon">🏛️</div>
            <div class="wh-detail-info">
                <h2>${escapeHtml(o.name)}</h2>
                ${o.address ? `<div class="wh-detail-address">📍 ${escapeHtml(o.address)}</div>` : ''}
            </div>
        </div>

        <div class="detail-tabs">
            <button class="detail-tab active" onclick="switchOfficeTab('equipment', event)">
                🔧 Техника (${equipment.length})
            </button>
            <button class="detail-tab" onclick="switchOfficeTab('occupancy', event)">
                📍 Заполненность мест (${occupancy.length})
            </button>
        </div>

        <div id="officeTabEquipment" class="detail-tab-content active">
    `;

    if (equipment.length === 0) {
        html += `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>В офисе нет техники</h3>
                <p>Техника появится, если её разместить на рабочем месте</p>
            </div>
        `;
    } else {
        html += `
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Инв. номер</th>
                        <th>Модель</th>
                        <th>Корп. ИД</th>
                        <th>Категория</th>
                        <th>Тип</th>
                        <th>Расположение</th>
                        <th>МОЛ</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
        `;

        equipment.forEach(eq => {
            const location = eq.workplace_code
                ? `${escapeHtml(eq.room_name || '—')} → <strong>${escapeHtml(eq.workplace_name || '—')} [${escapeHtml(eq.workplace_code)}]</strong>`
                : `${escapeHtml(eq.room_name || '—')} → ${escapeHtml(eq.workplace_name || '—')}`;

            html += `
                <tr class="equipment-row-link" onclick="openEquipmentCardFromInventory(${eq.id})">
                    <td><strong>${escapeHtml(eq.inventory_number || '—')}</strong></td>
                    <td>${escapeHtml(eq.model_name || '—')}</td>
                    <td>${escapeHtml(eq.model_corporate_id || '—')}</td>
                    <td>${eq.category_icon || '📁'} ${escapeHtml(eq.category_name || '—')}</td>
                    <td>${eq.type_icon || '📦'} ${escapeHtml(eq.type_name || '—')}</td>
                    <td style="font-size: 12px;">${location}</td>
                    <td style="font-size: 12px;">${escapeHtml(eq.responsible_user_name || '—')}</td>
                    <td><span class="status-badge status-${eq.status}">${statusLabel(eq.status)}</span></td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
    }

    html += `</div><div id="officeTabOccupancy" class="detail-tab-content">`;

    if (occupancy.length === 0) {
        html += `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>Нет рабочих мест</h3>
                <p>В этом офисе пока нет рабочих мест</p>
            </div>
        `;
    } else {
        occupancy.forEach(wp => {
            const percent = wp.percent || 0;
            const fillColor = percent >= 100 ? 'var(--danger)' : (percent > 0 ? 'var(--success)' : 'var(--border-light)');
            const capacityText = wp.current_count > 0 ? `🔴 ${wp.current_count}` : '0';

            html += `
                <div class="occupancy-item">
                    <div class="occupancy-cell">
                        <div class="occupancy-code">${escapeHtml(wp.code || '—')}</div>
                        <div class="occupancy-name">${escapeHtml(wp.name)} · ${escapeHtml(wp.room_name || '—')}</div>
                    </div>
                    <div class="occupancy-bar">
                        <div class="occupancy-bar-fill" style="width: ${percent}%; background: ${fillColor};"></div>
                    </div>
                    <div class="occupancy-count">${capacityText}</div>
                </div>
            `;
        });
    }

    html += `
        </div>
        <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
            <a href="/admin/workplaces/${currentOfficeId}" class="btn btn-primary">
                🏛️ Дерево офиса
            </a>
            <button onclick="exportOfficeInventory(${currentOfficeId})" class="btn btn-success">
                📥 Экспорт в CSV
            </button>
        </div>
    `;

    body.innerHTML = html;
}

function closeOfficeDetailModal() {
    document.getElementById('officeDetailModal').classList.remove('active');
    currentOfficeId = null;
    currentOffice = null;
}

function switchOfficeTab(tab, event) {
    document.querySelectorAll('#officeTabEquipment, #officeTabOccupancy').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelectorAll('#officeDetailModal .detail-tab').forEach(el => {
        el.classList.remove('active');
    });

    if (tab === 'equipment') {
        document.getElementById('officeTabEquipment').classList.add('active');
    } else {
        document.getElementById('officeTabOccupancy').classList.add('active');
    }

    if (event && event.target) {
        event.target.classList.add('active');
    }
}

function exportOfficeInventory(officeId) {
    window.location.href = `/api/admin/offices/${officeId}/equipment/export`;
    showToast('📥 Начинается скачивание CSV...', 'success');
}



function switchDetailTab(tab, event) {
    // Скрываем все вкладки
    document.querySelectorAll('.detail-tab-content').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelectorAll('.detail-tab').forEach(el => {
        el.classList.remove('active');
    });
    
    // Показываем нужную
    if (tab === 'equipment') {
        document.getElementById('detailTabEquipment').classList.add('active');
    } else {
        document.getElementById('detailTabOccupancy').classList.add('active');
    }
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// ============================================================
// 5.9.4: ДЕТАЛИ ПОЛЬЗОВАТЕЛЯ (модалка)
// ============================================================

async function openUserDetail(userId) {
    currentUserIdInv = userId;
    currentUserInv = usersSummary.find(u => u.id === userId);

    const modal = document.getElementById('userDetailModal');
    const title = document.getElementById('userDetailTitle');
    const body = document.getElementById('userDetailBody');

    title.textContent = `👤 ${currentUserInv?.full_name || currentUserInv?.username || 'Пользователь'}`;
    body.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';
    modal.classList.add('active');

    try {
        const response = await fetch(`/api/admin/inventory/users/${userId}/details`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        renderUserDetail(data);
    } catch (error) {
        console.error('❌ Ошибка загрузки деталей пользователя:', error);
        body.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось получить данные пользователя</p>
            </div>
        `;
    }
}

function renderUserDetail(data) {
    const body = document.getElementById('userDetailBody');
    const { user, stats, activeEquipment, history } = data;
    const showResponsibleCol = (document.getElementById('currentRole')?.value || '') !== 'mol';

    const statusLabel = (s) => ({
        available:   '✅ Доступна',
        placed:      '🪑 На месте',
        assigned:    '👤 Назначена',
        maintenance: '🔧 В ремонте',
        retired:     '❌ Списана',
    }[s] || s);

    let html = `
        <div class="wh-detail-header">
            <div class="wh-detail-icon">👤</div>
            <div class="wh-detail-info">
                <h2>${escapeHtml(user.full_name || user.username)}</h2>
                <div class="wh-detail-address">
                    @${escapeHtml(user.username)}
                    ${user.department ? ` · ${escapeHtml(user.department)}` : ''}
                    ${user.email ? ` · ${escapeHtml(user.email)}` : ''}
                </div>
            </div>
        </div>

        <div class="user-inv-stats">
            <div class="user-inv-stat">
                <div class="user-inv-stat-value active">${stats.active || 0}</div>
                <div class="user-inv-stat-label">Активных</div>
            </div>
            <div class="user-inv-stat">
                <div class="user-inv-stat-value total">${stats.total || 0}</div>
                <div class="user-inv-stat-label">Всего выдач</div>
            </div>
            <div class="user-inv-stat">
                <div class="user-inv-stat-value returned">${stats.returned || 0}</div>
                <div class="user-inv-stat-label">Возвратов</div>
            </div>
        </div>

        <div class="detail-tabs">
            <button class="detail-tab active" onclick="switchUserTab('active', event)">
                🔧 Активная техника (${activeEquipment.length})
            </button>
            <button class="detail-tab" onclick="switchUserTab('history', event)">
                📜 История (${history.length})
            </button>
        </div>

        <div id="userTabActive" class="detail-tab-content active">
    `;

    if (activeEquipment.length === 0) {
        html += `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>Нет активной техники</h3>
                <p>Всё возвращено на склад</p>
            </div>
        `;
    } else {
        html += `
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Инв. номер</th>
                        <th>Модель</th>
                        <th>Корп. ИД</th>
                        <th>Производитель</th>
                        ${showResponsibleCol ? '<th>МОЛ</th>' : ''}
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
        `;

        activeEquipment.forEach(eq => {
            html += `
                <tr class="equipment-row-link" onclick="openEquipmentCardFromInventory(${eq.id})">
                    <td><strong>${escapeHtml(eq.inventory_number || '—')}</strong></td>
                    <td>${escapeHtml(eq.model_name || '—')}</td>
                    <td>${escapeHtml(eq.model_corporate_id || '—')}</td>
                    <td>${escapeHtml(eq.model_manufacturer || '—')}</td>
                    ${showResponsibleCol ? `<td style="font-size: 12px;">${escapeHtml(eq.responsible_user_name || '—')}</td>` : ''}
                    <td><span class="status-badge status-${eq.status}">${statusLabel(eq.status)}</span></td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
    }

    html += `</div><div id="userTabHistory" class="detail-tab-content">`;

    if (history.length === 0) {
        html += `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>История пуста</h3>
                <p>Пользователь ещё не получал технику</p>
            </div>
        `;
    } else {
        html += `
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Модель</th>
                        <th>Корп. ИД</th>
                        <th>Выдано</th>
                        <th>Возвращено</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
        `;

        history.forEach(h => {
            const assignedDate = h.assigned_date
                ? new Date(h.assigned_date).toLocaleDateString('ru-RU') : '—';
            const returnedDate = h.returned_date
                ? new Date(h.returned_date).toLocaleDateString('ru-RU') : '—';
            const active = !h.returned_date;

            html += `
                <tr>
                    <td>${escapeHtml(h.model_name || '—')}</td>
                    <td>${escapeHtml(h.model_corporate_id || '—')}</td>
                    <td>${assignedDate}</td>
                    <td>${returnedDate}</td>
                    <td><span class="status-badge ${active ? 'status-assigned' : 'status-available'}">${active ? 'Активна' : 'Возвращена'}</span></td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
    }

    html += `</div>`;

    body.innerHTML = html;
}

function closeUserDetailModal() {
    document.getElementById('userDetailModal').classList.remove('active');
    currentUserIdInv = null;
    currentUserInv = null;
}

function switchUserTab(tab, event) {
    document.querySelectorAll('#userTabActive, #userTabHistory').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelectorAll('#userDetailModal .detail-tab').forEach(el => {
        el.classList.remove('active');
    });

    if (tab === 'active') {
        document.getElementById('userTabActive').classList.add('active');
    } else {
        document.getElementById('userTabHistory').classList.add('active');
    }

    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// ============================================================
// 5.9.6: ВЫБОРКА ПО УРОВНЮ (углубление)
// ============================================================

const BY_LEVEL_GROUPS = {
    warehouse: ['byLevelZoneGroup', 'byLevelRackGroup', 'byLevelCellGroup'],
    office:    ['byLevelRoomGroup', 'byLevelWorkplaceGroup'],
    user:      [],
};

function hideAllLevelGroups() {
    Object.values(BY_LEVEL_GROUPS).flat().forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

async function onByLevelTypeChange() {
    const type = document.getElementById('byLevelType').value;
    const objectGroup = document.getElementById('byLevelObjectGroup');
    const actionsGroup = document.getElementById('byLevelActionsGroup');
    const objectLabel = document.getElementById('byLevelObjectLabel');
    const objectSelect = document.getElementById('byLevelObjectId');
    const result = document.getElementById('byLevelResult');
    const breadcrumbs = document.getElementById('byLevelBreadcrumbs');

    result.style.display = 'none';
    breadcrumbs.style.display = 'none';
    breadcrumbs.innerHTML = '';
    byLevelData = { level: '', id: 0, sub: {}, rows: [], breadcrumbs: [] };

    hideAllLevelGroups();

    if (!type) {
        objectGroup.style.display = 'none';
        actionsGroup.style.display = 'none';
        return;
    }

    objectGroup.style.display = '';
    actionsGroup.style.display = '';
    objectSelect.innerHTML = '<option value="">⏳ Загрузка...</option>';

    try {
        let items = [];
        if (type === 'warehouse') {
            objectLabel.textContent = 'Склад';
            items = summary;
        } else if (type === 'office') {
            objectLabel.textContent = 'Офис';
            items = officesSummary;
        } else if (type === 'user') {
            objectLabel.textContent = 'Пользователь';
            items = usersSummary;
        }

        if (!items || items.length === 0) {
            objectSelect.innerHTML = '<option value="">— Нет объектов —</option>';
            return;
        }

        objectSelect.innerHTML = '<option value="">— Выберите —</option>' +
            items.map(o => {
                const label = o.name || o.full_name || o.username || `#${o.id}`;
                return `<option value="${o.id}">${escapeHtml(label)}</option>`;
            }).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки объектов уровня:', error);
        objectSelect.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

// При выборе объекта (склад/офис/пользователь) — показать нужные каскады
async function onByLevelObjectChange() {
    const type = document.getElementById('byLevelType').value;
    const objectId = parseInt(document.getElementById('byLevelObjectId').value, 10);

    hideAllLevelGroups();

    if (!type || !objectId) return;

    // Сброс значений каскадов
    ['byLevelZoneId', 'byLevelRackId', 'byLevelCellId',
     'byLevelRoomId', 'byLevelWorkplaceId'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const placeholder = el.options[0]?.textContent || '— Любой —';
            el.innerHTML = `<option value="">${placeholder}</option>`;
            el.value = '';
        }
    });

    if (type === 'warehouse') {
        document.getElementById('byLevelZoneGroup').style.display = '';
        await loadByLevelZones(objectId);
    } else if (type === 'office') {
        document.getElementById('byLevelRoomGroup').style.display = '';
        await loadByLevelRooms(objectId);
    }
}

async function loadByLevelZones(warehouseId) {
    const select = document.getElementById('byLevelZoneId');
    select.innerHTML = '<option value="">⏳ Загрузка...</option>';

    try {
        const response = await fetch(`/api/admin/warehouses/${warehouseId}/zones`);
        const zones = await response.json();
        select.innerHTML = '<option value="">— Любая зона —</option>' +
            zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
    } catch (error) {
        console.error('❌ Ошибка зон:', error);
        select.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

async function onByLevelZoneChange() {
    const zoneId = parseInt(document.getElementById('byLevelZoneId').value, 10);
    document.getElementById('byLevelRackGroup').style.display = zoneId ? '' : 'none';
    document.getElementById('byLevelCellGroup').style.display = 'none';

    const rackSelect = document.getElementById('byLevelRackId');
    const cellSelect = document.getElementById('byLevelCellId');
    rackSelect.innerHTML = '<option value="">— Любой —</option>';
    cellSelect.innerHTML = '<option value="">— Любая —</option>';

    if (!zoneId) return;

    rackSelect.innerHTML = '<option value="">⏳ Загрузка...</option>';
    try {
        const response = await fetch(`/api/admin/zones/${zoneId}/racks`);
        const racks = await response.json();
        rackSelect.innerHTML = '<option value="">— Любой стеллаж —</option>' +
            racks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    } catch (error) {
        console.error('❌ Ошибка стеллажей:', error);
        rackSelect.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

async function onByLevelRackChange() {
    const rackId = parseInt(document.getElementById('byLevelRackId').value, 10);
    document.getElementById('byLevelCellGroup').style.display = rackId ? '' : 'none';

    const cellSelect = document.getElementById('byLevelCellId');
    cellSelect.innerHTML = '<option value="">— Любая —</option>';

    if (!rackId) return;

    cellSelect.innerHTML = '<option value="">⏳ Загрузка...</option>';
    try {
        const response = await fetch(`/api/admin/racks/${rackId}/cells`);
        const cells = await response.json();
        cellSelect.innerHTML = '<option value="">— Любая ячейка —</option>' +
            cells.map(c => {
                const code = c.code ? ` [${c.code}]` : '';
                return `<option value="${c.id}">${escapeHtml(c.name)}${code}</option>`;
            }).join('');
    } catch (error) {
        console.error('❌ Ошибка ячеек:', error);
        cellSelect.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

async function loadByLevelRooms(officeId) {
    const select = document.getElementById('byLevelRoomId');
    select.innerHTML = '<option value="">⏳ Загрузка...</option>';

    try {
        const response = await fetch(`/api/admin/offices/${officeId}/rooms`);
        const rooms = await response.json();
        select.innerHTML = '<option value="">— Любой кабинет —</option>' +
            rooms.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    } catch (error) {
        console.error('❌ Ошибка кабинетов:', error);
        select.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

async function onByLevelRoomChange() {
    const roomId = parseInt(document.getElementById('byLevelRoomId').value, 10);
    document.getElementById('byLevelWorkplaceGroup').style.display = roomId ? '' : 'none';

    const wpSelect = document.getElementById('byLevelWorkplaceId');
    wpSelect.innerHTML = '<option value="">— Любое —</option>';

    if (!roomId) return;

    wpSelect.innerHTML = '<option value="">⏳ Загрузка...</option>';
    try {
        const response = await fetch(`/api/admin/rooms/${roomId}/workplaces`);
        const wps = await response.json();
        wpSelect.innerHTML = '<option value="">— Любое место —</option>' +
            wps.map(wp => {
                const code = wp.code ? ` [${wp.code}]` : '';
                return `<option value="${wp.id}">${escapeHtml(wp.name)}${code}</option>`;
            }).join('');
    } catch (error) {
        console.error('❌ Ошибка рабочих мест:', error);
        wpSelect.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

async function loadByLevel() {
    const type = document.getElementById('byLevelType').value;
    const id = parseInt(document.getElementById('byLevelObjectId').value, 10);
    const result = document.getElementById('byLevelResult');
    const breadcrumbs = document.getElementById('byLevelBreadcrumbs');

    if (!type || !id) {
        result.style.display = 'none';
        breadcrumbs.style.display = 'none';
        return;
    }

    // Собираем sub из селектов (только релевантные уровню)
    const sub = {};
    const breadcrumbsArr = [];

    // Название объекта
    let objectName = '';
    if (type === 'warehouse') {
        objectName = summary.find(w => w.id === id)?.name || `Склад #${id}`;
        const zoneId = parseInt(document.getElementById('byLevelZoneId').value, 10);
        const rackId = parseInt(document.getElementById('byLevelRackId').value, 10);
        const cellId = parseInt(document.getElementById('byLevelCellId').value, 10);
        if (zoneId) sub.zone_id = zoneId;
        if (rackId) sub.rack_id = rackId;
        if (cellId) sub.cell_id = cellId;

        breadcrumbsArr.push({ level: 'warehouse', id, label: `🏢 ${objectName}`, active: false });
        if (zoneId) {
            const name = document.getElementById('byLevelZoneId').selectedOptions[0]?.textContent || `Зона #${zoneId}`;
            breadcrumbsArr.push({ level: 'zone', id: zoneId, label: `📍 ${name}`, active: false });
        }
        if (rackId) {
            const name = document.getElementById('byLevelRackId').selectedOptions[0]?.textContent || `Стеллаж #${rackId}`;
            breadcrumbsArr.push({ level: 'rack', id: rackId, label: `🗄️ ${name}`, active: false });
        }
        if (cellId) {
            const name = document.getElementById('byLevelCellId').selectedOptions[0]?.textContent || `Ячейка #${cellId}`;
            breadcrumbsArr.push({ level: 'cell', id: cellId, label: `📦 ${name}`, active: false });
        }
    } else if (type === 'office') {
        objectName = officesSummary.find(o => o.id === id)?.name || `Офис #${id}`;
        const roomId = parseInt(document.getElementById('byLevelRoomId').value, 10);
        const wpId = parseInt(document.getElementById('byLevelWorkplaceId').value, 10);
        if (roomId) sub.room_id = roomId;
        if (wpId) sub.workplace_id = wpId;

        breadcrumbsArr.push({ level: 'office', id, label: `🏛️ ${objectName}`, active: false });
        if (roomId) {
            const name = document.getElementById('byLevelRoomId').selectedOptions[0]?.textContent || `Кабинет #${roomId}`;
            breadcrumbsArr.push({ level: 'room', id: roomId, label: `🚪 ${name}`, active: false });
        }
        if (wpId) {
            const name = document.getElementById('byLevelWorkplaceId').selectedOptions[0]?.textContent || `Место #${wpId}`;
            breadcrumbsArr.push({ level: 'workplace', id: wpId, label: `🪑 ${name}`, active: false });
        }
    } else if (type === 'user') {
        objectName = usersSummary.find(u => u.id === id)?.full_name || `Пользователь #${id}`;
        breadcrumbsArr.push({ level: 'user', id, label: `👤 ${objectName}`, active: false });
    }

    // Запрос
    result.style.display = '';
    breadcrumbs.style.display = '';
    result.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';

    try {
        const qs = new URLSearchParams({ level: type, id: String(id) });
        Object.entries(sub).forEach(([k, v]) => qs.set(k, String(v)));

        const response = await fetch(`/api/admin/inventory/by-level?${qs.toString()}`);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${response.status}`);
        }
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('Некорректный ответ API');

        byLevelData = { level: type, id, sub, rows, breadcrumbs: breadcrumbsArr };
        renderByLevelBreadcrumbs();
        renderByLevel();
    } catch (error) {
        console.error('❌ Ошибка выборки по уровню:', error);
        result.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
        breadcrumbs.style.display = 'none';
    }
}

function renderByLevelBreadcrumbs() {
    const container = document.getElementById('byLevelBreadcrumbs');
    if (!byLevelData.breadcrumbs.length) {
        container.style.display = 'none';
        return;
    }

    // Последний — активный (не кликабельный)
    const html = byLevelData.breadcrumbs.map((bc, idx) => {
        const isLast = idx === byLevelData.breadcrumbs.length - 1;
        if (isLast) {
            return `<span class="breadcrumb-item active">${escapeHtml(bc.label)}</span>`;
        }
        return `<span class="breadcrumb-item" onclick="navigateBreadcrumb(${idx})">${escapeHtml(bc.label)}</span><span class="breadcrumb-sep">/</span>`;
    }).join('');

    container.innerHTML = html;
    container.style.display = '';
}

function navigateBreadcrumb(idx) {
    const bc = byLevelData.breadcrumbs[idx];
    if (!bc) return;

    // Сбрасываем селекты НИЖЕ выбранного уровня
    if (bc.level === 'warehouse') {
        ['byLevelZoneId', 'byLevelRackId', 'byLevelCellId'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('byLevelRackGroup').style.display = 'none';
        document.getElementById('byLevelCellGroup').style.display = 'none';
    } else if (bc.level === 'zone') {
        ['byLevelRackId', 'byLevelCellId'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('byLevelCellGroup').style.display = 'none';
    } else if (bc.level === 'rack') {               // 🆕 5.9.6: ячейка
        const cellEl = document.getElementById('byLevelCellId');
        if (cellEl) cellEl.value = '';
        // byLevelCellGroup оставляем видимым (ячейки этого стеллажа ещё доступны)
    } else if (bc.level === 'office') {
        ['byLevelRoomId', 'byLevelWorkplaceId'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('byLevelWorkplaceGroup').style.display = 'none';
    } else if (bc.level === 'room') {
        const wpEl = document.getElementById('byLevelWorkplaceId');
        if (wpEl) wpEl.value = '';
        // byLevelWorkplaceGroup оставляем видимым
    }

    loadByLevel();
}

function renderByLevel() {
    const result = document.getElementById('byLevelResult');
    const { level, rows } = byLevelData;

    if (rows.length === 0) {
        result.innerHTML = `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>Техники нет</h3>
                <p>На выбранном уровне не найдено ни одной единицы</p>
            </div>
        `;
        return;
    }

    const statusLabel = (s) => ({
        available:   '✅ Доступна',
        placed:      '🪑 На месте',
        assigned:    '👤 Назначена',
        maintenance: '🔧 В ремонте',
        retired:     '❌ Списана',
    }[s] || s);

    let locationHeader = 'Расположение';
    if (level === 'warehouse') locationHeader = 'Ячейка';
    else if (level === 'office') locationHeader = 'Рабочее место';

    const tableHtml = `
        <table class="inventory-table">
            <thead>
                <tr>
                    <th>Инв. номер</th>
                    <th>Модель</th>
                    <th>Корп. ИД</th>
                    <th>Производитель</th>
                    <th>Категория</th>
                    <th>Тип</th>
                    <th>${locationHeader}</th>
                    <th>МОЛ</th>
                    <th>Статус</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(eq => {
                    let location = '—';
                    if (level === 'warehouse' && eq.cell_code) {
                        location = `${escapeHtml(eq.zone_name || '')} → ${escapeHtml(eq.rack_name || '')} → <strong>${escapeHtml(eq.cell_code)}</strong>`;
                    } else if (level === 'office' && eq.workplace_code) {
                        location = `${escapeHtml(eq.room_name || '')} → <strong>${escapeHtml(eq.workplace_name || '')} [${escapeHtml(eq.workplace_code)}]</strong>`;
                    } else if (level === 'user' && (eq.cell_code || eq.workplace_code)) {
                        if (eq.cell_code) {
                            location = `📦 ${escapeHtml(eq.warehouse_name || '')} → ${escapeHtml(eq.cell_code)}`;
                        } else {
                            location = `🪑 ${escapeHtml(eq.office_name || '')} → ${escapeHtml(eq.workplace_name || '')} [${escapeHtml(eq.workplace_code)}]`;
                        }
                    }

                    return `
                        <tr class="equipment-row-link" onclick="openEquipmentCardFromInventory(${eq.id})">
                            <td><strong>${escapeHtml(eq.inventory_number || '—')}</strong></td>
                            <td>${escapeHtml(eq.model_name || '—')}</td>
                            <td>${escapeHtml(eq.model_corporate_id || '—')}</td>
                            <td>${escapeHtml(eq.model_manufacturer || '—')}</td>
                            <td>${eq.category_icon || '📁'} ${escapeHtml(eq.category_name || '—')}</td>
                            <td>${eq.type_icon || '📦'} ${escapeHtml(eq.type_name || '—')}</td>
                            <td style="font-size: 12px;">${location}</td>
                            <td style="font-size: 12px;">${escapeHtml(eq.responsible_user_name || '—')}</td>
                            <td><span class="status-badge status-${eq.status}">${statusLabel(eq.status)}</span></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    result.innerHTML = `<div class="by-level-summary">Найдено: <strong>${rows.length}</strong> единиц</div>${tableHtml}`;
}

// ============================================================
// ЭКСПОРТ В CSV
// ============================================================

function exportInventory(warehouseId) {
    // Просто открываем ссылку — браузер скачает CSV
    window.location.href = `/api/admin/warehouses/${warehouseId}/inventory/export`;
    showToast('📥 Начинается скачивание CSV...', 'success');
}

// ============================================================
// ОТКРЫТИЕ КАРТОЧКИ ТЕХНИКИ (5.9.2)
// ============================================================

/**
 * Открывает карточку техники из модалки склада.
 * После закрытия — если в карточке что-то изменилось (changed),
 * перезагружаем страницу, чтобы обновить сводку и таблицу.
 */
window.openEquipmentCardFromInventory = function(id) {
  if (typeof EquipmentCard === 'undefined') {
    showToast?.('Модуль карточки не загружен', 'error');
    return;
  }
  EquipmentCard.open({
    id: id,
    onClose: (result) => {
      if (result && result.changed) {
        location.reload();
      }
    },
  });
};

// ============================================================
// ЗАКРЫТИЕ МОДАЛКИ
// ============================================================

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        if (e.target.id === 'warehouseDetailModal') closeWarehouseDetailModal();
        if (e.target.id === 'officeDetailModal') closeOfficeDetailModal();
        if (e.target.id === 'userDetailModal') closeUserDetailModal();      // 🆕 5.9.4
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeWarehouseDetailModal();
        closeOfficeDetailModal();
        closeUserDetailModal();       // 🆕 5.9.4
    }
});