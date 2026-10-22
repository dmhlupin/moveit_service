// public/js/equipment-card/modals.js
// Вложенные модалки действий карточки техники:
//   - openDelete          — подтверждение удаления
//   - openMove            — перемещение на склад (каскад склад→зона→стеллаж→ячейка)
//   - openAssign          — назначение пользователю
//   - openStatusChange    — смена статуса (в ремонт / списать / вернуть в эксплуатацию)
//   - openReturn          — возврат на склад (обязательный выбор ячейки)
//   - openMoveToWorkplace — перемещение на рабочее место
//
// После успешного действия — EquipmentCard.notifyChanged({ action }).
// Раньше было location.reload(); теперь — событие + onClose.
// Зависит от: EquipmentCard, escapeHtml, showToast.

(function () {
    'use strict';

    // ============================================================
    // ВНУТРЕННЕЕ СОСТОЯНИЕ (для каскадов перемещения)
    // ============================================================

    let moveEquipmentData = null;
    let moveLocations = {
        warehouses: [],
        zones: [],
        racks: [],
        cells: [],
    };

    // ============================================================
    // ХЕЛПЕР: ЗАКРЫТЬ МОДАЛКУ ПО ID
    // ============================================================

    function closeModalById(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.classList.remove('active');
    }

    // ============================================================
    // 1. ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ
    // ============================================================

    let pendingDeleteId = null;

    function openDelete(id) {
        pendingDeleteId = id;
        const textEl = document.getElementById('deleteUserText');
        if (textEl) {
            textEl.textContent =
                'Вы уверены, что хотите удалить эту технику? Это действие нельзя отменить.';
        }
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.add('active');
    }

    function closeDelete() {
        closeModalById('deleteModal');
        pendingDeleteId = null;
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;

        try {
            const response = await fetch(`/api/manage/equipment/${id}`, {
                method: 'DELETE',
            });
            const result = await response.json();

            if (result.success) {
                showToast('✅ ' + result.message, 'success');
                closeDelete();
                // Закрываем карточку и уведомляем об изменении
                EquipmentCard.notifyChanged({ action: 'delete', id });
            } else {
                showToast('❌ ' + result.error, 'error');
            }
        } catch (error) {
            console.error('[EquipmentCard] delete error:', error);
            showToast('❌ Ошибка при удалении', 'error');
        }
    }

    // ============================================================
    // 2. ПЕРЕМЕЩЕНИЕ НА СКЛАД
    // ============================================================

    async function openMove(equipmentId) {
        const modal = document.getElementById('moveEquipmentModal');
        const info = document.getElementById('moveEquipmentInfo');
        const currentLocation = document.getElementById('moveCurrentLocation');

        if (!modal || !info || !currentLocation) {
            console.error('[EquipmentCard] move modal not found in DOM');
            return;
        }

        info.innerHTML = '<div style="text-align: center; padding: 10px;">⏳ Загрузка...</div>';
        currentLocation.innerHTML = '';
        modal.classList.add('active');

        try {
            const response = await fetch(`/api/manage/equipment/${equipmentId}/details`);
            const data = await response.json();

            if (!data.equipment) {
                showToast('❌ Техника не найдена', 'error');
                closeMove();
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
            console.error('[EquipmentCard] move error:', error);
            showToast('❌ Ошибка загрузки техники', 'error');
            closeMove();
        }
    }

    function closeMove() {
        closeModalById('moveEquipmentModal');
        moveEquipmentData = null;
        moveLocations = { warehouses: [], zones: [], racks: [], cells: [] };
    }

    async function loadMoveWarehouses() {
        try {
            const response = await fetch('/api/admin/warehouses');
            const warehouses = await response.json();

            moveLocations.warehouses = warehouses;

            const select = document.getElementById('moveWarehouse');
            if (!select) return;
            select.innerHTML = '<option value="">— Убрать из ячейки —</option>' +
                warehouses.map(w => `
                    <option value="${w.id}">
                        ${w.is_default ? '⭐ ' : '🏢 '}${escapeHtml(w.name)}
                    </option>
                `).join('');
        } catch (error) {
            console.error('[EquipmentCard] load warehouses error:', error);
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
            console.error('[EquipmentCard] load zones error:', error);
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
            console.error('[EquipmentCard] load racks error:', error);
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
            console.error('[EquipmentCard] load cells error:', error);
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
            console.error('[EquipmentCard] preload location error:', error);
        }
    }

    async function submitMove(event) {
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
                    notes: notes || null,
                }),
            });

            const result = await response.json();

            if (result.success) {
                showToast(result.message || '✅ Техника перемещена', 'success');
                closeMove();
                EquipmentCard.notifyChanged({ action: 'move', id: equipmentId, cell_id: cellId });
            } else {
                showToast('❌ ' + result.error, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '🔄 Переместить';
            }
        } catch (error) {
            console.error('[EquipmentCard] submit move error:', error);
            showToast('❌ Ошибка соединения', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '🔄 Переместить';
        }
    }

    // ============================================================
    // 3. НАЗНАЧЕНИЕ ПОЛЬЗОВАТЕЛЮ
    // ============================================================

    async function openAssign(id) {
        document.getElementById('assignEquipmentId').value = id;
        document.getElementById('assignCondition').value = 'В хорошем состоянии';

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
            console.error('[EquipmentCard] load users error:', err);
        }

        document.getElementById('assignModal').classList.add('active');
    }

    function closeAssign() {
        closeModalById('assignModal');
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
                body: JSON.stringify({ user_id: parseInt(userId), condition }),
            });
            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                closeAssign();
                EquipmentCard.notifyChanged({ action: 'assign', id });
            } else {
                showToast('❌ ' + result.error, 'error');
                btn.disabled = false;
                btn.textContent = '👤 Назначить';
            }
        } catch (err) {
            console.error('[EquipmentCard] submit assign error:', err);
            showToast('❌ Ошибка соединения', 'error');
            btn.disabled = false;
            btn.textContent = '👤 Назначить';
        }
    }

    // ============================================================
    // 4. СМЕНА СТАТУСА
    // ============================================================

    function openStatusChange(id, status) {
        const titles = {
            maintenance: '🔧 Передать в ремонт',
            retired: '❌ Списать технику',
            available: '↩️ Вернуть в эксплуатацию',
        };
        const texts = {
            maintenance: 'Техника будет переведена в статус «В ремонте». Ячейка склада сохранится.',
            retired: 'Техника будет списана. Ячейка склада сохранится.',
            available: 'Техника будет возвращена в эксплуатацию (статус «Доступна»). Ячейка склада сохранится.',
        };

        document.getElementById('statusChangeEquipmentId').value = id;
        document.getElementById('statusChangeNewStatus').value = status;
        document.getElementById('statusChangeTitle').textContent = titles[status] || 'Смена статуса';
        document.getElementById('statusChangeText').textContent = texts[status] || '';
        document.getElementById('statusChangeModal').classList.add('active');
    }

    function closeStatusChange() {
        closeModalById('statusChangeModal');
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
                body: JSON.stringify({ status }),
            });
            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                closeStatusChange();
                EquipmentCard.notifyChanged({ action: 'status', id, status });
            } else {
                showToast('❌ ' + result.error, 'error');
                btn.disabled = false;
                btn.textContent = 'Подтвердить';
            }
        } catch (err) {
            console.error('[EquipmentCard] submit status error:', err);
            showToast('❌ Ошибка соединения', 'error');
            btn.disabled = false;
            btn.textContent = 'Подтвердить';
        }
    }

    // ============================================================
    // 5. ВОЗВРАТ НА СКЛАД
    // ============================================================

    async function openReturn(id) {
        document.getElementById('returnEquipmentId').value = id;
        document.getElementById('returnWarehouse').value = '';
        document.getElementById('returnZone').innerHTML = '<option value="">— Сначала выберите склад —</option>';
        document.getElementById('returnZone').disabled = true;
        document.getElementById('returnRack').innerHTML = '<option value="">— Сначала выберите зону —</option>';
        document.getElementById('returnRack').disabled = true;
        document.getElementById('returnCell').innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
        document.getElementById('returnCell').disabled = true;

        try {
            const response = await fetch('/api/admin/warehouses');
            const warehouses = await response.json();
            const select = document.getElementById('returnWarehouse');
            select.innerHTML = '<option value="">— Выберите склад —</option>' +
                warehouses.map(w => `<option value="${w.id}">${w.is_default ? '⭐ ' : '🏢 '}${escapeHtml(w.name)}</option>`).join('');
        } catch (err) {
            console.error('[EquipmentCard] open return error:', err);
        }

        document.getElementById('returnModal').classList.add('active');
    }

    function closeReturn() {
        closeModalById('returnModal');
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
            console.error('[EquipmentCard] return zones error:', err);
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
            console.error('[EquipmentCard] return racks error:', err);
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
            console.error('[EquipmentCard] return cells error:', err);
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
                body: JSON.stringify({ cell_id: parseInt(cellId) }),
            });
            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                closeReturn();
                EquipmentCard.notifyChanged({ action: 'return', id, cell_id: parseInt(cellId) });
            } else {
                showToast('❌ ' + result.error, 'error');
                btn.disabled = false;
                btn.textContent = '↩️ Вернуть';
            }
        } catch (err) {
            console.error('[EquipmentCard] submit return error:', err);
            showToast('❌ Ошибка соединения', 'error');
            btn.disabled = false;
            btn.textContent = '↩️ Вернуть';
        }
    }

    // ============================================================
    // 6. ПЕРЕМЕЩЕНИЕ НА РАБОЧЕЕ МЕСТО
    // ============================================================

    async function openMoveToWorkplace(id) {
        document.getElementById('moveToWorkplaceEquipmentId').value = id;

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
                        const desc = wp.description ? ` — ${wp.description}` : '';
                        groupHtml += `<option value="${wp.id}">🪑 ${escapeHtml(wp.name)}${code}${escapeHtml(desc)}</option>`;
                    });
                    html += `<optgroup label="${escapeHtml(groupLabel)}">${groupHtml}</optgroup>`;
                });
            });

            document.getElementById('moveToWorkplaceSelect').innerHTML = html;
        } catch (err) {
            console.error('[EquipmentCard] load offices error:', err);
        }

        document.getElementById('moveToWorkplaceModal').classList.add('active');
    }

    function closeMoveToWorkplace() {
        closeModalById('moveToWorkplaceModal');
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
                body: JSON.stringify({ workplace_id: parseInt(workplaceId) }),
            });
            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                closeMoveToWorkplace();
                EquipmentCard.notifyChanged({ action: 'move-to-workplace', id, workplace_id: parseInt(workplaceId) });
            } else {
                showToast('❌ ' + result.error, 'error');
                btn.disabled = false;
                btn.textContent = '🪑 Переместить';
            }
        } catch (err) {
            console.error('[EquipmentCard] submit move-to-workplace error:', err);
            showToast('❌ Ошибка соединения', 'error');
            btn.disabled = false;
            btn.textContent = '🪑 Переместить';
        }
    }

    // ============================================================
    // ПУБЛИЧНЫЙ API
    // ============================================================

    window.EquipmentCardModals = {
        // delete
        openDelete,
        closeDelete,
        confirmDelete,

        // move
        openMove,
        closeMove,
        onMoveWarehouseChange,
        onMoveZoneChange,
        onMoveRackChange,
        submitMove,

        // assign
        openAssign,
        closeAssign,
        submitAssign,

        // status
        openStatusChange,
        closeStatusChange,
        submitStatusChange,

        // return
        openReturn,
        closeReturn,
        onReturnWarehouseChange,
        onReturnZoneChange,
        onReturnRackChange,
        submitReturn,

        // move-to-workplace
        openMoveToWorkplace,
        closeMoveToWorkplace,
        submitMoveToWorkplace,
    };
})();