// public/js/workplace-details.js
// Логика страницы деталей офиса: дерево Кабинеты → Рабочие места

// ============================================================
// СОСТОЯНИЕ
// ============================================================

const pageData = document.getElementById('pageData');
const OFFICE_ID = pageData ? parseInt(pageData.dataset.officeId) : null;
const OFFICE_NAME = pageData ? pageData.dataset.officeName : '';

// 🆕 Этап 4: роль
const CURRENT_ROLE = pageData ? (pageData.dataset.currentRole || '') : '';

let tree = null;              // Дерево офиса
let deleteTarget = null;      // { type: 'room'|'workplace', id, name }

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    if (!OFFICE_ID || isNaN(OFFICE_ID)) {
        showToast('❌ Ошибка: не указан ID офиса', 'error');
        setTimeout(() => window.location.href = '/admin/workplaces', 2000);
        return;
    }

    await loadOfficeTree();

    // 🆕 Этап 4: ответственные МОЛ — только для admin
    if (CURRENT_ROLE === 'admin') {
        document.getElementById('officeResponsiblesCard').style.display = '';
        await loadOfficeResponsibles();
    }

    // 🆕 Подсветка рабочего места из ?highlightWorkplace=ID
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlightWorkplace');
    if (highlightId) {
        highlightWorkplace(highlightId);
    }
});
// ============================================================
// ЗАГРУЗКА ДЕРЕВА
// ============================================================

