// scripts/check-models.js
// Проверка структуры БД после миграции v3.0.1 (equipment_models)
//
// Запуск:
//   node scripts/check-models.js
//   npm run check-models   (если добавишь в package.json)

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// ============================================================
// УТИЛИТЫ ВЫВОДА
// ============================================================

let errorsCount = 0;
let warningsCount = 0;

function ok(msg)   { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); errorsCount++; }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warningsCount++; }
function info(msg) { console.log(`  ℹ️  ${msg}`); }

function header(title) {
  console.log('');
  console.log('─'.repeat(60));
  console.log(title);
  console.log('─'.repeat(60));
}

// ============================================================
// ПРОВЕРКИ
// ============================================================

async function tableExists(table) {
  const row = await get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [table]
  );
  return !!row;
}

async function getColumns(table) {
  const rows = await all(`PRAGMA table_info(${table})`);
  return rows.map(r => r.name);
}

async function getForeignKeys(table) {
  return all(`PRAGMA foreign_key_list(${table})`);
}

async function getIndexes(table) {
  return all(`PRAGMA index_list(${table})`);
}

// ============================================================
// 1. equipment_models
// ============================================================

async function checkEquipmentModels() {
  header('1. Таблица equipment_models');

  const exists = await tableExists('equipment_models');
  if (!exists) {
    fail('Таблица equipment_models НЕ существует');
    return;
  }
  ok('Таблица существует');

  const cols = await getColumns('equipment_models');
  const expected = [
    'id', 'corporate_id', 'name', 'manufacturer',
    'category_id', 'type_id', 'description',
    'created_at', 'updated_at',
  ];

  for (const col of expected) {
    if (cols.includes(col)) ok(`Поле ${col}`);
    else fail(`Отсутствует поле ${col}`);
  }

  const extra = cols.filter(c => !expected.includes(c));
  if (extra.length > 0) warn(`Лишние поля: ${extra.join(', ')}`);

  // FK
  const fks = await getForeignKeys('equipment_models');
  const fkTables = fks.map(f => f.table);
  if (fkTables.includes('equipment_categories')) ok('FK → equipment_categories');
  else fail('Нет FK на equipment_categories');
  if (fkTables.includes('equipment_types')) ok('FK → equipment_types');
  else fail('Нет FK на equipment_types');

  // UNIQUE на corporate_id
  const idxs = await all(`PRAGMA index_list(equipment_models)`);
  const hasUniqueCorporate = idxs.some(i =>
    i.unique && i.origin === 'u'   // origin=u — UNIQUE из объявления таблицы
  );
  if (hasUniqueCorporate) ok('UNIQUE на corporate_id');
  else fail('Нет UNIQUE на corporate_id');

  // Счётчик
  const cnt = await get(`SELECT COUNT(*) AS c FROM equipment_models`);
  info(`Записей: ${cnt.c}`);
}

// ============================================================
// 2. equipment
// ============================================================

async function checkEquipment() {
  header('2. Таблица equipment (экземпляры)');

  const exists = await tableExists('equipment');
  if (!exists) {
    fail('Таблица equipment НЕ существует');
    return;
  }
  ok('Таблица существует');

  const cols = await getColumns('equipment');

  // Ожидаемые поля
  const expected = [
    'id', 'model_id', 'inventory_number', 'serial_number',
    'status', 'cell_id', 'workplace_id',
    'purchase_date', 'warranty_until', 'description',
    'created_at', 'updated_at',
  ];
  for (const col of expected) {
    if (cols.includes(col)) ok(`Поле ${col}`);
    else fail(`Отсутствует поле ${col}`);
  }

  // Старые поля — должны быть удалены
  const removed = ['name', 'model', 'manufacturer', 'category_id', 'type_id'];
  const stillThere = removed.filter(c => cols.includes(c));
  if (stillThere.length === 0) {
    ok('Старые поля удалены (name/model/manufacturer/category_id/type_id)');
  } else {
    fail(`Старые поля всё ещё есть: ${stillThere.join(', ')}`);
  }

  // FK
  const fks = await getForeignKeys('equipment');
  const fkMap = {};
  for (const fk of fks) {
    fkMap[fk.from] = fk.table;
  }

  if (fkMap['model_id'] === 'equipment_models') ok('FK model_id → equipment_models');
  else fail(`FK model_id неверный: ${fkMap['model_id'] || 'нет'}`);

  if (fkMap['cell_id'] === 'cells') ok('FK cell_id → cells');
  else fail(`FK cell_id неверный: ${fkMap['cell_id'] || 'нет'}`);

  if (fkMap['workplace_id'] === 'workplaces') ok('FK workplace_id → workplaces');
  else fail(`FK workplace_id неверный: ${fkMap['workplace_id'] || 'нет'}`);

  // Счётчик
  const cnt = await get(`SELECT COUNT(*) AS c FROM equipment`);
  info(`Записей: ${cnt.c} (должно быть 0 сразу после миграции)`);
}

