// public/js/login.js — Скрипт страницы входа



function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    
    // Убираем анимацию через секунду
    setTimeout(() => {
        errorEl.style.animation = 'none';
        setTimeout(() => {
            errorEl.style.animation = '';
        }, 50);
    }, 500);
}

function hideError() {
    const errorEl = document.getElementById('errorMessage');
    errorEl.classList.remove('show');
}

async function submitLogin(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Скрываем предыдущую ошибку
    hideError();
    
    // Валидация
    if (!username || !password) {
        showError('Введите логин и пароль');
        return;
    }
    
    // Блокируем кнопку
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Вход...';
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Успешный вход
            submitBtn.textContent = '✅ Успешно!';
            submitBtn.style.background = '#48bb78';
            
            // Редирект
            setTimeout(() => {
                window.location.href = result.redirect || '/profile';
            }, 500);
        } else {
            // Ошибка входа
            showError(result.error || 'Ошибка входа');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
            
            // Очищаем поле пароля
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Ошибка соединения с сервером');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    }
}

// Фокус на поле логина при загрузке
document.addEventListener('DOMContentLoaded', function() {
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.focus();
    }
});