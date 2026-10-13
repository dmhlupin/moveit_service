// public/js/admin-models.js
// Логика страницы «Номенклатура» (модели ТМЦ)

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let categoriesCache = [];   // [{id, name, icon, ...}]
let typesCache      = [];   // [{id, category_id, name, icon, ...}]
let deleteTargetId  = null; // id модели, которую удаляем
let duplicateTimer  = null; // дебаунс проверки дубликата

let currentFilters = {
  search: '',
  category_id: '',
  type_id: '',
  page: 1,
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  bindToolbar();
  bindModelModal();
  bindDeleteModal();
  bindViewModelModal();

  loadCategoriesAndTypes().then(() => {
    loadModels();
  });
});

// ============================================================
// ЗАГРУЗКА СПРАВОЧНИКОВ (категории + типы)
// ============================================================

async function loadCategoriesAndTypes() {
  try {
    const [cats, typs] = await Promise.all([
      fetch('/api/admin/categories').then(r => r.json()),
      fetch('/api/admin/types').then(r => r.json()),
    ]);

    categoriesCache = Array.isArray(cats) ? cats : [];
    typesCache      = Array.isArray(typs) ? typs : [];

    fillCategoryFilter();
    fillCategorySelect('modelCategory');
  } catch (err) {
    console.error('Ошибка загрузки справочника:', err);
    showToast('❌ Ошибка загрузки справочника', 'error');
  }
}

function fillCategoryFilter() {
  const sel = document.getElementById('filterCategory');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Все категории</option>' +
    categoriesCache.map(c =>
      `<option value="${c.id}">${escapeHtml(c.icon || '📁')} ${escapeHtml(c.name)}</option>`
    ).join('');
  sel.value = current;
}

function fillCategorySelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— Выберите категорию —</option>' +
    categoriesCache.map(c =>
      `<option value="${c.id}">${escapeHtml(c.icon || '📁')} ${escapeHtml(c.name)}</option>`
    ).join('');
  sel.value = current;
}

function fillTypeSelect(selectId, categoryId, selectedId = null) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  if (!categoryId) {
    sel.innerHTML = '<option value="">— Сначала выберите категорию —</option>';
    return;
  }

  const types = typesCache.filter(t => String(t.category_id) === String(categoryId));
  sel.innerHTML = '<option value="">— Выберите тип —</option>' +
    types.map(t =>
      `<option value="${t.id}">${escapeHtml(t.icon || '📦')} ${escapeHtml(t.name)}</option>`
    ).join('');
  if (selectedId) sel.value = selectedId;
}

// ============================================================
// ТУЛБАР
// ============================================================

function bindToolbar() {
  const search   = document.getElementById('filterSearch');
  const category = document.getElementById('filterCategory');
  const type     = document.getElementById('filterType');
  const reset    = document.getElementById('btnResetFilters');
  const addBtn   = document.getElementById('btnAddModel');

  // Поиск — дебаунс
  let searchTimer = null;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentFilters.search = search.value.trim();
      currentFilters.page = 1;
      loadModels();
    }, 300);
  });

  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimer);
      currentFilters.search = search.value.trim();
      currentFilters.page = 1;
      loadModels();
    }
    if (e.key === 'Escape') {
      search.value = '';
      currentFilters.search = '';
      currentFilters.page = 1;
      loadModels();
    }
  });

  // Фильтр категории
  category.addEventListener('change', () => {
    currentFilters.category_id = category.value;
    currentFilters.type_id = '';
    currentFilters.page = 1;

    // Перестраиваем селект типов по выбранной категории
    if (category.value) {
      const types = typesCache.filter(t => String(t.category_id) === String(category.value));
      type.innerHTML = '<option value="">Все типы</option>' +
        types.map(t =>
          `<option value="${t.id}">${escapeHtml(t.icon || '📦')} ${escapeHtml(t.name)}</option>`
        ).join('');
    } else {
      type.innerHTML = '<option value="">Все типы</option>';
    }
    loadModels();
  });

  // Фильтр типа
  type.addEventListener('change', () => {
    currentFilters.type_id = type.value;
    currentFilters.page = 1;
    loadModels();
  });

  // Сброс
  reset.addEventListener('click', () => {
    search.value = '';
    category.value = '';
    type.innerHTML = '<option value="">Все типы</option>';
    type.value = '';
    currentFilters = { search: '', category_id: '', type_id: '', page: 1 };
    loadModels();
  });

  // Добавить
  addBtn.addEventListener('click', () => openModelModal());
}

