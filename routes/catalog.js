// routes/catalog.js
// Справочник техники: управление категориями и типами

const fs = require('fs');
const path = require('path');
const {
  // Категории
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  // Типы
  getAllTypes,
  getTypeById,
  createType,
  updateType,
  deleteType,
  reorderTypes,
  // 🆕 Для фильтра техники
  getEquipmentWithLocation,
  getEquipmentCountsByCategory,
  getEquipmentCountsByType,
} = require('../database/db');
const { logAction } = require('../utils/logger');
const { renderPageFor } = require('../utils/layout');

// ============================================================
// СТРАНИЦА
// ============================================================

/**
 * GET /admin/catalog — страница справочника техники
 */
async function renderCatalog(req, res) {
  try {
    // Загружаем данные только для статистики
    const [categories, types] = await Promise.all([
      getAllCategories(),
      getAllTypes(),
    ]);

    const totalCategories = categories.length;
    const totalTypes = types.length;
    const totalEquipment = types.reduce((sum, t) => sum + (t.equipment_count || 0), 0);

    const htmlPath = path.join(__dirname, '..', 'views', 'admin-catalog.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    content = content.replace(/\{\{total_categories\}\}/g, totalCategories);
    content = content.replace(/\{\{total_types\}\}/g, totalTypes);
    content = content.replace(/\{\{total_equipment\}\}/g, totalEquipment);

    renderPageFor(req, res, {
      title: 'Справочник техники – MoveIT service',
      content,
      pageCss: '/css/catalog.css',
      pageJs: '/js/catalog.js',
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки справочника:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

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

// ============================================================
// API — ТЕХНИКА В КАТЕГОРИИ/ТИПЕ
// ============================================================

/**
 * GET /api/admin/equipment/filtered
 * Возвращает технику с фильтром по category_id/type_id + пагинация
 * 
 * Query params:
 *   ?category_id=X — фильтр по категории
 *   ?type_id=Y — фильтр по типу
 *   ?search=Z — поиск по номеру/названию/модели
 *   ?page=1 — номер страницы (по умолчанию 1)
 *   ?limit=20 — элементов на странице (по умолчанию 20, макс 100)
 */
async function getFilteredEquipmentAPI(req, res) {
  try {
    const category_id = req.query.category_id ? parseInt(req.query.category_id) : null;
    const type_id = req.query.type_id ? parseInt(req.query.type_id) : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    
    const result = await getEquipmentWithLocation({
      category_id,
      type_id,
      search,
      limit,
      offset,
      include_total: true,
    });

    const totalPages = Math.ceil((result.total || 0) / limit);

    res.json({
      items: result.items || [],
      total: result.total || 0,
      page,
      limit,
      totalPages,
      filters: { category_id, type_id, search },
    });
      } catch (error) {
        console.error('❌ Ошибка получения техники:', error);
        res.status(500).json({ error: error.message });
      }
    }

/**
 * GET /api/admin/equipment/counts
 * Возвращает количество техники по категориям и типам
 */
async function getEquipmentCountsAPI(req, res) {
  try {
    const [byCategory, byType] = await Promise.all([
      getEquipmentCountsByCategory(),
      getEquipmentCountsByType(),
    ]);
    
    res.json({
      by_category: byCategory,
      by_type: byType,
    });
  } catch (error) {
    console.error('❌ Ошибка получения счётчиков:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

module.exports = {
  // Страница
  renderCatalog,
  
  // API категорий
  getCategoriesAPI,
  getCategoryAPI,
  createCategoryAPI,
  updateCategoryAPI,
  deleteCategoryAPI,
  reorderCategoriesAPI,
  
  // API типов
  getTypesAPI,
  getTypeAPI,
  createTypeAPI,
  updateTypeAPI,
  deleteTypeAPI,
  reorderTypesAPI,
  
  // 🆕 API техники в категории/типе
  getFilteredEquipmentAPI,
  getEquipmentCountsAPI,
};