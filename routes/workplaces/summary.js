const {
  getOfficeById,
  getFullWorkplaceTree,
  getOfficeTree,
  getWorkplaceStats,
  getWorkplaceSummary,
  getOfficeEquipment,
  getWorkplaceOccupancy,
} = require('../../database/db');

const { renderPageFor } = require('../../utils/layout');  // если понадобится

// ============================================================
// API — ДЕРЕВО И СТАТИСТИКА
// ============================================================

/**
 * GET /api/admin/offices/tree — дерево всех офисов
 */
async function getFullWorkplaceTreeAPI(req, res) {
  try {
    // 🆕 Этап 4: scope — МОЛ видит только свои офисы
    const scope = { userId: req.session.userId, role: req.session.role };
    const tree = await getFullWorkplaceTree(scope);
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/offices/:id/tree — дерево одного офиса
 */
async function getOfficeTreeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const tree = await getOfficeTree(id, scope);
    if (!tree) {
      return res.status(404).json({ error: 'Офис не найден' });
    }

    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/workplaces/stats — общая статистика
 */
async function getWorkplaceStatsAPI(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const stats = await getWorkplaceStats(scope);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/workplaces/summary — сводка по офисам (для страницы)
 */
async function getWorkplaceSummaryAPI(req, res) {
  try {
    // 🆕 Этап 4: scope — МОЛ видит только свои офисы
    const scope = { userId: req.session.userId, role: req.session.role };
    const summary = await getWorkplaceSummary(scope);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// API — СВОДКА И ЭКСПОРТ
// ============================================================

/**
 * GET /api/admin/offices/:id/equipment — техника офиса
 */
async function getOfficeEquipmentAPI(req, res) {
  try {
    const officeId = parseInt(req.params.id);
    if (isNaN(officeId)) {
      return res.status(400).json({ error: 'Неверный ID офиса' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const equipment = await getOfficeEquipment(officeId, scope);
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/offices/:id/occupancy — заполненность рабочих мест офиса
 */
async function getWorkplaceOccupancyAPI(req, res) {
  try {
    const officeId = parseInt(req.params.id);
    if (isNaN(officeId)) {
      return res.status(400).json({ error: 'Неверный ID офиса' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const occupancy = await getWorkplaceOccupancy(officeId, scope);
    res.json(occupancy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/offices/:id/equipment/export — экспорт техники офиса в CSV
 */
async function exportOfficeInventoryCSV(req, res) {
  try {
    const officeId = parseInt(req.params.id);
    if (isNaN(officeId)) {
      return res.status(400).send('Неверный ID офиса');
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const office = await getOfficeById(officeId, scope);
    if (!office) {
      return res.status(404).send('Офис не найден');
    }

    const equipment = await getOfficeEquipment(officeId, scope);

    // Формируем CSV
    const lines = [];

    // BOM для Excel (UTF-8)
    lines.push('\uFEFF');

    // Заголовок
    lines.push('Инвентаризация: ' + office.name);
    lines.push('Адрес: ' + (office.address || '—'));
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
      'Расположение',
      'Статус',
      'Ответственный МОЛ'
    ].join(';'));

    // Данные
    equipment.forEach(eq => {
      const location = eq.workplace_code
        ? `${eq.office_name} / ${eq.room_name} / ${eq.workplace_name} [${eq.workplace_code}]`
        : `${eq.office_name} / ${eq.room_name} / ${eq.workplace_name}`;

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
    lines.push(`Всего единиц: ${equipment.length}`);

    const csv = lines.join('\n');

    // Отправляем
    const filename = `office-inventory-${officeId}-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('❌ Ошибка экспорта:', error);
    res.status(500).send('Ошибка экспорта');
  }
}

module.exports = {
  getFullWorkplaceTreeAPI,
  getOfficeTreeAPI,
  getWorkplaceStatsAPI,
  getWorkplaceSummaryAPI,
  getOfficeEquipmentAPI,
  getWorkplaceOccupancyAPI,
  exportOfficeInventoryCSV,
};