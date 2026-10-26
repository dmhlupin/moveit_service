// public/js/catalog.js
// Логика страницы справочника техники
// 5.11.3: карточка техники через EquipmentCard, кликабельные строки.

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

function updateCategoryFilter() {
    const filter = document.getElementById('categoryFilter');
    const currentValue = filter.value;

    filter.innerHTML = '<option value="">Все категории</option>' +
        categories.map(cat => `
            <option value="${cat.id}">${cat.icon || '📁'} ${escapeHtml(cat.name)}</option>
        `).join('');

    filter.value = currentValue;
}

function updateCategorySelectInTypeModal() {
    const select = document.getElementById('typeCategory');
    const currentValue = select.value;

    select.innerHTML = '<option value="">— Выберите категорию —</option>' +
        categories.map(cat => `
            <option value="${cat.id}">${cat.icon || '📁'} ${escapeHtml(cat.name)}</option>
        `).join('');

    if (currentValue) select.value = currentValue;
}

function filterTypes() {
    const filter = document.getElementById('categoryFilter');
    currentFilter = filter.value;
    renderCategories();
    renderTypes();

    setEquipmentCategoryFilter(currentFilter || null);
}

function selectCategory(id) {
    const filter = document.getElementById('categoryFilter');
    if (String(filter.value) === String(id)) {
        filter.value = '';
        currentFilter = '';
    } else {
        filter.value = id;
        currentFilter = String(id);
    }
    renderCategories();
    renderTypes();

    setEquipmentCategoryFilter(currentFilter || null);
}

function selectType(typeId) {
    if (event) event.stopPropagation();

    const container = document.getElementById('typesList');
    const items = container.querySelectorAll('.type-item');

    items.forEach(item => item.classList.remove('selected'));

    if (currentEquipmentFilters.type_id === typeId) {
        currentEquipmentFilters.type_id = null;
        setEquipmentCategoryFilter(currentEquipmentFilters.category_id);
    } else {
        currentEquipmentFilters.type_id = typeId;
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
        const cat = categories.find(c => c.id === id);
        if (!cat) return;

        title.textContent = '✏️ Редактировать категорию';
        document.getElementById('categoryId').value = cat.id;
        document.getElementById('categoryIcon').value = cat.icon || '';
        document.getElementById('categoryName').value = cat.name || '';
        document.getElementById('categoryDescription').value = cat.description || '';
    } else {
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
        const type = types.find(t => t.id === id);
        if (!type) return;

        title.textContent = '✏️ Редактировать тип';
        document.getElementById('typeId').value = type.id;
        document.getElementById('typeCategory').value = type.category_id;
        document.getElementById('typeIcon').value = type.icon || '';
        document.getElementById('typeName').value = type.name || '';
        document.getElementById('typeDescription').value = type.description || '';
    } else {
        title.textContent = '➕ Добавить тип';
        document.getElementById('typeId').value = '';
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
// УДАЛЕНИЕ КАТЕГОРИИ / ТИПА
// 5.11.3: deleteModal → catalogDeleteModal (коллизия с партиалом)
// ============================================================

function deleteCategoryItem(id, name) {
    deleteTarget = { type: 'category', id, name };
    const msg = document.getElementById('deleteMessage');
    msg.innerHTML = `Вы уверены, что хотите удалить категорию <strong>"${escapeHtml(name)}"</strong>?<br><br>
        <span style="color: #c05621; font-size: 13px;">⚠️ Если в категории есть типы — удаление невозможно.</span>`;
    document.getElementById('catalogDeleteModal').classList.add('active');
}

function deleteTypeItem(id, name) {
    deleteTarget = { type: 'type', id, name };
    const msg = document.getElementById('deleteMessage');
    msg.innerHTML = `Вы уверены, что хотите удалить тип <strong>"${escapeHtml(name)}"</strong>?<br><br>
        <span style="color: #c05621; font-size: 13px;">⚠️ Если к типу привязана техника — удаление невозможно.</span>`;
    document.getElementById('catalogDeleteModal').classList.add('active');
}

function closeCatalogDeleteModal() {
    document.getElementById('catalogDeleteModal').classList.remove('active');
    deleteTarget = null;
}

async function confirmCatalogDelete() {
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
            closeCatalogDeleteModal();
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

function getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(p => p);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

async function loadFilteredEquipment(page = 1) {
    currentEquipmentPage = page;

    const container = document.getElementById('equipmentTableContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-block">⏳ Загрузка техники...</div>';

    try {
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

        const response = await fetch(`/api/manage/equipment/filtered?${params}`);
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
 * Отрисовать таблицу техники.
 * 🆕 5.11.3: строки кликабельны → EquipmentCard.open()
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
        const ownerInitials = eq.user_name
            ? eq.user_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            : '';

        const statusLabels = {
            'available': '✅ Доступна',
            'placed': '🪑 На месте',
            'assigned': '👤 Назначена',
            'maintenance': '🔧 В ремонте',
            'retired': '❌ Списана',
        };
        const statusText = statusLabels[eq.status] || eq.status;

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
            <tr class="equipment-row-link" onclick="openEquipmentCardCatalog(${eq.id})">
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
                    <div class="eq-actions" onclick="event.stopPropagation()">
                        <button onclick="openEquipmentCardCatalog(${eq.id})" 
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

function renderPagination(data) {
    const { page, totalPages, total, items } = data;
    const from = (page - 1) * data.limit + 1;
    const to = Math.min(page * data.limit, total);

    let buttons = '';

    buttons += `
        <button 
            class="equipment-pagination-btn" 
            onclick="loadFilteredEquipment(${page - 1})"
            ${page <= 1 ? 'disabled' : ''}
        >←</button>
    `;

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

function onEquipmentSearchKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        applyEquipmentSearch();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        resetEquipmentSearch();
    }
}

function applyEquipmentSearch() {
    const input = document.getElementById('equipmentSearch');
    if (!input) return;

    const searchTerm = input.value.trim() || null;

    if (searchTerm === currentEquipmentFilters.search) {
        return;
    }

    currentEquipmentFilters.search = searchTerm;
    loadFilteredEquipment(1);
}

function resetEquipmentSearch() {
    const input = document.getElementById('equipmentSearch');
    if (input) input.value = '';

    if (currentEquipmentFilters.search) {
        currentEquipmentFilters.search = null;
        loadFilteredEquipment(1);
    }
}

function setEquipmentCategoryFilter(categoryId) {
    currentEquipmentFilters.category_id = categoryId || null;
    currentEquipmentFilters.type_id = null;

    currentEquipmentFilters.search = null;
    const input = document.getElementById('equipmentSearch');
    if (input) input.value = '';

    loadFilteredEquipment(1);
}

function setEquipmentTypeFilter(typeId) {
    currentEquipmentFilters.type_id = typeId || null;
    loadFilteredEquipment(1);
}

// ============================================================
// 5.11.3: КАРТОЧКА ТЕХНИКИ ЧЕРЕЗ EquipmentCard
// ============================================================

window.openEquipmentCardCatalog = (id) => {
    EquipmentCard.open({
        id,
        onClose: (r) => { if (r && r.changed) location.reload(); },
    });
};

// ============================================================
// ЗАКРЫТИЕ МОДАЛОК ПО ESC И КЛИКУ НА ОВЕРЛЕЙ
// 5.11.3: #viewEquipmentModal / #deleteModal убраны — их ведёт EquipmentCard
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
        // #viewEquipmentModal закрывается через EquipmentCard.close()
        // (по Escape — обработчик в main.js, см. components.css)
    }
});