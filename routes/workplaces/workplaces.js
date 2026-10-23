const {
  getWorkplacesByRoom,
  getWorkplaceById,
  getNextWorkplaceNumber,
  createWorkplace,
  updateWorkplace,
  deleteWorkplace,
  getWorkplaceEquipment,
  moveEquipmentToWorkplace,
  getEquipmentById,
} = require('../../database/db');

const {
  canEditEquipment,
  canMoveEquipmentTo,
} = require('../../utils/permissions');

const { logAction } = require('../../utils/logger');

// ============================================================
// API — РАБОЧИЕ МЕСТА
// ============================================================

/**
 * GET /api/admin/rooms/:id/workplaces — рабочие места кабинета
 */
async function getWorkplacesAPI(req, res) {
  try {
    const roomId = parseInt(req.params.id);
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Неверный ID кабинета' });
    }

    const workplaces = await getWorkplacesByRoom(roomId);
    res.json(workplaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * 🆕 5.0.2.1: GET /api/admin/rooms/:id/next-workplace
 * Возвращает { next_name, next_code, current_count } для автозаполнения.
 */
async function getNextWorkplaceNumberAPI(req, res) {
  try {
    const roomId = parseInt(req.params.id);
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Неверный ID кабинета' });
    }

    const data = await getNextWorkplaceNumber(roomId);
    res.json(data);
  } catch (error) {
    console.error('❌ Ошибка получения следующего номера места:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/workplaces/:id — одно рабочее место
 */
async function getWorkplaceAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const workplace = await getWorkplaceById(id);
    if (!workplace) {
      return res.status(404).json({ error: 'Рабочее место не найдено' });
    }

    res.json(workplace);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/workplaces — создать рабочее место
 */
async function createWorkplaceAPI(req, res) {
  try {
    const { room_id, name, code, description, sort_order } = req.body;

    if (!room_id) {
      return res.status(400).json({ error: 'Кабинет обязателен' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название рабочего места обязательно' });
    }

    const result = await createWorkplace({
      room_id: parseInt(room_id),
      name: name.trim(),
      code: (code || '').trim(),
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
    });

    await logAction({
      req,
      action: 'workplace_create',
      entityType: 'workplace',
      entityId: result.id,
      details: JSON.stringify({ name: name.trim(), code, room_id }),
    });

    res.json({ success: true, message: 'Рабочее место создано', data: result });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Рабочее место с таким названием уже существует' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
}

/**
 * PUT /api/admin/workplaces/:id — обновить рабочее место
 */
async function updateWorkplaceAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, code, description, sort_order, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название рабочего места обязательно' });
    }

    const result = await updateWorkplace(id, {
      name: name.trim(),
      code: (code || '').trim(),
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
      is_active: is_active !== false && is_active !== 'false',
    });

    await logAction({
      req,
      action: 'workplace_update',
      entityType: 'workplace',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({ success: true, message: 'Рабочее место обновлено', data: result });
  } catch (error) {
    if (error.message === 'Рабочее место не найдено') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/workplaces/:id — удалить рабочее место
 */
async function deleteWorkplaceAPI(req, res) {
  try {
    const id = parseInt(req.params.id);

    const workplace = await getWorkplaceById(id);
    if (!workplace) {
      return res.status(404).json({ error: 'Рабочее место не найдено' });
    }

    const result = await deleteWorkplace(id);

    await logAction({
      req,
      action: 'workplace_delete',
      entityType: 'workplace',
      entityId: id,
      details: JSON.stringify({ name: workplace.name, code: workplace.code }),
    });

    res.json({ success: true, message: 'Рабочее место удалено', data: result });
  } catch (error) {
    if (error.message.includes('Нельзя удалить')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

// ============================================================
// API — ТЕХНИКА НА РАБОЧЕМ МЕСТЕ
// ============================================================

/**
 * GET /api/admin/workplaces/:id/equipment — техника на рабочем месте
 */
async function getWorkplaceEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const equipment = await getWorkplaceEquipment(id, scope);
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/workplaces/:id/move-equipment
 * Тело: { equipment_id }
 *
 * Перемещает технику на рабочее место. Единая логика с /api/manage/equipment/:id/move-to-workplace.
 */
async function moveEquipmentToWorkplaceAPI(req, res) {
  try {
    const workplaceId = parseInt(req.params.id);
    if (isNaN(workplaceId)) {
      return res.status(400).json({ error: 'Неверный ID рабочего места' });
    }

    const { equipment_id } = req.body;
    if (!equipment_id) {
      return res.status(400).json({ error: 'equipment_id обязателен' });
    }
    const equipmentId = parseInt(equipment_id, 10);

    const equipment = await getEquipmentById(equipmentId);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canEditEquipment(userForPerm, equipmentId))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    if (equipment.status === 'assigned') {
      return res.status(400).json({
        error: 'Нельзя переместить назначенную технику. Сначала верните её.',
      });
    }

    // 5.0.6: проверка доступности целевого офиса для МОЛа
    const targetCheck = await canMoveEquipmentTo(
      userForPerm,
      equipment,
      { type: 'workplace', id: workplaceId }
    );
    if (!targetCheck.ok) {
      return res.status(400).json({ error: targetCheck.reason });
    }

    const result = await moveEquipmentToWorkplace(equipmentId, workplaceId);

    await logAction({
      req,
      action: 'equipment_move',
      entityType: 'equipment',
      entityId: equipmentId,
      details: JSON.stringify({
        inventory_number: result.inventory_number || equipment.inventory_number,
        model_name: result.model_name || equipment.model_name,
        from_workplace_id: result.old_workplace_id,
        to_workplace_id: result.new_workplace_id,
        from_cell_id: result.old_cell_id,
      }),
    });

    res.json({
      success: true,
      message: '✅ Техника перемещена на рабочее место',
      data: result,
    });
  } catch (error) {
    console.error('❌ Ошибка перемещения на место:', error);
    if (error.message.includes('не найдено') || error.message.includes('не найдена')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = {
  getWorkplacesAPI,
  getWorkplaceAPI,
  getNextWorkplaceNumberAPI,
  createWorkplaceAPI,
  updateWorkplaceAPI,
  deleteWorkplaceAPI,
  getWorkplaceEquipmentAPI,
  moveEquipmentToWorkplaceAPI,
};