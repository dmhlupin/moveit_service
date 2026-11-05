// routes/dashboard/helpers.js
// Вспомогательные функции для рендера дашборда.

// ============================================================
// ЭКРАНИРОВАНИЕ И УТИЛИТЫ
// ============================================================

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(p => p);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

// ============================================================
// РЕНДЕР КАРТОЧЕК СТАТИСТИКИ
// ============================================================

function renderActionAddEquipment(role) {
  if (role !== 'admin' && role !== 'mol') return '';
  return `<a href="/manage/add" class="btn btn-success">Добавить технику</a>`;
}

function renderCardUsers(role, stats) {
  if (role !== 'admin' && role !== 'supervisor') return '';
  return `<a href="/admin/inventory#users" class="stat-card">
    <span class="icon">👥</span>
    <div class="number">${stats.active_users || 0}</div>
    <div class="label">Пользователей</div>
  </a>`;
}

function renderCardActionsToday(role, stats) {
  if (role !== 'admin') return '';
  return `<a href="/admin/logs" class="stat-card">
    <span class="icon">📈</span>
    <div class="number accent">${stats.actions_today || 0}</div>
    <div class="label">Действий за 24ч</div>
  </a>`;
}

function renderLinkAllLogs(role) {
  if (role !== 'admin') return '';
  return `<a href="/admin/logs" class="btn btn-ghost btn-sm">Все логи →</a>`;
}

// ============================================================
// РЕНДЕР БЛОКОВ
// ============================================================

function renderRecentActivity(recentActivity) {
  if (!recentActivity || recentActivity.length === 0) {
    return `<div class="empty-block"><span>📭</span><p>Нет недавних действий</p></div>`;
  }

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

  let html = '';
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

    html += `
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
  return html;
}

function renderAttention(attention) {
  let html = '';

  if (attention.maintenance.length > 0) {
    html += `
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
    html += `
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
    html += `
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
    html += `
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

  if (!html) {
    return `<div class="empty-block"><span>✅</span><p>Всё в порядке!</p></div>`;
  }
  return html;
}

function renderTopUsers(topUsers) {
  if (!topUsers || topUsers.length === 0) {
    return `<div class="empty-block"><span>📭</span><p>Нет активности за 30 дней</p></div>`;
  }

  const maxActions = Math.max(...topUsers.map(u => u.actions_count));
  let html = '';

  topUsers.forEach((user, index) => {
    const percent = Math.round((user.actions_count / maxActions) * 100);
    const userName = user.full_name || user.username;
    const initials = getInitials(userName);
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '·';

    html += `
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
  return html;
}

function renderCategoryStats(categoryStats) {
  if (categoryStats.categories.length === 0 || categoryStats.total === 0) {
    return `<div class="empty-block"><span>📭</span><p>Нет техники с категориями</p></div>`;
  }

  let html = '';
  categoryStats.categories.forEach(cat => {
    if (cat.equipment_count === 0) return;

    html += `
      <a href="/admin/catalog" class="category-stat-item" title="Перейти в справочник">
        <div class="category-stat-icon">
          ${cat.icon || '📁'}
        </div>
        <div class="category-stat-info">
          <div class="category-stat-name">${cat.name}</div>
          <div class="category-stat-meta">${cat.equipment_count} ед. · ${cat.types_count} типов</div>
        </div>
        <div class="category-stat-bar">
          <div class="category-stat-bar-fill" style="width: ${cat.percent}%;"></div>
        </div>
        <div class="category-stat-count">
          ${cat.percent}%
        </div>
      </a>
    `;
  });
  return html;
}

// ============================================================
// ГРАФИКИ (SVG)
// ============================================================

