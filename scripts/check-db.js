// scripts/check-db.js
// Проверка структуры БД: users, activity_log, equipment, fixed_assets.
// Стиль — как в migrate.js: промис-обёртки + async/await.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function columnExists(table, column) {
  const cols = await all(`PRAGMA table_info(${table})`);
  return cols.some(c => c.name === column);
}

async function tableExists(table) {
  const row = await get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [table]
  );
  return !!row;
}

async function main() {
  console.log('📊 Проверка структуры базы данных...\n');

  // ===== users =====
  const usersCols = await all('PRAGMA table_info(users)');
  console.log('📋 Таблица users:');
  console.log('─'.repeat(60));
  usersCols.forEach(col => {
    console.log(`  ${col.name.padEnd(25)} ${String(col.type).padEnd(15)} ${col.notnull ? 'NOT NULL' : ''}`);
  });
  console.log('');

  // ===== activity_log =====
  const logCols = await all('PRAGMA table_info(activity_log)');
  console.log('📋 Таблица activity_log:');
  console.log('─'.repeat(60));
  logCols.forEach(col => {
    console.log(`  ${col.name.padEnd(25)} ${String(col.type).padEnd(15)} ${col.notnull ? 'NOT NULL' : ''}`);
  });
  console.log('');

  // ===== пользователи =====
  const users = await all(
    'SELECT id, username, email, role, is_active, must_change_password FROM users'
  );
  console.log('👥 Пользователи:');
  console.log('─'.repeat(80));
  console.log(`  ${'ID'.padEnd(5)} ${'Логин'.padEnd(15)} ${'Роль'.padEnd(10)} ${'Активен'.padEnd(10)} ${'Сменить пароль'.padEnd(15)}`);
  console.log('─'.repeat(80));
  users.forEach(u => {
    console.log(
      `  ${String(u.id).padEnd(5)} ${u.username.padEnd(15)} ${u.role.padEnd(10)} ${(u.is_active ? 'Да' : 'Нет').padEnd(10)} ${(u.must_change_password ? 'Да' : 'Нет').padEnd(15)}`
    );
  });
  console.log('');

  // ===== пароли =====
  const pw = await get(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN password_hash IS NULL OR password_hash = '' THEN 1 ELSE 0 END) as no_pass
       FROM users`
  );
  console.log('🔐 Проверка паролей:');
  console.log(`  Всего пользователей: ${pw.total}`);
  console.log(`  Без пароля: ${pw.no_pass}`);
  console.log(pw.no_pass === 0
    ? '  ✅ У всех пользователей есть пароль\n'
    : '  ⚠️  Есть пользователи без пароля!\n'
  );

  // ===== 5.15.1: количественный учёт =====
  let failed = false;

  console.log('📋 5.15.1: Количественный учёт');
  console.log('─'.repeat(60));

  if (!(await columnExists('equipment', 'is_quantity_accounted'))) {
    console.log('  ❌ equipment.is_quantity_accounted — ОТСУТСТВУЕТ');
    failed = true;
  } else {
    console.log('  ✅ equipment.is_quantity_accounted');
  }

  // ===== 5.15.1: fixed_assets =====
  console.log('\n📋 5.15.1: Основные средства (fixed_assets)');
  console.log('─'.repeat(60));

  if (!(await tableExists('fixed_assets'))) {
    console.log('  ❌ Таблица fixed_assets — ОТСУТСТВУЕТ');
    failed = true;
  } else {
    const required = [
      'equipment_id',
      'commissioning_date',
      'initial_cost',
      'useful_life_months',
      'created_at',
      'updated_at',
    ];
    const faCols = (await all('PRAGMA table_info(fixed_assets)')).map(c => c.name);
    const missing = required.filter(c => !faCols.includes(c));
    if (missing.length) {
      console.log(`  ❌ fixed_assets: нет колонок — ${missing.join(', ')}`);
      failed = true;
    } else {
      console.log('  ✅ fixed_assets (все колонки на месте)');
    }
    const faCount = await get('SELECT COUNT(*) AS c FROM fixed_assets');
    console.log(`  ℹ️  Записей в fixed_assets: ${faCount.c}`);
  }

  // Триггер
  const trig = await get(
    `SELECT name FROM sqlite_master WHERE type='trigger'
       AND name='trg_fixed_assets_force_quantity'`
  );
  console.log(trig
    ? '  ✅ Триггер trg_fixed_assets_force_quantity'
    : '  ⚠️  Триггер trg_fixed_assets_force_quantity отсутствует'
  );
  console.log('');

  // ===== Сводка по учёту =====
  if (await columnExists('equipment', 'is_quantity_accounted')) {
    const q = await get(`
      SELECT
        (SELECT COUNT(*) FROM equipment)                                            AS total,
        (SELECT COUNT(*) FROM equipment WHERE is_quantity_accounted = 1)            AS accounted,
        (SELECT COUNT(*) FROM equipment WHERE is_quantity_accounted = 0)            AS minor
    `);
    console.log('📊 Учёт техники:');
    console.log(`  Всего экземпляров:        ${q.total}`);
    console.log(`  На количественном учёте:  ${q.accounted}`);
    console.log(`  Малоценка (учёт = 0):     ${q.minor}`);
    console.log('');
  }

  if (failed) {
    console.log('❌ Есть проблемы в структуре БД');
    process.exitCode = 1;
  } else {
    console.log('✅ Структура БД в порядке');
  }
}

main()
  .catch(err => {
    console.error('❌ Ошибка проверки:', err);
    process.exitCode = 1;
  })
  .finally(() => db.close());