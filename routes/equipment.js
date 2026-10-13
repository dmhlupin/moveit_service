// routes/equipment.js
// Страница просмотра техники (только для админов)

const fs = require('fs');
const path = require('path');
const {
  getEquipmentWithLocation,
  getStats,
  getAllCategories,
  getAllTypes,
  getAllWarehouses,
  getAllOffices,          // 🆕
  getRoomsByOffice,       // 🆕
  getWorkplacesByRoom,    // 🆕
} = require('../database/db');

/**
 * GET /equipment — страница просмотра техники
 */
const PAGE_SIZE = 10;   // 🆕 размер страницы

async function renderEquipmentDashboard(req, res) {
  try {
    const q = req.query || {};

    // 🆕 Читаем query и нормализуем
    const isUnplaced = q.status === 'unplaced';
    const filters = {
      category_id: q.category_id ? parseInt(q.category_id, 10) : null,
      type_id: q.type_id ? parseInt(q.type_id, 10) : null,
      warehouse_id: q.warehouse_id ? parseInt(q.warehouse_id, 10) : null,
      workplace_id: q.workplace_id ? parseInt(q.workplace_id, 10) : null,
      status: (!isUnplaced && q.status) ? q.status : null,
      unplaced: isUnplaced,
      search: (q.search || '').trim() || null,
    };

    // 🆕 Пагинация
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    // 🆕 Загружаем ОТФИЛЬТРОВАННУЮ технику + total
    const result = await getEquipmentWithLocation({
      ...filters,
      limit: PAGE_SIZE,
      offset,
      include_total: true,
    });
    const equipment = result.items || [];
    const totalFiltered = result.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

    // Глобальная статистика (не зависит от фильтров)
    const stats = await getStats();
    const categories = await getAllCategories();
    const warehouses = await getAllWarehouses();

    // 🆕 Типы: если фильтр по категории — только для неё
    let types;
    if (filters.category_id) {
      const all = await getAllTypes();
      types = all.filter(t => Number(t.category_id) === filters.category_id);
    } else {
      types = await getAllTypes();
    }

    const htmlPath = path.join(__dirname, '..', 'views', 'equipment.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Статистика (глобальная)
    html = html.replace(/\{\{total_equipment\}\}/g, stats.total_equipment || 0);
    html = html.replace(/\{\{available_equipment\}\}/g, stats.available_equipment || 0);
    html = html.replace(/\{\{placed_equipment\}\}/g, stats.placed_equipment || 0);
    html = html.replace(/\{\{assigned_equipment\}\}/g, stats.assigned_equipment || 0);
    html = html.replace(/\{\{unplaced_equipment\}\}/g, stats.unplaced_equipment || 0);
    html = html.replace(/\{\{total_users\}\}/g, stats.total_users || 0);

    // 🆕 Селект категорий — с selected
    let categoryOptions = '<option value="">Все категории</option>';
    categories.forEach(cat => {
      const sel = String(cat.id) === String(filters.category_id) ? 'selected' : '';
      categoryOptions += `<option value="${cat.id}" ${sel}>${cat.icon || '📁'} ${cat.name} (${cat.equipment_count || 0})</option>`;
    });
    html = html.replace('{{category_options}}', categoryOptions);

    // 🆕 Селект типов — с selected
    let typeOptions = '<option value="">Все типы</option>';
    types.forEach(t => {
      const sel = String(t.id) === String(filters.type_id) ? 'selected' : '';
      typeOptions += `<option value="${t.id}" ${sel}>${t.icon || '📦'} ${t.name} (${t.equipment_count || 0})</option>`;
    });
    html = html.replace('{{type_options}}', typeOptions);

    // Селект складов — с selected (без __none__)
    let warehouseOptions = '<option value="">Все склады</option>';
    warehouses.forEach(w => {
      const sel = String(w.id) === String(filters.warehouse_id) ? 'selected' : '';
      warehouseOptions += `<option value="${w.id}" ${sel}>${w.is_default ? '⭐ ' : '🏢 '}${w.name} (${w.equipment_count || 0})</option>`;
    });
    html = html.replace('{{warehouse_options}}', warehouseOptions);

    // Селект рабочих мест — с selected (без __none__)
    let workplaceOptions = '<option value="">Все рабочие места</option>';
    const offices = await getAllOffices();
    for (const office of offices) {
      const rooms = await getRoomsByOffice(office.id);
      for (const room of rooms) {
        const workplaces = await getWorkplacesByRoom(room.id);
        if (workplaces.length === 0) continue;
        const groupLabel = `🏛️ ${office.name} / 🚪 ${room.name}`;
        let groupHtml = '';
        workplaces.forEach(wp => {
          const code = wp.code ? ` [${wp.code}]` : '';
          const count = wp.equipment_count || 0;
          const sel = String(wp.id) === String(filters.workplace_id) ? 'selected' : '';
          groupHtml += `<option value="${wp.id}" ${sel}>🪑 ${wp.name}${code} (${count})</option>`;
        });
        workplaceOptions += `<optgroup label="${escapeHtml(groupLabel)}">${groupHtml}</optgroup>`;
      }
    }
    html = html.replace('{{workplace_options}}', workplaceOptions);

    // 🆕 Селект статусов — с selected
    const statusLabels = {
      'available':   '✅ Доступна',
      'placed':      '🪑 На рабочем месте',
      'assigned':    '👤 Назначена',
      'maintenance': '🔧 В ремонте',
      'retired':     '❌ Списана',
      'unplaced':    '⚠️ Не размещено',
    };
    const currentStatusKey = filters.unplaced ? 'unplaced' : (filters.status || '');
    let statusOptions = '<option value="">Все статусы</option>';
    Object.entries(statusLabels).forEach(([key, label]) => {
      const sel = key === currentStatusKey ? 'selected' : '';
      statusOptions += `<option value="${key}" ${sel}>${label}</option>`;
    });
    html = html.replace('{{status_options}}', statusOptions);

        // 🆕 Значение поиска — чтобы не терять его после редиректа
    html = html.replace(/\{\{search_value\}\}/g, escapeHtml(filters.search || ''));

    // 🆕 Таблица — построение без data-*
    let tableRows = '';
    if (equipment.length === 0) {
      tableRows = `
        <tr class="empty-row">
          <td colspan="8" class="empty-state">
            <span class="emoji">🔍</span>
            <h3>Ничего не найдено</h3>
            <p>Попробуйте изменить фильтры</p>
          </td>
        </tr>
      `;
    } else {
      equipment.forEach(item => {
        const statusClass = `status-${item.status}`;
        const userInfo = item.user_name
          ? `${item.user_name} (${item.user_department || 'без отдела'})`
          : '—';

        const categoryCell = item.category_name
          ? `<span class="category-badge">${item.category_icon || '📁'} ${item.category_name}</span>`
          : '<span style="color: #a0aec0;">—</span>';

        const typeCell = item.type_name
          ? `<span class="type-badge">${item.type_icon || '📦'} ${item.type_name}</span>`
          : '<span style="color: #a0aec0;">—</span>';

        const hasLocation = !!(item.cell_id || item.workplace_id);
        let locationCell = '<span style="color: #cbd5e0;">—</span>';

        if (item.cell_id) {
          locationCell = `<div class="location-cell">
               <div class="location-path">${item.warehouse_name} → ${item.zone_name} → ${item.rack_name}</div>
               <div class="location-cell-code">${item.cell_name}${item.cell_code ? ` [${item.cell_code}]` : ''}</div>
             </div>`;
        } else if (item.workplace_id) {
          const wpLabel = `${item.workplace_name || 'Рабочее место'}${item.workplace_code ? ` [${item.workplace_code}]` : ''}`;
          const roomLabel = item.room_name ? `🚪 ${item.room_name}` : '';
          const officeLabel = item.office_name ? `🏛️ ${item.office_name}` : '';
          const hierarchy = [officeLabel, roomLabel].filter(Boolean).join(' / ');
          const link = item.office_id
            ? `/admin/workplaces/${item.office_id}?highlightWorkplace=${item.workplace_id}`
            : '#';
          locationCell = `<div class="location-cell">
               <div class="location-path">${hierarchy || 'Рабочее место'}</div>
               <a href="${link}" class="location-cell-link" onclick="event.stopPropagation()" title="Открыть в дереве офиса">
                 <span class="location-cell-code location-cell-code--workplace">🪑 ${wpLabel}</span>
               </a>
             </div>`;
        } else if (item.status === 'available') {
          locationCell = '<span class="location-cell-unplaced">⚠️ Не размещено</span>';
        }

        const statusLabels2 = {
          'available':   '✅ Доступна',
          'placed':      '🪑 На месте',
          'assigned':    '👤 Назначена',
          'maintenance': '🔧 В ремонте',
          'retired':     '❌ Списана',
        };
        const statusLabel = statusLabels2[item.status] || item.status;

        tableRows += `
          <tr onclick="viewEquipmentFromList(${item.id})" style="cursor: pointer;" title="Нажмите для просмотра">
            <td><strong>${item.inventory_number}</strong></td>
            <td>${item.model_name || '—'}</td>
            <td>${item.model_corporate_id || '—'}</td>
            <td>${categoryCell}</td>
            <td>${typeCell}</td>
            <td>${locationCell}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td>${userInfo}</td>
          </tr>
        `;
      });
    }
    html = html.replace('{{equipment_rows}}', tableRows);

    // 🆕 Пагинация
    html = html.replace('{{pagination}}', renderPagination({
      page,
      totalPages,
      totalFiltered,
      query: req.query,
    }));

    const { renderPage } = require('../utils/layout');
    res.send(renderPage({
      title: 'Учет техники — MoveIT service',
      content: html,
      pageCss: '/css/equipment.css',
      pageJs: '/js/equipment-filter.js',
    }));
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).send('Ошибка при загрузке данных');
  }
}

/**
 * 🆕 Построить пагинацию как HTML
 */
function renderPagination({ page, totalPages, totalFiltered, query }) {
  if (totalPages <= 1) {
    return `<div class="pagination"><span class="pagination-info">Всего: ${totalFiltered}</span></div>`;
  }

  const buildUrl = (p) => {
    const params = new URLSearchParams();
    // Копируем все текущие query, кроме page
    Object.entries(query || {}).forEach(([k, v]) => {
      if (k !== 'page' && v) params.set(k, v);
    });
    params.set('page', p);
    return '/equipment?' + params.toString();
  };

  let html = '<div class="pagination">';
  html += `<span class="pagination-info">Страница ${page} из ${totalPages} (всего: ${totalFiltered})</span>`;
  html += '<div class="pagination-buttons">';

  if (page > 1) {
    html += `<a href="${buildUrl(page - 1)}" class="pagination-btn">← Назад</a>`;
  }
  if (page < totalPages) {
    html += `<a href="${buildUrl(page + 1)}" class="pagination-btn">Вперёд →</a>`;
  }

  html += '</div></div>';
  return html;
}
/**
 * Экранирование HTML
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

module.exports = renderEquipmentDashboard;