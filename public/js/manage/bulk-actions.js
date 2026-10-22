// public/js/manage/bulk-actions.js
// Групповое перемещение техники (5.0.5).

function toggleSelectAll(checkbox) {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateSelectedCount();
}

function clearSelection() {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = false;
    updateSelectedCount();
}

function updateSelectedCount() {
    const selected = getSelectedIds();
    const bar = document.getElementById('bulkActionsBar');
    const countEl = document.getElementById('selectedCount');
    if (bar) bar.style.display = selected.length > 0 ? 'flex' : 'none';
    if (countEl) countEl.textContent = selected.length;

    const all = document.querySelectorAll('.row-checkbox');
    const selectAll = document.getElementById('selectAll');
    if (selectAll && all.length > 0) {
        selectAll.checked = selected.length === all.length;
    }
}

function getSelectedIds() {
    return Array.from(document.querySelectorAll('.row-checkbox:checked'))
        .map(cb => parseInt(cb.value, 10))
        .filter(n => !isNaN(n));
}

function openBulkMoveModal() {
    if (getCurrentRole() !== 'admin' && getCurrentRole() !== 'mol') {
        showToast('❌ Нет прав на перемещение', 'error');
        return;
    }

    const ids = getSelectedIds();
    if (ids.length === 0) {
        showToast('❌ Не выбрана техника', 'error');
        return;
    }

    document.getElementById('bulkMoveCount').textContent = ids.length;
    document.getElementById('bulkMoveWarehouse').value = '';
    document.getElementById('bulkMoveZone').innerHTML = '<option value="">— Сначала выберите склад —</option>';
    document.getElementById('bulkMoveZone').disabled = true;
    document.getElementById('bulkMoveRack').innerHTML = '<option value="">— Сначала выберите зону —</option>';
    document.getElementById('bulkMoveRack').disabled = true;
    document.getElementById('bulkMoveCell').innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    document.getElementById('bulkMoveCell').disabled = true;

    fetch('/api/admin/warehouses')
        .then(r => r.json())
        .then(warehouses => {
            const select = document.getElementById('bulkMoveWarehouse');
            select.innerHTML = '<option value="">— Выберите склад —</option>' +
                warehouses.map(w => `<option value="${w.id}">${w.is_default ? '⭐ ' : '🏢 '}${escapeHtml(w.name)}</option>`).join('');
        })
        .catch(err => {
            console.error('Ошибка загрузки складов:', err);
            showToast('❌ Ошибка загрузки складов', 'error');
        });

    document.getElementById('bulkMoveModal').classList.add('active');
}

function closeBulkMoveModal() {
    document.getElementById('bulkMoveModal').classList.remove('active');
}

async function onBulkMoveWarehouseChange() {
    const whId = document.getElementById('bulkMoveWarehouse').value;
    const zoneSelect = document.getElementById('bulkMoveZone');
    const rackSelect = document.getElementById('bulkMoveRack');
    const cellSelect = document.getElementById('bulkMoveCell');

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
        const zones = await fetch(`/api/admin/warehouses/${whId}/zones`).then(r => r.json());
        zoneSelect.innerHTML = '<option value="">— Выберите зону —</option>' +
            zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
        zoneSelect.disabled = false;
    } catch (err) {
        console.error(err);
    }
}

async function onBulkMoveZoneChange() {
    const zoneId = document.getElementById('bulkMoveZone').value;
    const rackSelect = document.getElementById('bulkMoveRack');
    const cellSelect = document.getElementById('bulkMoveCell');

    cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    cellSelect.disabled = true;

    if (!zoneId) {
        rackSelect.innerHTML = '<option value="">— Сначала выберите зону —</option>';
        rackSelect.disabled = true;
        return;
    }

    try {
        const racks = await fetch(`/api/admin/zones/${zoneId}/racks`).then(r => r.json());
        rackSelect.innerHTML = '<option value="">— Выберите стеллаж —</option>' +
            racks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
        rackSelect.disabled = false;
    } catch (err) {
        console.error(err);
    }
}

async function onBulkMoveRackChange() {
    const rackId = document.getElementById('bulkMoveRack').value;
    const cellSelect = document.getElementById('bulkMoveCell');

    if (!rackId) {
        cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
        cellSelect.disabled = true;
        return;
    }

    try {
        const cells = await fetch(`/api/admin/racks/${rackId}/cells`).then(r => r.json());
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

async function submitBulkMove() {
    const ids = getSelectedIds();
    const cellId = document.getElementById('bulkMoveCell').value;

    if (ids.length === 0) {
        showToast('❌ Не выбрана техника', 'error');
        return;
    }
    if (!cellId) {
        showToast('❌ Выберите ячейку', 'error');
        return;
    }

    const btn = document.getElementById('bulkMoveSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Перемещение...';

    try {
        const response = await fetch('/api/manage/equipment/bulk-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, cell_id: parseInt(cellId, 10) }),
        });
        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            closeBulkMoveModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('❌ ' + (result.error || 'Ошибка'), 'error');
            btn.disabled = false;
            btn.textContent = '📦 Переместить';
        }
    } catch (err) {
        console.error(err);
        showToast('❌ Ошибка соединения', 'error');
        btn.disabled = false;
        btn.textContent = '📦 Переместить';
    }
}