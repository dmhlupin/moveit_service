const {
  getOfficeById,
  getRoomsByOffice,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');

// ============================================================
// API — КАБИНЕТЫ
// ============================================================

/**
 * GET /api/admin/offices/:id/rooms — кабинеты офиса
 */
async function getRoomsAPI(req, res) {
  try {
    const officeId = parseInt(req.params.id);
    if (isNaN(officeId)) {
      return res.status(400).json({ error: 'Неверный ID офиса' });
    }

    // 🆕 Этап 4: проверяем доступ к офису через scope
    const scope = { userId: req.session.userId, role: req.session.role };
    const office = await getOfficeById(officeId, scope);
    if (!office) {
      return res.status(404).json({ error: 'Офис не найден' });
    }

    const rooms = await getRoomsByOffice(officeId);
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/rooms — создать кабинет
 */
async function createRoomAPI(req, res) {
  try {
    const { office_id, name, description, sort_order } = req.body;

    if (!office_id) {
      return res.status(400).json({ error: 'Офис обязателен' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название кабинета обязательно' });
    }

    const result = await createRoom({
      office_id: parseInt(office_id),
      name: name.trim(),
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
    });

    await logAction({
      req,
      action: 'room_create',
      entityType: 'room',
      entityId: result.id,
      details: JSON.stringify({ name: name.trim(), office_id }),
    });

    res.json({ success: true, message: 'Кабинет создан', data: result });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Кабинет с таким названием уже существует' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
}

/**
 * PUT /api/admin/rooms/:id — обновить кабинет
 */
async function updateRoomAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, description, sort_order, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название кабинета обязательно' });
    }

    const result = await updateRoom(id, {
      name: name.trim(),
      description: (description || '').trim(),
      sort_order: parseInt(sort_order) || 0,
      is_active: is_active !== false && is_active !== 'false',
    });

    await logAction({
      req,
      action: 'room_update',
      entityType: 'room',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({ success: true, message: 'Кабинет обновлён', data: result });
  } catch (error) {
    if (error.message === 'Кабинет не найден') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/rooms/:id — удалить кабинет
 */
async function deleteRoomAPI(req, res) {
  try {
    const id = parseInt(req.params.id);

    const room = await getRoomById(id);
    if (!room) {
      return res.status(404).json({ error: 'Кабинет не найден' });
    }

    const result = await deleteRoom(id);

    await logAction({
      req,
      action: 'room_delete',
      entityType: 'room',
      entityId: id,
      details: JSON.stringify({ name: room.name }),
    });

    res.json({ success: true, message: 'Кабинет удалён', data: result });
  } catch (error) {
    if (error.message.includes('Нельзя удалить')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = {
  getRoomsAPI,
  createRoomAPI,
  updateRoomAPI,
  deleteRoomAPI,
};