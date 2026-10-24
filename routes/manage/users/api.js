const {
  getAllUsers,
  getUserById,
  getUserWithDetails,
  checkUserExists,
  deleteUserWithEquipmentReturn,
  updateUserPassword,
  setUserActive,
  getUserActiveEquipment, 
  getUserEquipmentHistory,
  countActiveAdmins,
  updateUserWithResponsibles,
  // + те, что реально вызываются в телах API:
  //   createUserWithPassword?, getUserActiveEquipment?, getUserEquipmentHistory?
} = require('../../../database/db');

const { hashPassword, generateTempPassword, validateUsername, validateEmail } = require('../../../utils/auth');
const { logAction } = require('../../../utils/logger');

// ============================================================
// API
// ============================================================

async function getUsersAPI(req, res) {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getUserByIdAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getUserDetailsAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserWithDetails(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const activeEquipment = await getUserActiveEquipment(id);
    const history = await getUserEquipmentHistory(id);

    const stats = {
      active: activeEquipment.length,
      total: history.length,
      returned: history.filter(h => h.returned_date).length,
    };

    delete user.password_hash;
    res.json({ user, stats, activeEquipment, history: history.slice(0, 30) });
  } catch (error) {
    console.error('❌ Ошибка получения деталей:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/manage/users-for-assign — список активных пользователей для назначения техники.
 * Доступен admin / supervisor / mol. Возвращает только id, username, full_name, department.
 */
async function getUsersForAssignAPI(req, res) {
  try {
    const users = await getAllUsers();
    const filtered = users
      .filter(u => u.is_active === 1 && u.role !== 'admin')
      .map(u => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        department: u.department,
      }));
    res.json(filtered);
  } catch (error) {
    console.error('❌ Ошибка получения пользователей для назначения:', error);
    res.status(500).json({ error: error.message });
  }
}

async function addUserAPI(req, res) {
  try {
    const { username, email, full_name, department, phone, role } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Логин и email обязательны' });
    }

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      return res.status(400).json({ error: usernameCheck.errors.join('. ') });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.errors.join('. ') });
    }

    const existing = await checkUserExists(username.trim(), email.trim());
    if (existing) {
      if (existing.username === username.trim()) {
        return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
      }
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const ALLOWED_ROLES = ['admin', 'supervisor', 'mol', 'user'];
    const userRole = ALLOWED_ROLES.includes(role) ? role : 'user';
    const tempPassword = generateTempPassword(12);
    const passwordHash = await hashPassword(tempPassword);

    const result = await createUserWithPassword({
      username: username.trim(),
      email: email.trim(),
      full_name: (full_name || '').trim(),
      department: (department || '').trim(),
      phone: (phone || '').trim(),
      password_hash: passwordHash,
      role: userRole,
      must_change_password: 1,
    });

    await logAction({
      req, action: 'user_create', entityType: 'user', entityId: result.id,
      details: JSON.stringify({ username: username.trim(), role: userRole }),
    });

    res.json({
      success: true,
      message: 'Пользователь создан успешно',
      data: { id: result.id, username: username.trim(), email: email.trim(), full_name, role: userRole },
      tempPassword,
      warning: 'Сохраните пароль! Он больше не будет показан.',
    });
  } catch (error) {
    console.error('❌ Ошибка создания пользователя:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateUserAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { username, email, full_name, department, phone, role } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Логин и email обязательны' });
    }

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      return res.status(400).json({ error: usernameCheck.errors.join('. ') });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.errors.join('. ') });
    }

    const existing = await checkUserExists(username.trim(), email.trim(), id);
    if (existing) {
      if (existing.username === username.trim()) {
        return res.status(400).json({ error: 'Логин уже используется' });
      }
      return res.status(400).json({ error: 'Email уже используется' });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const ALLOWED_ROLES = ['admin', 'supervisor', 'mol', 'user'];
    const newRole = ALLOWED_ROLES.includes(role) ? role : user.role;

    if (user.role === 'admin' && newRole !== 'admin') {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Нельзя изменить роль последнего администратора' });
      }
    }

    // 5.11.1b: транзакционно — UPDATE users + привязки МОЛ
    const warehouseIds = Array.isArray(req.body.warehouse_ids)
      ? req.body.warehouse_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
      : [];
    const officeIds = Array.isArray(req.body.office_ids)
      ? req.body.office_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
      : [];

    await updateUserWithResponsibles(id, {
      username: username.trim(),
      email: email.trim(),
      full_name: full_name || '',
      department: department || '',
      phone: phone || '',
      role: newRole,
    }, {
      warehouse_ids: newRole === 'mol' ? warehouseIds : [],
      office_ids:    newRole === 'mol' ? officeIds    : [],
    });

    await logAction({
      req, action: 'user_update', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: username.trim(), role_changed: user.role !== newRole }),
    });

    res.json({ success: true, message: 'Пользователь обновлён успешно' });
  } catch (error) {
    console.error('❌ Ошибка обновления:', error);
    res.status(500).json({ error: error.message });
  }
}

async function deleteUserAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'Нельзя удалить себя' });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.role === 'admin') {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
      }
    }

    const result = await deleteUserWithEquipmentReturn(id);

    await logAction({
      req, action: 'user_delete', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: user.username, equipment_returned: result.equipment_returned }),
    });

    res.json({
      success: true,
      message: `Пользователь удалён. Возвращено техники: ${result.equipment_returned}`,
      data: result,
    });
  } catch (error) {
    console.error('❌ Ошибка удаления:', error);
    res.status(500).json({ error: error.message });
  }
}

async function resetUserPasswordAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const tempPassword = generateTempPassword(12);
    const passwordHash = await hashPassword(tempPassword);
    await updateUserPassword(id, passwordHash, 1);

    await logAction({
      req, action: 'user_password_reset', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: user.username }),
    });

    res.json({
      success: true,
      message: `Пароль пользователя "${user.full_name || user.username}" сброшен`,
      tempPassword,
      warning: 'Передайте пароль пользователю. Он должен сменить его при следующем входе.',
    });
  } catch (error) {
    console.error('❌ Ошибка сброса пароля:', error);
    res.status(500).json({ error: error.message });
  }
}

async function blockUserAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'Нельзя заблокировать себя' });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.role === 'admin') {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Нельзя заблокировать последнего администратора' });
      }
    }

    await setUserActive(id, false);

    await logAction({
      req, action: 'user_block', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: user.username }),
    });

    res.json({ success: true, message: `Пользователь "${user.full_name || user.username}" заблокирован` });
  } catch (error) {
    console.error('❌ Ошибка блокировки:', error);
    res.status(500).json({ error: error.message });
  }
}

async function unblockUserAPI(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await setUserActive(id, true);

    await logAction({
      req, action: 'user_unblock', entityType: 'user', entityId: id,
      details: JSON.stringify({ username: user.username }),
    });

    res.json({ success: true, message: `Пользователь "${user.full_name || user.username}" разблокирован` });
  } catch (error) {
    console.error('❌ Ошибка разблокировки:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getUsersAPI,
  getUserByIdAPI,
  getUserDetailsAPI,
  addUserAPI,
  updateUserAPI,
  deleteUserAPI,
  resetUserPasswordAPI,
  blockUserAPI,
  unblockUserAPI,
  getUsersForAssignAPI,
};