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
            '/js/equipment-card/index.js',
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

        // 🆕 5.8.1.5-fix: контекст для карточки на внешних страницах.
        // #currentRole / #currentUserId есть только на /manage.
        // На остальных страницах берём из LayoutJS.currentUser() (layout.js).
        const user = (typeof window.LayoutJS !== 'undefined' && window.LayoutJS.currentUser)
            ? window.LayoutJS.currentUser()
            : null;
        const role = user?.role
            || document.getElementById('currentRole')?.value
            || 'user';
        const currentUserId = Number(
            user?.id
            ?? document.getElementById('currentUserId')?.value
            ?? 0
        );

        EquipmentCard.open({
            id: parsedId,
            role,
            currentUserId,
            onClose: (result) => {
                if (result && result.changed) {
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