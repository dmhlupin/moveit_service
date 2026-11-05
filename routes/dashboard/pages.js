// routes/dashboard/pages.js
const fs = require('fs');
const path = require('path');
const {
  getDashboardStats,
  getRecentActivity,
  getEquipmentNeedingAttention,
  getDashboardActivityByDay,
  getTopUsers,
  getCategoryStats,
  getStaleWarehouseEquipment, // 🆕
  getLostAvailableEquipment,  // 🆕
} = require('../../database/db');

const { renderPageFor } = require('../../utils/layout');
const helpers = require('./helpers');

async function renderDashboard(req, res) {
  try {
    const scope = { userId: req.session.userId, role: req.session.role };
    const role = req.session.role || 'user';

    const [stats, recentActivity, attention, activityByDay, topUsers, categoryStats, staleEquipment, lostEquipment    
    ] = await Promise.all([
      getDashboardStats(scope),
      getRecentActivity(10, scope),
      getEquipmentNeedingAttention(scope),
      getDashboardActivityByDay(14),
      getTopUsers(5, scope),
      getCategoryStats(scope),
      getStaleWarehouseEquipment(scope), // 🆕
      getLostAvailableEquipment(scope),  // 🆕
    ]);

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'dashboard.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // ===== Статистика =====
    html = html.replace(/\{\{stats\.total_equipment\}\}/g, stats.total_equipment || 0);
    html = html.replace(/\{\{stats\.available_equipment\}\}/g, stats.available_equipment || 0);
    html = html.replace(/\{\{stats\.assigned_equipment\}\}/g, stats.assigned_equipment || 0);
    html = html.replace(/\{\{stats\.maintenance_equipment\}\}/g, stats.maintenance_equipment || 0);
    html = html.replace(/\{\{stats\.retired_equipment\}\}/g, stats.retired_equipment || 0);
    html = html.replace(/\{\{stats\.active_users\}\}/g, stats.active_users || 0);
    html = html.replace(/\{\{stats\.actions_today\}\}/g, stats.actions_today || 0);

    // ===== Карточки по ролям =====
    html = html.replace('{{action_add_equipment}}', helpers.renderActionAddEquipment(role));
    html = html.replace('{{card_users}}', helpers.renderCardUsers(role, stats));
    html = html.replace('{{card_actions_today}}', helpers.renderCardActionsToday(role, stats));
    html = html.replace('{{link_all_logs}}', helpers.renderLinkAllLogs(role));

    // ===== Блоки =====
    html = html.replace('{{recent_activity}}', helpers.renderRecentActivity(recentActivity));
    html = html.replace('{{attention_blocks}}', helpers.renderAttention(attention));
    html = html.replace('{{top_users}}', helpers.renderTopUsers(topUsers));
    html = html.replace('{{category_stats}}', helpers.renderCategoryStats(categoryStats));

    // ===== Графики =====
    html = html.replace('{{activity_chart}}', helpers.renderActivityChart(activityByDay));
    html = html.replace('{{status_donut}}', helpers.renderStatusDonut(stats));
    html = html.replace('{{stale_equipment}}', helpers.renderStaleEquipment(staleEquipment));
    html = html.replace('{{lost_equipment_warning}}', helpers.renderLostEquipmentWarning(lostEquipment));

    // ===== Данные для JS (если нужно) =====
    html = html.replace('{{activity_data}}', JSON.stringify(activityByDay));

    renderPageFor(req, res, {
      title: 'Дашборд — MoveIT service',
      content: html,
      pageCss: '/css/dashboard.css',
      pageJs: '/js/dashboard.js',
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки дашборда:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

module.exports = { renderDashboard };