const {
  getEquipmentCountsByCategory,
  getEquipmentCountsByType,
} = require('../../database/db');

// ============================================================
// API — СЧЁТЧИКИ ТЕХНИКИ
// ============================================================

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
  getEquipmentCountsAPI,
};