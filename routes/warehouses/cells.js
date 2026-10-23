const {
  getCellsByRack,
  getCellById,
  getEquipmentInCell,
  createCell,
  getRackById,            // для getNextCellNumberAPI
  updateCell,
  deleteCell,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');

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

module.exports = {
  getCellsAPI,
  getCellAPI,
  getCellEquipmentAPI,
  createCellAPI,
  getNextCellNumberAPI,
  updateCellAPI,
  deleteCellAPI,
};