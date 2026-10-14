// routes/admin-responsibles.js
// ============================================================
// API управления МОЛ (Этап 4).
//
// Все роуты — только для роли admin (см. server.js).
// Функции:
//   - привязка/отвязка МОЛ к складам;
//   - привязка/отвязка МОЛ к офисам;
//   - назначение ответственного за конкретный экземпляр техники.
// ============================================================

const { db, run, get, all, getUserById } = require('../database/db');
const { logAction } = require('../utils/logger');

// ------------------------------------------------------------
// СКЛАДЫ: ответственные МОЛ
// ------------------------------------------------------------

/**
 * GET /api/admin/warehouses/:id/responsibles
 * Список МОЛ, ответственных за склад.
 */
async function getWarehouseResponsiblesAPI(req, res) {
  try {
    const warehouseId = parseInt(req.params.id, 10);
    if (isNaN(warehouseId)) {
      return res.status(400).json({ error: 'Неверный ID склада' });
    }

    const rows = await all(`
      SELECT
        wr.id,
        wr.user_id,
        wr.created_at,
        u.username,
        u.full_name,
        u.department
      FROM warehouse_responsibles wr
      JOIN users u ON u.id = wr.user_id
      WHERE wr.warehouse_id = ?
      ORDER BY u.full_name ASC
    `, [warehouseId]);

    res.json(rows);
  } catch (error) {
    console.error('❌ Ошибка получения ответственных за склад:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/warehouses/:id/responsibles
 * Body: { user_id }
 * Назначить пользователя ответственным за склад.
 * Пользователь должен существовать и иметь роль mol.
 */
async function addWarehouseResponsibleAPI(req, res) {
  try {
    const warehouseId = parseInt(req.params.id, 10);
    const userId = parseInt(req.body.user_id, 10);

    if (isNaN(warehouseId) || isNaN(userId)) {
      return res.status(400).json({ error: 'Неверные ID' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (user.role !== 'mol') {
      return res.status(400).json({ error: 'Пользователь не имеет роли МОЛ' });
    }

    const warehouse = await get('SELECT id, name FROM warehouses WHERE id = ?', [warehouseId]);
    if (!warehouse) {
      return res.status(404).json({ error: 'Склад не найден' });
    }

    // INSERT OR IGNORE — UNIQUE(warehouse_id, user_id) не даст дубликат
    const result = await run(`
      INSERT OR IGNORE INTO warehouse_responsibles (warehouse_id, user_id)
      VALUES (?, ?)
    `, [warehouseId, userId]);

    if (result.changes === 0) {
      return res.status(200).json({ success: true, message: 'Уже назначен', already: true });
    }

    await logAction({
      req,
      action: 'warehouse_responsible_add',
      entityType: 'warehouse',
      entityId: warehouseId,
      details: JSON.stringify({ user_id: userId, user_name: user.full_name || user.username }),
    });

    res.json({ success: true, message: 'МОЛ назначен' });
  } catch (error) {
    console.error('❌ Ошибка назначения МОЛ на склад:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * DELETE /api/admin/warehouses/:id/responsibles/:userId
 * Снять пользователя с ответственности за склад.
 */
async function removeWarehouseResponsibleAPI(req, res) {
  try {
    const warehouseId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(warehouseId) || isNaN(userId)) {
      return res.status(400).json({ error: 'Неверные ID' });
    }

    const result = await run(`
      DELETE FROM warehouse_responsibles
      WHERE warehouse_id = ? AND user_id = ?
    `, [warehouseId, userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Связка не найдена' });
    }

    await logAction({
      req,
      action: 'warehouse_responsible_remove',
      entityType: 'warehouse',
      entityId: warehouseId,
      details: JSON.stringify({ user_id: userId }),
    });

    res.json({ success: true, message: 'МОЛ снят' });
  } catch (error) {
    console.error('❌ Ошибка снятия МОЛ со склада:', error);
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// ОФИСЫ: ответственные МОЛ
// ------------------------------------------------------------

async function getOfficeResponsiblesAPI(req, res) {
  try {
    const officeId = parseInt(req.params.id, 10);
    if (isNaN(officeId)) {
      return res.status(400).json({ error: 'Неверный ID офиса' });
    }

    const rows = await all(`
      SELECT
        orr.id,
        orr.user_id,
        orr.created_at,
        u.username,
        u.full_name,
        u.department
      FROM office_responsibles orr
      JOIN users u ON u.id = orr.user_id
      WHERE orr.office_id = ?
      ORDER BY u.full_name ASC
    `, [officeId]);

    res.json(rows);
  } catch (error) {
    console.error('❌ Ошибка получения ответственных за офис:', error);
    res.status(500).json({ error: error.message });
  }
}

async function addOfficeResponsibleAPI(req, res) {
  try {
    const officeId = parseInt(req.params.id, 10);
    const userId = parseInt(req.body.user_id, 10);

    if (isNaN(officeId) || isNaN(userId)) {
      return res.status(400).json({ error: 'Неверные ID' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (user.role !== 'mol') {
      return res.status(400).json({ error: 'Пользователь не имеет роли МОЛ' });
    }

    const office = await get('SELECT id, name FROM offices WHERE id = ?', [officeId]);
    if (!office) {
      return res.status(404).json({ error: 'Офис не найден' });
    }

    const result = await run(`
      INSERT OR IGNORE INTO office_responsibles (office_id, user_id)
      VALUES (?, ?)
    `, [officeId, userId]);

    if (result.changes === 0) {
      return res.status(200).json({ success: true, message: 'Уже назначен', already: true });
    }

    await logAction({
      req,
      action: 'office_responsible_add',
      entityType: 'office',
      entityId: officeId,
      details: JSON.stringify({ user_id: userId, user_name: user.full_name || user.username }),
    });

    res.json({ success: true, message: 'МОЛ назначен' });
  } catch (error) {
    console.error('❌ Ошибка назначения МОЛ на офис:', error);
    res.status(500).json({ error: error.message });
  }
}

async function removeOfficeResponsibleAPI(req, res) {
  try {
    const officeId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(officeId) || isNaN(userId)) {
      return res.status(400).json({ error: 'Неверные ID' });
    }

    const result = await run(`
      DELETE FROM office_responsibles
      WHERE office_id = ? AND user_id = ?
    `, [officeId, userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Связка не найдена' });
    }

    await logAction({
      req,
      action: 'office_responsible_remove',
      entityType: 'office',
      entityId: officeId,
      details: JSON.stringify({ user_id: userId }),
    });

    res.json({ success: true, message: 'МОЛ снят' });
  } catch (error) {
    console.error('❌ Ошибка снятия МОЛ с офиса:', error);
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// ТЕХНИКА: ответственный МОЛ
// ------------------------------------------------------------

/**
 * GET /api/admin/equipment/:id/responsible
 * Текущий ответственный МОЛ за экземпляр.
 */
async function getEquipmentResponsibleAPI(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const row = await get(`
      SELECT
        e.id,
        e.responsible_user_id,
        u.username,
        u.full_name,
        u.department
      FROM equipment e
      LEFT JOIN users u ON u.id = e.responsible_user_id
      WHERE e.id = ?
    `, [id]);

    if (!row) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    res.json(row);
  } catch (error) {
    console.error('❌ Ошибка получения ответственного МОЛ:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/equipment/:id/responsible
 * Body: { user_id }  (user_id = null → снять ответственного)
 */
async function setEquipmentResponsibleAPI(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const equipment = await get('SELECT id FROM equipment WHERE id = ?', [id]);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const rawUserId = req.body.user_id;
    const userId = rawUserId ? parseInt(rawUserId, 10) : null;

    if (userId) {
      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      if (user.role !== 'mol') {
        return res.status(400).json({ error: 'Пользователь не имеет роли МОЛ' });
      }
    }

    await run(`
      UPDATE equipment
      SET responsible_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId, id]);

    await logAction({
      req,
      action: 'equipment_responsible_set',
      entityType: 'equipment',
      entityId: id,
      details: JSON.stringify({ user_id: userId }),
    });

    res.json({ success: true, message: userId ? 'Ответственный назначен' : 'Ответственный снят' });
  } catch (error) {
    console.error('❌ Ошибка назначения ответственного:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getWarehouseResponsiblesAPI,
  addWarehouseResponsibleAPI,
  removeWarehouseResponsibleAPI,
  getOfficeResponsiblesAPI,
  addOfficeResponsibleAPI,
  removeOfficeResponsibleAPI,
  getEquipmentResponsibleAPI,
  setEquipmentResponsibleAPI,
};