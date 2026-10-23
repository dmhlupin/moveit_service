const {
  // Склады / инвентаризация
  getWarehouseById,
  getInventorySummary,
  getInventoryTotals,
  getSpecialStatusSummary,
  getWarehouseInventory,
  getCellOccupancy,

  // Офисы (5.9.3)
  getWorkplaceSummary,

  // Пользователи (5.9.4)
  getUsersWithActiveEquipment,
  getUserWithDetails,
  getUserActiveEquipment,
  getUserEquipmentHistory,

  // Выборка по уровню (5.9.5 / 5.9.6)
  getEquipmentByLevel,
} = require('../../database/db');

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

module.exports = {
  getInventorySummaryAPI,
  getInventoryTotalsAPI,
  getSpecialStatusSummaryAPI,
  getInventoryOfficesSummaryAPI,
  getInventoryUsersSummaryAPI,
  getWarehouseInventoryAPI,
  getCellOccupancyAPI,
  exportInventoryCSV,
  getInventoryUserDetailsAPI,
  getInventoryByLevelAPI,
};