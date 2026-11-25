// public/js/manage-consumables/init.js
// Модалка создания/редактирования остатка (5.16.2b).
// Использует API:
//   GET    /manage/consumables/api/item-models     — номенклатура для селекта
//   GET    /manage/consumables/api/items/:id       — данные остатка
//   POST   /manage/consumables/api/items           — создать
//   PUT    /manage/consumables/api/items/:id       — обновить
//   DELETE /manage/consumables/api/items/:id       — удалить
//
// Склады — клонируются из #filterWarehouse (уже отрендерены сервером).

(function () {
  'use strict';

  const API_BASE = '/manage/consumables/api';

  // ---------- утилиты ----------
  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showError(msg) {
    alert(msg || 'Ошибка');
  }

  // ---------- клонирование складов ----------
  function cloneWarehouseOptions() {
    const src = $('filterWarehouse');
    const dst = $('consumableWarehouseId');
    if (!src || !dst) return;
    dst.innerHTML = src.innerHTML;
    // «Все склады» (value="") в модалке не нужен — заменяем на placeholder
    const first = dst.querySelector('option[value=""]');
    if (first) first.textContent = '— Выберите склад —';
  }

  // ---------- загрузка номенклатуры ----------
  let modelsCache = null;

  async function loadModels(force) {
    if (modelsCache && !force) return modelsCache;
    const res = await fetch(API_BASE + '/item-models');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'load_models_failed');
    modelsCache = data.items || [];
    return modelsCache;
  }

  async function fillModelsSelect(selectedId) {
    const sel = $('consumableModelId');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Выберите номенклатуру —</option>';
    try {
      const models = await loadModels();
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} (${m.corporate_id}) — ${m.unit}`;
        if (String(m.id) === String(selectedId)) opt.selected = true;
        sel.appendChild(opt);
      });
    } catch (e) {
      console.error('fillModelsSelect:', e);
    }
  }

  // ---------- открытие модалки ----------
  function openModal() {
    $('consumableModal').style.display = 'flex';
  }
  function closeConsumableModal() {
    $('consumableModal').style.display = 'none';
  }

  async function openConsumableCreate() {
    $('consumableModalTitle').textContent = 'Добавить позицию';
    $('consumableId').value = '';
    $('consumableQuantity').value = '0';
    $('consumableMinQuantity').value = '0';
    $('consumableIsActive').checked = true;

    cloneWarehouseOptions();
    $('consumableWarehouseId').value = '';
    await fillModelsSelect(null);

    openModal();
  }

  async function openConsumableEdit(id) {
    try {
      const res = await fetch(API_BASE + '/items/' + id);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'load_item_failed');
      const item = data.item;

      $('consumableModalTitle').textContent = 'Редактировать позицию';
      $('consumableId').value = item.id;
      $('consumableQuantity').value = item.quantity;
      $('consumableMinQuantity').value = item.min_quantity;
      $('consumableIsActive').checked = !!item.is_active;

      cloneWarehouseOptions();
      $('consumableWarehouseId').value = item.warehouse_id;
      // При редактировании склад и номенклатура не меняются
      $('consumableWarehouseId').disabled = true;

      await fillModelsSelect(item.model_id);
      $('consumableModelId').disabled = true;

      openModal();
    } catch (e) {
      console.error('openConsumableEdit:', e);
      showError('Не удалось загрузить позицию');
    }
  }

  // ---------- сохранение ----------
  async function submitConsumable() {
    const id = $('consumableId').value;
    const modelId = $('consumableModelId').value;
    const warehouseId = $('consumableWarehouseId').value;
    const quantity = $('consumableQuantity').value;
    const minQuantity = $('consumableMinQuantity').value;
    const isActive = $('consumableIsActive').checked;

    const payload = {
      quantity,
      min_quantity: minQuantity,
      is_active: isActive,
    };
    if (!id) {
      payload.model_id = modelId;
      payload.warehouse_id = warehouseId;
    }

    const url = id ? (API_BASE + '/items/' + id) : (API_BASE + '/items');
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'save_failed');
      window.location.reload();
    } catch (e) {
      console.error('submitConsumable:', e);
      showError('Не удалось сохранить: ' + e.message);
    }
  }

  // ---------- удаление ----------
  async function deleteConsumable(id) {
    if (!confirm('Удалить позицию?')) return;
    try {
      const res = await fetch(API_BASE + '/items/' + id, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'delete_failed');
      window.location.reload();
    } catch (e) {
      console.error('deleteConsumable:', e);
      showError('Не удалось удалить: ' + e.message);
    }
  }

  // ---------- экспорт в window (для inline onclick) ----------
  window.openConsumableCreate = openConsumableCreate;
  window.openConsumableEdit = openConsumableEdit;
  window.closeConsumableModal = closeConsumableModal;
  window.submitConsumable = submitConsumable;
  window.deleteConsumable = deleteConsumable;

  // ---------- инициализация ----------
  document.addEventListener('DOMContentLoaded', () => {
    cloneWarehouseOptions();
  });
})();