// public/js/equipment-card/loader.js
// Ленивая подгрузка партиала и CSS для карточки техники.
// Кэширует HTML партиала в памяти, CSS — в DOM (проверка по href).

(function () {
    'use strict';

    let partialHtml = null;      // кэш HTML партиала
    let partialPromise = null;   // промис загрузки (чтобы не дублировать fetch)

    const PARTIAL_URL = '/partials/equipment-card.html'; // см. п. «Маршрут партиала»
    const CSS_FILES = [
        '/css/manage/card.css',
        '/css/manage/modals.css',
    ];

    // ------------------------------------------------------------
    // CSS: подгружаем <link>, если ещё нет
    // ------------------------------------------------------------
    function ensureCss() {
        const promises = [];
        CSS_FILES.forEach(href => {
            if (document.querySelector(`link[href="${href}"]`)) return;
            promises.push(new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.dataset.equipmentCard = '1';
                link.onload = () => resolve();
                link.onerror = () => {
                    console.warn(`[EquipmentCard] не удалось загрузить ${href}`);
                    resolve(); // не блокируем карточку из-за CSS
                };
                document.head.appendChild(link);
            }));
        });
        return Promise.all(promises);
    }

    // ------------------------------------------------------------
    // Партиал: fetch + кэш, вставка в body (один раз)
    // ------------------------------------------------------------
    async function ensurePartial() {
        if (partialHtml) return partialHtml;
        if (partialPromise) return partialPromise;

        partialPromise = (async () => {
            const response = await fetch(PARTIAL_URL, { credentials: 'same-origin' });
            if (!response.ok) {
                throw new Error(`Не удалось загрузить партиал карточки: ${response.status}`);
            }
            partialHtml = await response.text();

            // Вставляем в конец body, если ещё не вставлен
            if (!document.getElementById('equipmentCardHost')) {
                const host = document.createElement('div');
                host.id = 'equipmentCardHost';
                host.innerHTML = partialHtml;
                document.body.appendChild(host);
            }
            return partialHtml;
        })();

        try {
            return await partialPromise;
        } finally {
            partialPromise = null;
        }
    }

    // ------------------------------------------------------------
    // Публичный API загрузчика
    // ------------------------------------------------------------
    window.EquipmentCardLoader = {
        ensureCss,
        ensurePartial,
    };
})();