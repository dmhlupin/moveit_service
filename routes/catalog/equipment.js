const {
  getEquipmentWithLocation,       // getFilteredEquipmentAPI
  getEquipmentCountsByCategory,   // getEquipmentCountsAPI
  getEquipmentCountsByType,       // getEquipmentCountsAPI
  getAllCategories,               // для валидации параметров
  getAllTypes,                    // для валидации параметров
} = require('../../database/db');

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

    // 🆕 5.11.3: scope — как на /manage. Под МОЛом — только его техника,
    // чтобы всё, что показано в таблице, открывалось в EquipmentCard.
    const scope = { userId: req.session.userId, role: req.session.role };

    const result = await getEquipmentWithLocation({
      category_id,
      type_id,
      search,
      limit,
      offset,
      include_total: true,
    }, scope);   // 🆕 scope вторым аргументом

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

module.exports = {
  getFilteredEquipmentAPI,
  getEquipmentCountsAPI,
};