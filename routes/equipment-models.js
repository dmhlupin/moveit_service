// routes/equipment-models.js
// Номенклатура: управление моделями ТМЦ (equipment_models)

const fs = require('fs');
const path = require('path');
const {
  // Модели
  getAllModels,
  getModelById,
  getModelByCorporateId,
  getModelInstances,
  createModel,
  updateModel,
  deleteModel,
  isCorporateIdFree,
  findSimilarModel,
  // Справочник — для селектов и подписей
  getAllCategories,
  getAllTypes,
} = require('../database/db');
const { logAction } = require('../utils/logger');
const { renderPageFor } = require('../utils/layout');

const PAGE_SIZE = 20;

// ============================================================
// УТИЛИТЫ
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

function parseIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// ============================================================
// СТРАНИЦА
// ============================================================

/**
 * GET /admin/models — страница «Номенклатура»
 */
async function renderModels(req, res) {
  try {
    const htmlPath = path.join(__dirname, '..', 'views', 'admin-models.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    renderPageFor(req, res, {
      title: 'Номенклатура – MoveIT service',
      content,
      pageCss: '/css/admin-models.css',
      pageJs: '/js/admin-models.js',
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки номенклатуры:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

// ============================================================
// API — СПИСОК И ОДНА МОДЕЛЬ
// ============================================================

/**
 * GET /api/admin/models
 * Query: category_id, type_id, search, page
 */
async function getModelsAPI(req, res) {
  try {
    const category_id = parseIntOrNull(req.query.category_id);
    const type_id     = parseIntOrNull(req.query.type_id);
    const search      = req.query.search ? String(req.query.search).trim() : null;
    const page        = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset      = (page - 1) * PAGE_SIZE;

    const result = await getAllModels({
      category_id,
      type_id,
      search,
      limit: PAGE_SIZE,
      offset,
      include_total: true,
    });

    const totalPages = Math.ceil((result.total || 0) / PAGE_SIZE);

    res.json({
      items: result.items || [],
      total: result.total || 0,
      page,
      limit: PAGE_SIZE,
      totalPages,
      filters: { category_id, type_id, search },
    });
  } catch (error) {
    console.error('❌ Ошибка получения моделей:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/models/:id
 */
async function getModelAPI(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const model = await getModelById(id);
    if (!model) {
      return res.status(404).json({ error: 'Модель не найдена' });
    }

    const instances = await getModelInstances(id);

    res.json({ ...model, instances });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// API — CRUD
// ============================================================

/**
 * POST /api/admin/models — создать модель
 */
async function createModelAPI(req, res) {
  try {
    const {
      corporate_id,
      name,
      manufacturer,
      category_id,
      type_id,
      description,
    } = req.body;

    // Валидация
    const corporateIdClean = String(corporate_id || '').trim();
    const nameClean        = String(name || '').trim();
    const manufacturerClean = manufacturer ? String(manufacturer).trim() : null;

    if (!corporateIdClean) {
      return res.status(400).json({ error: 'Corporate ID обязателен' });
    }
    if (!nameClean) {
      return res.status(400).json({ error: 'Название модели обязательно' });
    }
    if (!category_id) {
      return res.status(400).json({ error: 'Категория обязательна' });
    }
    if (!type_id) {
      return res.status(400).json({ error: 'Тип обязателен' });
    }

    const categoryIdNum = parseInt(category_id, 10);
    const typeIdNum     = parseInt(type_id, 10);
    if (Number.isNaN(categoryIdNum) || Number.isNaN(typeIdNum)) {
      return res.status(400).json({ error: 'Неверный ID категории или типа' });
    }

    // Проверка уникальности corporate_id
    const free = await isCorporateIdFree(corporateIdClean);
    if (!free) {
      return res.status(400).json({
        error: `Corporate ID «${corporateIdClean}» уже используется`,
      });
    }

    const result = await createModel({
      corporate_id: corporateIdClean,
      name: nameClean,
      manufacturer: manufacturerClean,
      category_id: categoryIdNum,
      type_id: typeIdNum,
      description: description ? String(description).trim() : null,
    });

    await logAction({
      req,
      action: 'model_create',
      entityType: 'model',
      entityId: result.id,
      details: JSON.stringify({
        corporate_id: corporateIdClean,
        name: nameClean,
      }),
    });

    res.json({
      success: true,
      message: 'Модель создана',
      data: result,
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Corporate ID уже используется' });
    }
    console.error('❌ Ошибка создания модели:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * PUT /api/admin/models/:id — обновить модель
 */
async function updateModelAPI(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const existing = await getModelById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Модель не найдена' });
    }

    const {
      corporate_id,
      name,
      manufacturer,
      category_id,
      type_id,
      description,
    } = req.body;

    const corporateIdClean = String(corporate_id || '').trim();
    const nameClean        = String(name || '').trim();
    const manufacturerClean = manufacturer ? String(manufacturer).trim() : null;

    if (!corporateIdClean) {
      return res.status(400).json({ error: 'Corporate ID обязателен' });
    }
    if (!nameClean) {
      return res.status(400).json({ error: 'Название модели обязательно' });
    }
    if (!category_id) {
      return res.status(400).json({ error: 'Категория обязательна' });
    }
    if (!type_id) {
      return res.status(400).json({ error: 'Тип обязателен' });
    }

    const categoryIdNum = parseInt(category_id, 10);
    const typeIdNum     = parseInt(type_id, 10);
    if (Number.isNaN(categoryIdNum) || Number.isNaN(typeIdNum)) {
      return res.status(400).json({ error: 'Неверный ID категории или типа' });
    }

    // Уникальность corporate_id с исключением текущей модели
    const free = await isCorporateIdFree(corporateIdClean, id);
    if (!free) {
      return res.status(400).json({
        error: `Corporate ID «${corporateIdClean}» уже используется другой моделью`,
      });
    }

    const result = await updateModel(id, {
      corporate_id: corporateIdClean,
      name: nameClean,
      manufacturer: manufacturerClean,
      category_id: categoryIdNum,
      type_id: typeIdNum,
      description: description ? String(description).trim() : null,
    });

    await logAction({
      req,
      action: 'model_update',
      entityType: 'model',
      entityId: id,
      details: JSON.stringify({
        corporate_id: corporateIdClean,
        name: nameClean,
      }),
    });

    res.json({
      success: true,
      message: 'Модель обновлена',
      data: result,
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Corporate ID уже используется' });
    }
    console.error('❌ Ошибка обновления модели:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * DELETE /api/admin/models/:id — удалить модель
 * Запрещено, если есть экземпляры.
 */
async function deleteModelAPI(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const model = await getModelById(id);
    if (!model) {
      return res.status(404).json({ error: 'Модель не найдена' });
    }

    const result = await deleteModel(id);

    await logAction({
      req,
      action: 'model_delete',
      entityType: 'model',
      entityId: id,
      details: JSON.stringify({
        corporate_id: model.corporate_id,
        name: model.name,
      }),
    });

    res.json({
      success: true,
      message: 'Модель удалена',
      data: result,
    });
  } catch (error) {
    if (error.message && error.message.includes('Нельзя удалить')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('❌ Ошибка удаления модели:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// API — ПРОВЕРКА ДУБЛИКАТА (не блокирующая)
// ============================================================

/**
 * GET /api/admin/models/check-duplicate
 * Query: name, manufacturer, exclude_id
 * Ответ: { similar: {...} | null }
 */
async function checkDuplicateAPI(req, res) {
  try {
    const name = req.query.name ? String(req.query.name).trim() : '';
    const manufacturer = req.query.manufacturer
      ? String(req.query.manufacturer).trim()
      : null;
    const exclude_id = parseIntOrNull(req.query.exclude_id);

    if (!name) {
      return res.json({ similar: null });
    }

    const similar = await findSimilarModel({
      name,
      manufacturer,
      excludeId: exclude_id,
    });

    res.json({ similar: similar || null });
  } catch (error) {
    console.error('❌ Ошибка проверки дубликата:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

module.exports = {
  renderModels,
  getModelsAPI,
  getModelAPI,
  createModelAPI,
  updateModelAPI,
  deleteModelAPI,
  checkDuplicateAPI,
};