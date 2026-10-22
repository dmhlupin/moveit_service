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

    // 🆕 5.8.1.4: закрытие модалок — делегируем EquipmentCard / EquipmentCardModals
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                if (this.id === 'deleteModal') {
                    if (typeof EquipmentCardModals !== 'undefined') EquipmentCardModals.closeDelete();
                }
                if (this.id === 'viewEquipmentModal') {
                    if (typeof EquipmentCard !== 'undefined') EquipmentCard.close();
                }
                if (this.id === 'moveEquipmentModal') {
                    if (typeof EquipmentCardModals !== 'undefined') EquipmentCardModals.closeMove();
                }
            }
        });
    });

    const searchEq = document.getElementById('searchEquipment');
    if (searchEq) searchEq.focus();

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (typeof EquipmentCardModals !== 'undefined') {
                EquipmentCardModals.closeDelete();
                EquipmentCardModals.closeMove();
            }
            if (typeof EquipmentCard !== 'undefined') {
                EquipmentCard.close();
            }
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

    // 🆕 5.6.3: селект «Показать: все/свои» → сразу применить
    const onlyMine = document.getElementById('filterOnlyMine');
    if (onlyMine) {
        onlyMine.addEventListener('change', applyFilters);
    }

    // 🆕 5.7.1 / 5.8.1.4: если в URL был ?open_equipment=ID — открыть карточку
    const openEquipmentId = document.getElementById('openEquipmentId')?.value;
    if (openEquipmentId && !isNaN(parseInt(openEquipmentId, 10))) {
        setTimeout(() => {
            if (typeof EquipmentCard !== 'undefined' && EquipmentCard.open) {
                EquipmentCard.open({
                    id: parseInt(openEquipmentId, 10),
                    onClose: (result) => {
                        if (result && result.changed) {
                            location.reload();
                        }
                    },
                });
                // Очистить URL, чтобы при F5 не открывалось снова
                const url = new URL(window.location.href);
                url.searchParams.delete('open_equipment');
                window.history.replaceState({}, '', url.toString());
            }
        }, 100);
    }
});

// 🆕 5.8.1.4: обёртка для onclick в таблице.
// В pages.js строки таблицы рендерятся как onclick="openEquipmentCard(ID)".
window.openEquipmentCard = function (id) {
    if (typeof EquipmentCard === 'undefined' || !EquipmentCard.open) {
        console.error('[manage] EquipmentCard не загружен');
        return;
    }
    EquipmentCard.open({
        id: parseInt(id, 10),
        onClose: (result) => {
            if (result && result.changed) {
                location.reload();
            }
        },
    });
};