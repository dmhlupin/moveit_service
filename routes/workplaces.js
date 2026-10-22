// routes/workplaces.js
// Управление рабочими местами: CRUD + иерархия офис → кабинет → место

const fs = require('fs');
const path = require('path');
const {
  // Офисы
  getAllOffices,
  getOfficeById,
  getDefaultOffice,
  createOffice,
  updateOffice,
  deleteOffice,
  setDefaultOffice,
  // Кабинеты
  getRoomsByOffice,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  // Рабочие места
  getWorkplacesByRoom,
  getWorkplaceById,
  createWorkplace,
  updateWorkplace,
  deleteWorkplace,
  getNextWorkplaceNumber,
  // Дерево и техника
  getOfficeTree,
  getFullWorkplaceTree,
  getWorkplaceEquipment,
  moveEquipmentToWorkplace,
  getEquipmentById,            // 🆕
  // Статистика и сводка
  getWorkplaceStats,
  getWorkplaceSummary,
  getOfficeEquipment,
  getWorkplaceOccupancy,
} = require('../database/db');

const {
  canEditEquipment,            // 🆕
  canMoveEquipmentTo,          // 🆕
} = require('../utils/permissions');

const { logAction } = require('../utils/logger');
const { renderPageFor } = require('../utils/layout');

// ============================================================
// ХЕЛПЕРЫ
// ============================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// СТРАНИЦЫ
// ============================================================

/**
 * GET /admin/workplaces — страница управления офисами
 */
