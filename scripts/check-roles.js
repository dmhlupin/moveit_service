// scripts/check-roles.js
// ============================================================
// Проверка структуры БД и данных для ролевой модели (Этап 4).
//
// Что проверяем:
//   - наличие таблиц warehouse_responsibles / office_responsibles
//   - наличие колонки equipment.responsible_user_id
//   - наличие всех индексов ролевой модели
//   - сводка пользователей по ролям
//   - сводка связок МОЛ ↔ склады / офисы
//   - сколько экземпляров техники без ответственного МОЛ
//
// Запуск:
//   npm run check-roles
// ============================================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new sqlite3.Database(dbPath);

// --- Промис-обёртки ---
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { err ? reject(err) : resolve(row); });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows); });
  });
}

async function tableExists(table) {
  const row = await get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [table]
  );
  return !!row;
}

async function columnExists(table, column) {
  const cols = await all(`PRAGMA table_info(${table})`);
  return cols.some(c => c.name === column);
}

async function indexExists(indexName) {
  const row = await get(
    `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
    [indexName]
  );
  return !!row;
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('👔 ПРОВЕРКА РОЛЕВОЙ МОДЕЛИ (ЭТАП 4)');
  console.log('═══════════════════════════════════════════════\n');

  let errors = 0;
  let warnings = 0;

  // --- 1. Таблицы ---
  console.log('📋 Таблицы:');
  const tables = [
    { name: 'warehouse_responsibles', label: 'МОЛ ↔ склады (many-to-many)' },
    { name: 'office_responsibles',    label: 'МОЛ ↔ офисы  (many-to-many)' },
  ];
  for (const t of tables) {
    const ok = await tableExists(t.name);
    console.log(`   ${ok ? '✅' : '❌'} ${t.name.padEnd(28)} ${t.label}`);
    if (!ok) errors++;
  }
  console.log('');

  // --- 2. Поле equipment.responsible_user_id ---
  console.log('📋 Поле equipment.responsible_user_id:');
  const hasResp = await columnExists('equipment', 'responsible_user_id');
  console.log(`   ${hasResp ? '✅' : '❌'} responsible_user_id присутствует`);
  if (!hasResp) errors++;
  console.log('');

  // --- 3. Индексы ---
  console.log('📋 Индексы:');
  const indexes = [
    'idx_wh_resp_user',
    'idx_wh_resp_wh',
    'idx_office_resp_user',
    'idx_office_resp_office',
    'idx_equipment_responsible',
  ];
  for (const idx of indexes) {
    const ok = await indexExists(idx);
    console.log(`   ${ok ? '✅' : '❌'} ${idx}`);
    if (!ok) errors++;
  }
  console.log('');

  // --- 4. Роли пользователей ---
  console.log('👥 Пользователи по ролям:');
  const roles = await all(`
    SELECT role, COUNT(*) AS count
    FROM users
    GROUP BY role
    ORDER BY role
  `);
  const knownRoles = ['admin', 'supervisor', 'mol', 'user'];
  const foundRoles = new Map(roles.map(r => [r.role, r.count]));
  for (const r of knownRoles) {
    const n = foundRoles.get(r) || 0;
    console.log(`   ${r.padEnd(12)} ${n}`);
  }
  // Незнакомые роли (на случай ручных правок)
  for (const r of roles) {
    if (!knownRoles.includes(r.role)) {
      console.log(`   ⚠️  ${r.role.padEnd(10)} ${r.count}  ← неизвестная роль`);
      warnings++;
    }
  }
  console.log('');

  // --- 5. Связки МОЛ ↔ склады / офисы ---
  console.log('🔗 Связки МОЛ:');
  const wh = await get(`SELECT COUNT(*) AS n FROM warehouse_responsibles`);
  const off = await get(`SELECT COUNT(*) AS n FROM office_responsibles`);
  console.log(`   МОЛ ↔ склады: ${wh.n}`);
  console.log(`   МОЛ ↔ офисы:  ${off.n}`);
  console.log('');

  // --- 6. Техника без ответственного МОЛ ---
  console.log('🔧 Техника без ответственного МОЛ:');
  const orphan = await get(`
    SELECT COUNT(*) AS n
    FROM equipment
    WHERE responsible_user_id IS NULL
  `);
  const total = await get(`SELECT COUNT(*) AS n FROM equipment`);
  console.log(`   Всего техники:    ${total.n}`);
  console.log(`   Без ответственного: ${orphan.n}`);
  if (orphan.n > 0) {
    console.log(`   ⚠️  ${orphan.n} экземпляров без responsible_user_id`);
    warnings++;
  } else if (total.n > 0) {
    console.log('   ✅ У всей техники проставлен ответственный МОЛ');
  }
  console.log('');

  // --- ИТОГ ---
  console.log('═══════════════════════════════════════════════');
  if (errors === 0 && warnings === 0) {
    console.log('✅ РОЛЕВАЯ МОДЕЛЬ НАСТРОЕНА КОРРЕКТНО');
  } else if (errors === 0) {
    console.log(`⚠️  ОШИБОК НЕТ, ПРЕДУПРЕЖДЕНИЙ: ${warnings}`);
  } else {
    console.log(`❌ ОШИБОК: ${errors}, ПРЕДУПРЕЖДЕНИЙ: ${warnings}`);
  }
  console.log('═══════════════════════════════════════════════\n');

  db.close();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Ошибка check-roles:', err);
  db.close();
  process.exit(1);
});