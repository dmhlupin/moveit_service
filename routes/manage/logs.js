// routes/manage/logs.js
// Рендер страницы логов + API.

const fs = require('fs');
const path = require('path');

const {
  getAllUsers,
  getActivityLogs,
  getActivityLogsCount,
  getUniqueActions,
  getActivityStats,
  getActivityByDay,
  cleanOldLogs,
} = require('../../database/db');

const { logAction } = require('../../utils/logger');
const { renderPageFor } = require('../../utils/layout');
const { escapeHtml, getInitials, formatDateTime } = require('./helpers');

const ACTION_NAMES = {
  'login': '🔐 Вход',
  'logout': '🚪 Выход',
  'login_failed': '❌ Неудачный вход',
  'password_change': '🔑 Смена пароля',
  'profile_update': '👤 Обновление профиля',
  'user_create': '➕ Создание пользователя',
  'user_update': '✏️ Редактирование пользователя',
  'user_delete': '🗑️ Удаление пользователя',
  'user_block': '🚫 Блокировка пользователя',
  'user_unblock': '✅ Разблокировка пользователя',
  'user_password_reset': '🔑 Сброс пароля',
  'equipment_create': '➕ Добавление техники',
  'equipment_update': '✏️ Редактирование техники',
  'equipment_delete': '🗑️ Удаление техники',
  'equipment_assign': '📦 Назначение техники',
  'equipment_return': '↩️ Возврат техники',
  'equipment_move': '🔄 Перемещение техники',
  'model_create': '🧩 Создание модели',
  'model_update': '🧩 Редактирование модели',
  'model_delete': '🧩 Удаление модели',
  'category_create': '📁 Создание категории',
  'category_update': '📁 Редактирование категории',
  'category_delete': '📁 Удаление категории',
  'type_create': '📦 Создание типа',
  'type_update': '📦 Редактирование типа',
  'type_delete': '📦 Удаление типа',
  'warehouse_create': '🏢 Создание склада',
  'warehouse_update': '🏢 Редактирование склада',
  'warehouse_delete': '🏢 Удаление склада',
  'warehouse_set_default': '⭐ Склад по умолчанию',
  'zone_create': '📍 Создание зоны',
  'zone_update': '📍 Редактирование зоны',
  'zone_delete': '📍 Удаление зоны',
  'rack_create': '🗄️ Создание стеллажа',
  'rack_update': '🗄️ Редактирование стеллажа',
  'rack_delete': '🗄️ Удаление стеллажа',
  'cell_create': '📦 Создание ячейки',
  'cell_update': '📦 Редактирование ячейки',
  'cell_delete': '📦 Удаление ячейки',
};

