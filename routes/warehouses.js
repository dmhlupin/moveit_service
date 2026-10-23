// routes/warehouses.js
// Управление складами: CRUD + иерархия

const fs = require('fs');
const path = require('path');
const {
  // Склады
  getAllWarehouses,
  getWarehouseById,
  getDefaultWarehouse,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  setDefaultWarehouse,
  // Статистика
  getWarehouseStats,
  getWarehouseTree,
  // Зоны
  getZonesByWarehouse,
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  // Стеллажи
  getRacksByZone,
  getRackById,
  createRack,
  updateRack,
  deleteRack,
  createRacksBatch,   // 🆕
  // Ячейки
  getCellsByRack,
  getCellById,
  createCell,
  updateCell,
  deleteCell,
  getCellFullPath,
  getEquipmentInCell,
  createCellsBatch,   // 🆕
  // Инвентаризация
  getInventorySummary,
  getWorkplaceSummary,       // 🆕 5.9.3
  getWarehouseInventory,
  getCellOccupancy,
  getInventoryTotals,
  getSpecialStatusSummary,  // 🆕 2.11.14
  getEquipmentByLevel,               // 🆕 5.9.5
  // Пользователи
  getUsersWithActiveEquipment,       // 🆕 5.9.4
  getUserWithDetails,                // 🆕 5.9.4
  getUserActiveEquipment,            // 🆕 5.9.4
  getUserEquipmentHistory,           // 🆕 5.9.4

} = require('../database/db');
const { logAction } = require('../utils/logger');
const { renderPageFor } = require('../utils/layout');

// ============================================================
// ХЕЛПЕРЫ
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

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-warehouses.html');
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
// API — СКЛАДЫ
// ============================================================

/**
 * GET /api/admin/warehouses — список складов
 */
async function getWarehousesAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const warehouses = await getAllWarehouses(scope);
    res.json(warehouses);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/warehouses/:id — один склад
 */
