const fs = require('fs');
const path = require('path');

const {
  getOfficeById,
  getWorkplaceStats,
} = require('../../database/db');

const { renderPageFor } = require('../../utils/layout');
const { escapeHtml } = require('./helpers');

// ============================================================
// СТРАНИЦЫ
// ============================================================

/**
 * GET /admin/workplaces — страница управления офисами
 */
async function renderWorkplaces(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const stats = await getWorkplaceStats(scope);

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-workplaces.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // Статистика
    content = content.replace(/\{\{total_offices\}\}/g, stats.total_offices || 0);
    content = content.replace(/\{\{total_rooms\}\}/g, stats.total_rooms || 0);
    content = content.replace(/\{\{total_workplaces\}\}/g, stats.total_workplaces || 0);
    content = content.replace(/\{\{equipment_on_workplaces\}\}/g, stats.equipment_on_workplaces || 0);
    content = content.replace(/\{\{equipment_unassigned\}\}/g, stats.equipment_unassigned || 0);

    renderPageFor(req, res, {
      title: 'Рабочие места – MoveIT service',
      content,
      pageCss: '/css/workplaces.css',
      pageJs: '/js/workplaces.js',
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки рабочих мест:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

/**
 * GET /admin/workplaces/:id — страница деталей офиса (дерево)
 */
async function renderWorkplaceDetails(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).send('Неверный ID офиса');
    }

    const office = await getOfficeById(id);
    if (!office) {
      return res.status(404).send('Офис не найден');
    }

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-workplace-details.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    // Данные офиса (name и description — через escapeHtml, чтобы
    // исключить XSS через пользовательский ввод)
    content = content.replace(/\{\{office\.id\}\}/g, office.id);
    content = content.replace(/\{\{office\.name\}\}/g, escapeHtml(office.name));
    content = content.replace(/\{\{office\.description\}\}/g, escapeHtml(office.description));

    // 🆕 Этап 4: роль — чтобы показать блок «Ответственные МОЛ» только админу
    content = content.replace(/\{\{current_role\}\}/g, req.session.role || 'user');

    renderPageFor(req, res, {
      title: `${office.name} – MoveIT service`,
      content,
      pageCss: '/css/workplace-details.css',
      pageJs: [
        '/js/equipment-view.js',
        '/js/workplace-details.js',
      ],
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки офиса:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}


module.exports = {
  renderWorkplaces,
  renderWorkplaceDetails,
};