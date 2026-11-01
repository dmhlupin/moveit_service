// public/js/manage/columns.js
// 5.11.3.2: скрытие / показ колонок таблицы /manage.
// Сохраняется в localStorage, перерисовывается без перезагрузки.

(function () {
    'use strict';

    const STORAGE_KEY = 'manage.hiddenColumns';
    const MENU_ID = 'columnsMenu';

    // Ключи → читаемые названия (для меню)
    const COLUMN_LABELS = {
        checkbox:    'Выбор (чекбокс)',
        id:          'ID',
        inventory:   'Инв. №',
        model:       'Модель',
        corporate:   'Корп. ИД',
        category:    'Категория',
        type:        'Тип',
        description: 'Описание',
        location:    'Место хранения',
        status:      'Статус',
        assigned:    'Назначена',
        responsible: 'Ответственный МОЛ',
    };

    // ---------- localStorage ----------
    function getHiddenColumns() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function setHiddenColumns(arr) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch (e) {}
    }

    // ---------- Применение к DOM ----------
    function applyToDOM() {
        const hidden = getHiddenColumns();
        document.querySelectorAll('#equipmentTableBody tr:not(.empty-row)').forEach(tr => {
            tr.querySelectorAll('[data-col]').forEach(cell => {
                const key = cell.getAttribute('data-col');
                cell.style.display = hidden.includes(key) ? 'none' : '';
            });
        });
        document.querySelectorAll('table.manage-table thead th[data-col]').forEach(th => {
            const key = th.getAttribute('data-col');
            th.style.display = hidden.includes(key) ? 'none' : '';
        });
        updateEmptyRowColspan();
    }

    function updateEmptyRowColspan() {
        const emptyRow = document.querySelector('#equipmentTableBody tr.empty-row');
        if (!emptyRow) return;
        const visibleCount = getVisibleColumnsCount();
        const td = emptyRow.querySelector('td');
        if (td) td.colSpan = visibleCount;
    }

    function getVisibleColumnsCount() {
        const hidden = getHiddenColumns();
        let count = 0;
        // считаем по первой непустой строке таблицы (td с data-col)
        const firstRow = document.querySelector('#equipmentTableBody tr:not(.empty-row)');
        if (firstRow) {
            firstRow.querySelectorAll('[data-col]').forEach(cell => {
                const key = cell.getAttribute('data-col');
                if (!hidden.includes(key)) count++;
            });
            return count;
        }
        // если строк нет — считаем по <thead>
        document.querySelectorAll('table.manage-table thead th[data-col]').forEach(th => {
            const key = th.getAttribute('data-col');
            if (!hidden.includes(key)) count++;
        });
        return count;
    }

    // ---------- Меню ----------
    function renderMenu() {
        const menu = document.getElementById(MENU_ID);
        if (!menu) return;

        const hidden = getHiddenColumns();
        const presentKeys = getPresentColumnKeys();

        let html = '<div class="columns-menu-title">Колонки</div>';
        presentKeys.forEach(key => {
            const label = COLUMN_LABELS[key] || key;
            const checked = !hidden.includes(key);
            html += `
                <label class="columns-menu-item">
                    <input type="checkbox" data-column-key="${key}" ${checked ? 'checked' : ''}>
                    <span>${label}</span>
                </label>
            `;
        });
        html += '<div class="columns-menu-actions">'
            + '<button type="button" class="btn btn-ghost btn-sm" onclick="resetColumnsMenu()">Сбросить</button>'
            + '</div>';

        menu.innerHTML = html;

        // обработчики чекбоксов
        menu.querySelectorAll('input[data-column-key]').forEach(cb => {
            cb.addEventListener('change', function () {
                const key = this.getAttribute('data-column-key');
                const list = getHiddenColumns();
                if (this.checked) {
                    const idx = list.indexOf(key);
                    if (idx !== -1) list.splice(idx, 1);
                } else {
                    if (!list.includes(key)) list.push(key);
                }
                setHiddenColumns(list);
                applyToDOM();
            });
        });
    }

    // Какие колонки реально есть в таблице (по thead)
    function getPresentColumnKeys() {
        const keys = [];
        document.querySelectorAll('table.manage-table thead th[data-col]').forEach(th => {
            const key = th.getAttribute('data-col');
            if (key && !keys.includes(key)) keys.push(key);
        });
        return keys;
    }

    // ---------- Публичный API ----------
    window.toggleColumnsMenu = function () {
        const menu = document.getElementById(MENU_ID);
        if (!menu) return;
        const isHidden = menu.style.display === 'none' || !menu.style.display;
        if (isHidden) {
            renderMenu();
            menu.style.display = 'block';
        } else {
            menu.style.display = 'none';
        }
    };

    window.resetColumnsMenu = function () {
        setHiddenColumns([]);
        applyToDOM();
        renderMenu();
    };

    // Закрытие меню при клике вне
    document.addEventListener('click', function (e) {
        const menu = document.getElementById(MENU_ID);
        if (!menu || menu.style.display === 'none') return;
        if (menu.contains(e.target)) return;
        if (e.target.closest('.columns-menu-wrapper')) return;
        menu.style.display = 'none';
    });

    // Инициализация при загрузке
    document.addEventListener('DOMContentLoaded', function () {
        applyToDOM();
    });
})();