// ============================================================
// ЗАГРУЗКА И РЕНДЕР СПИСКА
// ============================================================

async function loadModels() {
  const container = document.getElementById('modelsTableContainer');
  container.innerHTML = '<div class="loading-block">⏳ Загрузка моделей...</div>';

  try {
    const params = new URLSearchParams();
    if (currentFilters.search)      params.set('search', currentFilters.search);
    if (currentFilters.category_id) params.set('category_id', currentFilters.category_id);
    if (currentFilters.type_id)     params.set('type_id', currentFilters.type_id);
    params.set('page', currentFilters.page);

    const res  = await fetch(`/api/admin/models?${params}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');

    renderTable(data);
    updateStats(data);
  } catch (err) {
    console.error('Ошибка загрузки моделей:', err);
    container.innerHTML = `
      <div class="models-empty">
        <span class="emoji">❌</span>
        <h3>Ошибка загрузки</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function renderTable(data) {
  const container = document.getElementById('modelsTableContainer');

  if (!data.items || data.items.length === 0) {
    container.innerHTML = `
      <div class="models-empty">
        <span class="emoji">📭</span>
        <h3>Модели не найдены</h3>
        <p>Измените фильтры или добавьте первую модель.</p>
      </div>`;
    return;
  }

  let html = `
    <div class="models-table-wrapper">
      <table class="models-table">
        <thead>
          <tr>
            <th>Corporate ID</th>
            <th>Название</th>
            <th class="col-manufacturer">Производитель</th>
            <th class="col-category">Категория</th>
            <th class="col-type">Тип</th>
            <th style="text-align:center;">Экз.</th>
            <th class="col-actions">Действия</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.items.forEach(m => {
    const eqCount = m.equipment_count || 0;
    const countClass = eqCount === 0 ? 'cell-count zero' : 'cell-count';

    html += `
      <tr>
        <td class="cell-corporate">${escapeHtml(m.corporate_id)}</td>
        <td class="cell-name">${escapeHtml(m.name)}</td>
        <td class="cell-manufacturer col-manufacturer">${escapeHtml(m.manufacturer || '—')}</td>
        <td class="col-category">
          ${m.category_name
            ? `<span class="badge-category">${escapeHtml(m.category_icon || '📁')} ${escapeHtml(m.category_name)}</span>`
            : '<span class="text-muted">—</span>'}
        </td>
        <td class="col-type">
          ${m.type_name
            ? `<span class="badge-type">${escapeHtml(m.type_icon || '📦')} ${escapeHtml(m.type_name)}</span>`
            : '<span class="text-muted">—</span>'}
        </td>
        <td class="${countClass}">${eqCount}</td>
        <td class="cell-actions">
          <div class="row-actions">
            <button class="btn-icon btn-view" title="Карточка модели"
                    data-action="view" data-id="${m.id}">👁️</button>
            <button class="btn-icon btn-edit" title="Редактировать"
                    data-action="edit" data-id="${m.id}">✏️</button>
            <button class="btn-icon btn-delete" title="Удалить"
                    data-action="delete" data-id="${m.id}"
                    ${eqCount > 0 ? 'disabled' : ''}>🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';

  if (data.totalPages > 1) {
    html += renderPagination(data);
  } else if (data.total > 0) {
    html += `
      <div class="models-pagination">
        <div class="models-pagination-info">
          Показано ${data.items.length} из ${data.total}
        </div>
      </div>`;
  }

  container.innerHTML = html;

  // Делегирование кликов по действиям
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const action = btn.dataset.action;
      if (action === 'view')   openViewModel(id);
      if (action === 'edit')   openModelModal(id);
      if (action === 'delete') openDeleteModal(id);
    });
  });
}

