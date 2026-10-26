// public/js/change-password.js — Скрипт страницы смены пароля



function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    
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

function checkPasswordStrength() {
    const password = document.getElementById('newPassword').value;
    const strengthContainer = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!password) {
        strengthContainer.style.display = 'none';
        return;
    }
    
    strengthContainer.style.display = 'block';
    
    let score = 0;
    const checks = {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        digit: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    // Обновляем чек-лист
    updateRequirement('req-length', checks.length);
    updateRequirement('req-upper', checks.upper);
    updateRequirement('req-lower', checks.lower);
    updateRequirement('req-digit', checks.digit);
    
    // Считаем очки
    if (checks.length) score++;
    if (checks.upper) score++;
    if (checks.lower) score++;
    if (checks.digit) score++;
    if (checks.special) score++;
    
    // Определяем уровень
    strengthFill.className = 'strength-fill';
    strengthText.className = 'strength-text';
    
    if (score <= 2) {
        strengthFill.classList.add('weak');
        strengthText.classList.add('weak');
        strengthText.textContent = 'Слабый пароль';
    } else if (score <= 3) {
        strengthFill.classList.add('medium');
        strengthText.classList.add('medium');
        strengthText.textContent = 'Средний пароль';
    } else {
        strengthFill.classList.add('strong');
        strengthText.classList.add('strong');
        strengthText.textContent = 'Надёжный пароль';
    }
}

function updateRequirement(id, isValid) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (isValid) {
        el.classList.add('valid');
    } else {
        el.classList.remove('valid');
    }
}

async function submitChangePassword(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    hideError();
    
    // Валидация
    if (!currentPassword || !newPassword || !confirmPassword) {
        showError('Заполните все поля');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError('Новый пароль и подтверждение не совпадают');
        return;
    }
    
    if (newPassword.length < 8) {
        showError('Пароль должен содержать минимум 8 символов');
        return;
    }
    
    // Блокируем кнопку
    submitBtn.disabled = true;
    submitBtn.textContent = 'Смена пароля...';
    
    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
                confirmPassword
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            submitBtn.textContent = 'Пароль изменён';
            submitBtn.style.background = 'var(--success)';
            
            if (typeof showToast === 'function') {
                showToast('Пароль успешно изменён', 'success');
            }
            
            // Редирект через 1.5 секунды
            setTimeout(() => {
                window.location.href = result.redirect || '/';
            }, 1500);
        } else {
            showError(result.error || 'Ошибка смены пароля');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Сменить пароль';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Ошибка соединения с сервером');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Сменить пароль';
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Если mustChangePassword = true, показываем предупреждение
    if (window.mustChangePassword === true || window.mustChangePassword === 'true') {
        const warningBox = document.getElementById('warningBox');
        if (warningBox) {
            warningBox.style.display = 'flex';
        }
        
        const authSubtitle = document.getElementById('authSubtitle');
        if (authSubtitle) {
            authSubtitle.textContent = 'Установите новый пароль для продолжения';
        }
        
        // Скрываем ссылку "Выйти" — пользователь не должен уйти пока не сменит пароль
        const authFooter = document.getElementById('authFooter');
        if (authFooter) {
            authFooter.innerHTML = '<p style="color: var(--warning); font-size: var(--text-xs);">Смена пароля обязательна</p>';
        }
    }
});