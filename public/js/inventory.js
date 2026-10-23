// public/js/inventory.js
// Логика страницы инвентаризации

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let summary = [];
let totals = {};
let currentWarehouseId = null;
let currentWarehouse = null;

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    await loadSummary();
    await loadTotals();
    await loadSpecialSummary();  // 🆕 2.11.15
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
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeWarehouseDetailModal();
    }
});