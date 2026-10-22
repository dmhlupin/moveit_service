// public/js/manage/equipment-card.js
// Карточка техники (viewEquipment) + действия из карточки.

// ============================================================
// КАРТОЧКА ТЕХНИКИ
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

        let historyHtml = '';
        if (history.length === 0) {
            historyHtml = '<p style="color: var(--text-muted); text-align: center; padding: 10px; font-size: 12px;">История пуста</p>';
        } else {
            let rows = '';
            history.forEach(h => {
                const assignedDate = h.assigned_date
                    ? new Date(h.assigned_date).toLocaleDateString('ru-RU') : '—';
                const returnedDate = h.returned_date
                    ? new Date(h.returned_date).toLocaleDateString('ru-RU') : '—';
                const statusBadge2 = h.status === 'active'
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
                        <td>${statusBadge2}</td>
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

        // === КНОПКИ ДЕЙСТВИЙ ===
        const currentRole = getCurrentRole();
        const currentUserId = Number(window.currentUserId);
        const responsibleId = Number(equipment.responsible_user_id);
        const canEdit = (currentRole === 'admin') ||
                        (currentRole === 'mol' && responsibleId === currentUserId);

        let actionButtons = '';

        if (canEdit) {
            if (equipment.status !== 'assigned') {
                if (!equipment.cell_id && !equipment.workplace_id) {
                    actionButtons += `<button onclick="event.stopPropagation(); moveFromCard(${equipment.id})" class="btn btn-primary">📦 На склад</button>`;
                } else if (equipment.cell_id) {
                    actionButtons += `<button onclick="event.stopPropagation(); moveFromCard(${equipment.id})" class="btn btn-ghost">🔄 Переместить (склад)</button>`;
                } else if (equipment.workplace_id) {
                    actionButtons += `<button onclick="event.stopPropagation(); moveFromCard(${equipment.id})" class="btn btn-ghost">🔄 Переместить на склад</button>`;
                }
            }

            if (equipment.status === 'available' || equipment.status === 'placed') {
                if (!equipment.workplace_id) {
                    actionButtons += `<button onclick="event.stopPropagation(); moveToWorkplaceFromCard(${equipment.id})" class="btn btn-ghost">🪑 На рабочее место</button>`;
                } else {
                    actionButtons += `<button onclick="event.stopPropagation(); moveToWorkplaceFromCard(${equipment.id})" class="btn btn-ghost">🔄 Переместить (место)</button>`;
                }
            }

            if (equipment.status === 'available' && equipment.cell_id) {
                actionButtons += `<button onclick="event.stopPropagation(); assignFromCard(${equipment.id})" class="btn btn-success">👤 Назначить</button>`;
                actionButtons += `<button onclick="event.stopPropagation(); changeStatusFromCard(${equipment.id}, 'maintenance')" class="btn btn-warning">🔧 В ремонт</button>`;
                actionButtons += `<button onclick="event.stopPropagation(); changeStatusFromCard(${equipment.id}, 'retired')" class="btn btn-danger">❌ Списать</button>`;
            }

            if (equipment.status === 'assigned') {
                actionButtons += `<button onclick="event.stopPropagation(); returnFromCard(${equipment.id})" class="btn btn-success">↩️ Вернуть</button>`;
            }

            if ((equipment.status === 'maintenance' || equipment.status === 'retired') && equipment.cell_id) {
                actionButtons += `<button onclick="event.stopPropagation(); changeStatusFromCard(${equipment.id}, 'available')" class="btn btn-ghost">↩️ Вернуть в эксплуатацию</button>`;
            }

            actionButtons += `<div class="equipment-actions-divider"></div>`;
            actionButtons += `<button onclick="event.stopPropagation(); editFromCard(${equipment.id})" class="btn btn-ghost">✏️ Редактировать</button>`;

            if (equipment.status === 'available' && !equipment.cell_id) {
                actionButtons += `<button onclick="event.stopPropagation(); deleteFromCard(${equipment.id})" class="btn btn-danger">🗑️ Удалить</button>`;
            }
        }

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
    if (document.getElementById('viewEquipmentModal').classList.contains('active')) {
        closeViewEquipmentModal();
    }
}

// moveFromCard — определим в equipment-actions.js (там openMoveEquipmentModal).
// Но inline-обработчик `onclick="moveFromCard(...)"` требует глобальную функцию.
// Поэтому вынесем сюда простую обёртку:

function moveFromCard(equipmentId) {
    closeViewEquipmentModal();
    if (typeof openMoveEquipmentModal === 'function') {
        openMoveEquipmentModal(equipmentId);
    } else {
        console.warn('⚠️ openMoveEquipmentModal ещё не загружен');
    }
}