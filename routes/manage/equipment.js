// routes/manage/equipment.js
// API для техники: CRUD + детали + перемещение в ячейку.
// Действия из карточки (смена статуса, назначение, возврат,
// перемещение на место, bulk-move) — в routes/manage-equipment-actions.js.

const {
  getAllEquipment,
  getEquipmentById,
  getEquipmentWithLocation,
  addEquipment,
  updateEquipment,
  deleteEquipment,
  assignEquipment,
  returnEquipmentByEquipmentId,
  moveEquipmentToCellDetailed,
  getEquipmentMoves,
  checkCellAvailability,
  getEquipmentHistory,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');
const {
  canAccessEquipment,
  canEditEquipment,
  canMoveEquipmentTo,
} = require('../../utils/permissions');

// ============================================================
// CRUD
// ============================================================

async function getEquipmentAPI(req, res) {
  try {
    const equipment = await getAllEquipment();
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getEquipmentByIdAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const equipment = await getEquipmentById(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getEquipmentDetailsAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const equipment = await getEquipmentById(id, scope);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canAccessEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const history = await getEquipmentHistory(id);

    const activeAssignment = history.find(h => h.status === 'active');

    const stats = {
      total: history.length,
      active: activeAssignment ? 1 : 0,
      returned: history.filter(h => h.status === 'returned').length,
      current_user: activeAssignment ? {
        id: activeAssignment.user_id,
        full_name: activeAssignment.full_name,
        username: activeAssignment.username,
        department: activeAssignment.department,
        email: activeAssignment.email,
        assigned_date: activeAssignment.assigned_date,
        condition_on_assign: activeAssignment.condition_on_assign,
      } : null,
    };

    let location = { type: 'none' };
    if (activeAssignment) {
      location = { type: 'user', user: stats.current_user };
    } else if (equipment.workplace_id) {
      location = {
        type: 'workplace',
        workplace_id: equipment.workplace_id,
        workplace_name: equipment.workplace_name,
        workplace_code: equipment.workplace_code,
        room_id: equipment.room_id,
        room_name: equipment.room_name,
        office_id: equipment.office_id,
        office_name: equipment.office_name,
      };
    } else if (equipment.cell_id) {
      location = {
        type: 'cell',
        cell_id: equipment.cell_id,
        cell_name: equipment.cell_name,
        cell_code: equipment.cell_code,
        rack_name: equipment.rack_name,
        zone_name: equipment.zone_name,
        warehouse_id: equipment.warehouse_id,
        warehouse_name: equipment.warehouse_name,
      };
    }

    res.json({ equipment, stats, location, history });
  } catch (error) {
    console.error('❌ Ошибка получения деталей техники:', error);
    res.status(500).json({ error: error.message });
  }
}

async function addEquipmentAPI(req, res) {
  try {
    const {
      model_id, inventory_number, serial_number, status,
      description, purchase_date, warranty_until, cell_id, workplace_id,
    } = req.body;

    if (!model_id) {
      return res.status(400).json({ error: 'Модель ТМЦ обязательна' });
    }

    let responsibleUserId = null;
    if (req.session.role === 'mol') {
      responsibleUserId = req.session.userId;
    } else if (req.body.responsible_user_id) {
      responsibleUserId = parseInt(req.body.responsible_user_id, 10);
    }

    const result = await addEquipment({
      model_id: parseInt(model_id, 10),
      inventory_number: inventory_number || null,
      serial_number: serial_number || null,
      status: status || 'available',
      description: description || null,
      purchase_date: purchase_date || null,
      warranty_until: warranty_until || null,
      cell_id: cell_id ? parseInt(cell_id, 10) : null,
      workplace_id: workplace_id ? parseInt(workplace_id, 10) : null,
      responsible_user_id: responsibleUserId,
    });

    await logAction({
      req,
      action: 'equipment_create',
      entityType: 'equipment',
      entityId: result.id,
      details: JSON.stringify({
        inventory_number: inventory_number || null,
        model_id: parseInt(model_id, 10),
      }),
    });

    res.json({ success: true, message: 'Техника добавлена успешно', data: result });
  } catch (error) {
    if (error.message.includes('уже используется')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('Модель не найдена')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Инвентарный или серийный номер уже используется' });
    }
    console.error('❌ Ошибка создания техники:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const {
      model_id, inventory_number, serial_number, status, description,
      purchase_date, warranty_until, cell_id, workplace_id,
      assign_user_id, assign_condition, responsible_user_id,
    } = req.body;

    if (!model_id) {
      return res.status(400).json({ error: 'Модель ТМЦ обязательна' });
    }

    const existing = await getEquipmentById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (!(await canEditEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const oldStatus = existing.status;
    const oldResponsibleId = existing.responsible_user_id;

    let finalResponsibleId = undefined;
    if (req.session.role === 'admin') {
      finalResponsibleId = responsible_user_id ? parseInt(responsible_user_id, 10) : null;
    } else if (req.session.role === 'mol') {
      finalResponsibleId = req.session.userId;
    }

    let finalCellId = cell_id ? parseInt(cell_id, 10) : null;
    let finalWorkplaceId = workplace_id ? parseInt(workplace_id, 10) : null;

    if (finalWorkplaceId) finalCellId = null;
    if (finalCellId) finalWorkplaceId = null;

    if (status === 'assigned') {
      finalCellId = null;
      finalWorkplaceId = null;
    }
    if (status === 'maintenance' || status === 'retired') {
      finalWorkplaceId = null;
    }

    let finalStatus = status || 'available';
    if (finalStatus === 'placed' && !finalWorkplaceId) {
      finalStatus = 'available';
    } else if (finalStatus === 'available' && finalWorkplaceId) {
      finalStatus = 'placed';
    }

    if (finalCellId && finalCellId !== existing.cell_id) {
      const result = await checkCellAvailability(finalCellId, id);
      if (!result.ok) {
        if (result.reason === 'cell_not_found') {
          return res.status(400).json({ error: 'Ячейка не найдена' });
        }
        if (result.reason === 'is_full') {
          return res.status(400).json({ error: `Ячейка ${result.label} отмечена как заполненная` });
        }
        if (result.reason === 'over_capacity') {
          return res.status(400).json({
            error: `Ячейка ${result.label} переполнена (${result.cell.current_count}/${result.cell.capacity})`,
          });
        }
        return res.status(400).json({ error: `Ячейка недоступна (${result.reason})` });
      }
    }

    // 🆕 5.0.7: проверка доступности склада / офиса для МОЛа
    const finalMolId = (finalResponsibleId !== undefined) ? finalResponsibleId : existing.responsible_user_id;
    const molChanged = (finalResponsibleId !== undefined) && (finalResponsibleId !== existing.responsible_user_id);
    const cellChanged = finalCellId !== existing.cell_id;
    const wpChanged = finalWorkplaceId !== existing.workplace_id;

    if (finalMolId && (molChanged || cellChanged || wpChanged)) {
      if (finalCellId) {
        const targetCheck = await canMoveEquipmentTo(
          userForPerm, { responsible_user_id: finalMolId }, { type: 'cell', id: finalCellId }
        );
        if (!targetCheck.ok) {
          return res.status(400).json({ error: targetCheck.reason || 'Склад недоступен для выбранного МОЛа' });
        }
      }
      if (finalWorkplaceId) {
        const targetCheck = await canMoveEquipmentTo(
          userForPerm, { responsible_user_id: finalMolId }, { type: 'workplace', id: finalWorkplaceId }
        );
        if (!targetCheck.ok) {
          return res.status(400).json({ error: targetCheck.reason || 'Офис недоступен для выбранного МОЛа' });
        }
      }
    }

    let assignmentResult = null;
    if (status === 'assigned' && assign_user_id) {
      if (oldStatus === 'assigned') {
        try {
          await returnEquipmentByEquipmentId(id, 'Возвращена при переназначении', 'Автовозврат: переназначение');
        } catch (error) {
          console.warn('⚠️ Не удалось вернуть технику перед переназначением:', error.message);
        }
      }
      try {
        assignmentResult = await assignEquipment(
          parseInt(assign_user_id, 10), id,
          assign_condition || 'В хорошем состоянии',
          'Назначено через редактирование техники',
          req.session.userId
        );
        await logAction({
          req, action: 'equipment_assign', entityType: 'equipment', entityId: id,
          details: JSON.stringify({ inventory_number: inventory_number || null, user_id: assign_user_id }),
        });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    const willAutoReturn = oldStatus === 'assigned' && finalStatus !== 'assigned';
    if (willAutoReturn) {
      try {
        await returnEquipmentByEquipmentId(id, 'Возвращена при смене статуса', 'Автовозврат: смена статуса');
      } catch (error) {
        console.warn('⚠️ Не удалось вернуть технику перед сменой статуса:', error.message);
      }
    }

    const result = await updateEquipment(id, {
      model_id: parseInt(model_id, 10),
      inventory_number: inventory_number || null,
      serial_number: serial_number || null,
      status: finalStatus,
      description: description || null,
      purchase_date: purchase_date || null,
      warranty_until: warranty_until || null,
      cell_id: finalCellId,
      workplace_id: finalWorkplaceId,
      responsible_user_id: finalResponsibleId,
    });

    if (willAutoReturn) {
      await logAction({
        req, action: 'equipment_return', entityType: 'equipment', entityId: id,
        details: JSON.stringify({ inventory_number: inventory_number || null }),
      });
    }

    await logAction({
      req, action: 'equipment_update', entityType: 'equipment', entityId: id,
      details: JSON.stringify({
        inventory_number: inventory_number || null,
        status_changed: oldStatus !== finalStatus,
        responsible_changed: oldResponsibleId !== finalResponsibleId,
      }),
    });

    res.json({
      success: true,
      message: 'Техника обновлена успешно',
      data: result,
      assignment: assignmentResult,
      returned: willAutoReturn,
    });
  } catch (error) {
    console.error('❌ Ошибка обновления:', error);
    if (error.message === 'Техника не найдена') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('уже используется')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('Модель не найдена')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
}

async function deleteEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const userForPerm = { id: req.session.userId, role: req.session.role };

    if (!(await canEditEquipment(userForPerm, id))) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    const result = await deleteEquipment(id);
    if (result.deleted === 0) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }

    await logAction({ req, action: 'equipment_delete', entityType: 'equipment', entityId: id });
    res.json({ success: true, message: 'Техника удалена успешно' });
  } catch (error) {
    if (error.message.includes('назначена пользователю')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

// ============================================================
// ПЕРЕМЕЩЕНИЕ В ЯЧЕЙКУ
// ============================================================

async function moveEquipmentAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }

    const { cell_id, notes } = req.body;

    const equipment = await getEquipmentById(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Техника не найдена' });
    }
    if (equipment.status === 'assigned') {
      return res.status(400).json({ error: 'Нельзя переместить назначенную технику. Сначала верните её.' });
    }

    const userForPerm = { id: req.session.userId, role: req.session.role };
    if (cell_id) {
      const targetCheck = await canMoveEquipmentTo(userForPerm, equipment, {
        type: 'cell', id: parseInt(cell_id, 10),
      });
      if (!targetCheck.ok) {
        return res.status(400).json({ error: targetCheck.reason });
      }
    }

    const result = await moveEquipmentToCellDetailed(
      id, cell_id ? parseInt(cell_id) : null,
      req.session.userId, req.session.username
    );

    if (result.already_there) {
      return res.json({ success: true, message: 'Техника уже в этой ячейке', data: result });
    }

    await logAction({
      req, action: 'equipment_move', entityType: 'equipment', entityId: id,
      details: JSON.stringify({
        inventory_number: result.inventory_number,
        model_name: result.model_name,
        from_cell: result.from_cell_code || result.from_cell_name || null,
        to_cell: result.to_cell_code || result.to_cell_name || null,
        to_warehouse: result.to_warehouse_name || null,
        to_zone: result.to_zone_name || null,
        to_rack: result.to_rack_name || null,
        notes: notes || null,
      }),
    });

    let message = '✅ Техника перемещена';
    if (result.from_cell_code && result.to_cell_code) {
      message = `✅ Перемещено из ${result.from_cell_code} в ${result.to_cell_code}`;
    } else if (!result.from_cell_code && result.to_cell_code) {
      message = `✅ Техника размещена в ${result.to_cell_code}`;
    } else if (result.from_cell_code && !result.to_cell_code) {
      message = `✅ Техника убрана из ячейки ${result.from_cell_code}`;
    }

    res.json({ success: true, message, data: result });
  } catch (error) {
    console.error('❌ Ошибка перемещения:', error);
    if (error.message.includes('переполнена') ||
        error.message.includes('Нельзя переместить') ||
        error.message.includes('не найдена')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

async function getEquipmentMovesAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID техники' });
    }
    const moves = await getEquipmentMoves(id);
    res.json(moves);
  } catch (error) {
    console.error('❌ Ошибка получения истории:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getEquipmentAPI,
  getEquipmentByIdAPI,
  getEquipmentDetailsAPI,
  addEquipmentAPI,
  updateEquipmentAPI,
  deleteEquipmentAPI,
  moveEquipmentAPI,
  getEquipmentMovesAPI,
};