function renderActivityChart(data) {
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

  const points = data.map((d, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartHeight - (d.count / maxValue) * chartHeight;
    return { x, y, count: d.count, date: d.date };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  const areaPath = `M ${padding.left},${padding.top + chartHeight} ` +
                   points.map(p => `L ${p.x},${p.y}`).join(' ') +
                   ` L ${padding.left + (data.length - 1) * stepX},${padding.top + chartHeight} Z`;

  const gridLines = [];
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const y = padding.top + (chartHeight / ySteps) * i;
    const value = Math.round(maxValue * (1 - i / ySteps));
    gridLines.push(`
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
            stroke="var(--border-light)" stroke-width="1" stroke-dasharray="3,3"/>
      <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" 
            font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)">${value}</text>
    `);
  }

  const xLabels = [];
  data.forEach((d, i) => {
    if (i % 3 === 0 || i === data.length - 1) {
      const x = padding.left + i * stepX;
      const date = new Date(d.date);
      const label = `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
      xLabels.push(`
        <text x="${x}" y="${height - 10}" text-anchor="middle" 
              font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)">${label}</text>
      `);
    }
  });

  const circles = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--accent)" stroke="var(--bg-secondary)" stroke-width="2">
      <title>${p.date}: ${p.count} действий</title>
    </circle>
  `).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="activity-chart" preserveAspectRatio="xMidYMid meet">
      ${gridLines.join('')}
      
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      
      <path d="${areaPath}" fill="url(#areaGradient)"/>
      
      <polyline points="${polyline}" fill="none" stroke="var(--accent)" stroke-width="2" 
                stroke-linecap="round" stroke-linejoin="round"/>
      
      ${circles}
      ${xLabels.join('')}
    </svg>
  `;
}

function renderStatusDonut(stats) {
  const total = stats.total_equipment || 0;
  if (total === 0) {
    return '<div class="chart-empty">Нет данных</div>';
  }

  const data = [
    { label: 'Доступна', value: stats.available_equipment || 0, color: 'var(--success)' },
    { label: 'Назначена', value: stats.assigned_equipment || 0, color: 'var(--info)' },
    { label: 'На месте', value: stats.placed_equipment || 0, color: 'var(--purple)' },
    { label: 'В ремонте', value: stats.maintenance_equipment || 0, color: 'var(--warning)' },
    { label: 'Списана', value: stats.retired_equipment || 0, color: 'var(--danger)' },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return '<div class="chart-empty">Нет данных</div>';
  }

  const size = 160;
  const center = size / 2;
  const radius = 60;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  let segments = '';

  data.forEach(segment => {
    const percent = segment.value / total;
    const dashLength = percent * circumference;
    const gapLength = circumference - dashLength;

    segments += `
      <circle
        cx="${center}" cy="${center}" r="${radius}"
        fill="none"
        stroke="${segment.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${dashLength} ${gapLength}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${center} ${center})"
      />
    `;
    offset += dashLength;
  });

  const legend = data.map(d => `
    <div class="donut-legend-item">
      <span class="donut-legend-color" style="background: ${d.color};"></span>
      <span class="donut-legend-label">${d.label}</span>
      <span class="donut-legend-value">${d.value}</span>
    </div>
  `).join('');

  return `
    <div class="donut-chart-container">
      <svg viewBox="0 0 ${size} ${size}" class="donut-chart">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--bg-hover)" stroke-width="${strokeWidth}" />
        ${segments}
        <text x="${center}" y="${center - 5}" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text-primary)" font-family="var(--font-mono)">${total}</text>
        <text x="${center}" y="${center + 12}" text-anchor="middle" font-size="10" fill="var(--text-muted)">всего</text>
      </svg>
      <div class="donut-legend">
        ${legend}
      </div>
    </div>
  `;
}

module.exports = {
  escapeHtml,
  getInitials,
  timeAgoRu,
  renderActionAddEquipment,
  renderCardUsers,
  renderCardActionsToday,
  renderLinkAllLogs,
  renderRecentActivity,
  renderAttention,
  renderTopUsers,
  renderCategoryStats,
  renderActivityChart,
  renderStatusDonut,
};