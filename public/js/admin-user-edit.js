// public/js/admin-user-edit.js
// Логика формы редактирования пользователя

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

const userId = parseInt(document.getElementById('userId')?.value || '0');
const currentRole = document.getElementById('currentRole')?.value || 'user';

if (!userId || isNaN(userId)) {
  console.error('❌ ID пользователя не указан');
}

// Устанавливаем текущую роль
const roleSelect = document.getElementById('role');
if (roleSelect) {
  roleSelect.value = currentRole;
}

// 🆕 Этап 4: показать/скрыть блок «Ответственность МОЛ» при загрузке
document.addEventListener('DOMContentLoaded', () => {
  onRoleChange();
});

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ БЛОКА МОЛ
// ============================================================

/**
 * Показать блок «Ответственность МОЛ» только когда выбрана роль mol.
 */
function onRoleChange() {
  const role = document.getElementById('role')?.value || 'user';
  const card = document.getElementById('molResponsiblesCard');
  if (!card) return;

  card.style.display = (role === 'mol') ? '' : 'none';
}

// ============================================================
// СБОР ЧЕКБОКСОВ
// ============================================================

function collectCheckedIds(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const boxes = container.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(boxes).map(b => parseInt(b.value, 10)).filter(n => !isNaN(n));
}

// ============================================================
// ОТПРАВКА ФОРМЫ
// ============================================================

async function submitForm(event) {
  event.preventDefault();

  if (!userId || isNaN(userId)) {
    showToast('❌ Ошибка: ID пользователя не указан', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Сохранение...';

  const role = document.getElementById('role').value;

  const formData = {
    username: document.getElementById('username').value.trim(),
    email: document.getElementById('email').value.trim(),
    full_name: document.getElementById('full_name').value.trim(),
    department: document.getElementById('department').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    role,
  };

  // 🆕 Этап 4: если роль = mol — отправляем привязки складов и офисов
  if (role === 'mol') {
    formData.warehouse_ids = collectCheckedIds('warehouseCheckboxes');
    formData.office_ids = collectCheckedIds('officeCheckboxes');
  }

  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (result.success) {
      showToast('✅ Пользователь обновлён!', 'success');
      setTimeout(() => {
        window.location.href = '/admin/users';
      }, 1000);
    } else {
      showToast('❌ ' + result.error, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 Сохранить';
    }
  } catch (error) {
    console.error('❌ Ошибка при сохранении:', error);
    showToast('❌ Ошибка при сохранении', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Сохранить';
  }
}