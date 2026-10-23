const {
  getRacksByZone,
  createRack,
  createRacksBatch,       // массовое создание (5.0.1.2)
  createCellsBatch,       // автосоздание ячеек при создании стеллажа
  getRackById,
  updateRack,
  deleteRack,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');

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

module.exports = {
  getRacksAPI,
  createRackAPI,
  updateRackAPI,
  deleteRackAPI,
};