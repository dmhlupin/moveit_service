// public/js/equipment-card/index.js
// Публичный API карточки техники.
// Единственная точка входа: EquipmentCard.open({ id, role, currentUserId, onClose }).
//
// После 5.8.1.7 прокси-методы удалены: партиал использует
// EquipmentCardModals.* напрямую, а сам EquipmentCard.close() —
// только для закрытия карточки.

(function () {
    'use strict';

    // ------------------------------------------------------------
    // Гарантируем глобальные хелперы (если их ещё нет на странице)
    // ------------------------------------------------------------
    if (typeof window.escapeHtml !== 'function') {
        window.escapeHtml = function (str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
    }

    if (typeof window.getInitials !== 'function') {
        window.getInitials = function (name) {
            if (!name) return '?';
            const parts = String(name).trim().split(/\s+/).filter(p => p);
            if (parts.length === 0) return '?';
            if (parts.length === 1) return parts[0][0].toUpperCase();
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        };
    }

    if (typeof window.getCurrentRole !== 'function') {
        window.getCurrentRole = function () {
            const el = document.getElementById('currentRole');
            return el ? el.value : 'user';
        };
    }

    if (typeof window.showToast !== 'function') {
        window.showToast = function (message, type) {
            const container = document.querySelector('.toast-container') || (() => {
                const c = document.createElement('div');
                c.className = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            const toast = document.createElement('div');
            toast.className = `toast toast-${type || 'info'}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        };
    }

    // ------------------------------------------------------------
    // Внутреннее состояние
    // ------------------------------------------------------------
    const state = {
        currentId: null,
        role: 'user',
        currentUserId: 0,
        onClose: null,
        isOpen: false,
    };

    // ------------------------------------------------------------
    // Публичный API
    // ------------------------------------------------------------
    const EquipmentCard = {
        /**
         * Открыть карточку техники.
         * @param {Object} opts
         * @param {number} opts.id            — ID техники (обязательно)
         * @param {string} [opts.role]        — роль (admin|supervisor|mol); по умолчанию из #currentRole
         * @param {number} [opts.currentUserId] — ID пользователя; по умолчанию из #currentUserId
         * @param {Function} [opts.onClose]   — колбэк при закрытии: ({changed:boolean}) => void
         */
        async open(opts) {
            const options = opts || {};
            const id = parseInt(options.id, 10);
            if (!id || isNaN(id)) {
                console.error('[EquipmentCard] open(): неверный id', opts);
                return;
            }

            state.currentId = id;
            state.role = options.role
                || (document.getElementById('currentRole')?.value)
                || 'user';
            state.currentUserId = Number(
                options.currentUserId
                ?? document.getElementById('currentUserId')?.value
                ?? 0
            );
            state.onClose = typeof options.onClose === 'function' ? options.onClose : null;
            state.isOpen = true;

            try {
                await Promise.all([
                    EquipmentCardLoader.ensureCss(),
                    EquipmentCardLoader.ensurePartial(),
                ]);
            } catch (err) {
                console.error('[EquipmentCard] не удалось загрузить партиал:', err);
                showToast('❌ Не удалось загрузить карточку техники', 'error');
                state.isOpen = false;
                return;
            }

            await window.EquipmentCardRender.render(id, {
                role: state.role,
                currentUserId: state.currentUserId,
            });
        },

        /**
         * Закрыть карточку (и все вложенные модалки действий).
         * @param {Object} [result] — {changed: boolean} — передаётся в onClose
         */
        close(result) {
            const modal = document.getElementById('viewEquipmentModal');
            if (modal) modal.classList.remove('active');

            [
                'moveEquipmentModal', 'assignModal', 'statusChangeModal',
                'moveToWorkplaceModal', 'returnModal', 'deleteModal',
            ].forEach(modalId => {
                const el = document.getElementById(modalId);
                if (el) el.classList.remove('active');
            });

            const wasOpen = state.isOpen;
            state.isOpen = false;

            const callback = state.onClose;
            state.onClose = null;
            state.currentId = null;

            if (wasOpen && callback) {
                try {
                    callback(result || { changed: false });
                } catch (e) {
                    console.error('[EquipmentCard] onClose error:', e);
                }
            }
        },

        /**
         * Уведомить, что данные изменились (действие выполнено).
         * Вызывает CustomEvent + onClose({changed:true}).
         */
        notifyChanged(detail) {
            const payload = Object.assign({ id: state.currentId }, detail || {});
            document.dispatchEvent(new CustomEvent('equipment-updated', {
                detail: payload,
            }));
            this.close({ changed: true });
        },

        /**
         * Вернуть текущее состояние (для отладки / внутренних модулей).
         */
        getState() {
            return Object.assign({}, state);
        },
    };

    window.EquipmentCard = EquipmentCard;
})();