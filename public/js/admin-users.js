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

// ============================================================
// ПЕРЕМЕННЫЕ
// ============================================================

let deleteId = null;
let deleteType = null;
let deleteUserName = '';
let deleteEquipmentCount = 0;
let currentTempPassword = '';

// ============================================================
// ПОИСК
// ============================================================

function searchTable(type) {
    const input = document.getElementById(type === 'equipment' ? 'searchEquipment' : 'searchUsers');
    if (!input) return;
    const filter = input.value.toLowerCase();
    const table = document.getElementById(type === 'equipment' ? 'equipmentTableBody' : 'usersTableBody');
    if (!table) return;

    const rows = table.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        let found = false;
        for (let j = 0; j < cells.length; j++) {
            const text = cells[j].textContent || cells[j].innerText;
            if (text.toLowerCase().indexOf(filter) > -1) {
                found = true;
                break;
            }
        }
        rows[i].style.display = found ? '' : 'none';
    }
}

// ============================================================
// ПОЛЬЗОВАТЕЛИ
// ============================================================

function editUser(id) {
    window.location.href = `/admin/user/edit/${id}`;
}

function deleteUser(id, name) {
    deleteId = id;
    deleteType = 'user';
    deleteUserName = name || 'пользователя';
    deleteEquipmentCount = 0;

    const rows = document.querySelectorAll('#usersTableBody tr');
    rows.forEach(row => {
        const cells = row.getElementsByTagName('td');
        if (cells[0] && parseInt(cells[0].textContent) === id) {
            // Ищем бейдж с количеством ТМЦ (класс badge-count)
            const badge = cells[5]?.querySelector('.badge-count');
            deleteEquipmentCount = badge ? parseInt(badge.textContent) : 0;
        }
    });

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

        // Роль — теперь 4 варианта
        const roleLabels = {
            admin:      '👑 Администратор',
            supervisor: '👁️ Супервизор',
            mol:        '🧑‍💼 МОЛ',
            user:       '👤 Пользователь',
        };
        const roleClass = `role-badge role-${user.role || 'user'}`;
        const roleBadge = `<span class="${roleClass}">${roleLabels[user.role] || user.role}</span>`;

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
            activeEquipmentHtml = '<div class="equipment-cards">';
            activeEquipment.forEach(eq => {
                const assignedDate = new Date(eq.assigned_date).toLocaleDateString('ru-RU');
                activeEquipmentHtml += `
                    <div class="equipment-card">
                        <div class="equipment-card-header">
                            <span class="equipment-card-inv">${eq.inventory_number}</span>
                            <span class="equipment-card-date">${assignedDate}</span>
                        </div>
                        <div class="equipment-card-body">
                            <div class="equipment-card-name">${escapeHtml(eq.model_name || '—')}</div>
                            ${eq.model_corporate_id ? `<div class="equipment-card-model">${escapeHtml(eq.model_corporate_id)}</div>` : ''}
                            ${eq.model_manufacturer ? `<div class="equipment-card-manufacturer">${escapeHtml(eq.model_manufacturer)}</div>` : ''}
                        </div>
                        ${eq.condition_on_assign ? `
                            <div class="equipment-card-footer">
                                Состояние: ${eq.condition_on_assign}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            activeEquipmentHtml += '</div>';
        }

        let historyHtml = '';
        if (history.length === 0) {
            historyHtml = '<p style="color: #a0aec0; text-align: center; padding: 15px;">История пуста</p>';
        } else {
            historyHtml = `
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
                    <tbody>
            `;
            history.forEach(h => {
                const assignedDate = h.assigned_date
                    ? new Date(h.assigned_date).toLocaleDateString('ru-RU')
                    : '—';
                const returnedDate = h.returned_date
                    ? new Date(h.returned_date).toLocaleDateString('ru-RU')
                    : '—';
                const statusBadge = h.status === 'active'
                    ? '<span class="status-badge status-assigned">Активна</span>'
                    : '<span class="status-badge status-available">Возвращена</span>';

                historyHtml += `
                    <tr>
                        <td><strong>${escapeHtml(h.inventory_number || '—')}</strong></td>
                        <td>${escapeHtml(h.model_name || '—')}</td>
                        <td>${assignedDate}</td>
                        <td>${returnedDate}</td>
                        <td>${statusBadge}</td>
                    </tr>
                `;
            });
            historyHtml += '</tbody></table>';
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

            <div class="user-detail-section">
                <h4>📦 Активная техника (${stats.active})</h4>
                ${activeEquipmentHtml}
            </div>

            <div class="user-detail-section">
                <h4>📜 История получений (${stats.total})</h4>
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
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
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
});