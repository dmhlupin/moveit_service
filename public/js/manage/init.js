// public/js/manage/init.js
// Инициализация страницы /manage.

document.addEventListener('DOMContentLoaded', function() {
    // 🆕 5.0.5: обработка выбора чекбоксов
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', updateSelectedCount);
    });

    // ID текущего пользователя — для проверки прав в карточке
    window.currentUserId = parseInt(document.getElementById('currentUserId')?.value || '0');

    // 🆕 5.0.4: скрыть фильтр МОЛа для не-admin
    if (getCurrentRole() !== 'admin') {
        const molGroup = document.getElementById('filterMolGroup');
        if (molGroup) molGroup.style.display = 'none';
    }

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                if (this.id === 'deleteModal') closeModal();
                if (this.id === 'viewEquipmentModal') closeViewEquipmentModal();
                if (this.id === 'moveEquipmentModal') closeMoveEquipmentModal();
            }
        });
    });

    const searchEq = document.getElementById('searchEquipment');
    if (searchEq) searchEq.focus();

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeViewEquipmentModal();
            closeMoveEquipmentModal();
        }
    });

    // 🆕 5.0.4: Enter в текстовых полях → применить фильтр
    ['filterSearch', 'filterCorporateId', 'filterModelName'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applyFilters();
                }
            });
        }
    });

    // 🆕 5.0.4: селект размера страницы → сразу применить
    const pageSize = document.getElementById('filterPageSize');
    if (pageSize) {
        pageSize.addEventListener('change', applyFilters);
    }
});