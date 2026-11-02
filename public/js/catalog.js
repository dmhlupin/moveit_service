// public/js/catalog.js
// Логика страницы справочника техники (5.14.2: модели, без иконок)

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let categories = [];
let types = [];
let deleteTarget = null;

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
  await loadAll();
  initAddModelButton();
});

async function loadAll() {
  try {
    const [cats, typs] = await Promise.all([
      fetch('/api/admin/categories').then(r => r.json()),
      fetch('/api/admin/types').then(r => r.json()),
    ]);

    categories = Array.isArray(cats) ? cats : [];
    types = Array.isArray(typs) ? typs : [];

    renderCategories();
    renderTypes();
    updateCategorySelectInTypeModal();
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    showToast('Ошибка загрузки данных', 'error');
  }
}

// ============================================================
// КАТЕГОРИИ
// ============================================================

function renderCategories() {
  const container = document.getElementById('categoriesList');
  const currentFilter = document.getElementById('categoryFilter').value;

  if (categories.length === 0) {
    container.innerHTML = `
      <div class="catalog-empty">
        <div class="empty-text">Нет категорий</div>
        <div class="empty-hint">Нажмите «Добавить», чтобы создать первую</div>
      </div>`;
    return;
  }

  container.innerHTML = categories.map(cat => `
    <div class="category-item ${String(cat.id) === String(currentFilter) ? 'selected' : ''}" 
         data-id="${cat.id}"
         onclick="selectCategory(${cat.id})">
      <div class="category-info">
        <div class="category-name">${escapeHtml(cat.name)}</div>
        ${cat.description ? `<div class="category-description">${escapeHtml(cat.description)}</div>` : ''}
        <div class="category-stats">
          <span>${cat.types_count || 0} типов</span>
          <span>${cat.equipment_count || 0} техники</span>
        </div>
      </div>
      <div class="category-actions" onclick="event.stopPropagation()">
        <button onclick="openCategoryModal(${cat.id})" class="btn-action btn-edit" title="Редактировать">✏️</button>
        <button onclick="deleteCategoryItem(${cat.id}, '${escapeAttr(cat.name)}')" class="btn-action btn-delete" title="Удалить">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ============================================================
// ТИПЫ
// ============================================================

function renderTypes() {
  const container = document.getElementById('typesList');
  const currentFilter = document.getElementById('categoryFilter').value;

  const filtered = currentFilter
    ? types.filter(t => String(t.category_id) === String(currentFilter))
    : types;

  if (filtered.length === 0) {
    const hint = currentFilter
      ? 'В этой категории нет типов'
      : 'Нажмите «Добавить», чтобы создать первый';

    container.innerHTML = `
      <div class="catalog-empty">
        <div class="empty-text">Нет типов</div>
        <div class="empty-hint">${hint}</div>
      </div>`;
    return;
  }

  const currentTypeId = new URLSearchParams(window.location.search).get('type_id');

  container.innerHTML = filtered.map(type => `
    <div class="type-item ${String(type.id) === String(currentTypeId) ? 'selected' : ''}" 
         data-id="${type.id}" onclick="selectType(${type.id})">
      <div class="type-info">
        <div class="type-name">${escapeHtml(type.name)}</div>
        <span class="type-category">${escapeHtml(type.category_name)}</span>
        <div class="type-stats">${type.equipment_count || 0} техники</div>
      </div>
      <div class="type-actions">
        <button onclick="openTypeModal(${type.id})" class="btn-action btn-edit" title="Редактировать">✏️</button>
        <button onclick="deleteTypeItem(${type.id}, '${escapeAttr(type.name)}')" class="btn-action btn-delete" title="Удалить">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ============================================================
// ФИЛЬТРЫ И ВЫБОР
// ============================================================

function updateCategorySelectInTypeModal() {
  const select = document.getElementById('typeCategory');
  const currentValue = select.value;

  select.innerHTML = '<option value="">— Выберите категорию —</option>' +
    categories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join('');

  if (currentValue) select.value = currentValue;
}

function selectCategory(id) {
  const filter = document.getElementById('categoryFilter');
  if (String(filter.value) === String(id)) {
    filter.value = '';
  } else {
    filter.value = id;
  }
  applyFilters();
}

function selectType(typeId) {
  if (event) event.stopPropagation();
  const params = new URLSearchParams(window.location.search);
  if (params.get('type_id') === String(typeId)) {
    params.delete('type_id');
    params.delete('model_id');
  } else {
    params.set('type_id', typeId);
    params.delete('model_id');
  }
  params.delete('page');
  window.location.href = '/admin/catalog?' + params.toString();
}

function selectModel(modelId) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('model_id') === String(modelId)) {
    params.delete('model_id');
  } else {
    params.set('model_id', modelId);
  }
  params.delete('page');
  window.location.href = '/admin/catalog?' + params.toString();
}

