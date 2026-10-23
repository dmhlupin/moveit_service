const fs = require('fs');
const path = require('path');

const {
  getWarehouseStats,     // renderWarehouses
  getWarehouseById,      // renderWarehouseDetails
  getInventoryTotals,    // renderInventory
} = require('../../database/db');

const { renderPageFor } = require('../../utils/layout');
const { escapeHtml } = require('./helpers');

// ============================================================
// СТРАНИЦА
// ============================================================

/**
 * GET /admin/warehouses — страница управления складами
 */
async function renderWarehouses(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const stats = await getWarehouseStats(scope);

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-warehouses.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // Статистика
    content = content.replace(/\{\{total_warehouses\}\}/g, stats.total_warehouses || 0);
    content = content.replace(/\{\{total_zones\}\}/g, stats.total_zones || 0);
    content = content.replace(/\{\{total_racks\}\}/g, stats.total_racks || 0);
    content = content.replace(/\{\{total_cells\}\}/g, stats.total_cells || 0);
    content = content.replace(/\{\{equipment_on_stock\}\}/g, stats.equipment_on_stock || 0);

    renderPageFor(req, res, {
      title: 'Склады – MoveIT service',
      content,
      pageCss: '/css/warehouses.css',
      pageJs: '/js/warehouses.js',
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки складов:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

// ============================================================
// СТРАНИЦА ДЕТАЛЕЙ СКЛАДА
// ============================================================

/**
 * GET /admin/warehouses/:id — страница деталей склада
 */
async function renderWarehouseDetails(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).send('Неверный ID склада');
    }

    const warehouse = await getWarehouseById(id);
    if (!warehouse) {
      return res.status(404).send('Склад не найден');
    }

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-warehouse-details.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // Данные склада (name и description — через escapeHtml, чтобы
    // исключить XSS через пользовательский ввод)
    content = content.replace(/\{\{warehouse\.id\}\}/g, warehouse.id);
    content = content.replace(/\{\{warehouse\.name\}\}/g, escapeHtml(warehouse.name));
    content = content.replace(/\{\{warehouse\.description\}\}/g, escapeHtml(warehouse.description));
    // 🆕 Этап 4: роль — чтобы показать блок «Ответственные МОЛ» только админу
    content = content.replace(/\{\{current_role\}\}/g, req.session.role || 'user');

    renderPageFor(req, res, {
      title: `${warehouse.name} – MoveIT service`,
      content,
      pageCss: '/css/warehouse-details.css',
      pageJs: [
        '/js/equipment-view.js',
        '/js/warehouse-details.js',
      ],
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки склада:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

// ============================================================
// API — ИНВЕНТАРИЗАЦИЯ
// ============================================================

/**
 * GET /admin/inventory — страница инвентаризации
 */
async function renderInventory(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const totals = await getInventoryTotals(scope);

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-inventory.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // Общие итоги
    content = content.replace(/\{\{totals\.total_warehouses\}\}/g, totals.total_warehouses || 0);
    content = content.replace(/\{\{totals\.total_zones\}\}/g, totals.total_zones || 0);
    content = content.replace(/\{\{totals\.total_racks\}\}/g, totals.total_racks || 0);
    content = content.replace(/\{\{totals\.total_cells\}\}/g, totals.total_cells || 0);
    content = content.replace(/\{\{totals\.equipment_on_stock\}\}/g, totals.equipment_on_stock || 0);
    content = content.replace(/\{\{totals\.equipment_assigned\}\}/g, totals.equipment_assigned || 0);
    
    content = content.replace(/\{\{current_role\}\}/g, req.session.role || 'user');
    content = content.replace(/\{\{current_user_id\}\}/g, req.session.userId || 0);

    renderPageFor(req, res, {
      title: 'Инвентаризация – MoveIT service',
      content,
      pageCss: '/css/inventory.css',
      pageJs: [
        '/js/equipment-card/loader.js',
        '/js/equipment-card/render.js',
        '/js/equipment-card/actions.js',
        '/js/equipment-card/modals.js',
        '/js/equipment-card/index.js',
        '/js/inventory.js',
      ],
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки инвентаризации:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

module.exports = {
  renderWarehouses,
  renderWarehouseDetails,
  renderInventory,
};