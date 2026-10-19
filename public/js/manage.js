// public/js/manage.js — Логика страницы «Учёт ТМЦ»

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 🆕 Текущая роль (проброшена из сервера через #currentRole)
function getCurrentRole() {
    const el = document.getElementById('currentRole');
    return el ? el.value : 'user';
}

// ============================================================
// ПЕРЕМЕННЫЕ
// ============================================================

let deleteId = null;
let deleteType = null;

// ============================================================
// ПОИСК
// ============================================================

function searchTable(type) {
    const input = document.getElementById('searchEquipment');
    if (!input) return;
    const filter = input.value.toLowerCase();
    const table = document.getElementById('equipmentTableBody');
    if (!table) return;

    const rows = table.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        let found = false;
        for (let j = 0; j < cells.length; j++) {
            const text = cells[j].textContent || cells[j].innerText;
            if (text.toLowerCase().indexOf(filter) > -1) {
                found = true;
                break;
            }
        }
        rows[i].style.display = found ? '' : 'none';
    }
}

// ============================================================
// ТЕХНИКА
// ============================================================

function editEquipment(id) {
    window.location.href = `/manage/edit/${id}`;
}

function deleteEquipment(id) {
    deleteId = id;
    deleteType = 'equipment';

    document.getElementById('deleteUserText').textContent =
        'Вы уверены, что хотите удалить эту технику? Это действие нельзя отменить.';
    document.getElementById('deleteModal').classList.add('active');
}

function closeModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteId = null;
    deleteType = null;
}