function renderPagination(data) {
  const { page, totalPages, total, limit, items } = data;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  let buttons = `
    <button class="models-pagination-btn" data-page="${page - 1}"
            ${page <= 1 ? 'disabled' : ''}>←</button>
  `;

  const maxVisible = 5;
  let start = Math.max(1, page - 2);
  let end   = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (start > 1) {
    buttons += `<button class="models-pagination-btn" data-page="1">1</button>`;
    if (start > 2) buttons += `<span style="padding: 6px;">…</span>`;
  }

  for (let i = start; i <= end; i++) {
    buttons += `
      <button class="models-pagination-btn ${i === page ? 'active' : ''}"
              data-page="${i}">${i}</button>`;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) buttons += `<span style="padding: 6px;">…</span>`;
    buttons += `<button class="models-pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  buttons += `
    <button class="models-pagination-btn" data-page="${page + 1}"
            ${page >= totalPages ? 'disabled' : ''}>→</button>
  `;

  return `
    <div class="models-pagination">
      <div class="models-pagination-info">
        Показано ${from}–${to} из ${total}
      </div>
      <div class="models-pagination-buttons">
        ${buttons}
      </div>
    </div>
  `;
}

// Делегирование пагинации (обработчик на контейнере — один раз)
document.addEventListener('click', e => {
  const btn = e.target.closest('.models-pagination-btn[data-page]');
  if (!btn || btn.disabled) return;
  const p = parseInt(btn.dataset.page, 10);
  if (!Number.isNaN(p)) {
    currentFilters.page = p;
    loadModels();
  }
});

// ============================================================
// СТАТИСТИКА (по текущему отфильтрованному списку)
// ============================================================

function updateStats(data) {
  const total = data.total || 0;
  const withCategory = (data.items || []).filter(m => m.category_id && m.type_id).length;
  const withEquipment = (data.items || []).filter(m => (m.equipment_count || 0) > 0).length;

  const elTotal      = document.getElementById('statTotal');
  const elWithCat    = document.getElementById('statWithCategory');
  const elWithEquip  = document.getElementById('statWithEquipment');

  if (elTotal)     elTotal.textContent     = total;
  if (elWithCat)   elWithCat.textContent   = withCategory;
  if (elWithEquip) elWithEquip.textContent = withEquipment;
}

// ============================================================
// МОДАЛЬНОЕ ОКНО: СОЗДАНИЕ / РЕДАКТИРОВАНИЕ
// ============================================================

function bindModelModal() {
  const form = document.getElementById('modelForm');
  const categorySel = document.getElementById('modelCategory');
  const cancelBtn = document.getElementById('modelCancelBtn');
  const closeBtn = document.getElementById('modelModalClose');

  // Каскад: категория → типы
  categorySel.addEventListener('change', () => {
    fillTypeSelect('modelType', categorySel.value);
  });

  cancelBtn.addEventListener('click', closeModelModal);
  closeBtn.addEventListener('click', closeModelModal);

  form.addEventListener('submit', saveModel);

  // Проверка дубликата (по name + manufacturer, дебаунс)
  ['modelName', 'modelManufacturer'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      clearTimeout(duplicateTimer);
      duplicateTimer = setTimeout(checkDuplicate, 500);
    });
  });
}

function openModelModal(id = null) {
  const modal = document.getElementById('modelModal');
  const form = document.getElementById('modelForm');
  const title = document.getElementById('modelModalTitle');

  form.reset();

  const idField = document.getElementById('modelId');
  const corpId = document.getElementById('modelCorporateId');
  const name = document.getElementById('modelName');
  const manufacturer = document.getElementById('modelManufacturer');
  const categorySel = document.getElementById('modelCategory');
  const typeSel = document.getElementById('modelType');
  const description = document.getElementById('modelDescription');

  // Сброс типов
  typeSel.innerHTML = '<option value="">— Сначала выберите категорию —</option>';

  if (id) {
    // Редактирование — подгружаем данные
    title.textContent = '✏️ Редактировать модель';
    idField.value = id;

    fetch(`/api/admin/models/${id}`)
      .then(r => r.json())
      .then(m => {
        if (m.error) throw new Error(m.error);
        corpId.value = m.corporate_id || '';
        name.value = m.name || '';
        manufacturer.value = m.manufacturer || '';
        categorySel.value = m.category_id || '';
        fillTypeSelect('modelType', m.category_id, m.type_id);
        description.value = m.description || '';
      })
      .catch(err => {
        showToast('❌ Не удалось загрузить модель: ' + err.message, 'error');
        closeModelModal();
      });
  } else {
    title.textContent = '➕ Добавить модель';
    idField.value = '';
  }

  modal.classList.add('active');
  setTimeout(() => name.focus(), 100);
}

function closeModelModal() {
  document.getElementById('modelModal').classList.remove('active');
}

async function saveModel(e) {
  e.preventDefault();

  const id = document.getElementById('modelId').value;
  const isEdit = !!id;

  const payload = {
    corporate_id:  document.getElementById('modelCorporateId').value.trim(),
    name:          document.getElementById('modelName').value.trim(),
    manufacturer:  document.getElementById('modelManufacturer').value.trim() || null,
    category_id:   document.getElementById('modelCategory').value,
    type_id:       document.getElementById('modelType').value,
    description:   document.getElementById('modelDescription').value.trim() || null,
  };

  if (!payload.corporate_id) return showToast('❌ Corporate ID обязателен', 'error');
  if (!payload.name)         return showToast('❌ Название модели обязательно', 'error');
  if (!payload.category_id)  return showToast('❌ Выберите категорию', 'error');
  if (!payload.type_id)      return showToast('❌ Выберите тип', 'error');

  const btn = document.getElementById('modelSaveBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Сохранение...';

  try {
    const url    = isEdit ? `/api/admin/models/${id}` : '/api/admin/models';
    const method = isEdit ? 'PUT' : 'POST';

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Ошибка сохранения');
    }

    showToast(`✅ Модель ${isEdit ? 'обновлена' : 'создана'}`, 'success');
    closeModelModal();
    loadModels();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Сохранить';
  }
}

// ============================================================
// ПРОВЕРКА ДУБЛИКАТА
// ============================================================

async function checkDuplicate() {
  const name = document.getElementById('modelName').value.trim();
  const manufacturer = document.getElementById('modelManufacturer').value.trim();
  const id = document.getElementById('modelId').value;

  if (!name) return;

  const params = new URLSearchParams({ name });
  if (manufacturer) params.set('manufacturer', manufacturer);
  if (id) params.set('exclude_id', id);

  try {
    const res = await fetch(`/api/admin/models/check-duplicate?${params}`);
    const data = await res.json();
    if (data.similar) {
      showToast(
        `⚠️ Возможно, уже есть похожая модель: ${data.similar.corporate_id} — ${data.similar.name}`,
        'warning'
      );
    }
  } catch (err) {
    // тихо игнорируем — это не критично
    console.warn('Проверка дубликата не удалась:', err);
  }
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================

function bindDeleteModal() {
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteModalClose').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDelete);
}

function openDeleteModal(id) {
  deleteTargetId = id;

  fetch(`/api/admin/models/${id}`)
    .then(r => r.json())
    .then(m => {
      const msg = document.getElementById('deleteMessage');
      msg.innerHTML = `Удалить модель <strong>«${escapeHtml(m.corporate_id)} — ${escapeHtml(m.name)}»</strong>?<br><br>
        <span style="color: var(--warning); font-size: 13px;">
          ⚠️ Если у модели есть экземпляры, удаление невозможно.
        </span>`;
      document.getElementById('deleteModal').classList.add('active');
    })
    .catch(err => {
      showToast('❌ Не удалось получить модель: ' + err.message, 'error');
    });
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
  deleteTargetId = null;
}

async function confirmDelete() {
  if (!deleteTargetId) return;

  try {
    const res = await fetch(`/api/admin/models/${deleteTargetId}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Ошибка удаления');
    }

    showToast('✅ Модель удалена', 'success');
    closeDeleteModal();
    loadModels();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================================
