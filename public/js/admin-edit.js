// public/js/admin-edit.js
// Логика формы редактирования техники

// Кэш моделей
let modelsCache = [];

// ID для предзаполнения
const originalCellId = document.getElementById('currentCellId')?.value || '';
const originalWorkplaceId = document.getElementById('currentWorkplaceId')?.value || '';

// ID техники и текущей модели
const equipmentId = parseInt(document.getElementById('equipmentId')?.value || '0');
const originalModelId = document.getElementById('currentModelId')?.value || '';

// Кэш данных для превью места хранения
let locations = {
  warehouses: [],
  zones: [],
  racks: [],
  cells: [],
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async function () {
  if (!equipmentId || isNaN(equipmentId)) {
    showToast('❌ Ошибка: ID техники не указан', 'error');
    setTimeout(() => window.location.href = '/admin', 2000);
    return;
  }

  // Модели ТМЦ
  await loadModels();

  // Склады и рабочие места
  await loadWarehouses();
  await loadWorkplaces();

  // Определяем тип расположения и предзаполняем
  if (originalWorkplaceId) {
    setLocationType('workplace');
    document.getElementById('workplaceId').value = originalWorkplaceId;
    updateLocationPreview();
  } else if (originalCellId) {
    setLocationType('warehouse');
    await preloadLocation(originalCellId);
  } else {
    setLocationType('none');
  }

  // Сохраняем initial-значения для подсветки изменений
  [
    'inventory_number', 'serial_number', 'model_id', 'status'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.dataset.initialValue = el.value || '';
  });

  // Инициализируем состояние блоков по статусу
  onStatusChange();
});

// ============================================================
// МОДЕЛИ ТМЦ
// ============================================================

