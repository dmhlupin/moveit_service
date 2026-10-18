// routes/dashboard.js
const fs = require('fs');
const path = require('path');
const {
  getDashboardStats,
  getRecentActivity,
  getEquipmentNeedingAttention,
  getDashboardActivityByDay,
  getTopUsers,
  getCategoryStats,           
} = require('../database/db');

const { renderPageFor } = require('../utils/layout');
/**
 * GET / — Дашборд (главная страница)
 */

async function renderDashboard(req, res) {
  try {
    // Загружаем все данные параллельно
    const scope = { userId: req.session.userId, role: req.session.role };

    const [stats, recentActivity, attention, activityByDay, topUsers, categoryStats] = await Promise.all([
      getDashboardStats(scope),
      getRecentActivity(10, scope),
      getEquipmentNeedingAttention(scope),
      getDashboardActivityByDay(14),   // график активности — глобальный, не фильтруем
      getTopUsers(5, scope),
      getCategoryStats(scope)
    ]);
    
    const role = req.session.role || 'user';

    // ===== Ссылки и карточки — по ролям =====

    // Кнопка «Добавить технику» — admin, mol
    const actionAddEquipment = (role === 'admin' || role === 'mol')
      ? `<a href="/manage/add" class="btn btn-success">➕ Добавить технику</a>`
      : '';

    // Карточка «Пользователей» — admin, supervisor
    const cardUsers = (role === 'admin' || role === 'supervisor')
      ? `<a href="/users" class="stat-card">
            <span class="icon">👥</span>
            <div class="number">${stats.active_users || 0}</div>
            <div class="label">Пользователей</div>
        </a>`
      : '';

    // Карточка «Действий за 24ч» — только admin
    const cardActionsToday = (role === 'admin')
      ? `<a href="/admin/logs" class="stat-card">
            <span class="icon">📈</span>
            <div class="number accent">${stats.actions_today || 0}</div>
            <div class="label">Действий за 24ч</div>
        </a>`
      : '';

    // Ссылка «Все логи →» — только admin
    const linkAllLogs = (role === 'admin')
      ? `<a href="/admin/logs" class="btn btn-ghost btn-sm">Все логи →</a>`
      : '';

    // Читаем HTML
    const htmlPath = path.join(__dirname, '..', 'views', 'dashboard.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // ===== Статистика =====
    html = html.replace(/\{\{stats\.total_equipment\}\}/g, stats.total_equipment || 0);
    html = html.replace(/\{\{stats\.available_equipment\}\}/g, stats.available_equipment || 0);
    html = html.replace(/\{\{stats\.assigned_equipment\}\}/g, stats.assigned_equipment || 0);
    html = html.replace(/\{\{stats\.maintenance_equipment\}\}/g, stats.maintenance_equipment || 0);
    html = html.replace(/\{\{stats\.retired_equipment\}\}/g, stats.retired_equipment || 0);
    html = html.replace(/\{\{stats\.active_users\}\}/g, stats.active_users || 0);
    html = html.replace(/\{\{stats\.actions_today\}\}/g, stats.actions_today || 0);

    // 🆕 Ссылки и карточки по ролям
    html = html.replace('{{action_add_equipment}}', actionAddEquipment);
    html = html.replace('{{card_users}}', cardUsers);
    html = html.replace('{{card_actions_today}}', cardActionsToday);
    html = html.replace('{{link_all_logs}}', linkAllLogs);
    
    // ===== Последние действия =====
    let activityHtml = '';
    if (recentActivity.length === 0) {
      activityHtml = `
        <div class="empty-block">
          <span>📭</span>
          <p>Нет недавних действий</p>
        </div>
      `;
    } else {
      const actionLabels = {
        'login': { icon: '🔐', text: 'Вход в систему', class: 'action-login' },
        'logout': { icon: '🚪', text: 'Выход', class: 'action-logout' },
        'login_failed': { icon: '❌', text: 'Неудачный вход', class: 'action-failed' },
        'password_change': { icon: '🔑', text: 'Смена пароля', class: 'action-update' },
        'profile_update': { icon: '👤', text: 'Обновление профиля', class: 'action-update' },
        'user_create': { icon: '➕', text: 'Создан пользователь', class: 'action-create' },
        'user_update': { icon: '✏️', text: 'Изменён пользователь', class: 'action-update' },
        'user_delete': { icon: '🗑️', text: 'Удалён пользователь', class: 'action-delete' },
        'user_block': { icon: '🚫', text: 'Заблокирован пользователь', class: 'action-block' },
        'user_unblock': { icon: '✅', text: 'Разблокирован пользователь', class: 'action-create' },
        'user_password_reset': { icon: '🔑', text: 'Сброшен пароль', class: 'action-update' },
        'equipment_create': { icon: '➕', text: 'Добавлена техника', class: 'action-create' },
        'equipment_update': { icon: '✏️', text: 'Изменена техника', class: 'action-update' },
        'equipment_delete': { icon: '🗑️', text: 'Удалена техника', class: 'action-delete' },
        'equipment_assign': { icon: '📦', text: 'Назначена техника', class: 'action-create' },
        'equipment_return': { icon: '↩️', text: 'Возвращена техника', class: 'action-update' },
        'category_create': { icon: '📁', text: 'Создана категория', class: 'action-create' },
        'category_update': { icon: '📁', text: 'Изменена категория', class: 'action-update' },
        'category_delete': { icon: '📁', text: 'Удалена категория', class: 'action-delete' },
        'type_create': { icon: '📦', text: 'Создан тип', class: 'action-create' },
        'type_update': { icon: '📦', text: 'Изменён тип', class: 'action-update' },
        'type_delete': { icon: '📦', text: 'Удалён тип', class: 'action-delete' }
      };
      
      recentActivity.forEach(log => {
        const label = actionLabels[log.action] || { icon: '📝', text: log.action, class: 'action-default' };
        const userName = log.user_full_name || log.username || 'Система';
        const initials = getInitials(userName);
        const timeAgo = timeAgoRu(log.created_at);
        
        let detailsText = '';
        if (log.details) {
          try {
            const parsed = JSON.parse(log.details);
            if (parsed.inventory_number) detailsText = parsed.inventory_number;
            else if (parsed.username) detailsText = parsed.username;
            else if (parsed.name) detailsText = parsed.name;
            else if (parsed.role) detailsText = `роль: ${parsed.role}`;
          } catch {}
        }
        
        activityHtml += `
          <div class="activity-item">
            <div class="activity-avatar">${initials}</div>
            <div class="activity-body">
              <div class="activity-text">
                <strong>${userName}</strong>
                <span class="activity-action ${label.class}">${label.icon} ${label.text}</span>
                ${detailsText ? `<span class="activity-details">${detailsText}</span>` : ''}
              </div>
              <div class="activity-time">${timeAgo}</div>
            </div>
          </div>
        `;
      });
    }
    html = html.replace('{{recent_activity}}', activityHtml);
    
    // ===== Требует внимания =====
    let attentionHtml = '';
    
    if (attention.maintenance.length > 0) {
      attentionHtml += `
        <div class="attention-block attention-maintenance">
          <div class="attention-header">
            <span class="attention-icon">🔧</span>
            <span class="attention-title">В ремонте (${attention.maintenance.length})</span>
          </div>
          <ul class="attention-list">
            ${attention.maintenance.map(eq => `
              <li>
                <span class="inv-num">${eq.inventory_number}</span>
                <span class="inv-name">${escapeHtml(eq.model_name || '—')}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    if (attention.warrantySoon.length > 0) {
      attentionHtml += `
        <div class="attention-block attention-warning">
          <div class="attention-header">
            <span class="attention-icon">⏰</span>
            <span class="attention-title">Истекает гарантия (${attention.warrantySoon.length})</span>
          </div>
          <ul class="attention-list">
            ${attention.warrantySoon.map(eq => `
              <li>
                <span class="inv-num">${eq.inventory_number}</span>
                <span class="inv-name">${escapeHtml(eq.model_name || '—')}</span>
                <span class="inv-extra">${eq.days_left} дн.</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    if (attention.warrantyExpired.length > 0) {
      attentionHtml += `
        <div class="attention-block attention-info">
          <div class="attention-header">
            <span class="attention-icon">📋</span>
            <span class="attention-title">Просрочена гарантия (${attention.warrantyExpired.length})</span>
          </div>
          <ul class="attention-list">
            ${attention.warrantyExpired.map(eq => `
              <li>
                <span class="inv-num">${eq.inventory_number}</span>
                <span class="inv-name">${escapeHtml(eq.model_name || '—')}</span>
                <span class="inv-extra">${eq.days_expired} дн. назад</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    if (attention.longAvailable.length > 0) {
      attentionHtml += `
        <div class="attention-block attention-info">
          <div class="attention-header">
            <span class="attention-icon">📦</span>
            <span class="attention-title">Без владельца > 6 мес. (${attention.longAvailable.length})</span>
          </div>
          <ul class="attention-list">
            ${attention.longAvailable.map(eq => `
              <li>
                <span class="inv-num">${eq.inventory_number}</span>
                <span class="inv-name">${escapeHtml(eq.model_name || '—')}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    if (!attentionHtml) {
      attentionHtml = `
        <div class="empty-block">
          <span>✅</span>
          <p>Всё в порядке!</p>
        </div>
      `;
    }
    html = html.replace('{{attention_blocks}}', attentionHtml);
    
    // ===== Топ пользователей =====
    let topUsersHtml = '';
    if (topUsers.length === 0) {
      topUsersHtml = `
        <div class="empty-block">
          <span>📭</span>
          <p>Нет активности за 30 дней</p>
        </div>
      `;
    } else {
      const maxActions = Math.max(...topUsers.map(u => u.actions_count));
      topUsers.forEach((user, index) => {
        const percent = Math.round((user.actions_count / maxActions) * 100);
        const userName = user.full_name || user.username;
        const initials = getInitials(userName);
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '·';
        
        topUsersHtml += `
          <div class="top-user-item">
            <div class="top-user-medal">${medal}</div>
            <div class="top-user-avatar">${initials}</div>
            <div class="top-user-info">
              <div class="top-user-name">${userName}</div>
              <div class="top-user-dept">${user.department || 'Без отдела'}</div>
            </div>
            <div class="top-user-bar">
              <div class="top-user-bar-fill" style="width: ${percent}%"></div>
            </div>
            <div class="top-user-count">${user.actions_count}</div>
          </div>
        `;
      });
    }
    html = html.replace('{{top_users}}', topUsersHtml);
    
    // ===== 🆕 Статистика по категориям =====
    let categoryStatsHtml = '';
    if (categoryStats.categories.length === 0 || categoryStats.total === 0) {
      categoryStatsHtml = `
        <div class="empty-block">
          <span>📭</span>
          <p>Нет техники с категориями</p>
        </div>
      `;
    } else {
      // Цвета для категорий
      const colors = [
        '#667eea', '#48bb78', '#ed8936', '#f56565',
        '#9f7aea', '#38b2ac', '#ed64a6', '#d69e2e'
      ];
      
      categoryStats.categories.forEach((cat, index) => {
        if (cat.equipment_count === 0) return; // Пропускаем пустые
        
        const color = colors[index % colors.length];
        
        categoryStatsHtml += `
          <a href="/admin/catalog" class="category-stat-item" title="Перейти в справочник">
            <div class="category-stat-icon" style="background: ${color}20; color: ${color};">
              ${cat.icon || '📁'}
            </div>
            <div class="category-stat-info">
              <div class="category-stat-name">${cat.name}</div>
              <div class="category-stat-meta">
                ${cat.equipment_count} ед. · ${cat.types_count} типов
              </div>
            </div>
            <div class="category-stat-bar">
              <div class="category-stat-bar-fill" style="width: ${cat.percent}%; background: ${color};"></div>
            </div>
            <div class="category-stat-count" style="color: ${color};">
              ${cat.percent}%
            </div>
          </a>
        `;
      });
    }
    html = html.replace('{{category_stats}}', categoryStatsHtml);
       
    // ===== График активности (SVG) =====
    const chartSvg = generateActivityChart(activityByDay);
    html = html.replace('{{activity_chart}}', chartSvg);
    
    // ===== Данные для JS =====
    html = html.replace('{{activity_data}}', JSON.stringify(activityByDay));
    
    // Собираем страницу через layout-контроллер
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

/**
 * Генерация SVG-графика активности
 */
function generateActivityChart(data) {
  if (!data || data.length === 0) {
    return '<div class="chart-empty">Нет данных</div>';
  }
  
  const width = 600;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const maxValue = Math.max(...data.map(d => d.count), 1);
  const stepX = chartWidth / Math.max(data.length - 1, 1);
  
  // Точки
  const points = data.map((d, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartHeight - (d.count / maxValue) * chartHeight;
    return { x, y, count: d.count, date: d.date };
  });
  
  // Полилиния
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  
  // Область (заливка)
  const areaPath = `M ${padding.left},${padding.top + chartHeight} ` +
                   points.map(p => `L ${p.x},${p.y}`).join(' ') +
                   ` L ${padding.left + (data.length - 1) * stepX},${padding.top + chartHeight} Z`;
  
  // Сетка по Y
  const gridLines = [];
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const y = padding.top + (chartHeight / ySteps) * i;
    const value = Math.round(maxValue * (1 - i / ySteps));
    gridLines.push(`
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
            stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>
      <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" 
            font-size="10" fill="#a0aec0">${value}</text>
    `);
  }
  
  // Подписи по X (каждый 3-й день)
  const xLabels = [];
  data.forEach((d, i) => {
    if (i % 3 === 0 || i === data.length - 1) {
      const x = padding.left + i * stepX;
      const date = new Date(d.date);
      const label = `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
      xLabels.push(`
        <text x="${x}" y="${height - 10}" text-anchor="middle" 
              font-size="10" fill="#a0aec0">${label}</text>
      `);
    }
  });
  
  // Точки на графике (кружки)
  const circles = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="#667eea" stroke="white" stroke-width="2">
      <title>${p.date}: ${p.count} действий</title>
    </circle>
  `).join('');
  
  return `
    <svg viewBox="0 0 ${width} ${height}" class="activity-chart" preserveAspectRatio="xMidYMid meet">
      ${gridLines.join('')}
      
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#667eea" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#667eea" stop-opacity="0"/>
        </linearGradient>
      </defs>
      
      <path d="${areaPath}" fill="url(#areaGradient)"/>
      
      <polyline points="${polyline}" fill="none" stroke="#667eea" stroke-width="2" 
                stroke-linecap="round" stroke-linejoin="round"/>
      
      ${circles}
      ${xLabels.join('')}
    </svg>
  `;
}

/**
 * Получить инициалы
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(p => p);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Относительное время
 */
function timeAgoRu(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  } catch {
    return dateString;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = renderDashboard;