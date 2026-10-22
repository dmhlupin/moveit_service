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
    };

        // 🆕 5.6.3: селект «Показать: все/свои» → сразу применить
    const onlyMine = document.getElementById('filterOnlyMine');
    if (onlyMine) {
        onlyMine.addEventListener('change', applyFilters);
    }

        // 🆕 5.7.1: если в URL был ?open_equipment=ID — открыть карточку
    const openEquipmentId = document.getElementById('openEquipmentId')?.value;
    if (openEquipmentId && !isNaN(parseInt(openEquipmentId, 10))) {
        // Небольшая задержка, чтобы DOM точно отрисовался
        setTimeout(() => {
            if (typeof viewEquipment === 'function') {
                viewEquipment(parseInt(openEquipmentId, 10));
                // Очистить URL, чтобы при F5 не открывалось снова
                const url = new URL(window.location.href);
                url.searchParams.delete('open_equipment');
                window.history.replaceState({}, '', url.toString());
            }
        }, 100);
    }
});