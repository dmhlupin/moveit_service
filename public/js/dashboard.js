// public/js/dashboard.js — Логика дашборда

// Авто-обновление данных каждые 60 секунд (опционально)
// Раскомментируйте, если нужно

// let autoRefresh = setInterval(() => {
//     location.reload();
// }, 60000);

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Дашборд загружен');
    
    // Анимируем появление карточек
    const cards = document.querySelectorAll('.stat-card, .dashboard-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 50);
    });
    
    // Клик по элементам "Требует внимания" — переход к технике
    document.querySelectorAll('.attention-list li').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', function() {
            const invNum = this.querySelector('.inv-num')?.textContent;
            if (invNum) {
                // Открываем админку для поиска
                window.location.href = '/manage';
            }
        });
    });
});