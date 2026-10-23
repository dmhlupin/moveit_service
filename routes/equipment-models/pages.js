const fs = require('fs');
const path = require('path');

// + по факту: что использует renderModels из database/db
//   (скорее всего getAllModels, getAllCategories, getAllTypes, getModelsWithCounts)
const {
  getAllModels,        // проверь
  getAllCategories,    // проверь
  getAllTypes,         // проверь
} = require('../../database/db');

const { renderPageFor } = require('../../utils/layout');
const { escapeHtml } = require('./helpers');
// escapeHtml — если используется в renderModels, добавь хелпер (см. ниже)

// ============================================================
// СТРАНИЦА
// ============================================================

/**
 * GET /admin/models — страница «Номенклатура»
 */
async function renderModels(req, res) {
  try {
    const htmlPath = path.join(__dirname, '..','..', 'views', 'admin-models.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // 🆕 Этап 4: роль пользователя — для JS (скрытие кнопки «Удалить»)
    content = content.replace(/\{\{current_role\}\}/g, req.session.role || 'user');

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

module.exports = {
  renderModels,
};