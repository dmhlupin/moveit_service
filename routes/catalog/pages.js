const fs = require('fs');
const path = require('path');

const {
  getAllCategories,
  getAllTypes,
  getStats,              // если renderCatalog использует статистику — проверь
} = require('../../database/db');

const { renderPageFor } = require('../../utils/layout');
const { escapeHtml } = require('./helpers');   // если используется

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

    const htmlPath = path.join(__dirname, '..','..', 'views', 'admin-catalog.html');
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

module.exports = {
  renderCatalog,
};