async function renderWorkplaces(req, res) {
  try {
    const stats = await getWorkplaceStats();

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-workplaces.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // Статистика
    content = content.replace(/\{\{total_offices\}\}/g, stats.total_offices || 0);
    content = content.replace(/\{\{total_rooms\}\}/g, stats.total_rooms || 0);
    content = content.replace(/\{\{total_workplaces\}\}/g, stats.total_workplaces || 0);
    content = content.replace(/\{\{equipment_on_workplaces\}\}/g, stats.equipment_on_workplaces || 0);
    content = content.replace(/\{\{equipment_unassigned\}\}/g, stats.equipment_unassigned || 0);

    renderPageFor(req, res, {
      title: 'Рабочие места – MoveIT service',
      content,
      pageCss: '/css/workplaces.css',
      pageJs: '/js/workplaces.js',
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки рабочих мест:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

/**
 * GET /admin/workplaces/:id — страница деталей офиса (дерево)
 */
async function renderWorkplaceDetails(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).send('Неверный ID офиса');
    }

    const office = await getOfficeById(id);
    if (!office) {
      return res.status(404).send('Офис не найден');
    }

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-workplace-details.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // Данные офиса (name и description — через escapeHtml, чтобы
    // исключить XSS через пользовательский ввод)
    content = content.replace(/\{\{office\.id\}\}/g, office.id);
    content = content.replace(/\{\{office\.name\}\}/g, escapeHtml(office.name));
    content = content.replace(/\{\{office\.description\}\}/g, escapeHtml(office.description));

    // 🆕 Этап 4: роль — чтобы показать блок «Ответственные МОЛ» только админу
    content = content.replace(/\{\{current_role\}\}/g, req.session.role || 'user');

    renderPageFor(req, res, {
      title: `${office.name} – MoveIT service`,
      content,
      pageCss: '/css/workplace-details.css',
      pageJs: '/js/workplace-details.js',
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки офиса:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

// ============================================================
// API — ОФИСЫ
// ============================================================

/**
 * GET /api/admin/offices — список офисов
 */
async function getOfficesAPI(req, res) {
  try {
    // 🆕 Этап 4: scope — МОЛ видит только свои офисы
    const scope = { userId: req.session.userId, role: req.session.role };
    const offices = await getAllOffices(scope);
    res.json(offices);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/offices/:id — один офис
 */
async function getOfficeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const scope = { userId: req.session.userId, role: req.session.role };
    const office = await getOfficeById(id, scope);
    if (!office) {
      // 404 — не палим существование чужого офиса
      return res.status(404).json({ error: 'Офис не найден' });
    }

    res.json(office);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/offices — создать офис
 */
async function createOfficeAPI(req, res) {
  try {
    const { name, address, description, is_default } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название офиса обязательно' });
    }

    const result = await createOffice({
      name: name.trim(),
      address: (address || '').trim(),
      description: (description || '').trim(),
      is_default: is_default === true || is_default === 'true',
    });

    await logAction({
      req,
      action: 'office_create',
      entityType: 'office',
      entityId: result.id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({
      success: true,
      message: 'Офис создан',
      data: result,
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Офис с таким названием уже существует' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * PUT /api/admin/offices/:id — обновить офис
 */
async function updateOfficeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const { name, address, description, is_default, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название офиса обязательно' });
    }

    const result = await updateOffice(id, {
      name: name.trim(),
      address: (address || '').trim(),
      description: (description || '').trim(),
      is_default: is_default === true || is_default === 'true',
      is_active: is_active !== false && is_active !== 'false',
    });

    await logAction({
      req,
      action: 'office_update',
      entityType: 'office',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });

    res.json({
      success: true,
      message: 'Офис обновлён',
      data: result,
    });
  } catch (error) {
    if (error.message === 'Офис не найден') {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Офис с таким названием уже существует' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/offices/:id — удалить офис
 */
async function deleteOfficeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const office = await getOfficeById(id);
    if (!office) {
      return res.status(404).json({ error: 'Офис не найден' });
    }

    const result = await deleteOffice(id);

    await logAction({
      req,
      action: 'office_delete',
      entityType: 'office',
      entityId: id,
      details: JSON.stringify({ name: office.name }),
    });

    res.json({
      success: true,
      message: 'Офис удалён',
      data: result,
    });
  } catch (error) {
    if (error.message.includes('Нельзя удалить')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * POST /api/admin/offices/:id/set-default — сделать офисом по умолчанию
 */
async function setDefaultOfficeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const office = await getOfficeById(id);
    if (!office) {
      return res.status(404).json({ error: 'Офис не найден' });
    }

    await setDefaultOffice(id);

    await logAction({
      req,
      action: 'office_set_default',
      entityType: 'office',
      entityId: id,
      details: JSON.stringify({ name: office.name }),
    });

    res.json({
      success: true,
      message: `Офис "${office.name}" назначен по умолчанию`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

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
    const stats = await getWorkplaceStats();
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

    const equipment = await getWorkplaceEquipment(id);
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

    const equipment = await getOfficeEquipment(officeId);
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

    const occupancy = await getWorkplaceOccupancy(officeId);
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

    const office = await getOfficeById(officeId);
    if (!office) {
      return res.status(404).send('Офис не найден');
    }

    const equipment = await getOfficeEquipment(officeId);

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
      'Название',
      'Модель',
      'Производитель',
      'Категория',
      'Тип',
      'Расположение',
      'Статус'
    ].join(';'));

    // Данные
    equipment.forEach(eq => {
      const location = eq.workplace_code
        ? `${eq.office_name} / ${eq.room_name} / ${eq.workplace_name} [${eq.workplace_code}]`
        : `${eq.office_name} / ${eq.room_name} / ${eq.workplace_name}`;

      lines.push([
        eq.inventory_number,
        eq.name,
        eq.model || '',
        eq.manufacturer || '',
        eq.category_name || '',
        eq.type_name || '',
        location,
        eq.status
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

// ============================================================
// ЭКСПОРТ
// ============================================================

module.exports = {
  // Страницы
  renderWorkplaces,
  renderWorkplaceDetails,

  // API офисов
  getOfficesAPI,
  getOfficeAPI,
  createOfficeAPI,
  updateOfficeAPI,
  deleteOfficeAPI,
  setDefaultOfficeAPI,

  // API дерева и статистики
  getFullWorkplaceTreeAPI,
  getOfficeTreeAPI,
  getWorkplaceStatsAPI,
  getWorkplaceSummaryAPI,

  // API кабинетов
  getRoomsAPI,
  createRoomAPI,
  updateRoomAPI,
  deleteRoomAPI,

  // API рабочих мест
  getWorkplacesAPI,
  getWorkplaceAPI,
  getNextWorkplaceNumberAPI,  // 🆕
  createWorkplaceAPI,
  updateWorkplaceAPI,
  deleteWorkplaceAPI,

  // API техники
  getWorkplaceEquipmentAPI,
  moveEquipmentToWorkplaceAPI,

  // Сводка и экспорт
  getOfficeEquipmentAPI,
  getWorkplaceOccupancyAPI,
  exportOfficeInventoryCSV,
};