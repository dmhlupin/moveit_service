const {
  getWarehouseById,      // проверка scope в getZonesAPI
  getZonesByWarehouse,
  createZone,
  updateZone,
  getZoneById,
  deleteZone,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');

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

module.exports = {
  getZonesAPI,
  createZoneAPI,
  updateZoneAPI,
  deleteZoneAPI,
};