async function loadOfficeTree() {
    const container = document.getElementById('officeTree');
    if (!container) return;

    container.innerHTML = '<div class="loading-block">⏳ Загрузка структуры...</div>';

    try {
        const response = await fetch(`/api/admin/offices/${OFFICE_ID}/tree`);

        if (!response.ok) {
            throw new Error('Ошибка загрузки дерева');
        }

        tree = await response.json();
        renderTree();
        updateOfficeHeader();
    } catch (error) {
        console.error('❌ Ошибка загрузки дерева:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <h3>Ошибка загрузки</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// ============================================================
// ШАПКА (подзаголовок и бейджи)
// ============================================================

function updateOfficeHeader() {
    if (!tree) return;

    // Подзаголовок: адрес
    const subtitle = document.getElementById('officeSubtitle');
    if (subtitle) {
        subtitle.textContent = tree.address || '';
    }

    // Бейджи
    const badges = document.getElementById('officeBadges');
    if (badges) {
        const items = [];
        if (tree.is_default === 1) {
            items.push('<span class="badge badge-warning">⭐ По умолчанию</span>');
        }
        // В дереве getOfficeTree фильтрует is_active = 1 для rooms/workplaces,
        // сам офис приходит без is_active. Если нужно — расширим SQL, пока
        // просто не выводим бейдж активности.
        badges.innerHTML = items.join('');
    }
}

// ============================================================
// ОТРИСОВКА ДЕРЕВА
// ============================================================

function renderTree() {
    const container = document.getElementById('officeTree');
    if (!container) return;

    if (!tree || !tree.rooms || tree.rooms.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <h3>Структура офиса пуста</h3>
                <p>Нажмите "➕ Добавить кабинет" чтобы начать</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tree.rooms.map(room => renderRoom(room)).join('');
}

function renderRoom(room) {
    const workplacesCount = room.workplaces ? room.workplaces.length : 0;
    const equipmentCount = (room.workplaces || []).reduce(
        (sum, wp) => sum + (wp.equipment_count || 0), 0
    );

    return `
        <div class="tree-room" data-room-id="${room.id}">
            <div class="tree-room-header" onclick="toggleRoom(${room.id}, event)">
                <span class="toggle">▶</span>
                <span class="icon">🚪</span>
                <div class="tree-room-info">
                    <div class="tree-room-name">${escapeHtml(room.name)}</div>
                    ${room.description ? `<div class="tree-room-description">${escapeHtml(room.description)}</div>` : ''}
                </div>
                <div class="tree-room-meta">
                    <span>🪑 ${workplacesCount} мест</span>
                    <span>🔧 ${equipmentCount} техники</span>
                </div>
                <div class="tree-room-actions" onclick="event.stopPropagation()">
                    <button onclick="openWorkplaceModal(null, ${room.id})" class="tree-btn add" title="Добавить рабочее место">➕</button>
                    <button onclick="openRoomModal(${room.id})" class="tree-btn edit" title="Редактировать">✏️</button>
                    <button onclick="deleteRoomItem(${room.id}, '${escapeAttr(room.name)}', ${workplacesCount})" class="tree-btn delete" title="Удалить">🗑️</button>
                </div>
            </div>
            <div class="tree-room-body">
                ${workplacesCount === 0
                    ? `<div class="tree-empty" style="padding: 20px; background: var(--bg-tertiary);">
                        <div class="empty-text" style="font-size: 13px;">Нет рабочих мест</div>
                       </div>`
                    : room.workplaces.map(wp => renderWorkplace(wp)).join('')
                }
            </div>
        </div>
    `;
}

function renderWorkplace(wp) {
    const equipmentCount = wp.equipment_count || 0;

    // Класс счётчика: пусто или есть техника
    const countClass = equipmentCount > 0 ? 'has-items' : 'empty';

    // Текст счётчика
    const countText = `${equipmentCount}`;

    return `
        <div class="tree-workplace" data-workplace-id="${wp.id}" onclick="viewWorkplace(${wp.id})">
            <span class="tree-workplace-icon">🪑</span>
            <div class="tree-workplace-info">
                <div class="tree-workplace-name">${escapeHtml(wp.name)}</div>
                ${wp.code ? `<div class="tree-workplace-code">${escapeHtml(wp.code)}</div>` : ''}
                ${wp.description ? `<span class="tree-description">${escapeHtml(wp.description)}</span>` : ''}
            </div>
            <div class="tree-workplace-meta">
                <span class="tree-workplace-count ${countClass}">${countText}</span>
            </div>
            <div class="tree-workplace-actions" onclick="event.stopPropagation()">
                <button onclick="openWorkplaceModal(${wp.id})" class="tree-btn edit" title="Редактировать">✏️</button>
                ${equipmentCount > 0
                    ? `<button class="tree-btn delete" disabled title="Нельзя удалить: на месте есть техника" style="opacity: 0.3; cursor: not-allowed;">🗑️</button>`
                    : `<button onclick="deleteWorkplaceItem(${wp.id}, '${escapeAttr(wp.name)}', 0)"
                        class="tree-btn delete" title="Удалить">🗑️</button>`
                }
            </div>
        </div>
    `;
}

// ============================================================
// РАЗВОРАЧИВАНИЕ / СВОРАЧИВАНИЕ
// ============================================================

function toggleRoom(roomId, event) {
    if (event) event.stopPropagation();
    const room = document.querySelector(`.tree-room[data-room-id="${roomId}"]`);
    if (!room) return;

    room.classList.toggle('expanded');

    const toggle = room.querySelector('.tree-room-header .toggle');
    if (toggle) {
        toggle.textContent = room.classList.contains('expanded') ? '▼' : '▶';
    }
}

function expandAll() {
    document.querySelectorAll('.tree-room').forEach(r => r.classList.add('expanded'));
    document.querySelectorAll('.tree-room-header .toggle').forEach(t => t.textContent = '▼');
}

function collapseAll() {
    document.querySelectorAll('.tree-room').forEach(r => r.classList.remove('expanded'));
    document.querySelectorAll('.tree-room-header .toggle').forEach(t => t.textContent = '▶');
}

// ============================================================
// ПОДСВЕТКА РАБОЧЕГО МЕСТА (из ?highlightWorkplace=ID)
// ============================================================

function highlightWorkplace(workplaceId) {
    const target = document.querySelector(`.tree-workplace[data-workplace-id="${workplaceId}"]`);
    if (!target) return;

    // Раскрываем родительский кабинет
    const parentRoom = target.closest('.tree-room');
    if (parentRoom && !parentRoom.classList.contains('expanded')) {
        parentRoom.classList.add('expanded');
        const toggle = parentRoom.querySelector('.tree-room-header .toggle');
        if (toggle) toggle.textContent = '▼';
    }

    // Скролл к элементу
    setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    // Подсветка
    target.classList.add('highlight');
    setTimeout(() => {
        target.classList.remove('highlight');
    }, 2200);
}

// ============================================================
// МОДАЛЬНОЕ ОКНО: КАБИНЕТ
// ============================================================

function openRoomModal(id = null) {
    const modal = document.getElementById('roomModal');
    const title = document.getElementById('roomModalTitle');
    const form = document.getElementById('roomForm');
    const activeGroup = document.getElementById('roomActiveGroup');

    form.reset();
    document.getElementById('roomOfficeId').value = OFFICE_ID;

    if (id) {
        const room = findRoom(id);
        if (!room) return;

        title.textContent = '✏️ Редактировать кабинет';
        document.getElementById('roomId').value = room.id;
        document.getElementById('roomName').value = room.name || '';
        document.getElementById('roomDescription').value = room.description || '';
        document.getElementById('roomIsActive').checked = room.is_active !== 0;
        activeGroup.style.display = 'block';
    } else {
        title.textContent = '➕ Добавить кабинет';
        document.getElementById('roomId').value = '';
        document.getElementById('roomName').value = '';
        document.getElementById('roomDescription').value = '';
        document.getElementById('roomIsActive').checked = true;
        activeGroup.style.display = 'none';
    }

    modal.classList.add('active');
    setTimeout(() => document.getElementById('roomName').focus(), 100);
}

function closeRoomModal() {
    document.getElementById('roomModal').classList.remove('active');
}

async function saveRoom(event) {
    event.preventDefault();

    const btn = document.getElementById('roomSaveBtn');
    const id = document.getElementById('roomId').value;
    const isEdit = !!id;

    const data = {
        office_id: OFFICE_ID,
        name: document.getElementById('roomName').value.trim(),
        description: document.getElementById('roomDescription').value.trim(),
        is_active: document.getElementById('roomIsActive').checked,
    };

    if (!data.name) {
        showToast('❌ Введите название кабинета', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Сохранение...';

    try {
        const url = isEdit ? `/api/admin/rooms/${id}` : '/api/admin/rooms';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
            showToast(`✅ Кабинет ${isEdit ? 'обновлён' : 'создан'}`, 'success');
            closeRoomModal();
            await loadOfficeTree();
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения кабинета:', error);
        showToast('❌ Ошибка соединения', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Сохранить';
    }
}

// ============================================================
// МОДАЛЬНОЕ ОКНО: РАБОЧЕЕ МЕСТО
// ============================================================

function openWorkplaceModal(id = null, roomId = null) {
    const modal = document.getElementById('workplaceModal');
    const title = document.getElementById('workplaceModalTitle');
    const form = document.getElementById('workplaceForm');
    const activeGroup = document.getElementById('workplaceActiveGroup');

    form.reset();

    if (id) {
        const wp = findWorkplace(id);
        if (!wp) return;

        title.textContent = '✏️ Редактировать рабочее место';
        document.getElementById('workplaceId').value = wp.id;
        document.getElementById('workplaceRoomId').value = wp.room_id;
        document.getElementById('workplaceName').value = wp.name || '';
        document.getElementById('workplaceCode').value = wp.code || '';
        document.getElementById('workplaceDescription').value = wp.description || '';
        document.getElementById('workplaceIsActive').checked = wp.is_active !== 0;
        activeGroup.style.display = 'block';
    } else {
        title.textContent = '➕ Добавить рабочее место';
        document.getElementById('workplaceId').value = '';
        document.getElementById('workplaceRoomId').value = roomId || '';
        document.getElementById('workplaceName').value = '';
        document.getElementById('workplaceCode').value = '';
        document.getElementById('workplaceDescription').value = '';
        document.getElementById('workplaceIsActive').checked = true;
        activeGroup.style.display = 'none';

        // 🆕 Автозаполнение
        if (roomId) {
            autoFillNextWorkplace(roomId);
        }
    }

    modal.classList.add('active');
    setTimeout(() => document.getElementById('workplaceName').focus(), 100);
}

/**
 * 🆕 5.0.2.1: Автозаполнение названия и кода рабочего места.
 */
async function autoFillNextWorkplace(roomId) {
    try {
        const response = await fetch(`/api/admin/rooms/${roomId}/next-workplace`);
        if (!response.ok) {
            console.warn('⚠️ Не удалось получить следующий номер места');
            return;
        }
        const data = await response.json();

        const nameInput = document.getElementById('workplaceName');
        const codeInput = document.getElementById('workplaceCode');

        if (nameInput && !nameInput.value) {
            nameInput.value = data.next_name || '';
        }
        if (codeInput && !codeInput.value && data.next_code) {
            codeInput.value = data.next_code;
        }
    } catch (err) {
        console.error('❌ Ошибка автозаполнения места:', err);
    }
}

function closeWorkplaceModal() {
    document.getElementById('workplaceModal').classList.remove('active');
}

async function saveWorkplace(event) {
    event.preventDefault();

    const btn = document.getElementById('workplaceSaveBtn');
    const id = document.getElementById('workplaceId').value;
    const roomId = document.getElementById('workplaceRoomId').value;
    const isEdit = !!id;

    const data = {
        room_id: roomId,
        name: document.getElementById('workplaceName').value.trim(),
        code: document.getElementById('workplaceCode').value.trim(),
        description: document.getElementById('workplaceDescription').value.trim(),
        is_active: document.getElementById('workplaceIsActive').checked,
    };

    if (!data.name) {
        showToast('❌ Введите название рабочего места', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Сохранение...';

    try {
        const url = isEdit ? `/api/admin/workplaces/${id}` : '/api/admin/workplaces';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
            showToast(`✅ Рабочее место ${isEdit ? 'обновлено' : 'создано'}`, 'success');
            closeWorkplaceModal();
            await loadOfficeTree();
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения рабочего места:', error);
        showToast('❌ Ошибка соединения', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Сохранить';
    }
}

// ============================================================
// ПРОСМОТР РАБОЧЕГО МЕСТА (с техникой)
// ============================================================

async function viewWorkplace(workplaceId) {
    const modal = document.getElementById('workplaceViewModal');
    const title = document.getElementById('workplaceViewTitle');
    const body = document.getElementById('workplaceViewBody');

    body.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';
    modal.classList.add('active');

    try {
        const [wp, equipment] = await Promise.all([
            fetch(`/api/admin/workplaces/${workplaceId}`).then(r => r.json()),
            fetch(`/api/admin/workplaces/${workplaceId}/equipment`).then(r => r.json()),
        ]);

        title.textContent = `🪑 ${wp.name}`;

        let html = `
            <div class="workplace-view-header">
                <div class="workplace-view-icon">🪑</div>
                <div class="workplace-view-info">
                    <h2>${escapeHtml(wp.name)}</h2>
                    ${wp.code ? `<div class="workplace-view-code">${escapeHtml(wp.code)}</div>` : ''}
                    ${wp.room_name ? `
                        <div style="font-size: 13px; margin-top: 5px; opacity: 0.9;">
                            📍 ${escapeHtml(wp.office_name || '')} → ${escapeHtml(wp.room_name)}
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="workplace-view-section">
                <h4>ℹ️ Информация</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Занято</label>
                        <div class="value">${equipment.length}</div>
                    </div>
                    <div class="detail-item">
                        <label>Офис</label>
                        <div class="value">${escapeHtml(wp.office_name || '')}</div>
                    </div>
                    <div class="detail-item">
                        <label>Кабинет</label>
                        <div class="value">${escapeHtml(wp.room_name || '')}</div>
                    </div>
                </div>
                ${wp.description ? `
                    <div class="detail-item" style="margin-top: 12px;">
                        <label>Описание</label>
                        <div class="value">${escapeHtml(wp.description)}</div>
                    </div>
                ` : ''}
            </div>

            <div class="workplace-view-section">
                <h4>🔧 Техника на рабочем месте (${equipment.length})</h4>
        `;

        if (equipment.length === 0) {
            html += `
                <div class="workplace-view-empty">
                    <span class="emoji">📭</span>
                    <div>Рабочее место пусто</div>
                </div>
            `;
        } else {
            // 🆕 5.0.7: Таблица вместо карточек
            const statusLabels = {
                available: '✅ Доступна',
                placed: '🪑 На месте',
                assigned: '👤 Назначена',
                maintenance: '🔧 В ремонте',
                retired: '📦 Списана',
            };

            html += `
                <table class="cell-equipment-table">
                    <thead>
                        <tr>
                            <th>Инв. №</th>
                            <th>Наименование</th>
                            <th>Corporate ID</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            equipment.forEach(eq => {
                const statusLabel = statusLabels[eq.status] || eq.status;
                html += `
                    <tr>
                        <td><span class="eq-inv">${escapeHtml(eq.inventory_number || '—')}</span></td>
                        <td>
                            <div class="eq-name">${escapeHtml(eq.model_name || '—')}</div>
                            ${eq.type_name ? `<div class="eq-type">${eq.type_icon || '📦'} ${escapeHtml(eq.type_name)}</div>` : ''}
                        </td>
                        <td><span class="eq-corporate">${escapeHtml(eq.model_corporate_id || '—')}</span></td>
                        <td><span class="status-badge status-${eq.status}">${statusLabel}</span></td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
        }

        html += '</div>';

        body.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки рабочего места:', error);
        body.innerHTML = `
            <div class="workplace-view-empty">
                <span class="emoji">❌</span>
                <div>Ошибка загрузки</div>
            </div>
        `;
    }
}

function closeWorkplaceViewModal() {
    document.getElementById('workplaceViewModal').classList.remove('active');
}

// ============================================================
// 🆕 ЭТАП 4: ОТВЕТСТВЕННЫЕ МОЛ
// ============================================================

let allMols = null;

async function loadOfficeResponsibles() {
  const listEl = document.getElementById('officeResponsiblesList');
  const selectEl = document.getElementById('officeMolSelect');
  if (!listEl || !selectEl) return;

  listEl.innerHTML = '<div class="loading-block">⏳ Загрузка...</div>';

  try {
    const respRes = await fetch(`/api/admin/offices/${OFFICE_ID}/responsibles`);
    const responsibles = await respRes.json();

    if (!allMols) {
      const usersRes = await fetch('/api/admin/users');
      const users = await usersRes.json();
      allMols = (users || []).filter(u => u.role === 'mol' && u.is_active === 1);
    }

    if (!responsibles || responsibles.length === 0) {
      listEl.innerHTML = '<div class="mol-empty">Нет ответственных МОЛ</div>';
    } else {
      listEl.innerHTML = responsibles.map(r => `
        <div class="mol-responsible-item">
          <div class="mol-responsible-info">
            <span class="mol-responsible-name">${escapeHtml(r.full_name || r.username)}</span>
            ${r.department ? `<span class="mol-responsible-dept">${escapeHtml(r.department)}</span>` : ''}
          </div>
          <button type="button" class="btn-icon btn-delete"
                  onclick="removeOfficeResponsible(${r.user_id})"
                  title="Убрать">✕</button>
        </div>
      `).join('');
    }

    const assignedIds = new Set((responsibles || []).map(r => r.user_id));
    const freeMols = allMols.filter(m => !assignedIds.has(m.id));

    selectEl.innerHTML = '<option value="">— Выберите МОЛ для добавления —</option>' +
      freeMols.map(m => `<option value="${m.id}">${escapeHtml(m.full_name || m.username)}</option>`).join('');

    if (freeMols.length === 0) {
      selectEl.disabled = true;
      selectEl.innerHTML = '<option value="">— Все МОЛы уже назначены —</option>';
    } else {
      selectEl.disabled = false;
    }
  } catch (err) {
    console.error('❌ Ошибка загрузки ответственных МОЛ:', err);
    listEl.innerHTML = '<div class="mol-empty">Ошибка загрузки</div>';
  }
}

async function addOfficeResponsible() {
  const selectEl = document.getElementById('officeMolSelect');
  const userId = selectEl?.value;
  if (!userId) {
    showToast('❌ Выберите МОЛ', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/admin/offices/${OFFICE_ID}/responsibles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(userId, 10) }),
    });
    const data = await res.json();

    if (data.success || data.already) {
      showToast('✅ МОЛ назначен', 'success');
      await loadOfficeResponsibles();
    } else {
      showToast('❌ ' + (data.error || 'Ошибка'), 'error');
    }
  } catch (err) {
    console.error('❌ Ошибка добавления МОЛ:', err);
    showToast('❌ Ошибка соединения', 'error');
  }
}

async function removeOfficeResponsible(userId) {
  if (!confirm('Убрать этого МОЛа с ответственного за офис?')) return;

  try {
    const res = await fetch(`/api/admin/offices/${OFFICE_ID}/responsibles/${userId}`, {
      method: 'DELETE',
    });
    const data = await res.json();

    if (data.success) {
      showToast('✅ МОЛ убран', 'success');
      await loadOfficeResponsibles();
    } else {
      showToast('❌ ' + (data.error || 'Ошибка'), 'error');
    }
  } catch (err) {
    console.error('❌ Ошибка удаления МОЛ:', err);
    showToast('❌ Ошибка соединения', 'error');
  }
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================

function deleteRoomItem(id, name, workplacesCount) {
    deleteTarget = { type: 'room', id, name };

    document.getElementById('deleteMessage').innerHTML =
        `Вы уверены, что хотите удалить кабинет <strong>"${escapeHtml(name)}"</strong>?`;

    const warning = document.getElementById('deleteWarning');
    const warningText = document.getElementById('deleteWarningText');

    if (workplacesCount > 0) {
        warningText.textContent = `В кабинете ${workplacesCount} рабочих мест. Удаление невозможно, пока в кабинете есть рабочие места.`;
        warning.style.display = 'flex';
    } else {
        warning.style.display = 'none';
    }

    document.getElementById('deleteModal').classList.add('active');
}

function deleteWorkplaceItem(id, name, equipmentCount) {
    deleteTarget = { type: 'workplace', id, name };

    document.getElementById('deleteMessage').innerHTML =
        `Вы уверены, что хотите удалить рабочее место <strong>"${escapeHtml(name)}"</strong>?`;

    const warning = document.getElementById('deleteWarning');
    const warningText = document.getElementById('deleteWarningText');

    if (equipmentCount > 0) {
        warningText.textContent = `На рабочем месте ${equipmentCount} единиц техники. Удаление невозможно, пока место не пусто.`;
        warning.style.display = 'flex';
    } else {
        warning.style.display = 'none';
    }

    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteTarget = null;
}

async function confirmDelete() {
    if (!deleteTarget) return;

    const { type, id } = deleteTarget;
    const url = type === 'room'
        ? `/api/admin/rooms/${id}`
        : `/api/admin/workplaces/${id}`;

    try {
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            const typeNames = { room: 'Кабинет', workplace: 'Рабочее место' };
            showToast(`✅ ${typeNames[type]} удалено`, 'success');
            closeDeleteModal();
            await loadOfficeTree();
        } else {
            showToast('❌ ' + (result.error || 'Ошибка удаления'), 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showToast('❌ Ошибка соединения', 'error');
    }
}

// ============================================================
// РЕДАКТИРОВАНИЕ ИНФОРМАЦИИ ОБ ОФИСЕ
// ============================================================

function editOfficeInfo() {
    // Возврат на страницу офисов — там форма редактирования
    window.location.href = '/admin/workplaces';
}

// ============================================================
// ПОИСК ПО ДЕРЕВУ
// ============================================================

function findRoom(id) {
    if (!tree || !tree.rooms) return null;
    return tree.rooms.find(r => r.id === id);
}

function findWorkplace(id) {
    if (!tree || !tree.rooms) return null;
    for (const room of tree.rooms) {
        if (room.workplaces) {
            const wp = room.workplaces.find(w => w.id === id);
            if (wp) return wp;
        }
    }
    return null;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

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
// ЗАКРЫТИЕ МОДАЛОК
// ============================================================

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        if (e.target.id === 'roomModal') closeRoomModal();
        if (e.target.id === 'workplaceModal') closeWorkplaceModal();
        if (e.target.id === 'workplaceViewModal') closeWorkplaceViewModal();
        if (e.target.id === 'deleteModal') closeDeleteModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeRoomModal();
        closeWorkplaceModal();
        closeWorkplaceViewModal();
        closeDeleteModal();
    }
});