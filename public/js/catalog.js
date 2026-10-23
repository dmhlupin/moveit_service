// public/js/catalog.js
// Логика страницы справочника техники

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let categories = [];
let types = [];
let currentFilter = ''; // ID категории для фильтрации типов
let deleteTarget = null; // { type: 'category'|'type', id, name }

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📚 Справочник: загрузка данных...');
    await loadAll();
});

/**
 * Загрузить категории и типы
 */
async function loadAll() {
    try {
        const [cats, typs] = await Promise.all([
            fetch('/api/admin/categories').then(r => r.json()),
            fetch('/api/admin/types').then(r => r.json()),
        ]);
        
        categories = Array.isArray(cats) ? cats : [];
        types = Array.isArray(typs) ? typs : [];
        
        console.log(`✅ Загружено: ${categories.length} категорий, ${types.length} типов`);
        
        renderCategories();
        renderTypes();
        updateStats();
        updateCategoryFilter();
        updateCategorySelectInTypeModal();
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        showToast('❌ Ошибка загрузки данных', 'error');
    }
}

// ============================================================
// ОТРИСОВКА КАТЕГОРИЙ
// ============================================================

function renderCategories() {
    const container = document.getElementById('categoriesList');
    
    if (categories.length === 0) {
        container.innerHTML = `
            <div class="catalog-empty">
                <span class="empty-icon">📭</span>
                <div class="empty-text">Нет категорий</div>
                <div class="empty-hint">Нажмите "➕ Добавить" чтобы создать первую</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = categories.map(cat => `
        <div class="category-item ${String(cat.id) === String(currentFilter) ? 'selected' : ''}" 
             data-id="${cat.id}"
             onclick="selectCategory(${cat.id})">
            <div class="category-icon">${cat.icon || '📁'}</div>
            <div class="category-info">
                <div class="category-name">${escapeHtml(cat.name)}</div>
                ${cat.description ? `<div class="category-description">${escapeHtml(cat.description)}</div>` : ''}
                <div class="category-stats">
                    <span>📦 ${cat.types_count || 0} типов</span>
                    <span>🔧 ${cat.equipment_count || 0} техники</span>
                </div>
            </div>
            <div class="category-actions" onclick="event.stopPropagation()">
                <button onclick="openCategoryModal(${cat.id})" 
                        class="btn-action btn-edit" 
                        title="Редактировать">✏️</button>
                <button onclick="deleteCategoryItem(${cat.id}, '${escapeAttr(cat.name)}')" 
                        class="btn-action btn-delete" 
                        title="Удалить">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ============================================================
// ОТРИСОВКА ТИПОВ
// ============================================================

function renderTypes() {
    const container = document.getElementById('typesList');
    
    // Фильтрация
    const filtered = currentFilter
        ? types.filter(t => String(t.category_id) === String(currentFilter))
        : types;
    
    if (filtered.length === 0) {
        const hint = currentFilter
            ? 'В этой категории нет типов'
            : 'Нажмите "➕ Добавить" чтобы создать первый';
        
        container.innerHTML = `
            <div class="catalog-empty">
                <span class="empty-icon">📭</span>
                <div class="empty-text">Нет типов</div>
                <div class="empty-hint">${hint}</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(type => `
        <div class="type-item" data-id="${type.id}" onclick="selectType(${type.id})">
            <div class="type-icon">${type.icon || '📦'}</div>
            <div class="type-info">
                <div class="type-name">${escapeHtml(type.name)}</div>
                <span class="type-category">${type.category_icon || '📁'} ${escapeHtml(type.category_name)}</span>
                <div class="type-stats">🔧 ${type.equipment_count || 0} техники</div>
            </div>
            <div class="type-actions">
                <button onclick="openTypeModal(${type.id})" 
                        class="btn-action btn-edit" 
                        title="Редактировать">✏️</button>
                <button onclick="deleteTypeItem(${type.id}, '${escapeAttr(type.name)}')" 
                        class="btn-action btn-delete" 
                        title="Удалить">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ============================================================
// ФИЛЬТР И ВЫБОР КАТЕГОРИИ
// ============================================================

/**
 * Обновить выпадающий список категорий в фильтре
 */
function updateCategoryFilter() {
    const filter = document.getElementById('categoryFilter');
    const currentValue = filter.value;
    
    filter.innerHTML = '<option value="">Все категории</option>' +
        categories.map(cat => `
            <option value="${cat.id}">${cat.icon || '📁'} ${escapeHtml(cat.name)}</option>
        `).join('');
    
    filter.value = currentValue;
}

/**
 * Обновить выпадающий список категорий в модалке типа
 */
function updateCategorySelectInTypeModal() {
    const select = document.getElementById('typeCategory');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">— Выберите категорию —</option>' +
        categories.map(cat => `
            <option value="${cat.id}">${cat.icon || '📁'} ${escapeHtml(cat.name)}</option>
        `).join('');
    
    if (currentValue) select.value = currentValue;
}

/**
 * Обработка изменения фильтра
 */
function filterTypes() {
    const filter = document.getElementById('categoryFilter');
    currentFilter = filter.value;
    renderCategories();
    renderTypes();
    
    // 🆕 Обновляем фильтр техники
    setEquipmentCategoryFilter(currentFilter || null);
}
/**
 * Клик по категории — устанавливает фильтр
 */
function selectCategory(id) {
    const filter = document.getElementById('categoryFilter');
    if (String(filter.value) === String(id)) {
        // Повторный клик — сбросить фильтр
        filter.value = '';
        currentFilter = '';
    } else {
        filter.value = id;
        currentFilter = String(id);
    }
    renderCategories();
    renderTypes();
    
    // 🆕 Обновляем фильтр техники
    setEquipmentCategoryFilter(currentFilter || null);
}
/**
 * Клик по типу — устанавливает фильтр техники по типу
 */
function selectType(typeId) {
    // Проверяем, не кликнули ли на кнопки внутри
    if (event) event.stopPropagation();
    
    const container = document.getElementById('typesList');
    const items = container.querySelectorAll('.type-item');
    
    // Сбрасываем выделение со всех
    items.forEach(item => item.classList.remove('selected'));
    
    // Если клик по тому же — сбрасываем фильтр
    if (currentEquipmentFilters.type_id === typeId) {
        currentEquipmentFilters.type_id = null;
        setEquipmentCategoryFilter(currentEquipmentFilters.category_id);
    } else {
        currentEquipmentFilters.type_id = typeId;
        // Находим элемент и подсвечиваем
        const target = container.querySelector(`.type-item[data-id="${typeId}"]`);
        if (target) target.classList.add('selected');
        
        loadFilteredEquipment(1);
    }
}

// ============================================================
// СТАТИСТИКА
// ============================================================

function updateStats() {
    const statCategories = document.getElementById('statCategories');
    const statTypes = document.getElementById('statTypes');
    const statEquipment = document.getElementById('statEquipment');
    
    if (statCategories) statCategories.textContent = categories.length;
    if (statTypes) statTypes.textContent = types.length;
    if (statEquipment) {
        const total = types.reduce((sum, t) => sum + (t.equipment_count || 0), 0);
        statEquipment.textContent = total;
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
        // Редактирование
        const cat = categories.find(c => c.id === id);
        if (!cat) return;
        
        title.textContent = '✏️ Редактировать категорию';
        document.getElementById('categoryId').value = cat.id;
        document.getElementById('categoryIcon').value = cat.icon || '';
        document.getElementById('categoryName').value = cat.name || '';
        document.getElementById('categoryDescription').value = cat.description || '';
    } else {
        // Создание
        title.textContent = '➕ Добавить категорию';
        document.getElementById('categoryId').value = '';
        document.getElementById('categoryIcon').value = '';
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryDescription').value = '';
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
        icon: document.getElementById('categoryIcon').value.trim(),
        description: document.getElementById('categoryDescription').value.trim(),
    };
    
    if (!data.name) {
        showToast('❌ Название обязательно', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Сохранение...';
    
    try {
        const url = isEdit ? `/api/admin/categories/${id}` : '/api/admin/categories';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`✅ Категория ${isEdit ? 'обновлена' : 'создана'}`, 'success');
            closeCategoryModal();
            await loadAll();
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('❌ Ошибка соединения', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Сохранить';
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
        // Редактирование
        const type = types.find(t => t.id === id);
        if (!type) return;
        
        title.textContent = '✏️ Редактировать тип';
        document.getElementById('typeId').value = type.id;
        document.getElementById('typeCategory').value = type.category_id;
        document.getElementById('typeIcon').value = type.icon || '';
        document.getElementById('typeName').value = type.name || '';
        document.getElementById('typeDescription').value = type.description || '';
    } else {
        // Создание
        title.textContent = '➕ Добавить тип';
        document.getElementById('typeId').value = '';
        // Если фильтр активен — предзаполняем категорию
        if (currentFilter) {
            document.getElementById('typeCategory').value = currentFilter;
        }
        document.getElementById('typeIcon').value = '';
        document.getElementById('typeName').value = '';
        document.getElementById('typeDescription').value = '';
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
        icon: document.getElementById('typeIcon').value.trim(),
        description: document.getElementById('typeDescription').value.trim(),
    };
    
    if (!data.category_id) {
        showToast('❌ Выберите категорию', 'error');
        return;
    }
    if (!data.name) {
        showToast('❌ Название обязательно', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Сохранение...';
    
    try {
        const url = isEdit ? `/api/admin/types/${id}` : '/api/admin/types';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`✅ Тип ${isEdit ? 'обновлён' : 'создан'}`, 'success');
            closeTypeModal();
            await loadAll();
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('❌ Ошибка соединения', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Сохранить';
    }
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================

function deleteCategoryItem(id, name) {
    deleteTarget = { type: 'category', id, name };
    const msg = document.getElementById('deleteMessage');
    msg.innerHTML = `Вы уверены, что хотите удалить категорию <strong>"${escapeHtml(name)}"</strong>?<br><br>
        <span style="color: #c05621; font-size: 13px;">⚠️ Если в категории есть типы — удаление невозможно.</span>`;
    document.getElementById('deleteModal').classList.add('active');
}

function deleteTypeItem(id, name) {
    deleteTarget = { type: 'type', id, name };
    const msg = document.getElementById('deleteMessage');
    msg.innerHTML = `Вы уверены, что хотите удалить тип <strong>"${escapeHtml(name)}"</strong>?<br><br>
        <span style="color: #c05621; font-size: 13px;">⚠️ Если к типу привязана техника — удаление невозможно.</span>`;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteTarget = null;
}

async function confirmDelete() {
    if (!deleteTarget) return;
    
    const { type, id } = deleteTarget;
    const url = type === 'category' 
        ? `/api/admin/categories/${id}` 
        : `/api/admin/types/${id}`;
    
    try {
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
            showToast(`✅ ${type === 'category' ? 'Категория' : 'Тип'} удалён`, 'success');
            closeDeleteModal();
            await loadAll();
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('❌ Ошибка соединения', 'error');
    }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

/**
 * Экранирование HTML (для безопасной вставки)
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Экранирование для атрибута onclick
 */
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;');
}

// ============================================================
// ТЕХНИКА В ВЫБРАННОЙ КАТЕГОРИИ/ТИПЕ
// ============================================================

let currentEquipmentPage = 1;
let currentEquipmentFilters = {
    category_id: null,
    type_id: null,
    search: null,
};


/**
 * Загрузить технику с текущими фильтрами
 */
async function loadFilteredEquipment(page = 1) {
    currentEquipmentPage = page;
    
    const container = document.getElementById('equipmentTableContainer');
    if (!container) return;
    
    // Показываем загрузку
    container.innerHTML = '<div class="loading-block">⏳ Загрузка техники...</div>';
    
    try {
        // Формируем URL
        const params = new URLSearchParams();
        if (currentEquipmentFilters.category_id) {
            params.set('category_id', currentEquipmentFilters.category_id);
        }
        if (currentEquipmentFilters.type_id) {
            params.set('type_id', currentEquipmentFilters.type_id);
        }
        if (currentEquipmentFilters.search) {
            params.set('search', currentEquipmentFilters.search);
        }
        params.set('page', page);
        params.set('limit', 20);
        
        const response = await fetch(`/api/manage/equipment/filtered?${params}`)
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка загрузки');
        }
        
        renderEquipmentTable(data);
        updateEquipmentSubtitle(data);
    } catch (error) {
        console.error('Ошибка загрузки техники:', error);
        container.innerHTML = `
            <div class="catalog-empty">
                <span class="empty-icon">❌</span>
                <div class="empty-text">Ошибка загрузки: ${escapeHtml(error.message)}</div>
            </div>
        `;
    }
}

/**
 * Обновить подзаголовок секции
 */
function updateEquipmentSubtitle(data) {
    const subtitle = document.getElementById('equipmentSubtitle');
    if (!subtitle) return;
    
    const parts = [];
    
    if (currentEquipmentFilters.type_id) {
        const type = types.find(t => t.id === currentEquipmentFilters.type_id);
        if (type) parts.push(`📦 ${type.name}`);
    } else if (currentEquipmentFilters.category_id) {
        const cat = categories.find(c => c.id === currentEquipmentFilters.category_id);
        if (cat) parts.push(`📁 ${cat.name}`);
    }
    
    if (currentEquipmentFilters.search) {
        parts.push(`🔍 "${currentEquipmentFilters.search}"`);
    }
    
    if (parts.length === 0) {
        subtitle.textContent = 'Выберите категорию слева или тип справа';
    } else {
        subtitle.innerHTML = `Показано: ${data.total} единиц — ${parts.join(' → ')}`;
    }
}

/**
 * Отрисовать таблицу техники
 */
function renderEquipmentTable(data) {
    const container = document.getElementById('equipmentTableContainer');
    if (!container) return;
    
    if (data.items.length === 0) {
        container.innerHTML = `
            <div class="catalog-empty">
                <span class="empty-icon">📭</span>
                <div class="empty-text">Техника не найдена</div>
                <div class="empty-hint">Попробуйте изменить фильтр или поиск</div>
            </div>
        `;
        return;
    }
    
    // Таблица
    let html = `
        <div class="equipment-table-wrapper">
            <table class="equipment-table">
                <thead>
                    <tr>
                        <th>Инв. номер</th>
                        <th>Название</th>
                        <th class="col-model">Модель</th>
                        <th>Статус</th>
                        <th>Владелец</th>
                        <th style="text-align: right;">Действия</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    data.items.forEach(eq => {
        // Инициалы владельца
        const ownerInitials = eq.user_name 
            ? eq.user_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            : '';
        
        // Статус
        const statusLabels = {
            'available': '✅ Доступна',
            'assigned': '👤 Назначена',
            'maintenance': '🔧 В ремонте',
            'retired': '❌ Списана',
        };
        const statusText = statusLabels[eq.status] || eq.status;
        
        // Владелец
        let ownerHtml;
        if (eq.user_name) {
            ownerHtml = `
                <div class="eq-owner">
                    <span class="eq-owner-avatar">${ownerInitials}</span>
                    <div class="eq-owner-info">
                        <div class="eq-owner-name">${escapeHtml(eq.user_name)}</div>
                        ${eq.user_department ? `<div class="eq-owner-dept">${escapeHtml(eq.user_department)}</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            ownerHtml = '<span class="eq-owner-empty">—</span>';
        }
        
        html += `
            <tr>
                <td><span class="eq-inv">${escapeHtml(eq.inventory_number)}</span></td>
                <td>
                    <div class="eq-name">${escapeHtml(eq.model_name || '—')}</div>
                </td>
                <td class="col-model">
                    <div class="eq-model">${escapeHtml(eq.model_corporate_id || '—')}</div>
                </td>
                <td>
                    <span class="eq-status status-${eq.status}">${statusText}</span>
                </td>
                <td>${ownerHtml}</td>
                <td>
                    <div class="eq-actions">
                        <button onclick="viewEquipment(${eq.id})" 
                                class="eq-btn view" 
                                title="Просмотр карточки">👁️</button>
                        <a href="/admin/edit/${eq.id}" 
                           class="eq-btn edit" 
                           title="Редактировать">✏️</a>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // Пагинация
    if (data.totalPages > 1) {
        html += renderPagination(data);
    } else {
        html += `
            <div class="equipment-pagination">
                <div class="equipment-pagination-info">
                    Показано ${data.items.length} из ${data.total}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

/**
 * Отрисовать пагинацию
 */
function renderPagination(data) {
    const { page, totalPages, total, items } = data;
    const from = (page - 1) * data.limit + 1;
    const to = Math.min(page * data.limit, total);
    
    let buttons = '';
    
    // Кнопка "Назад"
    buttons += `
        <button 
            class="equipment-pagination-btn" 
            onclick="loadFilteredEquipment(${page - 1})"
            ${page <= 1 ? 'disabled' : ''}
        >←</button>
    `;
    
    // Номера страниц (сокращённые)
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
    }
    
    if (start > 1) {
        pages.push(`<button class="equipment-pagination-btn" onclick="loadFilteredEquipment(1)">1</button>`);
        if (start > 2) pages.push('<span style="padding: 6px;">…</span>');
    }
    
    for (let i = start; i <= end; i++) {
        pages.push(`
            <button 
                class="equipment-pagination-btn ${i === page ? 'active' : ''}" 
                onclick="loadFilteredEquipment(${i})"
            >${i}</button>
        `);
    }
    
    if (end < totalPages) {
        if (end < totalPages - 1) pages.push('<span style="padding: 6px;">…</span>');
        pages.push(`<button class="equipment-pagination-btn" onclick="loadFilteredEquipment(${totalPages})">${totalPages}</button>`);
    }
    
    buttons += pages.join('');
    
    // Кнопка "Вперёд"
    buttons += `
        <button 
            class="equipment-pagination-btn" 
            onclick="loadFilteredEquipment(${page + 1})"
            ${page >= totalPages ? 'disabled' : ''}
        >→</button>
    `;
    
    return `
        <div class="equipment-pagination">
            <div class="equipment-pagination-info">
                Показано ${from}–${to} из ${total}
            </div>
            <div class="equipment-pagination-buttons">
                ${buttons}
            </div>
        </div>
    `;
}

/**
 * Обработка нажатия клавиш в поиске
 * Enter — применить поиск
 * Escape — очистить
 */
function onEquipmentSearchKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        applyEquipmentSearch();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        resetEquipmentSearch();
    }
}

/**
 * Применить поиск (по кнопке или Enter)
 */
function applyEquipmentSearch() {
    const input = document.getElementById('equipmentSearch');
    if (!input) return;
    
    const searchTerm = input.value.trim() || null;
    
    // Если поиск не изменился — не делаем запрос
    if (searchTerm === currentEquipmentFilters.search) {
        return;
    }
    
    currentEquipmentFilters.search = searchTerm;
    loadFilteredEquipment(1);
}

/**
 * Сбросить поиск
 */
function resetEquipmentSearch() {
    const input = document.getElementById('equipmentSearch');
    if (input) input.value = '';
    
    if (currentEquipmentFilters.search) {
        currentEquipmentFilters.search = null;
        loadFilteredEquipment(1);
    }
}

/**
 * Установить фильтр по категории
 */
function setEquipmentCategoryFilter(categoryId) {
    currentEquipmentFilters.category_id = categoryId || null;
    currentEquipmentFilters.type_id = null; // сбрасываем тип
    
    // 🆕 Не сбрасываем поиск автоматически — оставляем как есть
    // Если хотите сбрасывать — раскомментируйте:
    currentEquipmentFilters.search = null;
    const input = document.getElementById('equipmentSearch');
    if (input) input.value = '';
    
    loadFilteredEquipment(1);
}

/**
 * Установить фильтр по типу
 */
function setEquipmentTypeFilter(typeId) {
    currentEquipmentFilters.type_id = typeId || null;
    loadFilteredEquipment(1);
}

// ============================================================
// ПРОСМОТР ТЕХНИКИ (карточка)
// ============================================================

/**
 * Открыть карточку техники
 */
async function viewEquipment(id) {
    try {
        const response = await fetch(`/api/manage/equipment/${id}/details`);
        const data = await response.json();
        
        if (!data.equipment) {
            showToast('❌ Техника не найдена', 'error');
            return;
        }
        
        const { equipment, stats, history } = data;
        
        // Даты
        const purchaseDate = equipment.purchase_date 
            ? new Date(equipment.purchase_date).toLocaleDateString('ru-RU')
            : '—';
        const warrantyDate = equipment.warranty_until 
            ? new Date(equipment.warranty_until).toLocaleDateString('ru-RU')
            : '—';
        
        // Проверка гарантии
        const warrantyExpired = equipment.warranty_until && new Date(equipment.warranty_until) < new Date();
        const warrantyBadge = warrantyExpired 
            ? '<span style="color: #c53030; font-size: 12px;">⚠️ Истекла</span>'
            : (equipment.warranty_until ? '<span style="color: #2f855a; font-size: 12px;">✅ Действует</span>' : '');
        
        // Статус
        const statusLabels = {
            'available': { label: 'Доступна', class: 'status-available', icon: '✅' },
            'assigned': { label: 'Назначена', class: 'status-assigned', icon: '👤' },
            'maintenance': { label: 'В ремонте', class: 'status-maintenance', icon: '🔧' },
            'retired': { label: 'Списана', class: 'status-retired', icon: '❌' }
        };
        const statusInfo = statusLabels[equipment.status] || statusLabels.available;
        const statusBadge = `<span class="status-badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>`;
        
        // Категория / тип
        const categoryHtml = equipment.category_name 
            ? `<span class="eq-status" style="background: #e2e8f0; color: #4a5568;">📁 ${escapeHtml(equipment.category_name)}</span>` 
            : '';
        const typeHtml = equipment.type_name 
            ? `<span class="eq-status" style="background: #e2e8f0; color: #4a5568;">📦 ${escapeHtml(equipment.type_name)}</span>` 
            : '';
        
        // Текущий владелец
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
        
        // История
        let historyHtml = '';
        if (history.length === 0) {
            historyHtml = '<p style="color: #a0aec0; text-align: center; padding: 15px;">История пуста</p>';
        } else {
            historyHtml = `
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Пользователь</th>
                            <th>Отдел</th>
                            <th>Выдано</th>
                            <th>Возвращено</th>
                            <th>Состояние</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            history.forEach(h => {
                const assignedDate = h.assigned_date 
                    ? new Date(h.assigned_date).toLocaleDateString('ru-RU') 
                    : '—';
                const returnedDate = h.returned_date 
                    ? new Date(h.returned_date).toLocaleDateString('ru-RU') 
                    : '—';
                const statusBadge = h.status === 'active'
                    ? '<span class="status-badge status-assigned">Активна</span>'
                    : '<span class="status-badge status-available">Возвращена</span>';
                
                historyHtml += `
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
                        <td>${escapeHtml(h.condition_on_assign || '—')}</td>
                        <td>${statusBadge}</td>
                    </tr>
                `;
            });
            historyHtml += '</tbody></table>';
        }
        
        // Собираем
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
            
            <div class="user-stats">
                <div class="user-stat">
                    <div class="user-stat-number active">${stats.active}</div>
                    <div class="user-stat-label">Сейчас назначена</div>
                </div>
                <div class="user-stat">
                    <div class="user-stat-number total">${stats.total}</div>
                    <div class="user-stat-label">Всего выдач</div>
                </div>
                <div class="user-stat">
                    <div class="user-stat-number returned">${stats.returned}</div>
                    <div class="user-stat-label">Возвращено</div>
                </div>
            </div>
            
            <div class="user-detail-section">
                <h4>📋 Информация о технике</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Модель</label>
                        <div class="value">${escapeHtml(equipment.model_name || '—')}</div>
                    </div>
                    <div class="detail-item">
                        <label>Corporate ID</label>
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
                </div>
                ${equipment.description ? `
                    <div class="detail-item" style="margin-top: 12px;">
                        <label>Описание</label>
                        <div class="value">${escapeHtml(equipment.description)}</div>
                    </div>
                ` : ''}
            </div>
            
            <div class="user-detail-section">
                <h4>👤 Текущий владелец</h4>
                ${currentUserHtml}
            </div>
            
            <div class="user-detail-section">
                <h4>📜 История использования (${stats.total})</h4>
                ${historyHtml}
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

/**
 * Получить инициалы из имени
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(p => p);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ============================================================
// ЗАКРЫТИЕ МОДАЛОК ПО ESC И КЛИКУ НА ОВЕРЛЕЙ
// ============================================================

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        if (e.target.id === 'categoryModal') closeCategoryModal();
        if (e.target.id === 'typeModal') closeTypeModal();
        if (e.target.id === 'deleteModal') closeDeleteModal();
        if (e.target.id === 'viewEquipmentModal') closeViewEquipmentModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeCategoryModal();
        closeTypeModal();
        closeDeleteModal();
        closeViewEquipmentModal();
    }
});