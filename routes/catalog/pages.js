const fs = require('fs');
const path = require('path');

const {
  getAllCategories,
  getAllTypes,
} = require('../../database/db');

const { renderPageFor } = require('../../utils/layout');
const { escapeHtml } = require('./helpers');

// ============================================================
// СТРАНИЦА
// ============================================================

/**
 * GET /admin/catalog — страница справочника техники
 */
async function renderCatalog(req, res) {
  try {
    const [categories, types] = await Promise.all([
      getAllCategories(),
      getAllTypes(),
    ]);

    const totalCategories = categories.length;
    const totalTypes = types.length;
    const totalEquipment = types.reduce((sum, t) => sum + (t.equipment_count || 0), 0);

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-catalog.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    content = content.replace(/\{\{total_categories\}\}/g, totalCategories);
    content = content.replace(/\{\{total_types\}\}/g, totalTypes);
    content = content.replace(/\{\{total_equipment\}\}/g, totalEquipment);

    // 🆕 5.11.3: роль и userId для карточки техники (EquipmentCard)
    const currentRole = req.session.role || 'user';
    content = content.replace(/\{\{current_role\}\}/g, escapeHtml(currentRole));
    content = content.replace(/\{\{current_user_id\}\}/g, req.session.userId || 0);

    renderPageFor(req, res, {
      title: 'Справочник техники – MoveIT service',
      content,
      pageCss: '/css/catalog.css',
      // 🆕 5.11.3: модули equipment-card ДО catalog.js
      pageJs: [
        '/js/manage/helpers.js',
        '/js/equipment-card/loader.js',
        '/js/equipment-card/render.js',
        '/js/equipment-card/actions.js',
        '/js/equipment-card/modals.js',
        '/js/equipment-card/index.js',
        '/js/catalog.js',
      ],
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки справочника:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

module.exports = {
  renderCatalog,
};