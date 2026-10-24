// scripts/restore-admin.js
// 5.11.1-fix: восстановление роли admin у пользователя admin (и manager).
// Использование:
//   node scripts/restore-admin.js
//   node scripts/restore-admin.js admin manager   // список username

const db = require('../database/db');

const DEFAULT_USERNAMES = ['admin', 'manager'];

async function run() {
  const usernames = process.argv.slice(2).filter(Boolean);
  const targets = usernames.length > 0 ? usernames : DEFAULT_USERNAMES;

  console.log('🔧 Восстановление роли admin для:', targets.join(', '));
  console.log('');

  try {
    const placeholders = targets.map(() => '?').join(', ');
    const rows = await db.all(
      `SELECT id, username, role, is_active FROM users WHERE username IN (${placeholders})`,
      targets
    );

    if (rows.length === 0) {
      console.log('❌ Не найдено ни одного пользователя с такими username:', targets.join(', '));
      console.log('   Проверь список пользователей:');
      const all = await db.all('SELECT id, username, role, is_active FROM users ORDER BY id');
      all.forEach(u => console.log(`   #${u.id} ${u.username} — role=${u.role}, active=${u.is_active}`));
      process.exit(1);
    }

    console.log('Найдено:');
    rows.forEach(u => console.log(`  #${u.id} ${u.username} — role=${u.role}, active=${u.is_active}`));
    console.log('');

    // Восстанавливаем: role = 'admin', is_active = 1
    const updatePlaceholders = rows.map(() => '?').join(', ');
    const updateIds = rows.map(u => u.id);

    await db.run(
      `UPDATE users SET role = 'admin', is_active = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${updatePlaceholders})`,
      updateIds
    );

    const updated = await db.all(
      `SELECT id, username, role, is_active FROM users WHERE id IN (${updatePlaceholders})`,
      updateIds
    );

    console.log('✅ После восстановления:');
    updated.forEach(u => console.log(`  #${u.id} ${u.username} — role=${u.role}, active=${u.is_active}`));
    console.log('');

    // Сводка: сколько админов в системе
    const adminCount = await db.get(
      `SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1`
    );
    console.log(`👑 Активных админов в системе: ${adminCount.count}`);

    if (adminCount.count === 0) {
      console.log('⚠️  Всё ещё 0 админов. Проверь имена пользователей и запусти снова со списком username.');
      process.exit(1);
    }

    console.log('');
    console.log('Готово. Зайди под admin / manager.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.message || error);
    process.exit(1);
  }
}

run();