async function getWarehouseAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const warehouse = await getWarehouseById(id, scope);
    if (!warehouse) {
      // 404 — не палим существование чужого склада
      return res.status(404).json({ error: 'Склад не найден' });
    }

    res.json(warehouse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/warehouses — создать склад
 */
async function createWarehouseAPI(req, res) {
  try {
    const { name, address, description, is_default } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название склада обязательно' });
    }

    const result = await createWarehouse({
      name: name.trim(),
      address: (address || '').trim(),
      description: (description || '').trim(),
      is_default: is_default === true || is_default === 'true',
    });

    await logAction({
      req,
      action: 'warehouse_create',
      entityType: 'warehouse',
      entityId: result.id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({
      success: true,
      message: 'Склад создан',
      data: result,
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Склад с таким названием уже существует' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * PUT /api/admin/warehouses/:id — обновить склад
 */
async function updateWarehouseAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const { name, address, description, is_default, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название склада обязательно' });
    }

    const result = await updateWarehouse(id, {
      name: name.trim(),
      address: (address || '').trim(),
      description: (description || '').trim(),
      is_default: is_default === true || is_default === 'true',
      is_active: is_active !== false && is_active !== 'false',
    });

    await logAction({
      req,
      action: 'warehouse_update',
      entityType: 'warehouse',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({
      success: true,
      message: 'Склад обновлён',
      data: result,
    });
  } catch (error) {
    if (error.message === 'Склад не найден') {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Склад с таким названием уже существует' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/warehouses/:id — удалить склад
 */
async function deleteWarehouseAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const warehouse = await getWarehouseById(id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Склад не найден' });
    }

    const result = await deleteWarehouse(id);

    await logAction({
      req,
      action: 'warehouse_delete',
      entityType: 'warehouse',
      entityId: id,
      details: JSON.stringify({ name: warehouse.name }),
    });

    res.json({
      success: true,
      message: 'Склад удалён',
      data: result,
    });
  } catch (error) {
    if (error.message.includes('Нельзя удалить')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * POST /api/admin/warehouses/:id/set-default — сделать складом по умолчанию
 */
async function setDefaultWarehouseAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const warehouse = await getWarehouseById(id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Склад не найден' });
    }

    await setDefaultWarehouse(id);

    await logAction({
      req,
      action: 'warehouse_set_default',
      entityType: 'warehouse',
      entityId: id,
      details: JSON.stringify({ name: warehouse.name }),
    });

    res.json({
      success: true,
      message: `Склад "${warehouse.name}" назначен по умолчанию`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/warehouses/:id/tree — дерево склада
 */
async function getWarehouseTreeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const tree = await getWarehouseTree(id, scope);
    if (!tree || tree.length === 0) {
      return res.status(404).json({ error: 'Склад не найден' });
    }

    res.json(tree[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/warehouses/tree — дерево всех складов
 */
async function getFullTreeAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const tree = await getWarehouseTree(null, scope);
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/warehouses/stats — статистика
 */
async function getWarehouseStatsAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const stats = await getWarehouseStats(scope);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// API — ЗОНЫ
// ============================================================

/**
 * GET /api/admin/warehouses/:id/zones — зоны склада
 */
async function getZonesAPI(req, res) {
  try {
    const warehouseId = parseInt(req.params.id);
    if (isNaN(warehouseId)) {
      return res.status(400).json({ error: 'Неверный ID склада' });
    }

    // 🆕 Этап 4: проверяем доступ к складу через scope
    const scope = { userId: req.session.userId, role: req.session.role };
    const warehouse = await getWarehouseById(warehouseId, scope);
    if (!warehouse) {
      return res.status(404).json({ error: 'Склад не найден' });
    }

    const zones = await getZonesByWarehouse(warehouseId);
    res.json(zones);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/zones — создать зону
 */
async function createZoneAPI(req, res) {
  try {
    const { warehouse_id, name, description, sort_order } = req.body;

    if (!warehouse_id) {
      return res.status(400).json({ error: 'Склад обязателен' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название зоны обязательно' });
    }

    const result = await createZone({
      warehouse_id: parseInt(warehouse_id),
      name: name.trim(),
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
    });

    await logAction({
      req,
      action: 'zone_create',
      entityType: 'zone',
      entityId: result.id,
      details: JSON.stringify({ name: name.trim(), warehouse_id }),
    });

    res.json({ success: true, message: 'Зона создана', data: result });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Зона с таким названием уже существует' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
}

/**
 * PUT /api/admin/zones/:id — обновить зону
 */
async function updateZoneAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, description, sort_order, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название зоны обязательно' });
    }

    const result = await updateZone(id, {
      name: name.trim(),
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
      is_active: is_active !== false && is_active !== 'false',
    });

    await logAction({
      req,
      action: 'zone_update',
      entityType: 'zone',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({ success: true, message: 'Зона обновлена', data: result });
  } catch (error) {
    if (error.message === 'Зона не найдена') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/zones/:id — удалить зону
 */
async function deleteZoneAPI(req, res) {
  try {
    const id = parseInt(req.params.id);

    const zone = await getZoneById(id);
    if (!zone) {
      return res.status(404).json({ error: 'Зона не найдена' });
    }

    const result = await deleteZone(id);

    await logAction({
      req,
      action: 'zone_delete',
      entityType: 'zone',
      entityId: id,
      details: JSON.stringify({ name: zone.name }),
    });

    res.json({ success: true, message: 'Зона удалена', data: result });
  } catch (error) {
    if (error.message.includes('Нельзя удалить')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

// ============================================================
// API — СТЕЛЛАЖИ
// ============================================================

/**
 * GET /api/admin/zones/:id/racks — стеллажи зоны
 */
async function getRacksAPI(req, res) {
  try {
    const zoneId = parseInt(req.params.id);
    if (isNaN(zoneId)) {
      return res.status(400).json({ error: 'Неверный ID зоны' });
    }

    const racks = await getRacksByZone(zoneId);
    res.json(racks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/racks — создать стеллаж
 */
async function createRackAPI(req, res) {
  try {
    const { zone_id, name, description, sort_order, quantity, cells_count } = req.body;
    const qty = parseInt(quantity) || 1;
    const cellsCount = parseInt(cells_count) || 0;

    if (!zone_id) {
      return res.status(400).json({ error: 'Зона обязательна' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название стеллажа обязательно' });
    }

    let result;

    if (qty > 1) {
      // 🆕 Массовое создание
      const created = await createRacksBatch(
        parseInt(zone_id),
        name.trim(),
        (description || '').trim(),
        qty
      );
      result = { message: `Создано ${created.length} стеллажей`, data: created };
    } else {
      // Одиночное создание
      const created = await createRack({
        zone_id: parseInt(zone_id),
        name: name.trim(),
        description: (description || '').trim(),
        sort_order: parseInt(sort_order) || 0,
      });
      result = { message: 'Стеллаж создан', data: [created] };
    }

    // 🆕 Автоматическое создание ячеек
    if (cellsCount > 0) {
      let totalCells = 0;
      for (const rack of result.data) {
        const cells = await createCellsBatch(rack.id, rack.name, cellsCount, null);
        totalCells += cells.length;
      }
      result.message += `. Создано ${totalCells} ячеек.`;
    }

    await logAction({
      req,
      action: 'rack_create',
      entityType: 'rack',
      entityId: result.data[0]?.id || null,
      details: JSON.stringify({
        name: name.trim(),
        zone_id,
        quantity: qty,
        cells_count: cellsCount,
      }),
    });

    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Стеллаж с таким названием уже существует' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
}

/**
 * PUT /api/admin/racks/:id — обновить стеллаж
 */
async function updateRackAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, description, sort_order, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название стеллажа обязательно' });
    }

    const result = await updateRack(id, {
      name: name.trim(),
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
      is_active: is_active !== false && is_active !== 'false',
    });

    await logAction({
      req,
      action: 'rack_update',
      entityType: 'rack',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({ success: true, message: 'Стеллаж обновлён', data: result });
  } catch (error) {
    if (error.message === 'Стеллаж не найден') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/racks/:id — удалить стеллаж
 */
async function deleteRackAPI(req, res) {
  try {
    const id = parseInt(req.params.id);

    const rack = await getRackById(id);
    if (!rack) {
      return res.status(404).json({ error: 'Стеллаж не найден' });
    }

    const result = await deleteRack(id);

    await logAction({
      req,
      action: 'rack_delete',
      entityType: 'rack',
      entityId: id,
      details: JSON.stringify({ name: rack.name }),
    });

    res.json({ success: true, message: 'Стеллаж удалён', data: result });
  } catch (error) {
    if (error.message.includes('Нельзя удалить')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

// ============================================================
// API — ЯЧЕЙКИ
// ============================================================

/**
 * GET /api/admin/racks/:id/cells — ячейки стеллажа
 */
async function getCellsAPI(req, res) {
  try {
    const rackId = parseInt(req.params.id);
    if (isNaN(rackId)) {
      return res.status(400).json({ error: 'Неверный ID стеллажа' });
    }

    const cells = await getCellsByRack(rackId);
    res.json(cells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/cells/:id — одна ячейка
 */
async function getCellAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const cell = await getCellById(id);

    if (!cell) {
      return res.status(404).json({ error: 'Ячейка не найдена' });
    }

    res.json(cell);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/cells/:id/equipment — техника в ячейке
 */
async function getCellEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const equipment = await getEquipmentInCell(id);
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/cells — создать ячейку
 */
async function createCellAPI(req, res) {
  try {
    const { rack_id, name, code, capacity, description, sort_order, is_full } = req.body;

    if (!rack_id) {
      return res.status(400).json({ error: 'Стеллаж обязателен' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название ячейки обязательно' });
    }

    const result = await createCell({
      rack_id: parseInt(rack_id),
      name: name.trim(),
      code: (code || '').trim(),
      capacity: capacity ? parseInt(capacity) : null,
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
      is_full: is_full === true || is_full === 'true' || is_full === 1,
    });

    await logAction({
      req,
      action: 'cell_create',
      entityType: 'cell',
      entityId: result.id,
      details: JSON.stringify({ name: name.trim(), code, rack_id }),
    });

    res.json({ success: true, message: 'Ячейка создана', data: result });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Ячейка с таким названием уже существует' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
}

/**
 * GET /api/admin/racks/:id/next-cell
 * Возвращает { next_name, next_code } для автозаполнения.
 */
async function getNextCellNumberAPI(req, res) {
    try {
        const rackId = parseInt(req.params.id);
        if (isNaN(rackId)) {
            return res.status(400).json({ error: 'Неверный ID стеллажа' });
        }

        // Получаем стеллаж и его название
        const rack = await getRackById(rackId);
        if (!rack) {
            return res.status(404).json({ error: 'Стеллаж не найден' });
        }

        // Получаем все ячейки стеллажа
        const cells = await getCellsByRack(rackId);

        // Следующий номер: N + 1, где N — максимальный существующий
        const nextNum = cells.length + 1;

        // Название: "Ячейка N"
        const nextName = `Ячейка ${nextNum}`;

        // Код: если стеллаж "Стеллаж А-04" или "Тумбочка А-04" → "А-04-01"
        // Извлекаем часть после пробела (последний токен), например "А-04"
        let rackCode = '';
        if (rack.name) {
            const parts = rack.name.trim().split(/\s+/);
            rackCode = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        }

        let nextCode = '';
        if (rackCode) {
            nextCode = `${rackCode}-${String(nextNum).padStart(2, '0')}`;
        }

        res.json({
            next_name: nextName,
            next_code: nextCode,
            current_count: cells.length,
        });
    } catch (error) {
        console.error('❌ Ошибка получения следующего номера:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * PUT /api/admin/cells/:id — обновить ячейку
 */
async function updateCellAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, code, capacity, description, sort_order, is_active, is_full } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название ячейки обязательно' });
    }

    const result = await updateCell(id, {
      name: name.trim(),
      code: (code || '').trim(),
      capacity: capacity ? parseInt(capacity) : null,
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
      is_active: is_active !== false && is_active !== 'false',
      is_full: is_full === true || is_full === 'true' || is_full === 1,
    });

    await logAction({
      req,
      action: 'cell_update',
      entityType: 'cell',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({ success: true, message: 'Ячейка обновлена', data: result });
  } catch (error) {
    if (error.message === 'Ячейка не найдена') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/cells/:id — удалить ячейку
 */
async function deleteCellAPI(req, res) {
  try {
    const id = parseInt(req.params.id);

    const cell = await getCellById(id);
    if (!cell) {
      return res.status(404).json({ error: 'Ячейка не найдена' });
    }

    const result = await deleteCell(id);

    await logAction({
      req,
      action: 'cell_delete',
      entityType: 'cell',
      entityId: id,
      details: JSON.stringify({ name: cell.name, code: cell.code }),
    });

    res.json({ success: true, message: 'Ячейка удалена', data: result });
  } catch (error) {
    if (error.message.includes('Нельзя удалить')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
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

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-warehouse-details.html');
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

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-inventory.html');
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

/**
 * GET /api/admin/inventory/summary — сводка по складам
 */
async function getInventorySummaryAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const summary = await getInventorySummary(scope);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/inventory/totals — общие итоги
 */
async function getInventoryTotalsAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const totals = await getInventoryTotals(scope);
    res.json(totals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/inventory/special — сводка по maintenance/retired
 * (виртуальные склады: ремонт и списание)
 */
async function getSpecialStatusSummaryAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const summary = await getSpecialStatusSummary(scope);
    res.json(summary);
  } catch (error) {
    console.error('❌ Ошибка сводки maintenance/retired:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/inventory/offices-summary — сводка по офисам (5.9.3)
 */
async function getInventoryOfficesSummaryAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const summary = await getWorkplaceSummary(scope);
    res.json(summary);
  } catch (error) {
    console.error('❌ Ошибка сводки по офисам:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/inventory/users-summary — сводка по пользователям (5.9.4)
 * Только пользователи с активной техникой; для МОЛа — только с его техникой.
 */
async function getInventoryUsersSummaryAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const rows = await getUsersWithActiveEquipment(scope);
    res.json(rows);
  } catch (error) {
    console.error('❌ Ошибка сводки по пользователям:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/inventory/users/:id/details — детали пользователя для инвентаризации (5.9.4).
 * Для МОЛа — только его техника (activeEquipment + history с его responsible_user_id).
 */
async function getInventoryUserDetailsAPI(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const user = await getUserWithDetails(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    let activeEquipment = await getUserActiveEquipment(id);
    let history = await getUserEquipmentHistory(id);

    if (req.session.role === 'mol') {
      const uid = parseInt(req.session.userId, 10) || 0;
      activeEquipment = activeEquipment.filter(eq => Number(eq.responsible_user_id) === uid);
      history = history.filter(h => Number(h.responsible_user_id) === uid);
    }

    const stats = {
      active: activeEquipment.length,
      total: history.length,
      returned: history.filter(h => h.returned_date).length,
    };

    delete user.password_hash;
    res.json({ user, stats, activeEquipment, history: history.slice(0, 30) });
  } catch (error) {
    console.error('❌ Ошибка деталей пользователя (инвентаризация):', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/inventory/by-level?level=warehouse|office|user&id=N
 *     &zone_id=&rack_id=&cell_id=&room_id=&workplace_id=
 * 5.9.6: углубление — техника на уровне зоны / стеллажа / ячейки / кабинета / места.
 */
async function getInventoryByLevelAPI(req, res) {
  try {
    const level = String(req.query.level || '').toLowerCase();
    const id = parseInt(req.query.id, 10);

    if (!['warehouse', 'office', 'user'].includes(level)) {
      return res.status(400).json({ error: 'Неверный уровень (warehouse / office / user)' });
    }
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const sub = {
      zone_id:      req.query.zone_id      ? parseInt(req.query.zone_id, 10)      : null,
      rack_id:      req.query.rack_id      ? parseInt(req.query.rack_id, 10)      : null,
      cell_id:      req.query.cell_id      ? parseInt(req.query.cell_id, 10)      : null,
      room_id:      req.query.room_id      ? parseInt(req.query.room_id, 10)      : null,
      workplace_id: req.query.workplace_id ? parseInt(req.query.workplace_id, 10) : null,
    };

    const scope = { userId: req.session.userId, role: req.session.role };
    const rows = await getEquipmentByLevel(level, id, scope, sub);
    res.json(rows);
  } catch (error) {
    console.error('❌ Ошибка выборки по уровню:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/warehouses/:id/inventory — техника на складе
 */
async function getWarehouseInventoryAPI(req, res) {
  try {
    const warehouseId = parseInt(req.params.id);
    if (isNaN(warehouseId)) {
      return res.status(400).json({ error: 'Неверный ID склада' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const inventory = await getWarehouseInventory(warehouseId, scope);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/warehouses/:id/occupancy — заполненность ячеек
 */
async function getCellOccupancyAPI(req, res) {
  try {
    const warehouseId = parseInt(req.params.id);
    if (isNaN(warehouseId)) {
      return res.status(400).json({ error: 'Неверный ID склада' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const occupancy = await getCellOccupancy(warehouseId, scope);
    res.json(occupancy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/warehouses/:id/inventory/export — экспорт в CSV
 */
async function exportInventoryCSV(req, res) {
  try {
    const warehouseId = parseInt(req.params.id);
    if (isNaN(warehouseId)) {
      return res.status(400).send('Неверный ID склада');
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const warehouse = await getWarehouseById(warehouseId, scope);
    if (!warehouse) {
      return res.status(404).send('Склад не найден');
    }

    const inventory = await getWarehouseInventory(warehouseId, scope);
    // Формируем CSV
    const lines = [];

    // BOM для Excel (UTF-8)
    lines.push('\uFEFF');

    // Заголовок
    lines.push('Инвентаризация: ' + warehouse.name);
    lines.push('Адрес: ' + (warehouse.address || '—'));
    lines.push('Дата: ' + new Date().toLocaleString('ru-RU'));
    lines.push('');

    // Шапка таблицы
    lines.push([
      'Инв. номер',
      'Модель',
      'Корп. ИД',
      'Производитель',
      'Категория',
      'Тип',
      'Место хранения',
      'Статус',
      'Ответственный МОЛ'
    ].join(';'));

    // Данные
    inventory.forEach(eq => {
      const location = eq.cell_code 
        ? `${eq.zone_name} / ${eq.rack_name} / ${eq.cell_name} [${eq.cell_code}]`
        : `${eq.zone_name} / ${eq.rack_name} / ${eq.cell_name}`;

      lines.push([
        eq.inventory_number,
        eq.model_name || '',
        eq.model_corporate_id || '',
        eq.model_manufacturer || '',
        eq.category_name || '',
        eq.type_name || '',
        location,
        eq.status,
        eq.responsible_user_name || '—'
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    });

    lines.push('');
    lines.push(`Всего единиц: ${inventory.length}`);

    const csv = lines.join('\n');

    // Отправляем
    const filename = `inventory-${warehouseId}-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('❌ Ошибка экспорта:', error);
    res.status(500).send('Ошибка экспорта');
  }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

module.exports = {
  // Страницы
  renderWarehouses,
  renderWarehouseDetails,

  // API складов
  getWarehousesAPI,
  getWarehouseAPI,
  createWarehouseAPI,
  updateWarehouseAPI,
  deleteWarehouseAPI,
  setDefaultWarehouseAPI,

  // Дерево и статистика
  getWarehouseTreeAPI,
  getFullTreeAPI,
  getWarehouseStatsAPI,

  // API зон
  getZonesAPI,
  createZoneAPI,
  updateZoneAPI,
  deleteZoneAPI,

  // API стеллажей
  getRacksAPI,
  createRackAPI,
  updateRackAPI,
  deleteRackAPI,

  // API ячеек
  getCellsAPI,
  getCellAPI,
  getCellEquipmentAPI,
  createCellAPI,
  getNextCellNumberAPI,   // 🆕
  updateCellAPI,
  deleteCellAPI,

  // Инвентаризация
  renderInventory,
  getInventorySummaryAPI,
  getInventoryTotalsAPI,
  getSpecialStatusSummaryAPI,  // 🆕 2.11.14
  getInventoryOfficesSummaryAPI,   // 🆕 5.9.3
  getInventoryUsersSummaryAPI,       // 🆕 5.9.4
  getWarehouseInventoryAPI,
  getCellOccupancyAPI,
  exportInventoryCSV,
  getInventoryUserDetailsAPI,
  getInventoryByLevelAPI,            // 🆕 5.9.5
};