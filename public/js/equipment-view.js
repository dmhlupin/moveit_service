// public/js/equipment-view.js
// Карточка техники открывается на любой странице через EquipmentCard.open().
// Модуль public/js/equipment-card/ подгружается лениво при первом вызове.
// Используется на /admin/warehouses, /admin/workplaces, /admin/users.

let equipmentCardModulePromise = null;

function loadEquipmentCardModule() {
    if (equipmentCardModulePromise) return equipmentCardModulePromise;

    equipmentCardModulePromise = new Promise((resolve, reject) => {
        const files = [
            '/js/equipment-card/loader.js',
            '/js/equipment-card/render.js',
            '/js/equipment-card/actions.js',
            '/js/equipment-card/modals.js',
            '/js/equipment-card/index.js',   // последним — определяет EquipmentCard
        ];
        let loaded = 0;
        let failed = false;

        files.forEach(src => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                if (failed) return;
                loaded++;
                if (loaded === files.length) resolve();
            };
            script.onerror = () => {
                if (failed) return;
                failed = true;
                reject(new Error(`Не удалось загрузить ${src}`));
            };
            document.head.appendChild(script);
        });
    });

    return equipmentCardModulePromise;
}

async function viewEquipmentFromExternal(id) {
    const parsedId = parseInt(id, 10);
    if (!parsedId || isNaN(parsedId)) {
        console.error('[equipment-view] viewEquipmentFromExternal: неверный id', id);
        return;
    }

    try {
        if (typeof EquipmentCard === 'undefined') {
            await loadEquipmentCardModule();
        }
        EquipmentCard.open({
            id: parsedId,
            onClose: (result) => {
                if (result && result.changed) {
                    // Перезагружаем текущую страницу, если что-то изменилось
                    location.reload();
                }
            },
        });
    } catch (err) {
        console.error('[equipment-view] не удалось загрузить модуль карточки:', err);
        if (typeof showToast === 'function') {
            showToast('❌ Не удалось открыть карточку техники', 'error');
        }
    }
}