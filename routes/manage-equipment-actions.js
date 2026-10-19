// routes/manage-equipment-actions.js
// API для действий с техникой из карточки:
// смена статуса, назначение, возврат, перемещение на место.

const {
  getEquipmentById,
  updateEquipment,
  assignEquipment,
  returnEquipmentByEquipmentId,
  checkCellAvailability,
} = require('../database/db');

const { canEditEquipment } = require('../utils/permissions');
const { logAction } = require('../utils/logger');

// ============================================================
// API — СМЕНА СТАТУСА
// ============================================================

/**
 * POST /api/manage/equipment/:id/status
 * Тело: { status: 'maintenance' | 'retired' | 'available' }
 *
 * Условия:
 * - maintenance / retired — только из available + cell_id (на складе).
 * - available — только из maintenance / retired + cell_id (возврат в эксплуатацию).
 */
async function changeEquipmentStatusAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }

    const { status } = req.body;
    const allowed = ['maintenance', 'retired', 'available'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    const equipment = await getEquipmentById(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canEditEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const oldStatus = equipment.status;

    if (status === 'maintenance' || status === 'retired') {
      if (oldStatus !== 'available') {
        return res.status(400).json({
          error: `В статус "${status}" можно перевести только из "Доступна"`,
        });
      }
      if (!equipment.cell_id) {
        return res.status(400).json({
          error: 'Сначала разместите технику на складе',
        });
      }
    }

    if (status === 'available') {
      if (oldStatus !== 'maintenance' && oldStatus !== 'retired') {
        return res.status(400).json({
          error: 'Вернуть в эксплуатацию можно только из "В ремонте" или "Списана"',
        });
      }
      if (!equipment.cell_id) {
        return res.status(400).json({
          error: 'Сначала разместите технику на складе',
        });
      }
    }

    await updateEquipment(id, {
      model_id: equipment.model_id,
      inventory_number: equipment.inventory_number,
      serial_number: equipment.serial_number,
      status: status,
      description: equipment.description,
      purchase_date: equipment.purchase_date,
      warranty_until: equipment.warranty_until,
      cell_id: equipment.cell_id,
      workplace_id: null,
      responsible_user_id: undefined,
    });

    const statusNames = {
      maintenance: 'В ремонте',
      retired: 'Списана',
      available: 'Доступна',
    };

    await logAction({
      req,
      action: 'equipment_update',
      entityType: 'equipment',
      entityId: id,
      details: JSON.stringify({
        inventory_number: equipment.inventory_number,
        status_changed: true,
        old_status: oldStatus,
        new_status: status,
      }),
    });

    res.json({
      success: true,
      message: `✅ Статус изменён на «${statusNames[status]}»`,
      data: { id, status },
    });
  } catch (error) {
    console.error('❌ Ошибка смены статуса:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// API — НАЗНАЧЕНИЕ ПОЛЬЗОВАТЕЛЮ
// ============================================================

async function assignEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }

    const { user_id, condition } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'Выберите пользователя' });
    }

    const equipment = await getEquipmentById(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canEditEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    if (equipment.status !== 'available') {
      return res.status(400).json({
        error: 'Назначить можно только доступную технику',
      });
    }

    if (!equipment.cell_id) {
      return res.status(400).json({
        error: 'Сначала разместите технику на складе',
      });
    }

    const result = await assignEquipment(
      parseInt(user_id, 10),
      id,
      condition || 'В хорошем состоянии',
      'Назначено через карточку техники'
    );

    await logAction({
      req,
      action: 'equipment_assign',
      entityType: 'equipment',
      entityId: id,
      details: JSON.stringify({
        inventory_number: equipment.inventory_number,
        user_id: parseInt(user_id, 10),
      }),
    });

    res.json({
      success: true,
      message: '✅ Техника назначена пользователю',
      data: result,
    });
  } catch (error) {
    console.error('❌ Ошибка назначения:', error);
    if (error.message.includes('не найден') || error.message.includes('заблокирован')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

// ============================================================
// API — ВОЗВРАТ ОТ ПОЛЬЗОВАТЕЛЯ
// ============================================================

async function returnEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }

    const { cell_id, condition } = req.body;
    if (!cell_id) {
      return res.status(400).json({ error: 'Выберите ячейку склада для возврата' });
    }

    const equipment = await getEquipmentById(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canEditEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    if (equipment.status !== 'assigned') {
      return res.status(400).json({
        error: 'Вернуть можно только назначенную технику',
      });
    }

    const check = await checkCellAvailability(parseInt(cell_id, 10), id);
    if (!check.ok) {
      if (check.reason === 'cell_not_found') {
        return res.status(400).json({ error: 'Ячейка не найдена' });
      }
      if (check.reason === 'is_full') {
        return res.status(400).json({ error: `Ячейка ${check.label} отмечена как заполненная` });
      }
      if (check.reason === 'over_capacity') {
        return res.status(400).json({
          error: `Ячейка ${check.label} переполнена (${check.cell.current_count}/${check.cell.capacity})`,
        });
      }
      return res.status(400).json({ error: `Ячейка недоступна (${check.reason})` });
    }

    await returnEquipmentByEquipmentId(id, condition || 'В хорошем состоянии', 'Возврат через карточку');

    await updateEquipment(id, {
      model_id: equipment.model_id,
      inventory_number: equipment.inventory_number,
      serial_number: equipment.serial_number,
      status: 'available',
      description: equipment.description,
      purchase_date: equipment.purchase_date,
      warranty_until: equipment.warranty_until,
      cell_id: parseInt(cell_id, 10),
      workplace_id: null,
      responsible_user_id: undefined,
    });

    await logAction({
      req,
      action: 'equipment_return',
      entityType: 'equipment',
      entityId: id,
      details: JSON.stringify({
        inventory_number: equipment.inventory_number,
        to_cell_id: parseInt(cell_id, 10),
      }),
    });

    res.json({
      success: true,
      message: '✅ Техника возвращена на склад',
      data: { id, cell_id: parseInt(cell_id, 10) },
    });
  } catch (error) {
    console.error('❌ Ошибка возврата:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// API — ПЕРЕМЕЩЕНИЕ НА РАБОЧЕЕ МЕСТО
// ============================================================

async function moveToWorkplaceFromCardAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }

    const { workplace_id } = req.body;
    if (!workplace_id) {
      return res.status(400).json({ error: 'Выберите рабочее место' });
    }

    const equipment = await getEquipmentById(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canEditEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    if (equipment.status === 'assigned') {
      return res.status(400).json({
        error: 'Нельзя переместить назначенную технику. Сначала верните её.',
      });
    }

    await updateEquipment(id, {
      model_id: equipment.model_id,
      inventory_number: equipment.inventory_number,
      serial_number: equipment.serial_number,
      status: 'placed',
      description: equipment.description,
      purchase_date: equipment.purchase_date,
      warranty_until: equipment.warranty_until,
      cell_id: null,
      workplace_id: parseInt(workplace_id, 10),
      responsible_user_id: undefined,
    });

    await logAction({
      req,
      action: 'equipment_move',
      entityType: 'equipment',
      entityId: id,
      details: JSON.stringify({
        inventory_number: equipment.inventory_number,
        to_workplace_id: parseInt(workplace_id, 10),
      }),
    });

    res.json({
      success: true,
      message: '✅ Техника перемещена на рабочее место',
      data: { id, workplace_id: parseInt(workplace_id, 10) },
    });
  } catch (error) {
    console.error('❌ Ошибка перемещения на место:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

module.exports = {
  changeEquipmentStatusAPI,
  assignEquipmentAPI,
  returnEquipmentAPI,
  moveToWorkplaceFromCardAPI,   // ← переименовали
};