// ============================================================
// 3. user_equipment
// ============================================================

async function checkUserEquipment() {
  header('3. Таблица user_equipment');

  const exists = await tableExists('user_equipment');
  if (!exists) {
    fail('Таблица user_equipment НЕ существует');
    return;
  }
  ok('Таблица существует');

  const cols = await getColumns('user_equipment');
  const expected = [
    'id', 'user_id', 'equipment_id',
    'assigned_date', 'returned_date',
    'condition_on_assign', 'condition_on_return', 'notes',
  ];
  for (const col of expected) {
    if (cols.includes(col)) ok(`Поле ${col}`);
    else fail(`Отсутствует поле ${col}`);
  }

  const fks = await getForeignKeys('user_equipment');
  const fkMap = {};
  for (const fk of fks) fkMap[fk.from] = fk.table;

  if (fkMap['user_id'] === 'users') ok('FK user_id → users');
  else fail(`FK user_id неверный: ${fkMap['user_id'] || 'нет'}`);

  if (fkMap['equipment_id'] === 'equipment') ok('FK equipment_id → equipment');
  else fail(`FK equipment_id неверный: ${fkMap['equipment_id'] || 'нет'}`);

  const cnt = await get(`SELECT COUNT(*) AS c FROM user_equipment`);
  info(`Записей: ${cnt.c}`);
}

// ============================================================
// 4. Индексы
// ============================================================

async function checkIndexes() {
  header('4. Индексы');

  const idxRows = await all(   // ← было all, стало idxRows
    `SELECT name, tbl_name FROM sqlite_master
     WHERE type='index' AND name LIKE 'idx_%'
     ORDER BY tbl_name, name`
  );

  const modelsIdxs = idxRows.filter(i => i.tbl_name === 'equipment_models').map(i => i.name);
  const equipIdxs  = idxRows.filter(i => i.tbl_name === 'equipment').map(i => i.name);

  const expectedModels = [
    'idx_models_corporate', 'idx_models_name', 'idx_models_category',
    'idx_models_type', 'idx_models_manufacturer',
  ];
  const expectedEquip = [
    'idx_equipment_model', 'idx_equipment_status', 'idx_equipment_cell',
    'idx_equipment_workplace', 'idx_equipment_inventory', 'idx_equipment_serial',
  ];

  for (const name of expectedModels) {
    if (modelsIdxs.includes(name)) ok(name);
    else fail(`Отсутствует индекс ${name}`);
  }
  for (const name of expectedEquip) {
    if (equipIdxs.includes(name)) ok(name);
    else fail(`Отсутствует индекс ${name}`);
  }
}

// ============================================================
// 5. Общая статистика
// ============================================================

async function checkStats() {
  header('5. Сводка');

  const stats = await get(`
    SELECT
      (SELECT COUNT(*) FROM users)              AS users,
      (SELECT COUNT(*) FROM equipment_categories) AS categories,
      (SELECT COUNT(*) FROM equipment_types)    AS types,
      (SELECT COUNT(*) FROM equipment_models)   AS models,
      (SELECT COUNT(*) FROM equipment)          AS equipment,
      (SELECT COUNT(*) FROM warehouses)         AS warehouses,
      (SELECT COUNT(*) FROM cells)              AS cells,
      (SELECT COUNT(*) FROM workplaces)         AS workplaces
  `);

  console.log(`  👥 Пользователей:  ${stats.users}`);
  console.log(`  📁 Категорий:      ${stats.categories}`);
  console.log(`  📦 Типов:          ${stats.types}`);
  console.log(`  🧩 Моделей ТМЦ:    ${stats.models}  ← должно быть 0`);
  console.log(`  🔧 Экземпляров:    ${stats.equipment}  ← должно быть 0`);
  console.log(`  🏢 Складов:        ${stats.warehouses}`);
  console.log(`  📦 Ячеек:          ${stats.cells}`);
  console.log(`  💺 Рабочих мест:   ${stats.workplaces}`);
}

// ============================================================
// ЗАПУСК
// ============================================================

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🔍 ПРОВЕРКА СТРУКТУРЫ БД (v3.0.1: equipment_models)');
  console.log('═══════════════════════════════════════════════');

  try {
    await checkEquipmentModels();
    await checkEquipment();
    await checkUserEquipment();
    await checkIndexes();
    await checkStats();
  } catch (err) {
    console.error('\n❌ Ошибка выполнения проверки:', err.message);
    errorsCount++;
  } finally {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    if (errorsCount === 0 && warningsCount === 0) {
      console.log('✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
    } else if (errorsCount === 0) {
      console.log(`✅ ПРОВЕРКИ ПРОЙДЕНЫ (${warningsCount} предупреждений)`);
    } else {
      console.log(`❌ ОШИБОК: ${errorsCount}, предупреждений: ${warningsCount}`);
    }
    console.log('═══════════════════════════════════════════════');
    console.log('');
    db.close();
  }
}

main();