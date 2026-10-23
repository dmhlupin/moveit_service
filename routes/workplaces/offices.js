const {
  getAllOffices,
  getOfficeById,
  createOffice,
  updateOffice,
  deleteOffice,
  setDefaultOffice,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');

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

module.exports = {
  getOfficesAPI,
  getOfficeAPI,
  createOfficeAPI,
  updateOfficeAPI,
  deleteOfficeAPI,
  setDefaultOfficeAPI,
};