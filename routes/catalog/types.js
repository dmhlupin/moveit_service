const {
  getAllTypes,
  getTypeById,
  createType,
  updateType,
  deleteType,
  reorderTypes,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');

// ============================================================
// API — ТИПЫ
// ============================================================

/**
 * GET /api/admin/types — список типов
 * Поддерживает фильтр ?category_id=
 */
async function getTypesAPI(req, res) {
  try {
    const categoryId = req.query.category_id ? parseInt(req.query.category_id) : null;
    const types = await getAllTypes(categoryId);
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/types/:id — один тип
 */
async function getTypeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }
    
    const type = await getTypeById(id);
    if (!type) {
      return res.status(404).json({ error: 'Тип не найден' });
    }
    
    res.json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/types — создать тип
 */
async function createTypeAPI(req, res) {
  try {
    const { category_id, name, description, icon, sort_order } = req.body;
    
    if (!category_id) {
      return res.status(400).json({ error: 'Категория обязательна' });
    }
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название типа обязательно' });
    }
    
    const result = await createType({
      category_id: parseInt(category_id),
      name: name.trim(),
      description: (description || '').trim(),
      icon: (icon || '').trim(),
      sort_order: parseInt(sort_order) || 0,
    });
    
    await logAction({
      req,
      action: 'type_create',
      entityType: 'type',
      entityId: result.id,
      details: JSON.stringify({ name: name.trim(), category_id }),
    });
    
    res.json({
      success: true,
      message: 'Тип создан',
      data: result,
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Тип с таким названием уже есть в категории' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
}

/**
 * PUT /api/admin/types/:id — обновить тип
 */
async function updateTypeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }
    
    const { category_id, name, description, icon, sort_order, is_active } = req.body;
    
    if (!category_id) {
      return res.status(400).json({ error: 'Категория обязательна' });
    }
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название типа обязательно' });
    }
    
    const result = await updateType(id, {
      category_id: parseInt(category_id),
      name: name.trim(),
      description: (description || '').trim(),
      icon: (icon || '').trim(),
      sort_order: parseInt(sort_order) || 0,
      is_active: is_active !== undefined ? is_active : true,
    });
    
    await logAction({
      req,
      action: 'type_update',
      entityType: 'type',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });
    
    res.json({
      success: true,
      message: 'Тип обновлён',
      data: result,
    });
  } catch (error) {
    if (error.message === 'Тип не найден') {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Тип с таким названием уже есть' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/types/:id — удалить тип
 */
async function deleteTypeAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }
    
    const type = await getTypeById(id);
    if (!type) {
      return res.status(404).json({ error: 'Тип не найден' });
    }
    
    const result = await deleteType(id);
    
    await logAction({
      req,
      action: 'type_delete',
      entityType: 'type',
      entityId: id,
      details: JSON.stringify({ name: type.name }),
    });
    
    res.json({
      success: true,
      message: 'Тип удалён',
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
 * POST /api/admin/types/reorder — изменить порядок
 */
async function reorderTypesAPI(req, res) {
  try {
    const { order } = req.body;
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Ожидается массив order' });
    }
    
    const result = await reorderTypes(order);
    
    await logAction({
      req,
      action: 'types_reorder',
      details: JSON.stringify({ count: order.length }),
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getTypesAPI,
  getTypeAPI,
  createTypeAPI,
  updateTypeAPI,
  deleteTypeAPI,
  reorderTypesAPI,
};