async function loadModels() {
  try {
    const response = await fetch('/api/admin/models');
    const data = await response.json();
    modelsCache = Array.isArray(data) ? data : (data.items || []);

    // Селект уже заполнен сервером ({{model_options}}),
    // но подстрахуемся, если пуст.
    const select = document.getElementById('model_id');
    if (select && select.options.length <= 1) {
      let html = '<option value="">— Выберите модель —</option>';
      modelsCache.forEach(m => {
        const selected = String(m.id) === String(originalModelId) ? 'selected' : '';
        html += `<option value="${m.id}" ${selected}>${escapeHtml(m.corporate_id)} · ${escapeHtml(m.name)}</option>`;
      });
      select.innerHTML = html;
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки моделей:', error);
  }
}

/**
 * Обновляет карточку «Текущая информация» при смене модели.
 */
function bindModelPreview() {
  const select = document.getElementById('model_id');
  if (!select) return;

  const update = () => {
    const id = select.value;
    const m = modelsCache.find(x => String(x.id) === String(id));

    setInfo('info_model_name',   m ? m.name : '—');
    setInfo('info_corporate_id', m ? m.corporate_id : '—');
    setInfo('info_manufacturer', m ? (m.manufacturer || '—') : '—');
    setInfo('info_category',
      m && m.category_name ? `${m.category_icon || '📁'} ${m.category_name}` : '—'
    );
    setInfo('info_type',
      m && m.type_name ? `${m.type_icon || '📦'} ${m.type_name}` : '—'
    );
  };

  select.addEventListener('change', update);
  // Первичная инициализация
  update();
}

function setInfo(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '—';
  el.classList.toggle('muted', !text || text === '—');
}

// ============================================================
// ОТПРАВКА ФОРМЫ
// ============================================================

async function submitForm(event) {
  event.preventDefault();

  if (!equipmentId || isNaN(equipmentId)) {
    showToast('❌ Ошибка: ID техники не указан', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  let newStatus = document.getElementById('status').value;
  const currentStatus = document.getElementById('currentStatus')?.value || '';

  if (newStatus === '' && currentStatus === 'placed') {
    newStatus = 'placed';
  }

  // Проверяем назначение
  if (newStatus === 'assigned') {
    const assignUserId = document.getElementById('assignUserId')?.value;
    if (!assignUserId) {
      showToast('❌ Для назначения техники выберите пользователя', 'error');
      document.getElementById('assignUserId')?.focus();
      return;
    }
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Обновление...';

  // Тип расположения
  const oldStatusForLoc = document.getElementById('currentStatus')?.value || '';
  let cellId = null;
  let workplaceId = null;

  if (newStatus !== 'assigned') {
    const locationType = document.querySelector('input[name="locationType"]:checked')?.value || 'none';
    cellId = locationType === 'warehouse' ? (document.getElementById('cellId')?.value || null) : null;
    workplaceId = locationType === 'workplace' ? (document.getElementById('workplaceId')?.value || null) : null;
  }

  // maintenance / retired — не могут быть на рабочем месте
  if (newStatus === 'maintenance' || newStatus === 'retired') {
    workplaceId = null;
  }

  // Если техника была на рабочем месте, а статус меняется не на placed/assigned
  if (oldStatusForLoc === 'placed' && newStatus !== 'placed' && newStatus !== 'assigned') {
    cellId = null;
    workplaceId = null;
  }

  // Валидация статус ↔ место
  if (newStatus === 'placed' && !workplaceId) {
    showToast('❌ Для статуса «На месте» выберите рабочее место', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Обновить';
    return;
  }
  if (newStatus === 'available' && workplaceId) {
    showToast('❌ Техника на рабочем месте не может быть «Доступна». Измените статус на «На месте»', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Обновить';
    return;
  }

  const formData = {
    model_id: document.getElementById('model_id').value || null,
    inventory_number: document.getElementById('inventory_number').value.trim() || null,
    serial_number: document.getElementById('serial_number').value.trim() || null,
    status: newStatus,
    purchase_date: document.getElementById('purchase_date').value || null,
    warranty_until: document.getElementById('warranty_until').value || null,
    description: document.getElementById('description').value.trim() || null,
    cell_id: cellId,
    workplace_id: workplaceId,
  };

  if (!formData.model_id) {
    showToast('❌ Выберите модель ТМЦ', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Обновить';
    document.getElementById('model_id').focus();
    return;
  }

  if (newStatus === 'assigned') {
    formData.assign_user_id = document.getElementById('assignUserId').value;
    formData.assign_condition = document.getElementById('assignCondition')?.value || 'В хорошем состоянии';
  }

  try {
    const response = await fetch(`/api/admin/equipment/${equipmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (result.success) {
      let message = '✅ Техника успешно обновлена!';
      if (result.assignment) {
        message += ' Техника назначена пользователю.';
      } else if (result.returned) {
        message += ' Техника возвращена от пользователя.';
      }
      showToast(message, 'success');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1500);
    } else {
      showToast('❌ ' + result.error, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 Обновить';
    }
  } catch (error) {
    console.error('❌ Ошибка при обновлении:', error);
    showToast('❌ Ошибка при обновлении техники', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Обновить';
  }
}

// ============================================================
// МЕСТО ХРАНЕНИЯ (склады)
// ============================================================

async function loadWarehouses() {
  try {
    const response = await fetch('/api/admin/warehouses');
    const warehouses = await response.json();

    locations.warehouses = warehouses;

    const select = document.getElementById('warehouseId');
    if (!select) return;

    select.innerHTML = '<option value="">— Не указано —</option>' +
      warehouses.map(w => `
        <option value="${w.id}">
          ${w.is_default ? '⭐ ' : ''}${escapeHtml(w.name)}
        </option>
      `).join('');
  } catch (error) {
    console.error('❌ Ошибка загрузки складов:', error);
  }
}

// ============================================================
// РАБОЧИЕ МЕСТА
// ============================================================

async function loadWorkplaces() {
  const select = document.getElementById('workplaceId');
  if (!select) return;

  try {
    const response = await fetch('/api/admin/offices/tree');
    const offices = await response.json();

    let html = '<option value="">— Не указано —</option>';

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

    select.innerHTML = html;
  } catch (error) {
    console.error('❌ Ошибка загрузки рабочих мест:', error);
    select.innerHTML = '<option value="">— Ошибка загрузки —</option>';
  }
}

// ============================================================
// ПЕРЕКЛЮЧАТЕЛЬ ТИПА РАСПОЛОЖЕНИЯ
// ============================================================

function setLocationType(type) {
  const radios = document.querySelectorAll('input[name="locationType"]');
  radios.forEach(r => {
    r.checked = r.value === type;
  });
  applyLocationTypeVisibility(type);
}

function onLocationTypeChange() {
  const selected = document.querySelector('input[name="locationType"]:checked');
  if (!selected) return;

  const type = selected.value;
  applyLocationTypeVisibility(type);

  if (type === 'workplace') {
    document.getElementById('warehouseId').value = '';
    document.getElementById('zoneId').innerHTML = '<option value="">— Сначала выберите склад —</option>';
    document.getElementById('zoneId').disabled = true;
    document.getElementById('rackId').innerHTML = '<option value="">— Сначала выберите зону —</option>';
    document.getElementById('rackId').disabled = true;
    document.getElementById('cellId').innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    document.getElementById('cellId').disabled = true;
  } else if (type === 'warehouse') {
    document.getElementById('workplaceId').value = '';
  } else {
    document.getElementById('workplaceId').value = '';
    document.getElementById('warehouseId').value = '';
    document.getElementById('zoneId').innerHTML = '<option value="">— Сначала выберите склад —</option>';
    document.getElementById('zoneId').disabled = true;
    document.getElementById('rackId').innerHTML = '<option value="">— Сначала выберите зону —</option>';
    document.getElementById('rackId').disabled = true;
    document.getElementById('cellId').innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
    document.getElementById('cellId').disabled = true;
  }

  updateLocationPreview();
}

function applyLocationTypeVisibility(type) {
  const warehouseBlock = document.getElementById('warehouseBlock');
  const workplaceBlock = document.getElementById('workplaceBlock');

  if (warehouseBlock) warehouseBlock.style.display = type === 'warehouse' ? 'block' : 'none';
  if (workplaceBlock) workplaceBlock.style.display = type === 'workplace' ? 'block' : 'none';
}

async function onWarehouseChange() {
  const warehouseId = document.getElementById('warehouseId').value;
  const zoneSelect = document.getElementById('zoneId');
  const rackSelect = document.getElementById('rackId');
  const cellSelect = document.getElementById('cellId');

  rackSelect.innerHTML = '<option value="">— Сначала выберите зону —</option>';
  rackSelect.disabled = true;
  cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
  cellSelect.disabled = true;
  updateLocationPreview();

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

    locations.zones = zones;

    if (zones.length === 0) {
      zoneSelect.innerHTML = '<option value="">— Нет зон —</option>';
      return;
    }

    zoneSelect.innerHTML = '<option value="">— Выберите зону —</option>' +
      zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
    zoneSelect.disabled = false;
    updateLocationPreview();
  } catch (error) {
    console.error('❌ Ошибка загрузки зон:', error);
    zoneSelect.innerHTML = '<option value="">— Ошибка —</option>';
  }
}

async function onZoneChange() {
  const zoneId = document.getElementById('zoneId').value;
  const rackSelect = document.getElementById('rackId');
  const cellSelect = document.getElementById('cellId');

  cellSelect.innerHTML = '<option value="">— Сначала выберите стеллаж —</option>';
  cellSelect.disabled = true;
  updateLocationPreview();

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

    locations.racks = racks;

    if (racks.length === 0) {
      rackSelect.innerHTML = '<option value="">— Нет стеллажей —</option>';
      return;
    }

    rackSelect.innerHTML = '<option value="">— Выберите стеллаж —</option>' +
      racks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    rackSelect.disabled = false;
    updateLocationPreview();
  } catch (error) {
    console.error('❌ Ошибка загрузки стеллажей:', error);
    rackSelect.innerHTML = '<option value="">— Ошибка —</option>';
  }
}

async function onRackChange() {
  const rackId = document.getElementById('rackId').value;
  const cellSelect = document.getElementById('cellId');

  updateLocationPreview();

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

    locations.cells = cells;

    if (cells.length === 0) {
      cellSelect.innerHTML = '<option value="">— Нет ячеек —</option>';
      return;
    }

    cellSelect.innerHTML = '<option value="">— Выберите ячейку —</option>' +
      cells.map(c => {
        const code = c.code ? ` [${c.code}]` : '';
        const count = c.equipment_count || 0;
        const capacity = c.capacity || 0;
        const countText = capacity > 0 ? ` (${count}/${capacity})` : (count > 0 ? ` (${count})` : '');
        return `<option value="${c.id}">${escapeHtml(c.name)}${code}${countText}</option>`;
      }).join('');
    cellSelect.disabled = false;
    updateLocationPreview();
  } catch (error) {
    console.error('❌ Ошибка загрузки ячеек:', error);
    cellSelect.innerHTML = '<option value="">— Ошибка —</option>';
  }
}

async function preloadLocation(cellId) {
  try {
    const cellResponse = await fetch(`/api/admin/cells/${cellId}`);
    const cell = await cellResponse.json();

    if (!cell || !cell.id) return;

    const warehouseSelect = document.getElementById('warehouseId');
    warehouseSelect.value = cell.warehouse_id;

    const zonesResponse = await fetch(`/api/admin/warehouses/${cell.warehouse_id}/zones`);
    const zones = await zonesResponse.json();
    locations.zones = zones;

    const zoneSelect = document.getElementById('zoneId');
    zoneSelect.innerHTML = '<option value="">— Выберите зону —</option>' +
      zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
    zoneSelect.disabled = false;
    zoneSelect.value = cell.zone_id;

    const racksResponse = await fetch(`/api/admin/zones/${cell.zone_id}/racks`);
    const racks = await racksResponse.json();
    locations.racks = racks;

    const rackSelect = document.getElementById('rackId');
    rackSelect.innerHTML = '<option value="">— Выберите стеллаж —</option>' +
      racks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    rackSelect.disabled = false;
    rackSelect.value = cell.rack_id;

    const cellsResponse = await fetch(`/api/admin/racks/${cell.rack_id}/cells`);
    const cells = await cellsResponse.json();
    locations.cells = cells;

    const cellSelect = document.getElementById('cellId');
    cellSelect.innerHTML = '<option value="">— Выберите ячейку —</option>' +
      cells.map(c => {
        const code = c.code ? ` [${c.code}]` : '';
        const count = c.equipment_count || 0;
        const capacity = c.capacity || 0;
        const countText = capacity > 0 ? ` (${count}/${capacity})` : (count > 0 ? ` (${count})` : '');
        return `<option value="${c.id}">${escapeHtml(c.name)}${code}${countText}</option>`;
      }).join('');
    cellSelect.disabled = false;
    cellSelect.value = cell.id;

    updateLocationPreview();
  } catch (error) {
    console.error('❌ Ошибка предзаполнения:', error);
  }
}

function updateLocationPreview() {
  const selected = document.querySelector('input[name="locationType"]:checked');
  const type = selected ? selected.value : 'none';

  const preview = document.getElementById('locationPreview');
  const previewText = document.getElementById('locationPreviewText');
  if (!preview || !previewText) return;

  const parts = [];

  if (type === 'workplace') {
    const workplaceId = document.getElementById('workplaceId')?.value;
    if (workplaceId) {
      const opt = document.querySelector(`#workplaceId option[value="${workplaceId}"]`);
      const label = opt ? opt.textContent.trim() : `🪑 WP #${workplaceId}`;
      const group = opt ? opt.closest('optgroup') : null;
      const groupLabel = group ? group.label : '';
      if (groupLabel) parts.push(groupLabel);
      parts.push(label);
    }
  } else if (type === 'warehouse') {
    const warehouseId = document.getElementById('warehouseId')?.value;
    const zoneId = document.getElementById('zoneId')?.value;
    const rackId = document.getElementById('rackId')?.value;
    const cellId = document.getElementById('cellId')?.value;

    if (warehouseId) {
      const wh = locations.warehouses.find(w => String(w.id) === String(warehouseId));
      if (wh) parts.push(`🏢 ${wh.name}`);
    }
    if (zoneId) {
      const z = locations.zones.find(z => String(z.id) === String(zoneId));
      if (z) parts.push(`📍 ${z.name}`);
    }
    if (rackId) {
      const r = locations.racks.find(r => String(r.id) === String(rackId));
      if (r) parts.push(`🗄️ ${r.name}`);
    }
    if (cellId) {
      const c = locations.cells.find(c => String(c.id) === String(cellId));
      if (c) {
        const code = c.code ? ` [${c.code}]` : '';
        parts.push(`📦 ${c.name}${code}`);
      }
    }
  }

  if (parts.length === 0) {
    preview.style.display = 'none';
  } else {
    preview.style.display = 'flex';
    previewText.textContent = parts.join(' → ');
  }
}

// ============================================================
// СМЕНА СТАТУСА
// ============================================================

function onStatusChange() {
  const newStatus = document.getElementById('status').value;
  const oldStatus = document.getElementById('currentStatus')?.value || '';
  const warning = document.getElementById('statusWarning');
  const info = document.getElementById('statusInfo');
  const assignSection = document.getElementById('assignSection');
  const helpText = document.getElementById('statusHelpText');
  const locationCard = document.getElementById('locationCard');

  if (warning) warning.classList.remove('show');
  if (info) info.classList.remove('show');
  if (assignSection) assignSection.classList.remove('show');

  if (locationCard) {
    locationCard.style.display = (newStatus === 'assigned') ? 'none' : '';
  }

  if (newStatus !== 'assigned') {
    autoSelectLocationType(newStatus);
  }

  if (newStatus === 'assigned') {
    if (info) info.classList.add('show');
    if (assignSection) assignSection.classList.add('show');
    if (helpText) {
      helpText.textContent = oldStatus === 'assigned'
        ? 'Техника уже назначена. Для переназначения выберите другого пользователя.'
        : 'ℹ️ Выберите пользователя для назначения техники';
    }
  } else if (oldStatus === 'assigned' && newStatus === 'available') {
    if (warning) warning.classList.add('show');
    if (helpText) helpText.textContent = '⚠️ Техника будет автоматически возвращена от пользователя';
  } else if (newStatus === 'placed') {
    if (helpText) helpText.textContent = '🪑 Укажите рабочее место ниже — это обязательно';
  } else if (newStatus === 'available') {
    if (helpText) helpText.textContent = '✅ Техника на складе — при необходимости укажите ячейку';
  } else if (newStatus === 'maintenance') {
    if (helpText) helpText.textContent = '🔧 Техника в ремонте. Может лежать на складе (в ячейке), но не на рабочем месте';
  } else if (newStatus === 'retired') {
    if (helpText) helpText.textContent = '❌ Техника списана. Может лежать на складе (в ячейке), но не на рабочем месте';
  } else {
    if (helpText) helpText.textContent = 'Выберите статус техники';
  }
}

function autoSelectLocationType(status) {
  let target = null;
  if (status === 'placed') target = 'workplace';
  else if (status === 'available') target = 'warehouse';

  if (!target) return;

  const radio = document.querySelector(`input[name="locationType"][value="${target}"]`);
  if (!radio) return;

  if (!radio.checked) {
    radio.checked = true;
    if (typeof onLocationTypeChange === 'function') {
      onLocationTypeChange();
    }
  }
}

// ============================================================
// ПОДГРУЗКА ТЕКУЩЕГО РАСПОЛОЖЕНИЯ + ПРЕДПРОСМОТР
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  if (!equipmentId || isNaN(equipmentId)) return;

  loadCurrentLocation();
  bindLivePreview();
  bindModelPreview();
});

async function loadCurrentLocation() {
  try {
    const res = await fetch(`/api/admin/equipment/${equipmentId}/details`);
    if (!res.ok) return;

    const data = await res.json();
    const cur = data.stats?.current_user;
    const loc = data.location || {};

    const assignedEl = document.getElementById('info_assigned');
    if (assignedEl) {
      if (cur) {
        const dept = cur.department ? ` (${cur.department})` : '';
        assignedEl.textContent = `${cur.full_name}${dept}`;
        assignedEl.classList.remove('muted');
      } else {
        assignedEl.textContent = '—';
        assignedEl.classList.add('muted');
      }
    }

    const locEl = document.getElementById('info_location');
    if (locEl) {
      let text = '—';
      if (loc.type === 'workplace') {
        const code = loc.workplace_code ? ` [${loc.workplace_code}]` : '';
        text = `🪑 ${loc.workplace_name}${code} — ${loc.office_name} / ${loc.room_name}`;
      } else if (loc.type === 'cell') {
        text = `📦 ${loc.cell_name} [${loc.cell_code}] — ${loc.warehouse_name} / ${loc.zone_name} / ${loc.rack_name}`;
      } else if (loc.type === 'user') {
        text = '👤 У пользователя';
      }
      locEl.textContent = text;
      locEl.classList.toggle('muted', text === '—');
    }
  } catch (err) {
    console.error('❌ Не удалось загрузить текущее расположение:', err);
  }
}

function bindLivePreview() {
  bindInput('inventory_number', 'info_inv');
  bindInput('serial_number',    'info_serial');
  bindSelect('status',          'info_status');
}

function bindInput(inputId, infoId) {
  const input = document.getElementById(inputId);
  const info = document.getElementById(infoId);
  if (!input || !info) return;

  input.addEventListener('input', () => {
    const v = input.value.trim();
    info.textContent = v || '—';
    info.classList.toggle('muted', !v);
    markChanged(info, inputId);
  });
}

function bindSelect(selectId, infoId) {
  const select = document.getElementById(selectId);
  const info = document.getElementById(infoId);
  if (!select || !info) return;

  select.addEventListener('change', () => {
    const opt = select.options[select.selectedIndex];
    const v = opt ? opt.textContent.trim() : '';
    info.textContent = v || '—';
    info.classList.toggle('muted', !v);
    markChanged(info, selectId);
  });
}

function markChanged(infoEl, fieldId) {
  const input = document.getElementById(fieldId);
  if (!input) return;

  const initial = input.dataset.initialValue ?? '';
  const current = (input.value || '').trim();
  infoEl.classList.toggle('changed', current !== initial);
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}