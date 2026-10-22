// public/js/admin-users.js — Логика страницы «Управление доступом»

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(p => p);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;');
}

// ============================================================
// ПЕРЕМЕННЫЕ
// ============================================================

let deleteId = null;
let deleteType = null;
let deleteUserName = '';
let deleteEquipmentCount = 0;
let currentTempPassword = '';


// ============================================================
// ПОЛЬЗОВАТЕЛИ
// ============================================================

function editUser(id) {
    window.location.href = `/admin/user/edit/${id}`;
}

function deleteUserFromCard(id, name, equipmentCount) {
    closeViewUserModal();
    deleteId = id;
    deleteType = 'user';
    deleteUserName = name || 'пользователя';
    deleteEquipmentCount = equipmentCount || 0;

    document.getElementById('deleteUserText').innerHTML =
        `Вы уверены, что хотите удалить пользователя <strong>"${escapeHtml(deleteUserName)}"</strong>?`;

    const warning = document.getElementById('deleteUserWarning');
    if (deleteEquipmentCount > 0) {
        document.getElementById('deleteEquipmentCount').textContent = deleteEquipmentCount;
        warning.style.display = 'flex';
    } else {
        warning.style.display = 'none';
    }

    document.getElementById('deleteModal').classList.add('active');
}

function closeModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteId = null;
    deleteType = null;
    deleteUserName = '';
    deleteEquipmentCount = 0;
}

