document.addEventListener('DOMContentLoaded', function() {
    // Переключатель темы
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '🌙';
    themeToggle.setAttribute('aria-label', 'Переключить тему');
    themeToggle.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--primary-color);
        color: white;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
    `;
    document.body.appendChild(themeToggle);

    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        themeToggle.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';
    }

    themeToggle.addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
    });

    // Плавная прокрутка для навигации
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    
});