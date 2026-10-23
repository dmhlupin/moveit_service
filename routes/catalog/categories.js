const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');

// ============================================================
// API — КАТЕГОРИИ
// ============================================================

/**
 * GET /api/admin/categories — список всех категорий
 */
async function getCategoriesAPI(req, res) {
  try {
    const categories = await getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/categories/:id — одна категория
 */
async function getCategoryAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }
    
    const category = await getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/categories — создать категорию
 */
async function createCategoryAPI(req, res) {
  try {
    const { name, description, icon, sort_order } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название категории обязательно' });
    }
    
    const result = await createCategory({
      name: name.trim(),
      description: (description || '').trim(),
      icon: (icon || '').trim(),
      sort_order: parseInt(sort_order) || 0,
    });
    
    await logAction({
      req,
      action: 'category_create',
      entityType: 'category',
      entityId: result.id,
      details: JSON.stringify({ name: name.trim() }),
    });
    
    res.json({
      success: true,
      message: 'Категория создана',
      data: result,
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Категория с таким названием уже существует' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * PUT /api/admin/categories/:id — обновить категорию
 */
async function updateCategoryAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }
    
    const { name, description, icon, sort_order, is_active } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название категории обязательно' });
    }
    
    const result = await updateCategory(id, {
      name: name.trim(),
      description: (description || '').trim(),
      icon: (icon || '').trim(),
      sort_order: parseInt(sort_order) || 0,
      is_active: is_active !== undefined ? is_active : true,
    });
    
    await logAction({
      req,
      action: 'category_update',
      entityType: 'category',
      entityId: id,
      details: JSON.stringify({ name: name.trim() }),
    });
    
    res.json({
      success: true,
      message: 'Категория обновлена',
      data: result,
    });
  } catch (error) {
    if (error.message === 'Категория не найдена') {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Категория с таким названием уже существует' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * DELETE /api/admin/categories/:id — удалить категорию
 */
async function deleteCategoryAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }
    
    const category = await getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    
    const result = await deleteCategory(id);
    
    await logAction({
      req,
      action: 'category_delete',
      entityType: 'category',
      entityId: id,
      details: JSON.stringify({ name: category.name }),
    });
    
    res.json({
      success: true,
      message: 'Категория удалена',
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
 * POST /api/admin/categories/reorder — изменить порядок
 */
async function reorderCategoriesAPI(req, res) {
  try {
    const { order } = req.body;
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Ожидается массив order' });
    }
    
    const result = await reorderCategories(order);
    
    await logAction({
      req,
      action: 'categories_reorder',
      details: JSON.stringify({ count: order.length }),
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getCategoriesAPI,
  getCategoryAPI,
  createCategoryAPI,
  updateCategoryAPI,
  deleteCategoryAPI,
  reorderCategoriesAPI,
};