async function renderLogs(req, res) {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action || null,
      search: req.query.search || null,
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
    };

    const logs = await getActivityLogs(filters);
    const totalCount = await getActivityLogsCount(filters);
    const stats = await getActivityStats(30);
    const users = await getAllUsers();
    const actions = await getUniqueActions();

    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-logs.html');
    let content = fs.readFileSync(htmlPath, 'utf8');

    content = content.replace(/\{\{stats\.total\}\}/g, stats.total || 0);
    content = content.replace(/\{\{stats\.unique_users\}\}/g, stats.unique_users || 0);
    content = content.replace(/\{\{stats\.logins\}\}/g, stats.logins || 0);
    content = content.replace(/\{\{stats\.failed_logins\}\}/g, stats.failed_logins || 0);
    content = content.replace(/\{\{stats\.equipment_actions\}\}/g, stats.equipment_actions || 0);
    content = content.replace(/\{\{stats\.user_actions\}\}/g, stats.user_actions || 0);
    content = content.replace(/\{\{stats\.deletes\}\}/g, stats.deletes || 0);

    let userOptions = '<option value="">Все пользователи</option>';
    users.forEach(u => {
      const selected = filters.userId === u.id ? 'selected' : '';
      userOptions += `<option value="${u.id}" ${selected}>${escapeHtml(u.full_name || u.username)}</option>`;
    });
    content = content.replace('{{user_options}}', userOptions);

    let actionOptions = '<option value="">Все действия</option>';
    actions.forEach(a => {
      const selected = filters.action === a.action ? 'selected' : '';
      const label = ACTION_NAMES[a.action] || a.action;
      actionOptions += `<option value="${a.action}" ${selected}>${label} (${a.count})</option>`;
    });
    content = content.replace('{{action_options}}', actionOptions);

    content = content.replace(/\{\{filter\.search\}\}/g, escapeHtml(filters.search || ''));
    content = content.replace(/\{\{filter\.dateFrom\}\}/g, filters.dateFrom || '');
    content = content.replace(/\{\{filter\.dateTo\}\}/g, filters.dateTo || '');

    let logRows = '';
    if (logs.length === 0) {
      logRows = `
        <tr>
          <td colspan="6" class="empty-row">
            <div class="empty-state">
              <span class="emoji">📭</span>
              <h3>Логи не найдены</h3>
              <p>Попробуйте изменить фильтры</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      logs.forEach(log => {
        let actionClass = 'log-action-default';
        if (log.action.includes('delete')) actionClass = 'log-action-delete';
        else if (log.action.includes('create')) actionClass = 'log-action-create';
        else if (log.action.includes('update')) actionClass = 'log-action-update';
        else if (log.action === 'login') actionClass = 'log-action-login';
        else if (log.action === 'login_failed') actionClass = 'log-action-failed';
        else if (log.action.includes('block')) actionClass = 'log-action-block';
        else if (log.action === 'equipment_move') actionClass = 'log-action-move';

        const actionLabel = ACTION_NAMES[log.action] || log.action;

        let detailsHtml = '—';
        if (log.details) {
          try {
            const parsed = JSON.parse(log.details);
            detailsHtml = Object.entries(parsed)
              .map(([k, v]) => `<span class="log-detail-key">${escapeHtml(k)}:</span> <span class="log-detail-value">${escapeHtml(String(v))}</span>`)
              .join('<br>');
          } catch {
            detailsHtml = escapeHtml(log.details);
          }
        }

        const userName = log.user_full_name || log.username || '—';
        const userInitials = getInitials(log.user_full_name || log.username);

        logRows += `
          <tr>
            <td class="log-date">${formatDateTime(log.created_at)}</td>
            <td>
              <div class="log-user">
                <span class="log-avatar">${userInitials}</span>
                <div>
                  <div class="log-user-name">${escapeHtml(userName)}</div>
                  ${log.user_department ? `<div class="log-user-dept">${escapeHtml(log.user_department)}</div>` : ''}
                </div>
              </div>
            </td>
            <td><span class="log-action ${actionClass}">${actionLabel}</span></td>
            <td class="log-entity">
              ${log.entity_type ? `<span class="log-entity-type">${escapeHtml(log.entity_type)}</span>` : ''}
              ${log.entity_id ? `<span class="log-entity-id">#${log.entity_id}</span>` : ''}
              ${!log.entity_type && !log.entity_id ? '—' : ''}
            </td>
            <td class="log-details">${detailsHtml}</td>
            <td class="log-ip">${log.ip_address || '—'}</td>
          </tr>
        `;
      });
    }
    content = content.replace('{{log_rows}}', logRows);

    const totalPages = Math.ceil(totalCount / filters.limit);
    const currentPage = Math.floor(filters.offset / filters.limit) + 1;

    let pagination = '';
    if (totalPages > 1) {
      pagination = `<div class="pagination">`;
      pagination += `<span class="pagination-info">Страница ${currentPage} из ${totalPages} (всего: ${totalCount})</span>`;
      pagination += `<div class="pagination-buttons">`;

      const buildQuery = (offset) => {
        const params = new URLSearchParams();
        if (filters.userId) params.set('userId', filters.userId);
        if (filters.action) params.set('action', filters.action);
        if (filters.search) params.set('search', filters.search);
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
        params.set('limit', filters.limit);
        params.set('offset', offset);
        return '?' + params.toString();
      };

      if (filters.offset > 0) {
        pagination += `<a href="/admin/logs${buildQuery(filters.offset - filters.limit)}" class="pagination-btn">← Назад</a>`;
      }
      if (filters.offset + filters.limit < totalCount) {
        pagination += `<a href="/admin/logs${buildQuery(filters.offset + filters.limit)}" class="pagination-btn">Вперёд →</a>`;
      }

      pagination += `</div></div>`;
    } else {
      pagination = `<div class="pagination"><span class="pagination-info">Всего: ${totalCount} записей</span></div>`;
    }
    content = content.replace('{{pagination}}', pagination);

    renderPageFor(req, res, {
      title: 'Логи активности – MoveIT service',
      content,
      pageCss: '/css/logs.css',
      pageJs: '/js/logs.js',
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки логов:', error);
    res.status(500).send('Ошибка загрузки страницы логов');
  }
}

async function getLogsAPI(req, res) {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action || null,
      search: req.query.search || null,
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
    };
    const logs = await getActivityLogs(filters);
    const total = await getActivityLogsCount(filters);
    res.json({ logs, total, filters });
  } catch (error) {
    console.error('❌ Ошибка API логов:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getLogsStatsAPI(req, res) {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 30;
    const stats = await getActivityStats(days);
    const byDay = await getActivityByDay(14);
    res.json({ stats, byDay });
  } catch (error) {
    console.error('❌ Ошибка статистики:', error);
    res.status(500).json({ error: error.message });
  }
}

async function cleanLogsAPI(req, res) {
  try {
    const days = req.body.days ? parseInt(req.body.days) : 90;
    if (days < 30) {
      return res.status(400).json({ error: 'Нельзя удалять логи младше 30 дней' });
    }
    const result = await cleanOldLogs(days);
    await logAction({
      req, action: 'logs_clean',
      details: JSON.stringify({ days, deleted: result.deleted }),
    });
    res.json({
      success: true,
      message: `Удалено ${result.deleted} старых записей`,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error('❌ Ошибка очистки логов:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  renderLogs,
  getLogsAPI,
  getLogsStatsAPI,
  cleanLogsAPI,
};