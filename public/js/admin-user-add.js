// public/js/admin-user-add.js
// Логика формы добавления пользователя

// ============================================================
// ОТПРАВКА ФОРМЫ
// ============================================================

let createdUserId = null;
let createdRole = null;

async function submitForm(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Создание...';

  const formData = {
    username: document.getElementById('username').value.trim(),
    email: document.getElementById('email').value.trim(),
    full_name: document.getElementById('full_name').value.trim(),
    department: document.getElementById('department').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    role: document.getElementById('role').value,
  };

  try {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (result.success) {
      createdUserId = result.data.id;
      createdRole = result.data.role;

      document.getElementById('tempPasswordValue').textContent = result.tempPassword;
      document.getElementById('passwordUsername').textContent = result.data.username;

      // 🆕 Этап 4: если создан МОЛ — приглашаем сразу к привязке складов/офисов
      const finishBtn = document.querySelector('#passwordModal .modal-actions button');
      if (finishBtn) {
        finishBtn.textContent = (createdRole === 'mol')
          ? 'Понятно, привязать склады и офисы'
          : 'Понятно, перейти к списку';
      }

      document.getElementById('passwordModal').classList.add('active');
    } else {
      showToast('❌ ' + result.error, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 Создать';
    }
  } catch (error) {
    console.error('❌ Ошибка при создании пользователя:', error);
    showToast('❌ Ошибка при создании пользователя', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Создать';
  }
}

function finishCreate() {
  // 🆕 Этап 4: МОЛ → сразу в edit для привязки складов и офисов
  if (createdRole === 'mol' && createdUserId) {
    window.location.href = `/admin/user/edit/${createdUserId}`;
    return;
  }
  window.location.href = '/admin';
}