// КАРТОЧКА МОДЕЛИ
// ============================================================

function bindViewModelModal() {
  document.getElementById('viewModelClose').addEventListener('click', closeViewModel);
}

async function openViewModel(id) {
  const body = document.getElementById('viewModelBody');
  body.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';
  document.getElementById('viewModelModal').classList.add('active');

  try {
    const res = await fetch(`/api/admin/models/${id}`);
    const m   = await res.json();
    if (!res.ok || m.error) throw new Error(m.error || 'Ошибка');

    const instances = Array.isArray(m.instances) ? m.instances : [];

    const badges = [];
    if (m.category_name) {
      badges.push(`<span class="badge">${escapeHtml(m.category_icon || '📁')} ${escapeHtml(m.category_name)}</span>`);
    }
    if (m.type_name) {
      badges.push(`<span class="badge">${escapeHtml(m.type_icon || '📦')} ${escapeHtml(m.type_name)}</span>`);
    }

    body.innerHTML = `
      <div class="model-header-card">
        <div class="model-header-icon">🧩</div>
        <div class="model-header-info">
          <h2>${escapeHtml(m.name)}</h2>
          <div class="model-header-corporate">${escapeHtml(m.corporate_id)}</div>
          <div class="model-header-badges">${badges.join('')}</div>
        </div>
      </div>

      <div class="model-detail-section">
        <h4>📋 Общая информация</h4>
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
            <div class="value">${formatDate(m.created_at)}</div>
          </div>
          <div class="detail-item">
            <label>Обновлено</label>
            <div class="value">${formatDate(m.updated_at)}</div>
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
          <h4>🔧 Экземпляры</h4>
          <span class="model-instances-count">${instances.length}</span>
        </div>
        ${renderInstances(instances)}
      </div>
    `;
  } catch (err) {
    body.innerHTML = `
      <div class="models-empty">
        <span class="emoji">❌</span>
        <h3>Ошибка загрузки</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function closeViewModel() {
  document.getElementById('viewModelModal').classList.remove('active');
}

function renderInstances(instances) {
  if (!instances || instances.length === 0) {
    return `
      <div class="model-instances-empty">
        У этой модели пока нет экземпляров.
      </div>`;
  }

  const statusLabels = {
    available:   '✅ Доступна',
    placed:      '🪑 На рабочем месте',
    assigned:    '👤 Назначена',
    maintenance: '🔧 В ремонте',
    retired:     '📦 Списана',
  };

  let rows = '';
  for (const eq of instances) {
    const location = formatInstanceLocation(eq);
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

/**
 * Формируем текст «где лежит экземпляр»:
 *   - на рабочем месте → офис / кабинет / место
 *   - на складе       → склад / зона / стеллаж / ячейка (code)
 *   - назначено        → пометка пользователя
 *   - иначе            → «—»
 */
function formatInstanceLocation(eq) {
  if (eq.status === 'assigned') {
    return `<span class="loc-icon">👤</span> Назначена пользователю`;
  }

  if (eq.workplace_id) {
    const parts = [eq.office_name, eq.room_name, eq.workplace_name]
      .filter(Boolean)
      .map(escapeHtml);
    if (parts.length === 0) return '—';
    return `<span class="loc-icon">🪑</span> ${parts.join(' / ')}`;
  }

  if (eq.cell_id) {
    const warehouse = eq.warehouse_name ? escapeHtml(eq.warehouse_name) : null;
    const cell = eq.cell_code
      ? escapeHtml(eq.cell_code)
      : (eq.cell_name ? escapeHtml(eq.cell_name) : null);
    const parts = [warehouse, cell].filter(Boolean);
    if (parts.length === 0) return '—';
    return `<span class="loc-icon">📦</span> ${parts.join(' / ')}`;
  }

  return '—';
}

// ============================================================
// ЗАКРЫТИЕ МОДАЛОК ПО ESC И ОВЕРЛЕЮ
// ============================================================

document.addEventListener('click', e => {
  if (!e.target.classList.contains('modal-overlay')) return;
  if (e.target.id === 'modelModal')  closeModelModal();
  if (e.target.id === 'deleteModal') closeDeleteModal();
  if (e.target.id === 'viewModelModal') closeViewModel();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeModelModal();
  closeDeleteModal();
  closeViewModel();
});

// ============================================================
// УТИЛИТЫ
// ============================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleDateString('ru-RU', {
      day:   '2-digit',
      month: '2-digit',
      year:  'numeric',
    });
  } catch {
    return dt;
  }
}