function applyFilters() {
  const params = new URLSearchParams();
  const categoryFilter = document.getElementById('categoryFilter').value;
  const searchInput = document.getElementById('equipmentSearch').value.trim();

  if (categoryFilter) params.set('category_id', categoryFilter);
  if (searchInput) params.set('search', searchInput);

  const currentUrlParams = new URLSearchParams(window.location.search);
  if (currentUrlParams.has('type_id')) params.set('type_id', currentUrlParams.get('type_id'));
  if (currentUrlParams.has('model_id')) params.set('model_id', currentUrlParams.get('model_id'));

  params.delete('page');
  window.location.href = '/admin/catalog?' + params.toString();
}

function resetFilters() {
  window.location.href = '/admin/catalog';
}

function onEquipmentSearchKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    applyFilters();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    resetFilters();
  }
}

// ============================================================
// МОДАЛЬНОЕ ОКНО: КАТЕГОРИЯ
// ============================================================

function openCategoryModal(id = null) {
  const modal = document.getElementById('categoryModal');
  const title = document.getElementById('categoryModalTitle');
  const form = document.getElementById('categoryForm');
  form.reset();

  if (id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    title.textContent = 'Редактировать категорию';
    document.getElementById('categoryId').value = cat.id;
    document.getElementById('categoryName').value = cat.name || '';
    document.getElementById('categoryDescription').value = cat.description || '';
  } else {
    title.textContent = 'Добавить категорию';
    document.getElementById('categoryId').value = '';
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('categoryName').focus(), 100);
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
}

