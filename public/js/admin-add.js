// public/js/admin-add.js
// Логика формы добавления техники

// Кэш моделей (для предпросмотра в правой колонке)
let modelsCache = [];

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
  // Модели ТМЦ
  await loadModels();

  // Плейсхолдер для инвентарного номера
  const invInput = document.getElementById('inventory_number');
  if (invInput && !invInput.value) {
    invInput.placeholder = generateInventoryNumber();
  }

  // Склады
  await loadWarehouses();

  // Живой предпросмотр
  bindLivePreview();
  bindModelPreview();
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
    // но подстрахуемся, если пуст — заполним на клиенте.
    const select = document.getElementById('model_id');
    if (select && select.options.length <= 1) {
      let html = '<option value="">— Выберите модель —</option>';
      modelsCache.forEach(m => {
        html += `<option value="${m.id}">${escapeHtml(m.corporate_id)} · ${escapeHtml(m.name)}</option>`;
      });
      select.innerHTML = html;
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки моделей:', error);
  }
}

/**
 * Обновляет карточку предпросмотра при смене модели.
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
  // Инициализация — на случай, если браузер восстановил значение
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

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Сохранение...';

  // 🆕 Этап 4: ответственный МОЛ.
  //   - admin выбирает из селекта #responsible_user_id;
  //   - mol всегда он сам (сервер всё равно перезапишет на себя,
  //     но отправим null, чтобы не «притворяться»);
  //   - если поле скрыто или отсутствует — null.
  const currentRole = document.getElementById('currentRole')?.value || '';
  let responsibleUserId = null;
  if (currentRole === 'admin') {
    const sel = document.getElementById('responsible_user_id');
    responsibleUserId = sel && sel.value ? parseInt(sel.value, 10) : null;
  }

  const formData = {
    model_id: document.getElementById('model_id').value || null,
    inventory_number: document.getElementById('inventory_number').value.trim() || null,
    serial_number: document.getElementById('serial_number').value.trim() || null,
    status: document.getElementById('status').value,
    purchase_date: document.getElementById('purchase_date').value || null,
    warranty_until: document.getElementById('warranty_until').value || null,
    description: document.getElementById('description').value.trim() || null,
    cell_id: document.getElementById('cellId')?.value || null,
    responsible_user_id: responsibleUserId,
  };

  if (!formData.model_id) {
    showToast('❌ Выберите модель ТМЦ', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Сохранить';
    document.getElementById('model_id').focus();
    return;
  }

  try {
    const response = await fetch('/api/admin/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (result.success) {
      showToast('✅ Техника успешно добавлена!', 'success');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1500);
    } else {
      showToast('❌ ' + result.error, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 Сохранить';
    }
  } catch (error) {
    console.error('Ошибка:', error);
    showToast('❌ Ошибка при добавлении техники', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Сохранить';
  }
}

// ============================================================
// МЕСТО ХРАНЕНИЯ (каскадные селекты)
// ============================================================

async function loadWarehouses() {
  try {
    const response = await fetch('/api/admin/warehouses');
    const warehouses = await response.json();

    locations.warehouses = warehouses;

    const select = document.getElementById('warehouseId');
    if (!select) return;

    select.innerHTML =
      '<option value="">— Не указано —</option>' +
      warehouses
        .map(
          (w) => `
            <option value="${w.id}">
              ${w.is_default ? '⭐ ' : ''}${escapeHtml(w.name)}
            </option>
          `
        )
        .join('');
  } catch (error) {
    console.error('❌ Ошибка загрузки складов:', error);
  }
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

    zoneSelect.innerHTML =
      '<option value="">— Выберите зону —</option>' +
      zones.map((z) => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
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

    rackSelect.innerHTML =
      '<option value="">— Выберите стеллаж —</option>' +
      racks.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
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

    cellSelect.innerHTML =
      '<option value="">— Выберите ячейку —</option>' +
      cells
        .map((c) => {
          const code = c.code ? ` [${c.code}]` : '';
          const count = c.equipment_count || 0;
          const capacity = c.capacity || 0;
          const countText =
            capacity > 0 ? ` (${count}/${capacity})` : count > 0 ? ` (${count})` : '';
          return `<option value="${c.id}">${escapeHtml(c.name)}${code}${countText}</option>`;
        })
        .join('');
    cellSelect.disabled = false;
    updateLocationPreview();
  } catch (error) {
    console.error('❌ Ошибка загрузки ячеек:', error);
    cellSelect.innerHTML = '<option value="">— Ошибка —</option>';
  }
}

function updateLocationPreview() {
  const warehouseId = document.getElementById('warehouseId')?.value;
  const zoneId = document.getElementById('zoneId')?.value;
  const rackId = document.getElementById('rackId')?.value;
  const cellId = document.getElementById('cellId')?.value;

  const preview = document.getElementById('locationPreview');
  const previewText = document.getElementById('locationPreviewText');

  if (!preview || !previewText) return;

  const parts = [];

  if (warehouseId) {
    const wh = locations.warehouses.find((w) => String(w.id) === String(warehouseId));
    if (wh) parts.push(`🏢 ${wh.name}`);
  }
  if (zoneId) {
    const z = locations.zones.find((z) => String(z.id) === String(zoneId));
    if (z) parts.push(`📍 ${z.name}`);
  }
  if (rackId) {
    const r = locations.racks.find((r) => String(r.id) === String(rackId));
    if (r) parts.push(`🗄️ ${r.name}`);
  }
  if (cellId) {
    const c = locations.cells.find((c) => String(c.id) === String(cellId));
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

  // Правая колонка
  const infoLoc = document.getElementById('info_location');
  if (infoLoc) {
    if (parts.length === 0) {
      infoLoc.textContent = '—';
      infoLoc.classList.add('muted');
    } else {
      infoLoc.textContent = parts.join(' / ');
      infoLoc.classList.remove('muted');
    }
  }
}

// ============================================================
// ЖИВОЙ ПРЕДПРОСМОТР
// ============================================================

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
  });
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

function generateInventoryNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `Например: EQ-${year}-${random}`;
}