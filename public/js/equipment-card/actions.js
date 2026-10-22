// public/js/equipment-card/actions.js
// Публичные действия из карточки техники.
// Каждое действие открывает соответствующую модалку (modals.js)
// или выполняет запрос напрямую (edit, delete).
// Зависит от: EquipmentCardModals, EquipmentCard, showToast.

(function () {
    'use strict';

    const Actions = {
        /**
         * Перейти на страницу редактирования техники.
         */
        edit(id) {
            window.location.href = `/manage/edit/${id}`;
        },

        /**
         * Открыть подтверждение удаления и, при подтверждении,
         * удалить технику.
         */
        delete(id) {
            window.EquipmentCardModals.openDelete(id);
        },

        /**
         * Открыть модалку перемещения на склад.
         */
        move(id) {
            window.EquipmentCardModals.openMove(id);
        },

        /**
         * Открыть модалку назначения пользователю.
         */
        assign(id) {
            window.EquipmentCardModals.openAssign(id);
        },

        /**
         * Открыть модалку возврата на склад.
         */
        return(id) {
            window.EquipmentCardModals.openReturn(id);
        },

        /**
         * Открыть модалку смены статуса.
         * @param {number} id
         * @param {string} status — 'maintenance' | 'retired' | 'available'
         */
        changeStatus(id, status) {
            window.EquipmentCardModals.openStatusChange(id, status);
        },

        /**
         * Открыть модалку перемещения на рабочее место.
         */
        moveToWorkplace(id) {
            window.EquipmentCardModals.openMoveToWorkplace(id);
        },
    };

    window.EquipmentCardActions = Actions;
})();