async function confirmDelete() {
    if (!deleteId) return;

    const endpoint = `/api/admin/users/${deleteId}`;

    try {
        const response = await fetch(endpoint, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showToast('❌ Ошибка при удалении', 'error');
    }

    closeModal();
}

function editUserFromCard(id) {
    closeViewUserModal();
    editUser(id);
}

function resetUserPasswordFromCard(id) {
    closeViewUserModal();
    const usernameEl = document.querySelector('#viewUserBody .user-header-username');
    const username = usernameEl ? usernameEl.textContent.replace('@', '').trim() : '';
    resetUserPassword(id, username);
}

function blockUserFromCard(id) {
    closeViewUserModal();
    blockUser(id);
}

function unblockUserFromCard(id) {
    closeViewUserModal();
    unblockUser(id);
}

// ============================================================
// БЛОКИРОВКА
// ============================================================

async function blockUser(id) {
    if (!confirm('Заблокировать пользователя? Он не сможет войти в систему.')) return;

    try {
        const response = await fetch(`/api/admin/users/${id}/block`, {
            method: 'POST'
        });
        const result = await response.json();

        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            setTimeout(() => location.reload(), 800);
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showToast('❌ Ошибка блокировки', 'error');
    }
}

async function unblockUser(id) {
    try {
        const response = await fetch(`/api/admin/users/${id}/unblock`, {
            method: 'POST'
        });
        const result = await response.json();

        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            setTimeout(() => location.reload(), 800);
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showToast('❌ Ошибка разблокировки', 'error');
    }
}

// ============================================================
// СБРОС ПАРОЛЯ
// ============================================================

async function resetUserPassword(id, username) {
    if (!confirm(`Сбросить пароль для пользователя "${username}"?\n\nБудет сгенерирован новый временный пароль.`)) return;

    try {
        const response = await fetch(`/api/admin/users/${id}/reset-password`, {
            method: 'POST'
        });
        const result = await response.json();

        if (result.success) {
            currentTempPassword = result.tempPassword;
            document.getElementById('tempPasswordValue').textContent = result.tempPassword;
            document.getElementById('passwordUsername').textContent = username;
            document.getElementById('passwordModal').classList.add('active');
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showToast('❌ Ошибка сброса пароля', 'error');
    }
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
    currentTempPassword = '';
    document.getElementById('tempPasswordValue').textContent = '';
}

function copyPassword() {
    if (!currentTempPassword) return;

    navigator.clipboard.writeText(currentTempPassword).then(() => {
        showToast('📋 Пароль скопирован в буфер обмена', 'success');
    }).catch(() => {
        showToast('❌ Не удалось скопировать', 'error');
    });
}

// ============================================================
// ПРОСМОТР ПОЛЬЗОВАТЕЛЯ
// ============================================================

async function viewUser(id) {
    try {
        const response = await fetch(`/api/admin/users/${id}/details`);
        const data = await response.json();

        if (!data.user) {
            showToast('❌ Пользователь не найден', 'error');
            return;
        }

        const { user, stats, activeEquipment, history } = data;

        // Запоминаем ID текущего пользователя в модалке — для проверки прав
        document.getElementById('viewUserModal').dataset.userId = id;

        const lastLogin = user.last_login
            ? new Date(user.last_login).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
            : 'никогда';

        const createdAt = user.created_at
            ? new Date(user.created_at).toLocaleDateString('ru-RU')
            : '—';

        const isActive = user.is_active === 1;
        const statusBadge = isActive
            ? '<span class="status-badge status-available">✅ Активен</span>'
            : '<span class="status-badge status-retired">🚫 Заблокирован</span>';

        const roleLabels = {
            admin:      '👑 Администратор',
            supervisor: '👁️ Супервизор',
            mol:        '🧑‍💼 МОЛ',
            user:       '👤 Пользователь',
        };
        const roleClass = `role-badge role-${user.role || 'user'}`;
        const roleBadge = `<span class="${roleClass}">${roleLabels[user.role] || escapeHtml(user.role)}</span>`;

        const initials = getInitials(user.full_name || user.username);

        let activeEquipmentHtml = '';
        if (activeEquipment.length === 0) {
            activeEquipmentHtml = `
                <div class="empty-equipment">
                    <span class="empty-icon">📭</span>
                    <p>Нет активной техники</p>
                </div>
            `;
        } else {
            // 🆕 5.5.3: таблица вместо карточек
            activeEquipmentHtml = `
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Инв. №</th>
                            <th>Модель</th>
                            <th>Corporate ID</th>
                            <th>Производитель</th>
                            <th>Выдано</th>
                            <th>Состояние</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            activeEquipment.forEach(eq => {
                const assignedDate = new Date(eq.assigned_date).toLocaleDateString('ru-RU');
                activeEquipmentHtml += `
                    <tr>
                        <td><strong>${escapeHtml(eq.inventory_number || '—')}</strong></td>
                        <td>${escapeHtml(eq.model_name || '—')}</td>
                        <td>${escapeHtml(eq.model_corporate_id || '—')}</td>
                        <td>${escapeHtml(eq.model_manufacturer || '—')}</td>
                        <td>${assignedDate}</td>
                        <td>${escapeHtml(eq.condition_on_assign || '—')}</td>
                    </tr>
                `;
            });
            activeEquipmentHtml += '</tbody></table>';
        }

        let historyHtml = '';
        if (history.length === 0) {
            historyHtml = '<p style="color: var(--text-muted); text-align: center; padding: 15px;">История пуста</p>';
        } else {
            // 🆕 5.5.4: сворачиваемая история (закрыта по умолчанию)
            let historyRows = '';
            history.forEach(h => {
                const assignedDate = h.assigned_date
                    ? new Date(h.assigned_date).toLocaleDateString('ru-RU')
                    : '—';
                const returnedDate = h.returned_date
                    ? new Date(h.returned_date).toLocaleDateString('ru-RU')
                    : '—';
                const histStatus = h.status === 'active'
                    ? '<span class="status-badge status-assigned">Активна</span>'
                    : '<span class="status-badge status-available">Возвращена</span>';

                historyRows += `
                    <tr>
                        <td><strong>${escapeHtml(h.inventory_number || '—')}</strong></td>
                        <td>${escapeHtml(h.model_name || '—')}</td>
                        <td>${assignedDate}</td>
                        <td>${returnedDate}</td>
                        <td>${histStatus}</td>
                    </tr>
                `;
            });

            historyHtml = `
                <details class="history-accordion">
                    <summary>📜 История получений (${stats.total})</summary>
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Инв. номер</th>
                                <th>Название</th>
                                <th>Выдано</th>
                                <th>Возвращено</th>
                                <th>Статус</th>
                            </tr>
                        </thead>
                        <tbody>${historyRows}</tbody>
                    </table>
                </details>
            `;
        }

        // === ДЕЙСТВИЯ В ПРАВОЙ КОЛОНКЕ ===
        const currentUserId = Number(window.currentUserId || 0);
        const isSelf = Number(user.id) === currentUserId;

        let actionButtons = '';

        // Редактировать — всегда, кроме самого себя? Нет, себя тоже можно.
        actionButtons += `<button type="button" class="btn btn-ghost" onclick="editUserFromCard(${user.id})">✏️ Редактировать</button>`;

        // Сбросить пароль — всегда
        actionButtons += `<button type="button" class="btn btn-warning" onclick="resetUserPasswordFromCard(${user.id}, '${escapeAttr(user.username)}')">🔑 Сбросить пароль</button>`;

        // Заблокировать / Разблокировать — только не себя
        if (!isSelf) {
            if (isActive) {
                actionButtons += `<button type="button" class="btn btn-warning" onclick="blockUserFromCard(${user.id})">🚫 Заблокировать</button>`;
            } else {
                actionButtons += `<button type="button" class="btn btn-success" onclick="unblockUserFromCard(${user.id})">✅ Разблокировать</button>`;
            }
        }

        // Удалить — только не себя
        if (!isSelf) {
            actionButtons += `<div class="user-actions-divider"></div>`;
            actionButtons += `<button type="button" class="btn btn-danger" onclick="deleteUserFromCard(${user.id}, '${escapeAttr(user.full_name || user.username)}', ${stats.active})">🗑️ Удалить</button>`;
        }

        const body = document.getElementById('viewUserBody');
        body.innerHTML = `
            <div class="user-header-card">
                <div class="user-header-avatar">${initials}</div>
                <div class="user-header-info">
                    <h2>${escapeHtml(user.full_name || user.username)}</h2>
                    <div class="user-header-username">@${escapeHtml(user.username)}</div>
                    <div class="user-header-badges">
                        ${roleBadge}
                        ${statusBadge}
                    </div>
                </div>
            </div>

            <div class="user-detail-layout">
                <!-- ЛЕВАЯ КОЛОНКА -->
                <div class="user-detail-main">
                    <div class="user-stats">
                        <div class="user-stat">
                            <div class="user-stat-number active">${stats.active}</div>
                            <div class="user-stat-label">Активной техники</div>
                        </div>
                        <div class="user-stat">
                            <div class="user-stat-number total">${stats.total}</div>
                            <div class="user-stat-label">Всего получал</div>
                        </div>
                        <div class="user-stat">
                            <div class="user-stat-number returned">${stats.returned}</div>
                            <div class="user-stat-label">Возвращено</div>
                        </div>
                    </div>

                    <div class="user-detail-section">
                        <h4>📋 Контактная информация</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Email</label>
                                <div class="value">${escapeHtml(user.email || '—')}</div>
                            </div>
                            <div class="detail-item">
                                <label>Телефон</label>
                                <div class="value">${escapeHtml(user.phone || '—')}</div>
                            </div>
                            <div class="detail-item">
                                <label>Отдел</label>
                                <div class="value">${escapeHtml(user.department || '—')}</div>
                            </div>
                            <div class="detail-item">
                                <label>Последний вход</label>
                                <div class="value">${lastLogin}</div>
                            </div>
                            <div class="detail-item">
                                <label>Дата создания</label>
                                <div class="value">${createdAt}</div>
                            </div>
                            <div class="detail-item">
                                <label>ID пользователя</label>
                                <div class="value">#${user.id}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ПРАВАЯ КОЛОНКА -->
                <div class="user-detail-side">
                    <div class="user-actions-card">
                        <h4>⚡ Действия</h4>
                        <div class="user-actions-list">
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            </div>
                <!-- 🆕 ПОЛНАЯ ШИРИНА -->
            <div class="user-detail-section">
                <h4>📦 Активная техника (${stats.active})</h4>
                ${activeEquipmentHtml}
            </div>

            <div class="user-detail-section">
                ${historyHtml}
            </div>
        `;

        document.getElementById('viewUserModal').classList.add('active');
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('❌ Ошибка загрузки данных', 'error');
    }
}

function closeViewUserModal() {
    document.getElementById('viewUserModal').classList.remove('active');
}

// ============================================================
// ФИЛЬТРЫ (H.3)
// ============================================================

function applyFilters() {
    const params = new URLSearchParams();

    const search = document.getElementById('filterSearch')?.value.trim();
    const role = document.getElementById('filterRole')?.value;
    const status = document.getElementById('filterStatus')?.value;
    const pageSize = document.getElementById('filterPageSize')?.value;

    if (search) params.set('search', search);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (pageSize) params.set('limit', pageSize);

    window.location.href = '/admin/users?' + params.toString();
}

function resetFilters() {
    window.location.href = '/admin/users';
}

function applyPageSize() {
    applyFilters();
}


// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // 🆕 H.3: currentUserId для проверки прав в карточке
    window.currentUserId = parseInt(document.getElementById('currentUserId')?.value || '0', 10);
    // Закрытие модалок по клику на оверлей
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                if (this.id === 'deleteModal') closeModal();
                if (this.id === 'passwordModal') closePasswordModal();
                if (this.id === 'viewUserModal') closeViewUserModal();
            }
        });
    });

    const searchUsers = document.getElementById('searchUsers');
    if (searchUsers) searchUsers.focus();

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closePasswordModal();
            closeViewUserModal();
        }
    });
        // 🆕 H.3: Enter в поиске → применить
    const searchEl = document.getElementById('filterSearch');
    if (searchEl) {
        searchEl.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyFilters();
            }
        });
    }

    // 🆕 H.3: смена размера страницы → сразу применить
    const pageSizeEl = document.getElementById('filterPageSize');
    if (pageSizeEl) {
        pageSizeEl.addEventListener('change', applyFilters);
    }
});