async function confirmDelete() {
    if (!deleteId) return;

    const endpoint = `/api/manage/equipment/${deleteId}`;

    try {
        const response = await fetch(endpoint, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showToast('❌ Ошибка при удалении', 'error');
    }

    closeModal();
}

// ============================================================
// ПРОСМОТР ТЕХНИКИ (карточка)
// ============================================================

async function viewEquipment(id) {
    try {
        const response = await fetch(`/api/manage/equipment/${id}/details`);

        const data = await response.json();

        if (!data.equipment) {
            showToast('❌ Техника не найдена', 'error');
            return;
        }

        const { equipment, stats, history } = data;

        // ===== Даты и гарантия =====
        const purchaseDate = equipment.purchase_date
            ? new Date(equipment.purchase_date).toLocaleDateString('ru-RU')
            : '—';
        const warrantyDate = equipment.warranty_until
            ? new Date(equipment.warranty_until).toLocaleDateString('ru-RU')
            : '—';

        const warrantyExpired = equipment.warranty_until && new Date(equipment.warranty_until) < new Date();
        const warrantyBadge = warrantyExpired
            ? '<span style="color: #c53030; font-size: 11px;">⚠️ Истекла</span>'
            : (equipment.warranty_until ? '<span style="color: #2f855a; font-size: 11px;">✅ Действует</span>' : '');

        // ===== Статус =====
        const statusLabels = {
            'available':   { label: 'Доступна', class: 'status-available', icon: '✅' },
            'placed':      { label: 'На месте', class: 'status-placed',    icon: '🪑' },
            'assigned':    { label: 'Назначена', class: 'status-assigned', icon: '👤' },
            'maintenance': { label: 'В ремонте', class: 'status-maintenance', icon: '🔧' },
            'retired':     { label: 'Списана',  class: 'status-retired',   icon: '❌' }
        };
        const statusInfo = statusLabels[equipment.status] || statusLabels.available;
        const statusBadge = `<span class="status-badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>`;

        const categoryHtml = equipment.category_name
            ? `<span class="status-badge" style="background: #e2e8f0; color: #4a5568;">📁 ${escapeHtml(equipment.category_name)}</span>`
            : '';
        const typeHtml = equipment.type_name
            ? `<span class="status-badge" style="background: #e2e8f0; color: #4a5568;">📦 ${escapeHtml(equipment.type_name)}</span>`
            : '';

        // ===== Текущий владелец =====
        let currentUserHtml = '';
        if (stats.current_user) {
            const u = stats.current_user;
            const initials = getInitials(u.full_name || u.username);
            const assignedDate = new Date(u.assigned_date).toLocaleDateString('ru-RU');
            currentUserHtml = `
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
        } else {
            currentUserHtml = `
                <div class="empty-equipment">
                    <span class="empty-icon">📭</span>
                    <p>Техника не назначена пользователю</p>
                </div>
            `;
        }

        // ===== История (аккордеон) =====
        let historyHtml = '';
        if (history.length === 0) {
            historyHtml = '<p style="color: var(--text-muted); text-align: center; padding: 10px; font-size: 12px;">История пуста</p>';
        } else {
            let rows = '';
            history.forEach(h => {
                const assignedDate = h.assigned_date
                    ? new Date(h.assigned_date).toLocaleDateString('ru-RU')
                    : '—';
                const returnedDate = h.returned_date
                    ? new Date(h.returned_date).toLocaleDateString('ru-RU')
                    : '—';
                const statusBadge = h.status === 'active'
                    ? '<span class="status-badge status-assigned" style="font-size:10px;">Активна</span>'
                    : '<span class="status-badge status-available" style="font-size:10px;">Возвращена</span>';

                rows += `
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

            historyHtml = `
                <details class="history-accordion">
                    <summary>📜 История использования (${stats.total})</summary>
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
                        <tbody>${rows}</tbody>
                    </table>
                </details>
            `;
        }

        // ===== Место хранения =====
        let locationHtml = '';
        if (equipment.cell_id) {
            locationHtml = `
                <div class="detail-item location-detail-item">
                    <div class="location-detail-info">
                        <div class="value">
                            ${escapeHtml(equipment.warehouse_name || '—')} 
                            → ${escapeHtml(equipment.zone_name || '—')} 
                            → ${escapeHtml(equipment.rack_name || '—')} 
                            → <strong>${escapeHtml(equipment.cell_name || '—')}${equipment.cell_code ? ` [${equipment.cell_code}]` : ''}</strong>
                        </div>
                    </div>
                </div>
            `;
        } else if (equipment.workplace_id) {
            locationHtml = `
                <div class="detail-item location-detail-item">
                    <div class="location-detail-info">
                        <div class="value">
                            🪑 ${escapeHtml(equipment.workplace_name || '—')}${equipment.workplace_code ? ` [${equipment.workplace_code}]` : ''}
                            <div class="location-path" style="font-size: 11px; margin-top: 2px;">
                                ${escapeHtml(equipment.office_name || '—')} / ${escapeHtml(equipment.room_name || '—')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            locationHtml = `
                <div class="detail-item location-detail-item no-location">
                    <div class="location-detail-info">
                        <div class="value" style="color: var(--text-muted);">
                            Место не указано
                        </div>
                    </div>
                </div>
            `;
        }

        // ===== Кнопки действий =====
        // ===== Кнопки действий =====
        const currentRole = getCurrentRole();
        const currentUserId = Number(window.currentUserId);
        const responsibleId = Number(equipment.responsible_user_id);
        const canEdit = (currentRole === 'admin') ||
                        (currentRole === 'mol' && responsibleId === currentUserId);

        console.log('🔍 canEdit:', { currentRole, currentUserId, responsibleId, canEdit });
        // window.currentUserId нужно будет пробросить из шаблона (см. ниже)

        console.log('🔍 canEdit:', { currentRole, currentUserId, responsibleId, canEdit });

        let actionButtons = '';

        if (canEdit) {
            // На склад / Переместить
            if (equipment.status !== 'assigned') {
                if (!equipment.cell_id && !equipment.workplace_id) {
                    actionButtons += `<button onclick="event.stopPropagation(); moveFromCard(${equipment.id})" class="btn btn-primary">📦 На склад</button>`;
                } else if (equipment.cell_id) {
                    actionButtons += `<button onclick="event.stopPropagation(); moveFromCard(${equipment.id})" class="btn btn-ghost">🔄 Переместить (склад)</button>`;
                } else if (equipment.workplace_id) {
                    actionButtons += `<button onclick="event.stopPropagation(); moveFromCard(${equipment.id})" class="btn btn-ghost">🔄 Переместить на склад</button>`;
                }
            }

            // На рабочее место / Переместить (место)
            if (equipment.status === 'available' || equipment.status === 'placed') {
                if (!equipment.workplace_id) {
                    actionButtons += `<button onclick="event.stopPropagation(); moveToWorkplaceFromCard(${equipment.id})" class="btn btn-ghost">🪑 На рабочее место</button>`;
                } else {
                    actionButtons += `<button onclick="event.stopPropagation(); moveToWorkplaceFromCard(${equipment.id})" class="btn btn-ghost">🔄 Переместить (место)</button>`;
                }
            }

            // Назначить (только available + cell_id)
            if (equipment.status === 'available' && equipment.cell_id) {
                actionButtons += `<button onclick="event.stopPropagation(); assignFromCard(${equipment.id})" class="btn btn-success">👤 Назначить</button>`;
            }

            // В ремонт / Списать (только available + cell_id)
            if (equipment.status === 'available' && equipment.cell_id) {
                actionButtons += `<button onclick="event.stopPropagation(); changeStatusFromCard(${equipment.id}, 'maintenance')" class="btn btn-warning">🔧 В ремонт</button>`;
                actionButtons += `<button onclick="event.stopPropagation(); changeStatusFromCard(${equipment.id}, 'retired')" class="btn btn-danger">❌ Списать</button>`;
            }

            // Вернуть (только assigned)
            if (equipment.status === 'assigned') {
                actionButtons += `<button onclick="event.stopPropagation(); returnFromCard(${equipment.id})" class="btn btn-success">↩️ Вернуть</button>`;
            }

            // Вернуть в эксплуатацию (только maintenance / retired + cell_id)
            if ((equipment.status === 'maintenance' || equipment.status === 'retired') && equipment.cell_id) {
                actionButtons += `<button onclick="event.stopPropagation(); changeStatusFromCard(${equipment.id}, 'available')" class="btn btn-ghost">↩️ Вернуть в эксплуатацию</button>`;
            }

            // Редактировать
            actionButtons += `<div class="equipment-actions-divider"></div>`;
            actionButtons += `<button onclick="event.stopPropagation(); editFromCard(${equipment.id})" class="btn btn-ghost">✏️ Редактировать</button>`;

            // Удалить (только available + cell_id null)
            if (equipment.status === 'available' && !equipment.cell_id) {
                actionButtons += `<button onclick="event.stopPropagation(); deleteFromCard(${equipment.id})" class="btn btn-danger">🗑️ Удалить</button>`;
            }
        }

        // ===== Сборка HTML =====
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

            <div class="equipment-detail-layout">
                <!-- ЛЕВАЯ КОЛОНКА -->
                <div class="equipment-detail-main">
                    <div class="user-detail-section">
                        <h4>📋 Информация о технике</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Модель</label>
                                <div class="value">${escapeHtml(equipment.model_name || '—')}</div>
                            </div>
                            <div class="detail-item">
                                <label>Корпоративный ИД</label>
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
                            <div class="detail-item" style="grid-column: 1 / -1;">
                                <label>Ответственный МОЛ</label>
                                <div class="value">
                                    ${equipment.responsible_user_name
                                        ? `<span style="color: var(--accent); font-weight: 600;">${escapeHtml(equipment.responsible_user_name)}</span>`
                                        : '<span style="color: var(--text-muted);">—</span>'}
                                </div>
                            </div>
                        </div>
                        ${equipment.description ? `
                            <div class="detail-item" style="margin-top: 8px;">
                                <label>Описание</label>
                                <div class="value">${escapeHtml(equipment.description)}</div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="user-detail-section">
                        <h4>📍 Место хранения</h4>
                        ${locationHtml}
                    </div>

                    <div class="user-detail-section">
                        <h4>👤 Текущий владелец</h4>
                        ${currentUserHtml}
                    </div>

                    ${historyHtml}
                </div>

                <!-- ПРАВАЯ КОЛОНКА -->
                <div class="equipment-detail-side">
                    ${canEdit && actionButtons ? `
                        <div class="equipment-actions-card">
                            <h4>⚡ Действия</h4>
                            <div class="equipment-actions-list">
                                ${actionButtons}
                            </div>
                        </div>
                    ` : ''}

                    <div class="equipment-mini-stats">
                        <div>📊 Всего выдач: <strong>${stats.total}</strong></div>
                        <div>✅ Активных: <strong>${stats.active}</strong></div>
                        <div>↩️ Возвратов: <strong>${stats.returned}</strong></div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('viewEquipmentModal').classList.add('active');
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('❌ Ошибка загрузки данных', 'error');
    }
}

function closeViewEquipmentModal() {
    document.getElementById('viewEquipmentModal').classList.remove('active');
}

// ============================================================
// ПЕРЕМЕЩЕНИЕ ТЕХНИКИ (без изменений)
// ============================================================

let moveEquipmentData = null;
let moveLocations = {
    warehouses: [],
    zones: [],
    racks: [],
    cells: [],
};

async function openMoveEquipmentModal(equipmentId) {
    const modal = document.getElementById('moveEquipmentModal');
    const info = document.getElementById('moveEquipmentInfo');
    const currentLocation = document.getElementById('moveCurrentLocation');

    info.innerHTML = '<div style="text-align: center; padding: 10px;">⏳ Загрузка...</div>';
    currentLocation.innerHTML = '';
    modal.classList.add('active');

    try {
        const response = await fetch(`/api/manage/equipment/${equipmentId}/details`);
        const data = await response.json();

        if (!data.equipment) {
            showToast('❌ Техника не найдена', 'error');
            closeMoveEquipmentModal();
            return;
        }

        moveEquipmentData = data.equipment;

        info.innerHTML = `
            <div class="move-equipment-name">${escapeHtml(data.equipment.model_name || '—')}</div>
            <span class="move-equipment-inv">${escapeHtml(data.equipment.inventory_number || '—')}</span>
        `;

        if (data.equipment.cell_id) {
            currentLocation.className = 'move-current-location';
            currentLocation.innerHTML = `
                <div><strong>📍 Текущее место:</strong></div>
                <div style="margin-top: 5px;">
                    ${escapeHtml(data.equipment.warehouse_name || '—')} → 
                    ${escapeHtml(data.equipment.zone_name || '—')} → 
                    ${escapeHtml(data.equipment.rack_name || '—')} → 
                    <strong>${escapeHtml(data.equipment.cell_name || '—')}${data.equipment.cell_code ? ` [${data.equipment.cell_code}]` : ''}</strong>
                </div>
            `;
        } else {
            currentLocation.className = 'move-current-location no-location';
            currentLocation.innerHTML = `<div><strong>📍 Текущее место:</strong> не указано</div>`;
        }

        document.getElementById('moveEquipmentId').value = equipmentId;
        document.getElementById('moveNotes').value = '';

        await loadMoveWarehouses();

        if (data.equipment.cell_id) {
            await preloadMoveLocation(data.equipment);
        } else {
            document.getElementById('moveWarehouse').value = '';
            document.getElementById('moveZone').innerHTML = '<option value="">— Сначала выберите склад —</option>';
            document.getElementById('moveZone').disabled = true;
            document.getElementById('moveRack').innerHTML = '<option value="">— Сначала выберите зону —</option>';
            document.getElementById('moveRack').disabled = true;
            document.getElementById('moveCell').innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
            document.getElementById('moveCell').disabled = true;
            updateMovePreview();
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showToast('❌ Ошибка загрузки техники', 'error');
        closeMoveEquipmentModal();
    }
}

function closeMoveEquipmentModal() {
    document.getElementById('moveEquipmentModal').classList.remove('active');
    moveEquipmentData = null;
    moveLocations = { warehouses: [], zones: [], racks: [], cells: [] };
}

async function loadMoveWarehouses() {
    try {
        const response = await fetch('/api/admin/warehouses');
        const warehouses = await response.json();

        moveLocations.warehouses = warehouses;

        const select = document.getElementById('moveWarehouse');
        select.innerHTML = '<option value="">— Убрать из ячейки —</option>' +
            warehouses.map(w => `
                <option value="${w.id}">
                    ${w.is_default ? '⭐ ' : '🏢 '}${escapeHtml(w.name)}
                </option>
            `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки складов:', error);
    }
}

async function onMoveWarehouseChange() {
    const warehouseId = document.getElementById('moveWarehouse').value;
    const zoneSelect = document.getElementById('moveZone');
    const rackSelect = document.getElementById('moveRack');
    const cellSelect = document.getElementById('moveCell');

    rackSelect.innerHTML = '<option value="">— Сначала выберите зону —</option>';
    rackSelect.disabled = true;
    cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    cellSelect.disabled = true;
    updateMovePreview();

    if (!warehouseId) {
        zoneSelect.innerHTML = '<option value="">— Сначала выберите склад —</option>';
        zoneSelect.disabled = true;
        return;
    }

    zoneSelect.innerHTML = '<option value="">⏳ Загрузка...</option>';
    zoneSelect.disabled = true;

    try {
        const response = await fetch(`/api/admin/warehouses/${warehouseId}/zones`);
        const zones = await response.json();

        moveLocations.zones = zones;

        if (zones.length === 0) {
            zoneSelect.innerHTML = '<option value="">— Нет зон —</option>';
            return;
        }

        zoneSelect.innerHTML = '<option value="">— Выберите зону —</option>' +
            zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
        zoneSelect.disabled = false;
    } catch (error) {
        console.error('❌ Ошибка загрузки зон:', error);
        zoneSelect.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

async function onMoveZoneChange() {
    const zoneId = document.getElementById('moveZone').value;
    const rackSelect = document.getElementById('moveRack');
    const cellSelect = document.getElementById('moveCell');

    cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    cellSelect.disabled = true;
    updateMovePreview();

    if (!zoneId) {
        rackSelect.innerHTML = '<option value="">— Сначала выберите зону —</option>';
        rackSelect.disabled = true;
        return;
    }

    rackSelect.innerHTML = '<option value="">⏳ Загрузка...</option>';
    rackSelect.disabled = true;

    try {
        const response = await fetch(`/api/admin/zones/${zoneId}/racks`);
        const racks = await response.json();

        moveLocations.racks = racks;

        if (racks.length === 0) {
            rackSelect.innerHTML = '<option value="">— Нет стеллажей —</option>';
            return;
        }

        rackSelect.innerHTML = '<option value="">— Выберите стеллаж —</option>' +
            racks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
        rackSelect.disabled = false;
    } catch (error) {
        console.error('❌ Ошибка загрузки стеллажей:', error);
        rackSelect.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

async function onMoveRackChange() {
    const rackId = document.getElementById('moveRack').value;
    const cellSelect = document.getElementById('moveCell');

    updateMovePreview();

    if (!rackId) {
        cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
        cellSelect.disabled = true;
        return;
    }

    cellSelect.innerHTML = '<option value="">⏳ Загрузка...</option>';
    cellSelect.disabled = true;

    try {
        const response = await fetch(`/api/admin/racks/${rackId}/cells`);
        const cells = await response.json();

        moveLocations.cells = cells;

        if (cells.length === 0) {
            cellSelect.innerHTML = '<option value="">— Нет ячеек —</option>';
            return;
        }

        cellSelect.innerHTML = '<option value="">— Выберите ячейку —</option>' +
            cells.map(c => {
                const code = c.code ? ` [${c.code}]` : '';
                const count = c.equipment_count || 0;
                const capacity = c.capacity || 0;
                const isFull = capacity > 0 && count >= capacity;
                const countText = capacity > 0 ? ` (${count}/${capacity})` : (count > 0 ? ` (${count})` : '');
                const fullMark = isFull ? ' ⛔' : '';
                return `<option value="${c.id}" ${isFull ? 'disabled' : ''}>${escapeHtml(c.name)}${code}${countText}${fullMark}</option>`;
            }).join('');
        cellSelect.disabled = false;
    } catch (error) {
        console.error('❌ Ошибка загрузки ячеек:', error);
        cellSelect.innerHTML = '<option value="">— Ошибка —</option>';
    }
}

function updateMovePreview() {
    const warehouseId = document.getElementById('moveWarehouse')?.value;
    const zoneId = document.getElementById('moveZone')?.value;
    const rackId = document.getElementById('moveRack')?.value;
    const cellId = document.getElementById('moveCell')?.value;

    const preview = document.getElementById('movePreview');
    const previewText = document.getElementById('movePreviewText');

    if (!preview || !previewText) return;

    const parts = [];

    if (warehouseId) {
        const w = moveLocations.warehouses.find(x => String(x.id) === String(warehouseId));
        if (w) parts.push(`🏢 ${w.name}`);
    }
    if (zoneId) {
        const z = moveLocations.zones.find(x => String(x.id) === String(zoneId));
        if (z) parts.push(`📍 ${z.name}`);
    }
    if (rackId) {
        const r = moveLocations.racks.find(x => String(x.id) === String(rackId));
        if (r) parts.push(`🗄️ ${r.name}`);
    }
    if (cellId) {
        const c = moveLocations.cells.find(x => String(x.id) === String(cellId));
        if (c) {
            const code = c.code ? ` [${c.code}]` : '';
            parts.push(`📦 ${c.name}${code}`);
        }
    }

    if (parts.length === 0) {
        preview.style.display = 'none';
    } else {
        preview.style.display = 'flex';
        previewText.textContent = parts.join(' → ');
    }
}

async function preloadMoveLocation(equipment) {
    try {
        const warehouseSelect = document.getElementById('moveWarehouse');
        warehouseSelect.value = equipment.warehouse_id;

        const zonesResponse = await fetch(`/api/admin/warehouses/${equipment.warehouse_id}/zones`);
        const zones = await zonesResponse.json();
        moveLocations.zones = zones;

        const zoneSelect = document.getElementById('moveZone');
        zoneSelect.innerHTML = '<option value="">— Выберите зону —</option>' +
            zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
        zoneSelect.disabled = false;
        zoneSelect.value = equipment.zone_id || '';

        if (equipment.zone_id) {
            const racksResponse = await fetch(`/api/admin/zones/${equipment.zone_id}/racks`);
            const racks = await racksResponse.json();
            moveLocations.racks = racks;

            const rackSelect = document.getElementById('moveRack');
            rackSelect.innerHTML = '<option value="">— Выберите стеллаж —</option>' +
                racks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
            rackSelect.disabled = false;
            rackSelect.value = equipment.rack_id || '';
        }

        if (equipment.rack_id) {
            const cellsResponse = await fetch(`/api/admin/racks/${equipment.rack_id}/cells`);
            const cells = await cellsResponse.json();
            moveLocations.cells = cells;

            const cellSelect = document.getElementById('moveCell');
            cellSelect.innerHTML = '<option value="">— Выберите ячейку —</option>' +
                cells.map(c => {
                    const code = c.code ? ` [${c.code}]` : '';
                    const count = c.equipment_count || 0;
                    const capacity = c.capacity || 0;
                    const countText = capacity > 0 ? ` (${count}/${capacity})` : (count > 0 ? ` (${count})` : '');
                    return `<option value="${c.id}">${escapeHtml(c.name)}${code}${countText}</option>`;
                }).join('');
            cellSelect.disabled = false;
            cellSelect.value = equipment.cell_id || '';
        }

        updateMovePreview();
    } catch (error) {
        console.error('❌ Ошибка предзаполнения:', error);
    }
}

async function submitMoveEquipment(event) {
    event.preventDefault();

    const equipmentId = document.getElementById('moveEquipmentId').value;
    const cellId = document.getElementById('moveCell').value || null;
    const notes = document.getElementById('moveNotes').value.trim();

    if (!equipmentId) {
        showToast('❌ Ошибка: ID техники не указан', 'error');
        return;
    }

    const submitBtn = document.getElementById('moveSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Перемещение...';

    try {
        const response = await fetch(`/api/manage/equipment/${equipmentId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cell_id: cellId ? parseInt(cellId) : null,
                notes: notes || null
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast(result.message || '✅ Техника перемещена', 'success');
            closeMoveEquipmentModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('❌ ' + result.error, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '🔄 Переместить';
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showToast('❌ Ошибка соединения', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '🔄 Переместить';
    }
}

function moveFromCard(equipmentId) {
    closeViewEquipmentModal();
    openMoveEquipmentModal(equipmentId);
}

// ============================================================
// ДЕЙСТВИЯ ИЗ КАРТОЧКИ
// ============================================================

function editFromCard(id) {
    window.location.href = `/manage/edit/${id}`;
}

function deleteFromCard(id) {
    deleteId = id;
    deleteType = 'equipment';
    document.getElementById('deleteUserText').textContent =
        'Вы уверены, что хотите удалить эту технику? Это действие нельзя отменить.';
    document.getElementById('deleteModal').classList.add('active');
}

// ===== Назначение пользователю =====
async function assignFromCard(id) {
    document.getElementById('assignEquipmentId').value = id;
    document.getElementById('assignCondition').value = 'В хорошем состоянии';

    // Загружаем пользователей
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        const select = document.getElementById('assignUserId');
        select.innerHTML = '<option value="">— Выберите пользователя —</option>' +
            users
                .filter(u => u.is_active === 1 && u.role !== 'admin')
                .map(u => {
                    const name = u.full_name || u.username;
                    const dept = u.department ? ` (${u.department})` : '';
                    return `<option value="${u.id}">${escapeHtml(name)}${escapeHtml(dept)}</option>`;
                }).join('');
    } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
    }

    document.getElementById('assignModal').classList.add('active');
}

function closeAssignModal() {
    document.getElementById('assignModal').classList.remove('active');
}

async function submitAssign() {
    const id = document.getElementById('assignEquipmentId').value;
    const userId = document.getElementById('assignUserId').value;
    const condition = document.getElementById('assignCondition').value.trim();

    if (!userId) {
        showToast('❌ Выберите пользователя', 'error');
        return;
    }

    const btn = document.getElementById('assignSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Назначение...';

    try {
        const response = await fetch(`/api/manage/equipment/${id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(userId), condition })
        });
        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            closeAssignModal();
            closeViewEquipmentModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('❌ ' + result.error, 'error');
            btn.disabled = false;
            btn.textContent = '👤 Назначить';
        }
    } catch (err) {
        console.error(err);
        showToast('❌ Ошибка соединения', 'error');
        btn.disabled = false;
        btn.textContent = '👤 Назначить';
    }
}

// ===== Смена статуса (в ремонт / списать / вернуть в эксплуатацию) =====
function changeStatusFromCard(id, status) {
    const titles = {
        maintenance: '🔧 Передать в ремонт',
        retired: '❌ Списать технику',
        available: '↩️ Вернуть в эксплуатацию'
    };
    const texts = {
        maintenance: 'Техника будет переведена в статус «В ремонте». Ячейка склада сохранится.',
        retired: 'Техника будет списана. Ячейка склада сохранится.',
        available: 'Техника будет возвращена в эксплуатацию (статус «Доступна»). Ячейка склада сохранится.'
    };

    document.getElementById('statusChangeEquipmentId').value = id;
    document.getElementById('statusChangeNewStatus').value = status;
    document.getElementById('statusChangeTitle').textContent = titles[status] || 'Смена статуса';
    document.getElementById('statusChangeText').textContent = texts[status] || '';
    document.getElementById('statusChangeModal').classList.add('active');
}

function closeStatusChangeModal() {
    document.getElementById('statusChangeModal').classList.remove('active');
}

async function submitStatusChange() {
    const id = document.getElementById('statusChangeEquipmentId').value;
    const status = document.getElementById('statusChangeNewStatus').value;

    const btn = document.getElementById('statusChangeSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳...';

    try {
        const response = await fetch(`/api/manage/equipment/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            closeStatusChangeModal();
            closeViewEquipmentModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('❌ ' + result.error, 'error');
            btn.disabled = false;
            btn.textContent = 'Подтвердить';
        }
    } catch (err) {
        console.error(err);
        showToast('❌ Ошибка соединения', 'error');
        btn.disabled = false;
        btn.textContent = 'Подтвердить';
    }
}

// ===== Возврат от пользователя =====
async function returnFromCard(id) {
    document.getElementById('returnEquipmentId').value = id;
    document.getElementById('returnWarehouse').value = '';
    document.getElementById('returnZone').innerHTML = '<option value="">— Сначала выберите склад —</option>';
    document.getElementById('returnZone').disabled = true;
    document.getElementById('returnRack').innerHTML = '<option value="">— Сначала выберите зону —</option>';
    document.getElementById('returnRack').disabled = true;
    document.getElementById('returnCell').innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    document.getElementById('returnCell').disabled = true;

    // Загружаем склады
    try {
        const response = await fetch('/api/admin/warehouses');
        const warehouses = await response.json();
        const select = document.getElementById('returnWarehouse');
        select.innerHTML = '<option value="">— Выберите склад —</option>' +
            warehouses.map(w => `<option value="${w.id}">${w.is_default ? '⭐ ' : '🏢 '}${escapeHtml(w.name)}</option>`).join('');
    } catch (err) {
        console.error('Ошибка загрузки складов:', err);
    }

    document.getElementById('returnModal').classList.add('active');
}

function closeReturnModal() {
    document.getElementById('returnModal').classList.remove('active');
}

async function onReturnWarehouseChange() {
    const whId = document.getElementById('returnWarehouse').value;
    const zoneSelect = document.getElementById('returnZone');
    const rackSelect = document.getElementById('returnRack');
    const cellSelect = document.getElementById('returnCell');

    rackSelect.innerHTML = '<option value="">— Сначала выберите зону —</option>';
    rackSelect.disabled = true;
    cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    cellSelect.disabled = true;

    if (!whId) {
        zoneSelect.innerHTML = '<option value="">— Сначала выберите склад —</option>';
        zoneSelect.disabled = true;
        return;
    }

    try {
        const response = await fetch(`/api/admin/warehouses/${whId}/zones`);
        const zones = await response.json();
        zoneSelect.innerHTML = '<option value="">— Выберите зону —</option>' +
            zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
        zoneSelect.disabled = false;
    } catch (err) {
        console.error(err);
    }
}

async function onReturnZoneChange() {
    const zoneId = document.getElementById('returnZone').value;
    const rackSelect = document.getElementById('returnRack');
    const cellSelect = document.getElementById('returnCell');

    cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    cellSelect.disabled = true;

    if (!zoneId) {
        rackSelect.innerHTML = '<option value="">— Сначала выберите зону —</option>';
        rackSelect.disabled = true;
        return;
    }

    try {
        const response = await fetch(`/api/admin/zones/${zoneId}/racks`);
        const racks = await response.json();
        rackSelect.innerHTML = '<option value="">— Выберите стеллаж —</option>' +
            racks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
        rackSelect.disabled = false;
    } catch (err) {
        console.error(err);
    }
}

async function onReturnRackChange() {
    const rackId = document.getElementById('returnRack').value;
    const cellSelect = document.getElementById('returnCell');

    if (!rackId) {
        cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
        cellSelect.disabled = true;
        return;
    }

    try {
        const response = await fetch(`/api/admin/racks/${rackId}/cells`);
        const cells = await response.json();
        cellSelect.innerHTML = '<option value="">— Выберите ячейку —</option>' +
            cells.map(c => {
                const code = c.code ? ` [${c.code}]` : '';
                const count = c.equipment_count || 0;
                const capacity = c.capacity || 0;
                const countText = capacity > 0 ? ` (${count}/${capacity})` : (count > 0 ? ` (${count})` : '');
                const isFull = capacity > 0 && count >= capacity;
                return `<option value="${c.id}" ${isFull ? 'disabled' : ''}>${escapeHtml(c.name)}${code}${countText}${isFull ? ' ⛔' : ''}</option>`;
            }).join('');
        cellSelect.disabled = false;
    } catch (err) {
        console.error(err);
    }
}

async function submitReturn() {
    const id = document.getElementById('returnEquipmentId').value;
    const cellId = document.getElementById('returnCell').value;

    if (!cellId) {
        showToast('❌ Выберите ячейку склада', 'error');
        return;
    }

    const btn = document.getElementById('returnSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Возврат...';

    try {
        const response = await fetch(`/api/manage/equipment/${id}/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cell_id: parseInt(cellId) })
        });
        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            closeReturnModal();
            closeViewEquipmentModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('❌ ' + result.error, 'error');
            btn.disabled = false;
            btn.textContent = '↩️ Вернуть';
        }
    } catch (err) {
        console.error(err);
        showToast('❌ Ошибка соединения', 'error');
        btn.disabled = false;
        btn.textContent = '↩️ Вернуть';
    }
}

// ===== Перемещение на рабочее место =====
async function moveToWorkplaceFromCard(id) {
    document.getElementById('moveToWorkplaceEquipmentId').value = id;

    // Загружаем рабочие места
    try {
        const response = await fetch('/api/admin/offices/tree');
        const offices = await response.json();

        let html = '<option value="">— Выберите рабочее место —</option>';
        offices.forEach(office => {
            (office.rooms || []).forEach(room => {
                const workplaces = room.workplaces || [];
                if (workplaces.length === 0) return;

                const groupLabel = `🏛️ ${office.name} / 🚪 ${room.name}`;
                let groupHtml = '';
                workplaces.forEach(wp => {
                    const code = wp.code ? ` [${wp.code}]` : '';
                    groupHtml += `<option value="${wp.id}">🪑 ${escapeHtml(wp.name)}${code}</option>`;
                });
                html += `<optgroup label="${escapeHtml(groupLabel)}">${groupHtml}</optgroup>`;
            });
        });

        document.getElementById('moveToWorkplaceSelect').innerHTML = html;
    } catch (err) {
        console.error(err);
    }

    document.getElementById('moveToWorkplaceModal').classList.add('active');
}

function closeMoveToWorkplaceModal() {
    document.getElementById('moveToWorkplaceModal').classList.remove('active');
}

async function submitMoveToWorkplace() {
    const id = document.getElementById('moveToWorkplaceEquipmentId').value;
    const workplaceId = document.getElementById('moveToWorkplaceSelect').value;

    if (!workplaceId) {
        showToast('❌ Выберите рабочее место', 'error');
        return;
    }

    const btn = document.getElementById('moveToWorkplaceSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳...';

    try {
        const response = await fetch(`/api/manage/equipment/${id}/move-to-workplace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workplace_id: parseInt(workplaceId) })
        });
        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            closeMoveToWorkplaceModal();
            closeViewEquipmentModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('❌ ' + result.error, 'error');
            btn.disabled = false;
            btn.textContent = '🪑 Переместить';
        }
    } catch (err) {
        console.error(err);
        showToast('❌ Ошибка соединения', 'error');
        btn.disabled = false;
        btn.textContent = '🪑 Переместить';
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // 🆕 ID текущего пользователя — для проверки прав в карточке
    window.currentUserId = parseInt(document.getElementById('currentUserId')?.value || '0');
    console.log('🔍 currentUserId из DOM:', window.currentUserId);

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                if (this.id === 'deleteModal') closeModal();
                if (this.id === 'viewEquipmentModal') closeViewEquipmentModal();
                if (this.id === 'moveEquipmentModal') closeMoveEquipmentModal();
            }
        });
    });

    const searchEq = document.getElementById('searchEquipment');
    if (searchEq) searchEq.focus();

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeViewEquipmentModal();
            closeMoveEquipmentModal();
        }
    });
});