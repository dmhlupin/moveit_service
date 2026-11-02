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
  bindCatalogModelModal();   // 🆕 5.14.2.2
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
        <button onclick="openCategoryModal(${cat.id})" 
                class="btn btn-ghost btn-xs" 
                title="Редактировать">Изменить</button>
        <button onclick="deleteCategoryItem(${cat.id}, '${escapeAttr(cat.name)}')" 
                class="btn btn-ghost btn-xs btn-danger-text" 
                title="Удалить">Удалить</button>
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
      <div class="type-actions" onclick="event.stopPropagation()">
        <button onclick="openTypeModal(${type.id})" 
                class="btn btn-ghost btn-xs" 
                title="Редактировать">Изменить</button>
        <button onclick="deleteTypeItem(${type.id}, '${escapeAttr(type.name)}')" 
                class="btn btn-ghost btn-xs btn-danger-text" 
                title="Удалить">Удалить</button>
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
// МОДЕЛИ: CRUD (5.14.2.2)
// ============================================================

let duplicateTimer = null;
let modelDeleteTargetId = null;

function getCatalogRole() {
  const el = document.getElementById('currentRole');
  return el ? el.value : 'user';
}

function initAddModelButton() {
  const btn = document.getElementById('btnAddModelCatalog');
  if (!btn) return;

  // supervisor не может добавлять модели — скрываем кнопку
  if (getCatalogRole() === 'supervisor') {
    btn.style.display = 'none';
    return;
  }

  btn.addEventListener('click', () => openModelModalCatalog());
}

function bindCatalogModelModal() {
  const form = document.getElementById('catalogModelForm');
  if (!form) return;
  form.addEventListener('submit', saveModelCatalog);

  const categorySel = document.getElementById('catalogModelCategory');
  categorySel.addEventListener('change', () => {
    fillCatalogTypeSelect(categorySel.value);
  });

  // Проверка дубликата по name + manufacturer (дебаунс)
  ['catalogModelName', 'catalogModelManufacturer'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      clearTimeout(duplicateTimer);
      duplicateTimer = setTimeout(checkCatalogDuplicate, 500);
    });
  });
}