async function saveCategory(event) {
  event.preventDefault();
  const btn = document.getElementById('categorySaveBtn');
  const id = document.getElementById('categoryId').value;
  const isEdit = !!id;

  const data = {
    name: document.getElementById('categoryName').value.trim(),
    description: document.getElementById('categoryDescription').value.trim(),
    icon: '',
  };

  if (!data.name) {
    showToast('Название обязательно', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Сохранение...';

  try {
    const url = isEdit ? `/api/admin/categories/${id}` : '/api/admin/categories';
    const method = isEdit ? 'PUT' : 'POST';
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();

    if (result.success) {
      showToast(`Категория ${isEdit ? 'обновлена' : 'создана'}`, 'success');
      closeCategoryModal();
      window.location.reload();
    } else {
      showToast(result.error, 'error');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    showToast('Ошибка соединения', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить';
  }
}

// ============================================================
// МОДАЛЬНОЕ ОКНО: ТИП
// ============================================================

function openTypeModal(id = null) {
  const modal = document.getElementById('typeModal');
  const title = document.getElementById('typeModalTitle');
  const form = document.getElementById('typeForm');
  form.reset();
  updateCategorySelectInTypeModal();

  if (id) {
    const type = types.find(t => t.id === id);
    if (!type) return;
    title.textContent = 'Редактировать тип';
    document.getElementById('typeId').value = type.id;
    document.getElementById('typeCategory').value = type.category_id;
    document.getElementById('typeName').value = type.name || '';
    document.getElementById('typeDescription').value = type.description || '';
  } else {
    title.textContent = 'Добавить тип';
    document.getElementById('typeId').value = '';
    const currentFilter = document.getElementById('categoryFilter').value;
    if (currentFilter) document.getElementById('typeCategory').value = currentFilter;
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('typeName').focus(), 100);
}

function closeTypeModal() {
  document.getElementById('typeModal').classList.remove('active');
}

async function saveType(event) {
  event.preventDefault();
  const btn = document.getElementById('typeSaveBtn');
  const id = document.getElementById('typeId').value;
  const isEdit = !!id;

  const data = {
    category_id: document.getElementById('typeCategory').value,
    name: document.getElementById('typeName').value.trim(),
    description: document.getElementById('typeDescription').value.trim(),
    icon: '',
  };

  if (!data.category_id) { showToast('Выберите категорию', 'error'); return; }
  if (!data.name) { showToast('Название обязательно', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Сохранение...';

  try {
    const url = isEdit ? `/api/admin/types/${id}` : '/api/admin/types';
    const method = isEdit ? 'PUT' : 'POST';
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();

    if (result.success) {
      showToast(`Тип ${isEdit ? 'обновлён' : 'создан'}`, 'success');
      closeTypeModal();
      window.location.reload();
    } else {
      showToast(result.error, 'error');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    showToast('Ошибка соединения', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить';
  }
}

// ============================================================
// УДАЛЕНИЕ КАТЕГОРИИ / ТИПА
// ============================================================

function deleteCategoryItem(id, name) {
  deleteTarget = { type: 'category', id, name };
  const msg = document.getElementById('deleteMessage');
  msg.innerHTML = `Вы уверены, что хотите удалить категорию <strong>"${escapeHtml(name)}"</strong>?<br><br>
    <span style="color: #c05621; font-size: 13px;">Если в категории есть типы — удаление невозможно.</span>`;
  document.getElementById('catalogDeleteModal').classList.add('active');
}

function deleteTypeItem(id, name) {
  deleteTarget = { type: 'type', id, name };
  const msg = document.getElementById('deleteMessage');
  msg.innerHTML = `Вы уверены, что хотите удалить тип <strong>"${escapeHtml(name)}"</strong>?<br><br>
    <span style="color: #c05621; font-size: 13px;">Если к типу привязана техника — удаление невозможно.</span>`;
  document.getElementById('catalogDeleteModal').classList.add('active');
}

function closeCatalogDeleteModal() {
  document.getElementById('catalogDeleteModal').classList.remove('active');
  deleteTarget = null;
}

async function confirmCatalogDelete() {
  if (!deleteTarget) return;
  const { type, id } = deleteTarget;
  const url = type === 'category' ? `/api/admin/categories/${id}` : `/api/admin/types/${id}`;

  try {
    const response = await fetch(url, { method: 'DELETE' });
    const result = await response.json();

    if (result.success) {
      showToast(`${type === 'category' ? 'Категория' : 'Тип'} удалён`, 'success');
      closeCatalogDeleteModal();
      window.location.reload();
    } else {
      showToast(result.error, 'error');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    showToast('Ошибка соединения', 'error');
  }
}

// ============================================================
// МОДЕЛИ: кнопка «Добавить модель» (CRUD — в 5.14.2.2)
// ============================================================

function initAddModelButton() {
  const btn = document.getElementById('btnAddModelCatalog');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Заглушка до 5.14.2.2
    showToast('CRUD моделей будет в 5.14.2.2', 'info');
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

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}

// ============================================================
// КАРТОЧКА ТЕХНИКИ
// ============================================================

window.openEquipmentCardCatalog = (id) => {
  EquipmentCard.open({
    id,
    onClose: (r) => { if (r && r.changed) location.reload(); },
  });
};

// ============================================================
// ЗАКРЫТИЕ МОДАЛОК
// ============================================================

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    if (e.target.id === 'categoryModal') closeCategoryModal();
    if (e.target.id === 'typeModal') closeTypeModal();
    if (e.target.id === 'catalogDeleteModal') closeCatalogDeleteModal();
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeCategoryModal();
    closeTypeModal();
    closeCatalogDeleteModal();
  }
});