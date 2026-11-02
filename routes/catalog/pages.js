const fs = require('fs');
const path = require('path');

const {
  getAllCategories,
  getAllTypes,
  getAllModels,          // 🆕 5.14.2
  getEquipmentWithLocation,
  getEquipmentCountsByCategory,
  getEquipmentCountsByType,
} = require('../../database/db');

const { renderPageFor } = require('../../utils/layout');
const { escapeHtml } = require('./helpers');

// ============================================================
// СТРАНИЦА
// ============================================================

async function renderCatalog(req, res) {
  try {
    const currentRole = req.session.role || 'user';
    const currentUserId = req.session.userId || 0;
    const scope = { userId: currentUserId, role: currentRole };
    const q = req.query || {};

    // ---------- Пагинация ----------
    const PAGE_SIZE = 20;
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    // ---------- Фильтры ----------
    const filters = {
      category_id: q.category_id ? parseInt(q.category_id, 10) : null,
      type_id: q.type_id ? parseInt(q.type_id, 10) : null,
      model_id: q.model_id ? parseInt(q.model_id, 10) : null,   // 🆕
      search: (q.search || '').trim() || null,
      limit: PAGE_SIZE,
      offset,
      include_total: true,
    };

    // ---------- Данные ----------
    const [categories, types, result, countsByCategory, countsByType] = await Promise.all([
      getAllCategories(),
      getAllTypes(),
      getEquipmentWithLocation(filters, scope),
      getEquipmentCountsByCategory(),
      getEquipmentCountsByType(),
    ]);

    // Модели выбранного типа (если тип задан)
    let models = [];
    if (filters.type_id) {
      models = await getAllModels({ type_id: filters.type_id });
    }

    const equipment = result.items || [];
    const totalFiltered = result.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

    const totalCategories = categories.length;
    const totalTypes = types.length;
    const totalEquipment = Object.values(countsByType).reduce((sum, c) => sum + c, 0);

    // ---------- Шаблон ----------
    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-catalog.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // ---------- Скаляры ----------
    content = content.replace(/\{\{total_categories\}\}/g, totalCategories);
    content = content.replace(/\{\{total_types\}\}/g, totalTypes);
    content = content.replace(/\{\{total_equipment\}\}/g, totalEquipment);
    content = content.replace(/\{\{current_role\}\}/g, escapeHtml(currentRole));
    content = content.replace(/\{\{current_user_id\}\}/g, currentUserId);

    // ---------- Фильтры: опции ----------
    content = content.replace('{{filter_category_options}}', buildCategoryOptions(categories, filters.category_id));
    content = content.replace('{{filter_type_options}}', buildTypeOptions(types, filters));
    content = content.replace(/\{\{filter_search\}\}/g, escapeHtml(filters.search || ''));

    // ---------- Модели ----------
    content = content.replace('{{models_subtitle}}', buildModelsSubtitle(types, filters, models.length));
    content = content.replace('{{models_list}}', renderModelsList(models, filters, currentRole, currentUserId));

    // ---------- Заголовок секции техники ----------
    content = content.replace('{{equipment_subtitle}}', buildEquipmentSubtitle(categories, types, models, filters, totalFiltered));

    // ---------- Таблица: строки ----------
    let equipmentRows = '';
    if (equipment.length === 0) {
      equipmentRows = renderEmptyRow();
    } else {
      equipment.forEach(item => {
        equipmentRows += renderEquipmentRow(item, currentRole, currentUserId);
      });
    }
    content = content.replace('{{equipment_rows}}', equipmentRows);

    // ---------- Пагинация ----------
    content = content.replace('{{pagination}}', renderCatalogPagination(page, totalPages, totalFiltered, q));

    // ---------- Подключение JS / CSS ----------
    renderPageFor(req, res, {
      title: 'Справочник техники – MoveIT service',
      content,
      pageCss: [
        '/css/catalog.css',
        '/css/admin-models.css',   // 🆕 5.14.2: стили моделей (переиспользуем)
      ],
      pageJs: [
        '/js/manage/helpers.js',
        '/js/equipment-card/loader.js',
        '/js/equipment-card/render.js',
        '/js/equipment-card/actions.js',
        '/js/equipment-card/modals.js',
        '/js/equipment-card/index.js',
        '/js/catalog.js',
      ],
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки справочника:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

// ============================================================
// ХЕЛПЕРЫ
// ============================================================

function buildCategoryOptions(categories, selectedId) {
  let html = '<option value="">Все категории</option>';
  categories.forEach(c => {
    const sel = String(c.id) === String(selectedId) ? 'selected' : '';
    html += `<option value="${c.id}" ${sel}>${escapeHtml(c.name)}</option>`;
  });
  return html;
}

function buildTypeOptions(types, filters) {
  let html = '<option value="">Все типы</option>';
  const filteredTypes = filters.category_id
    ? types.filter(t => Number(t.category_id) === filters.category_id)
    : types;
  filteredTypes.forEach(t => {
    const sel = String(t.id) === String(filters.type_id) ? 'selected' : '';
    html += `<option value="${t.id}" ${sel}>${escapeHtml(t.name)}</option>`;
  });
  return html;
}

function buildModelsSubtitle(types, filters, modelsCount) {
  if (!filters.type_id) {
    return 'Выберите тип, чтобы увидеть модели';
  }
  const type = types.find(t => t.id === filters.type_id);
  const typeName = type ? escapeHtml(type.name) : 'выбранного типа';
  return `Модели типа «${typeName}» — ${modelsCount}`;
}

function renderModelsList(models, filters, currentRole, currentUserId) {
  if (!filters.type_id) {
    return `
      <div class="catalog-empty">
        <span class="empty-icon">👆</span>
        <div class="empty-text">Выберите тип справа</div>
        <div class="empty-hint">Модели этого типа появятся здесь</div>
      </div>`;
  }

  if (models.length === 0) {
    return `
      <div class="catalog-empty">
        <span class="empty-icon">📭</span>
        <div class="empty-text">У этого типа пока нет моделей</div>
        <div class="empty-hint">Нажмите «Добавить модель», чтобы создать</div>
      </div>`;
  }

  const canEdit = (currentRole === 'admin' || currentRole === 'mol');
  const canDelete = (currentRole === 'admin');

  return models.map(m => {
    const isSelected = String(m.id) === String(filters.model_id);
    const eqCount = m.equipment_count || 0;

    return `
      <div class="model-card ${isSelected ? 'selected' : ''}" 
           data-id="${m.id}"
           onclick="selectModel(${m.id})">
        <div class="model-card-info">
          <div class="model-card-name">${escapeHtml(m.name)}</div>
          <div class="model-card-corporate">${escapeHtml(m.corporate_id)}</div>
          ${m.manufacturer ? `<div class="model-card-manufacturer">${escapeHtml(m.manufacturer)}</div>` : ''}
        </div>
        <div class="model-card-meta">
          <span class="model-card-count">${eqCount} экз.</span>
          <div class="model-card-actions" onclick="event.stopPropagation()">
            <button onclick="openViewModelCatalog(${m.id})" 
                    class="btn btn-ghost btn-xs" 
                    title="Карточка модели">Просмотр</button>
            ${canEdit ? `<button onclick="openModelModalCatalog(${m.id})" 
                    class="btn btn-ghost btn-xs" 
                    title="Редактировать">Изменить</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function buildEquipmentSubtitle(categories, types, models, filters, totalFiltered) {
  const parts = [];
  if (filters.model_id) {
    const model = models.find(m => m.id === filters.model_id);
    if (model) parts.push(`Модель: ${escapeHtml(model.name)}`);
  } else if (filters.type_id) {
    const type = types.find(t => t.id === filters.type_id);
    if (type) parts.push(`Тип: ${escapeHtml(type.name)}`);
  } else if (filters.category_id) {
    const cat = categories.find(c => c.id === filters.category_id);
    if (cat) parts.push(`Категория: ${escapeHtml(cat.name)}`);
  }
  if (filters.search) {
    parts.push(`Поиск: "${escapeHtml(filters.search)}"`);
  }
  if (parts.length === 0) {
    return 'Выберите категорию слева или тип справа';
  }
  return `Показано: ${totalFiltered} единиц — ${parts.join(' → ')}`;
}

function renderEquipmentRow(item, currentRole, currentUserId) {
  const showResponsible = (currentRole === 'admin' || currentRole === 'supervisor');

  const ownerInitials = item.user_name
    ? item.user_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '';

  const statusLabels = {
    'available':   'Доступна',
    'placed':      'На месте',
    'assigned':    'Назначена',
    'maintenance': 'В ремонте',
    'retired':     'Списана',
  };
  const statusText = statusLabels[item.status] || item.status;

  let ownerHtml;
  if (item.user_name) {
    ownerHtml = `
      <div class="eq-owner">
        <span class="eq-owner-avatar">${ownerInitials}</span>
        <div class="eq-owner-info">
          <div class="eq-owner-name">${escapeHtml(item.user_name)}</div>
          ${item.user_department ? `<div class="eq-owner-dept">${escapeHtml(item.user_department)}</div>` : ''}
        </div>
      </div>
    `;
  } else {
    ownerHtml = '<span class="eq-owner-empty">—</span>';
  }

  let responsibleCell = '';
  if (showResponsible) {
    if (item.responsible_user_name) {
      const respInitials = item.responsible_user_name
        .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      responsibleCell = `<td>
        <div class="eq-owner">
          <span class="eq-owner-avatar" style="background: linear-gradient(135deg, var(--purple) 0%, var(--accent) 100%);">${respInitials}</span>
          <div class="eq-owner-info">
            <div class="eq-owner-name">${escapeHtml(item.responsible_user_name)}</div>
          </div>
        </div>
      </td>`;
    } else {
      responsibleCell = `<td><span class="eq-owner-empty">—</span></td>`;
    }
  }

  return `
    <tr class="equipment-row-link" onclick="openEquipmentCardCatalog(${item.id})">
      <td><span class="eq-inv">${escapeHtml(item.inventory_number)}</span></td>
      <td><div class="eq-name">${escapeHtml(item.model_name || '—')}</div></td>
      <td class="col-model"><div class="eq-model">${escapeHtml(item.model_corporate_id || '—')}</div></td>
      <td><span class="eq-status status-${item.status}">${statusText}</span></td>
      <td>${ownerHtml}</td>
      ${responsibleCell}
    </tr>
  `;
}

function renderEmptyRow() {
  return `
    <tr class="empty-row">
      <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div style="font-size: 40px; margin-bottom: 10px;">🔍</div>
        <div>Ничего не найдено</div>
        <div style="font-size: 12px; margin-top: 5px;">Попробуйте изменить фильтры</div>
      </td>
    </tr>
  `;
}

function renderCatalogPagination(page, totalPages, totalFiltered, query) {
  if (totalPages <= 1) {
    return `<div class="equipment-pagination">
      <div class="equipment-pagination-info">Показано ${totalFiltered} из ${totalFiltered}</div>
    </div>`;
  }

  const buildUrl = (p) => {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([k, v]) => {
      if (k !== 'page' && v) params.set(k, v);
    });
    params.set('page', p);
    return '/admin/catalog?' + params.toString();
  };

  let html = '<div class="equipment-pagination">';
  html += `<div class="equipment-pagination-info">Страница ${page} из ${totalPages} (всего: ${totalFiltered})</div>`;
  html += '<div class="equipment-pagination-buttons">';

  if (page > 1) {
    html += `<a href="${buildUrl(page - 1)}" class="equipment-pagination-btn">←</a>`;
  }

  const maxVisible = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  if (start > 1) {
    html += `<a href="${buildUrl(1)}" class="equipment-pagination-btn">1</a>`;
    if (start > 2) html += '<span style="padding: 6px;">…</span>';
  }

  for (let i = start; i <= end; i++) {
    html += `<a href="${buildUrl(i)}" class="equipment-pagination-btn ${i === page ? 'active' : ''}">${i}</a>`;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += '<span style="padding: 6px;">…</span>';
    html += `<a href="${buildUrl(totalPages)}" class="equipment-pagination-btn">${totalPages}</a>`;
  }

  if (page < totalPages) {
    html += `<a href="${buildUrl(page + 1)}" class="equipment-pagination-btn">→</a>`;
  }

  html += '</div></div>';
  return html;
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}

module.exports = {
  renderCatalog,
};