function fillCatalogCategorySelect(selectedId = null) {
  const sel = document.getElementById('catalogModelCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Выберите категорию —</option>' +
    categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (selectedId) sel.value = selectedId;
}

function fillCatalogTypeSelect(categoryId, selectedId = null) {
  const sel = document.getElementById('catalogModelType');
  if (!sel) return;

  if (!categoryId) {
    sel.innerHTML = '<option value="">— Сначала выберите категорию —</option>';
    return;
  }

  const filtered = types.filter(t => String(t.category_id) === String(categoryId));
  sel.innerHTML = '<option value="">— Выберите тип —</option>' +
    filtered.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  if (selectedId) sel.value = selectedId;
}

function openModelModalCatalog(id = null) {
  const modal = document.getElementById('catalogModelModal');
  const form = document.getElementById('catalogModelForm');
  const title = document.getElementById('catalogModelModalTitle');
  form.reset();
  fillCatalogCategorySelect();

  const idField = document.getElementById('catalogModelId');
  const corpId = document.getElementById('catalogModelCorporateId');
  const name = document.getElementById('catalogModelName');
  const manufacturer = document.getElementById('catalogModelManufacturer');
  const categorySel = document.getElementById('catalogModelCategory');
  const typeSel = document.getElementById('catalogModelType');
  const description = document.getElementById('catalogModelDescription');

  typeSel.innerHTML = '<option value="">— Сначала выберите категорию —</option>';

  if (id) {
    title.textContent = 'Редактировать модель';
    idField.value = id;

    fetch(`/api/admin/models/${id}`)
      .then(r => r.json())
      .then(m => {
        if (m.error) throw new Error(m.error);
        corpId.value = m.corporate_id || '';
        name.value = m.name || '';
        manufacturer.value = m.manufacturer || '';
        categorySel.value = m.category_id || '';
        fillCatalogTypeSelect(m.category_id, m.type_id);
        description.value = m.description || '';
      })
      .catch(err => {
        showToast('Не удалось загрузить модель: ' + err.message, 'error');
        closeModelModalCatalog();
      });
  } else {
    title.textContent = 'Добавить модель';
    idField.value = '';

    // Предзаполнение из текущих фильтров
    const params = new URLSearchParams(window.location.search);
    const catId = params.get('category_id');
    const typeId = params.get('type_id');
    if (catId) {
      categorySel.value = catId;
      fillCatalogTypeSelect(catId, typeId || null);
    }
  }

  modal.classList.add('active');
  setTimeout(() => name.focus(), 100);
}

function closeModelModalCatalog() {
  document.getElementById('catalogModelModal').classList.remove('active');
}

async function saveModelCatalog(e) {
  e.preventDefault();

  const id = document.getElementById('catalogModelId').value;
  const isEdit = !!id;

  const payload = {
    corporate_id: document.getElementById('catalogModelCorporateId').value.trim(),
    name: document.getElementById('catalogModelName').value.trim(),
    manufacturer: document.getElementById('catalogModelManufacturer').value.trim() || null,
    category_id: document.getElementById('catalogModelCategory').value,
    type_id: document.getElementById('catalogModelType').value,
    description: document.getElementById('catalogModelDescription').value.trim() || null,
  };

  if (!payload.corporate_id) return showToast('Corporate ID обязателен', 'error');
  if (!payload.name) return showToast('Название модели обязательно', 'error');
  if (!payload.category_id) return showToast('Выберите категорию', 'error');
  if (!payload.type_id) return showToast('Выберите тип', 'error');

  const btn = document.getElementById('catalogModelSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Сохранение...';

  try {
    const url = isEdit ? `/api/admin/models/${id}` : '/api/admin/models';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Ошибка сохранения');
    }

    showToast(`Модель ${isEdit ? 'обновлена' : 'создана'}`, 'success');
    closeModelModalCatalog();
    window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить';
  }
}

async function checkCatalogDuplicate() {
  const name = document.getElementById('catalogModelName').value.trim();
  const manufacturer = document.getElementById('catalogModelManufacturer').value.trim();
  const id = document.getElementById('catalogModelId').value;

  if (!name) return;

  const params = new URLSearchParams({ name });
  if (manufacturer) params.set('manufacturer', manufacturer);
  if (id) params.set('exclude_id', id);

  try {
    const res = await fetch(`/api/admin/models/check-duplicate?${params}`);
    const data = await res.json();
    if (data.similar) {
      showToast(`Возможно, уже есть похожая модель: ${data.similar.corporate_id} — ${data.similar.name}`, 'warning');
    }
  } catch (err) {
    console.warn('Проверка дубликата не удалась:', err);
  }
}

function deleteModelItemCatalog(id, name) {
  modelDeleteTargetId = id;

  fetch(`/api/admin/models/${id}`)
    .then(r => r.json())
    .then(m => {
      const msg = document.getElementById('catalogModelDeleteMessage');
      msg.innerHTML = `Удалить модель <strong>«${escapeHtml(m.corporate_id)} — ${escapeHtml(m.name)}»</strong>?<br><br>
        <span style="color: var(--warning); font-size: 13px;">
          Если у модели есть экземпляры, удаление невозможно.
        </span>`;
      document.getElementById('catalogModelDeleteModal').classList.add('active');
    })
    .catch(err => {
      showToast('Не удалось получить модель: ' + err.message, 'error');
    });
}

function closeModelDeleteModalCatalog() {
  document.getElementById('catalogModelDeleteModal').classList.remove('active');
  modelDeleteTargetId = null;
}

async function confirmModelDeleteCatalog() {
  if (!modelDeleteTargetId) return;

  try {
    const res = await fetch(`/api/admin/models/${modelDeleteTargetId}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Ошибка удаления');
    }

    showToast('Модель удалена', 'success');
    closeModelDeleteModalCatalog();
    window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// КАРТОЧКА МОДЕЛИ (просмотр)
// ============================================================

async function openViewModelCatalog(id) {
  const body = document.getElementById('catalogViewModelBody');
  body.innerHTML = '<div class="loading-block">Загрузка...</div>';
  document.getElementById('catalogViewModelModal').classList.add('active');

  try {
    const res = await fetch(`/api/admin/models/${id}`);
    const m = await res.json();
    if (!res.ok || m.error) throw new Error(m.error || 'Ошибка');

    const instances = Array.isArray(m.instances) ? m.instances : [];

    const badges = [];
    if (m.category_name) badges.push(`<span class="badge">${escapeHtml(m.category_name)}</span>`);
    if (m.type_name) badges.push(`<span class="badge">${escapeHtml(m.type_name)}</span>`);

    body.innerHTML = `
      <div class="model-header-card">
        <div class="model-header-info">
          <h2>${escapeHtml(m.name)}</h2>
          <div class="model-header-corporate">${escapeHtml(m.corporate_id)}</div>
          <div class="model-header-badges">${badges.join('')}</div>
        </div>
      </div>

      <div class="model-detail-section">
        <h4>Общая информация</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Производитель</label>
            <div class="value">${escapeHtml(m.manufacturer || '—')}</div>
          </div>
          <div class="detail-item">
            <label>Экземпляров</label>
            <div class="value">${m.equipment_count || 0}</div>
          </div>
          <div class="detail-item">
            <label>Создано</label>
            <div class="value">${formatDateCatalog(m.created_at)}</div>
          </div>
          <div class="detail-item">
            <label>Обновлено</label>
            <div class="value">${formatDateCatalog(m.updated_at)}</div>
          </div>
        </div>
        ${m.description ? `
          <div class="detail-item" style="margin-top: 12px;">
            <label>Описание</label>
            <div class="value">${escapeHtml(m.description)}</div>
          </div>
        ` : ''}
      </div>

      <div class="model-detail-section">
        <div class="model-instances-header">
          <h4>Экземпляры</h4>
          <span class="model-instances-count">${instances.length}</span>
        </div>
        ${renderModelInstancesCatalog(instances)}
      </div>
    `;
  } catch (err) {
    body.innerHTML = `
      <div class="models-empty">
        <h3>Ошибка загрузки</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function closeViewModelCatalog() {
  document.getElementById('catalogViewModelModal').classList.remove('active');
}

function renderModelInstancesCatalog(instances) {
  if (!instances || instances.length === 0) {
    return `<div class="model-instances-empty">У этой модели пока нет экземпляров.</div>`;
  }

  const statusLabels = {
    available: 'Доступна',
    placed: 'На рабочем месте',
    assigned: 'Назначена',
    maintenance: 'В ремонте',
    retired: 'Списана',
  };

  let rows = '';
  for (const eq of instances) {
    const location = formatModelInstanceLocation(eq);
    const inv = eq.inventory_number
      ? `<span class="inst-inv">${escapeHtml(eq.inventory_number)}</span>`
      : `<span class="inst-inv inst-empty">—</span>`;
    const serial = eq.serial_number
      ? `<span class="inst-inv">${escapeHtml(eq.serial_number)}</span>`
      : `<span class="inst-inv inst-empty">—</span>`;
    const status = statusLabels[eq.status] || eq.status;

    rows += `
      <tr>
        <td>${inv}</td>
        <td>${serial}</td>
        <td><span class="inst-status status-${eq.status}">${escapeHtml(status)}</span></td>
        <td class="inst-location">${location}</td>
      </tr>
    `;
  }

  return `
    <table class="model-instances-table">
      <thead>
        <tr>
          <th>Инв. №</th>
          <th>Серийный №</th>
          <th>Статус</th>
          <th>Место хранения</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatModelInstanceLocation(eq) {
  if (eq.status === 'assigned') return 'Назначена пользователю';
  if (eq.workplace_id) {
    const parts = [eq.office_name, eq.room_name, eq.workplace_name].filter(Boolean).map(escapeHtml);
    if (parts.length === 0) return '—';
    return parts.join(' / ');
  }
  if (eq.cell_id) {
    const warehouse = eq.warehouse_name ? escapeHtml(eq.warehouse_name) : null;
    const cell = eq.cell_code ? escapeHtml(eq.cell_code) : (eq.cell_name ? escapeHtml(eq.cell_name) : null);
    const parts = [warehouse, cell].filter(Boolean);
    if (parts.length === 0) return '—';
    return parts.join(' / ');
  }
  return '—';
}

function formatDateCatalog(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dt; }
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
    if (e.target.id === 'catalogModelModal') closeModelModalCatalog();           // 🆕
    if (e.target.id === 'catalogModelDeleteModal') closeModelDeleteModalCatalog(); // 🆕
    if (e.target.id === 'catalogViewModelModal') closeViewModelCatalog();        // 🆕
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeCategoryModal();
    closeTypeModal();
    closeCatalogDeleteModal();
    closeModelModalCatalog();           // 🆕
    closeModelDeleteModalCatalog();     // 🆕
    closeViewModelCatalog();            // 🆕
  }
});