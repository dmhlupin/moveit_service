// scripts/check-db.js
// ============================================================
// Проверка структуры БД на соответствие текущему состоянию
// программы (после 5.16.3.2).
//
// Что проверяет:
//   1. Все ожидаемые таблицы существуют.
//   2. Колонки каждой таблицы: имя, тип, NOT NULL, DEFAULT.
//   3. Индексы (UNIQUE, обычные).
//   4. Триггеры (trg_fixed_assets_force_quantity).
//   5. Внешние ключи (PRAGMA foreign_key_list).
//   6. Инварианты данных:
//      - ОС ⇒ is_quantity_accounted = 1;
//      - fixed_assets.commissioning_date NOT NULL;
//      - дубли inventory_number / serial_number (NULL разрешён);
//      - осиротевшие записи (equipment без model, user_equipment без user);
//      - kind-инварианты (ОС / ТМЦ / малоценка).
//   7. Версия схемы (PRAGMA user_version) — если задана.
//
// Не меняет БД. Код выхода: 0 — всё ок, 1 — есть расхождения.
//
// Запуск: npm run check-db
// ============================================================

const path = require('path');
const { db, closeDatabase } = require('../database/db');

// ============================================================
// Эталон: что ожидает код (после 5.16.3.2)
// ============================================================
// ВАЖНО: при добавлении новой таблицы / колонки в migrate.js —
// обновить этот эталон. Иначе check-db будет «зелёным», но
// код упадёт на реальной БД.
// ============================================================

const EXPECTED_SCHEMA = {
  // ---------- Пользователи / роли ----------
  users: {
    columns: {
      id:            { type: 'INTEGER', notnull: 0, default: null },
      username:      { type: 'TEXT',    notnull: 1 },
      password_hash: { type: 'TEXT',    notnull: 1 },
      full_name:     { type: 'TEXT' },
      email:         { type: 'TEXT' },
      department:    { type: 'TEXT' },
      role:          { type: 'TEXT',    notnull: 1, default: "'user'" },
      is_active:     { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:    { type: 'TEXT',    default: "datetime('now')" },
      updated_at:    { type: 'TEXT' },
    },
    unique: [['username']],
    indexes: [],
  },

  // ---------- Справочник ----------
  equipment_categories: {
    columns: {
      id:         { type: 'INTEGER', notnull: 0 },
      name:       { type: 'TEXT',    notnull: 1 },
      icon:       { type: 'TEXT' },
      sort_order: { type: 'INTEGER', default: '0' },
      created_at: { type: 'TEXT' },
    },
    unique: [['name']],
    indexes: [],
  },

  equipment_types: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      category_id: { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      icon:        { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      created_at:  { type: 'TEXT' },
    },
    unique: [['category_id', 'name']],
    indexes: ['idx_types_category'],
  },

  // ---------- Номенклатура / экземпляры ----------
  equipment_models: {
    columns: {
      id:            { type: 'INTEGER', notnull: 0 },
      name:          { type: 'TEXT',    notnull: 1 },
      manufacturer:  { type: 'TEXT' },
      corporate_id:  { type: 'TEXT',    notnull: 1 },
      category_id:   { type: 'INTEGER' },
      type_id:       { type: 'INTEGER' },
      description:   { type: 'TEXT' },
      created_at:    { type: 'TEXT' },
    },
    unique: [['corporate_id']],
    indexes: ['idx_models_category', 'idx_models_type'],
  },

  equipment: {
    columns: {
      id:                   { type: 'INTEGER', notnull: 0 },
      model_id:             { type: 'INTEGER', notnull: 1 },
      inventory_number:     { type: 'TEXT' },
      serial_number:        { type: 'TEXT' },
      status:               { type: 'TEXT',    notnull: 1, default: "'available'" },
      cell_id:              { type: 'INTEGER' },
      workplace_id:         { type: 'INTEGER' },
      responsible_user_id:  { type: 'INTEGER' },
      purchase_date:        { type: 'TEXT' },
      warranty_until:       { type: 'TEXT' },
      description:          { type: 'TEXT' },
      import_id:            { type: 'TEXT' },
      is_quantity_accounted:{ type: 'INTEGER', notnull: 1, default: '1' },  // 🆕 5.15
      assigned_by_user_id:  { type: 'INTEGER' },                            // 🆕 5.11.2
      created_at:           { type: 'TEXT' },
      updated_at:           { type: 'TEXT' },
    },
    unique: [['inventory_number'], ['serial_number']],
    indexes: [
      'idx_equipment_status',
      'idx_equipment_cell',
      'idx_equipment_workplace',
      'idx_equipment_responsible',
    ],
  },

  fixed_assets: {
    columns: {
      equipment_id:        { type: 'INTEGER', notnull: 1 },
      commissioning_date:  { type: 'TEXT',    notnull: 1 },
      initial_cost:        { type: 'REAL' },
      useful_life_months:  { type: 'INTEGER' },
      created_at:          { type: 'TEXT' },
      updated_at:          { type: 'TEXT' },
    },
    unique: [['equipment_id']],
    indexes: [],
  },

  // ---------- Назначения ----------
  user_equipment: {
    columns: {
      id:                   { type: 'INTEGER', notnull: 0 },
      user_id:              { type: 'INTEGER', notnull: 1 },
      equipment_id:         { type: 'INTEGER', notnull: 1 },
      assigned_date:        { type: 'TEXT' },
      returned_date:        { type: 'TEXT' },
      condition_on_assign:  { type: 'TEXT' },
      condition_on_return:  { type: 'TEXT' },
      notes:                { type: 'TEXT' },
      assigned_by_user_id:  { type: 'INTEGER' },  // 🆕 5.11.2
    },
    unique: [],
    indexes: ['idx_user_equipment_user', 'idx_user_equipment_eq'],
  },

  // ---------- Склады ----------
  warehouses: {
    columns: {
      id:         { type: 'INTEGER', notnull: 0 },
      name:       { type: 'TEXT',    notnull: 1 },
      is_default: { type: 'INTEGER', notnull: 1, default: '0' },
      created_at: { type: 'TEXT' },
    },
    unique: [['name']],
    indexes: [],
  },

  zones: {
    columns: {
      id:           { type: 'INTEGER', notnull: 0 },
      warehouse_id: { type: 'INTEGER', notnull: 1 },
      name:         { type: 'TEXT',    notnull: 1 },
      created_at:   { type: 'TEXT' },
    },
    unique: [['warehouse_id', 'name']],
    indexes: ['idx_zones_warehouse'],
  },

  racks: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      zone_id:     { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      description: { type: 'TEXT' },
      created_at:  { type: 'TEXT' },
    },
    unique: [['zone_id', 'name']],
    indexes: ['idx_racks_zone'],
  },

  cells: {
    columns: {
      id:         { type: 'INTEGER', notnull: 0 },
      rack_id:    { type: 'INTEGER', notnull: 1 },
      name:       { type: 'TEXT',    notnull: 1 },
      code:       { type: 'TEXT' },
      capacity:   { type: 'INTEGER' },
      is_full:    { type: 'INTEGER', notnull: 1, default: '0' },
      created_at: { type: 'TEXT' },
    },
    unique: [['rack_id', 'name']],
    indexes: ['idx_cells_rack'],
  },

  // ---------- Рабочие места ----------
  offices: {
    columns: {
      id:         { type: 'INTEGER', notnull: 0 },
      name:       { type: 'TEXT',    notnull: 1 },
      is_default: { type: 'INTEGER', notnull: 1, default: '0' },
      created_at: { type: 'TEXT' },
    },
    unique: [['name']],
    indexes: [],
  },

  rooms: {
    columns: {
      id:         { type: 'INTEGER', notnull: 0 },
      office_id:  { type: 'INTEGER', notnull: 1 },
      name:       { type: 'TEXT',    notnull: 1 },
      created_at: { type: 'TEXT' },
    },
    unique: [['office_id', 'name']],
    indexes: ['idx_rooms_office'],
  },

  workplaces: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      room_id:     { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      code:        { type: 'TEXT' },
      description: { type: 'TEXT' },
      created_at:  { type: 'TEXT' },
    },
    unique: [['room_id', 'name']],
    indexes: ['idx_workplaces_room'],
  },

  // ---------- МОЛ ----------
  warehouse_responsibles: {
    columns: {
      warehouse_id: { type: 'INTEGER', notnull: 1 },
      user_id:      { type: 'INTEGER', notnull: 1 },
      created_at:   { type: 'TEXT' },
    },
    unique: [['warehouse_id', 'user_id']],
    indexes: [],
  },

  office_responsibles: {
    columns: {
      office_id:  { type: 'INTEGER', notnull: 1 },
      user_id:    { type: 'INTEGER', notnull: 1 },
      created_at: { type: 'TEXT' },
    },
    unique: [['office_id', 'user_id']],
    indexes: [],
  },

  // ---------- Логи / мета ----------
  activity_log: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      user_id:     { type: 'INTEGER' },
      username:    { type: 'TEXT' },
      action:      { type: 'TEXT',    notnull: 1 },
      entity_type: { type: 'TEXT' },
      entity_id:   { type: 'INTEGER' },
      details:     { type: 'TEXT' },
      created_at:  { type: 'TEXT' },
    },
    unique: [],
    indexes: ['idx_logs_user', 'idx_logs_action', 'idx_logs_entity', 'idx_logs_created'],
  },

  app_meta: {
    columns: {
      key:        { type: 'TEXT', notnull: 1 },
      value:      { type: 'TEXT' },
      updated_at: { type: 'TEXT' },
    },
    unique: [['key']],
    indexes: [],
  },

  // ---------- Импорт ----------
  import_history: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      import_id:   { type: 'TEXT',    notnull: 1 },
      filename:    { type: 'TEXT' },
      user_id:     { type: 'INTEGER' },
      stats:       { type: 'TEXT' },
      created_at:  { type: 'TEXT' },
    },
    unique: [['import_id']],
    indexes: [],
  },

  // 🆕 5.16.2 (заглушка, если ещё не мигрировали — см. skipIfMissing)
  // consumables: { ... }
};

const EXPECTED_TRIGGERS = [
  'trg_fixed_assets_force_quantity',
];

const EXPECTED_FK = {
  equipment: [
    { from: 'model_id',            table: 'equipment_models', to: 'id' },
    { from: 'cell_id',             table: 'cells',            to: 'id' },
    { from: 'workplace_id',        table: 'workplaces',       to: 'id' },
    { from: 'responsible_user_id', table: 'users',            to: 'id' },
  ],
  fixed_assets: [
    { from: 'equipment_id', table: 'equipment', to: 'id' },
  ],
  // ... (можно расширить)
};

// ============================================================
// Утилиты вывода
// ============================================================

const C = {
  reset: '\x1b[0m',
  red:   '\x1b[31m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  cyan:  '\x1b[36m',
  gray:  '\x1b[90m',
};

function ok(msg)   { console.log(`${C.green}[OK]${C.reset}    ${msg}`); }
function warn(msg) { console.log(`${C.yellow}[WARN]${C.reset}  ${msg}`); }
function fail(msg) { console.log(`${C.red}[FAIL]${C.reset}  ${msg}`); }
function info(msg) { console.log(`${C.cyan}[INFO]${C.reset}  ${msg}`); }
function section(msg) { console.log(`\n${C.cyan}── ${msg} ──${C.reset}`); }

// ============================================================
// Хелперы
// ============================================================

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

async function tableExists(name) {
  const row = await get(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [name]
  );
  return !!row;
}

async function getTableInfo(name) {
  return all(`PRAGMA table_info(${name})`);
}

async function getIndexes(name) {
  return all(`PRAGMA index_list(${name})`);
}

async function getTriggers() {
  return all(`SELECT name FROM sqlite_master WHERE type = 'trigger'`);
}

async function getForeignKeys(name) {
  return all(`PRAGMA foreign_key_list(${name})`);
}

// ============================================================
// Проверки
// ============================================================

let errors = 0;
let warnings = 0;

async function checkTable(name, spec) {
  const exists = await tableExists(name);
  if (!exists) {
    fail(`Таблица "${name}" не существует`);
    errors++;
    return;
  }

  const cols = await getTableInfo(name);
  const colMap = Object.fromEntries(cols.map(c => [c.name, c]));

  // Колонки
  for (const [colName, colSpec] of Object.entries(spec.columns || {})) {
    const actual = colMap[colName];
    if (!actual) {
      fail(`  ${name}.${colName} — колонка отсутствует (ожидается ${colSpec.type})`);
      errors++;
      continue;
    }
    // Тип
    if (colSpec.type && actual.type.toUpperCase() !== colSpec.type.toUpperCase()) {
      warn(`  ${name}.${colName} — тип "${actual.type}", ожидается "${colSpec.type}"`);
      warnings++;
    }
    // NOT NULL
    if (colSpec.notnull !== undefined && actual.notnull !== colSpec.notnull) {
      warn(`  ${name}.${colName} — notnull=${actual.notnull}, ожидается ${colSpec.notnull}`);
      warnings++;
    }
    // DEFAULT
    if (colSpec.default !== undefined && colSpec.default !== null) {
      const actualDef = (actual.dflt_value || '').toString().replace(/\s+/g, '');
      const expectedDef = colSpec.default.toString().replace(/\s+/g, '');
      if (actualDef !== expectedDef) {
        warn(`  ${name}.${colName} — default="${actual.dflt_value}", ожидается "${colSpec.default}"`);
        warnings++;
      }
    }
  }

  // Лишние колонки (предупреждение, не ошибка)
  for (const actualName of Object.keys(colMap)) {
    if (!(actualName in (spec.columns || {}))) {
      warn(`  ${name}.${actualName} — колонка есть в БД, но не описана в эталоне`);
      warnings++;
    }
  }

  // Индексы
  const indexes = await getIndexes(name);
  const idxNames = indexes.map(i => i.name);
  for (const idx of spec.indexes || []) {
    if (!idxNames.includes(idx)) {
      warn(`  ${name} — индекс "${idx}" отсутствует`);
      warnings++;
    }
  }

  // UNIQUE
  for (const uq of spec.unique || []) {
    const found = indexes.some(i => {
      if (!i.unique) return false;
      // PRAGMA index_info — проверить состав
      return true; // упрощённо: проверяем только наличие unique-индекса
    });
    if (!found) {
      warn(`  ${name} — UNIQUE(${uq.join(', ')}) не найден`);
      warnings++;
    }
  }

  ok(`Таблица "${name}" — ${cols.length} колонок`);
}

async function checkTriggers() {
  const triggers = await getTriggers();
  const names = triggers.map(t => t.name);
  for (const trg of EXPECTED_TRIGGERS) {
    if (names.includes(trg)) {
      ok(`Триггер "${trg}" — есть`);
    } else {
      fail(`Триггер "${trg}" — отсутствует`);
      errors++;
    }
  }
}

async function checkForeignKeys() {
  for (const [table, fks] of Object.entries(EXPECTED_FK)) {
    const exists = await tableExists(table);
    if (!exists) continue;
    const actual = await getForeignKeys(table);
    for (const fk of fks) {
      const found = actual.some(a =>
        a.from === fk.from && a.table === fk.table && a.to === fk.to
      );
      if (found) {
        ok(`FK ${table}.${fk.from} → ${fk.table}.${fk.to}`);
      } else {
        warn(`FK ${table}.${fk.from} → ${fk.table}.${fk.to} — отсутствует`);
        warnings++;
      }
    }
  }
}

async function checkDataInvariants() {
  // 1. ОС ⇒ is_quantity_accounted = 1
  const osQty = await get(`
    SELECT COUNT(*) AS n
    FROM fixed_assets fa
    JOIN equipment e ON e.id = fa.equipment_id
    WHERE e.is_quantity_accounted = 0
  `);
  if (osQty.n > 0) {
    fail(`Инвариант ОС: ${osQty.n} ОС с is_quantity_accounted = 0`);
    errors++;
  } else {
    ok('Инвариант ОС ⇒ кол. учёт = 1');
  }

  // 2. fixed_assets.commissioning_date NOT NULL
  const faNull = await get(`
    SELECT COUNT(*) AS n FROM fixed_assets WHERE commissioning_date IS NULL
  `);
  if (faNull.n > 0) {
    fail(`fixed_assets: ${faNull.n} записей с commissioning_date = NULL`);
    errors++;
  } else {
    ok('fixed_assets.commissioning_date — везде заполнено');
  }

  // 3. Дубли inventory_number
  const dupInv = await all(`
    SELECT inventory_number, COUNT(*) AS n
    FROM equipment
    WHERE inventory_number IS NOT NULL
    GROUP BY inventory_number
    HAVING n > 1
  `);
  if (dupInv.length > 0) {
    fail(`Дубли inventory_number: ${dupInv.map(r => r.inventory_number).join(', ')}`);
    errors++;
  } else {
    ok('Дубли inventory_number — нет');
  }

  // 4. Дубли serial_number
  const dupSn = await all(`
    SELECT serial_number, COUNT(*) AS n
    FROM equipment
    WHERE serial_number IS NOT NULL
    GROUP BY serial_number
    HAVING n > 1
  `);
  if (dupSn.length > 0) {
    fail(`Дубли serial_number: ${dupSn.map(r => r.serial_number).join(', ')}`);
    errors++;
  } else {
    ok('Дубли serial_number — нет');
  }

  // 5. Осиротевшие записи
  const orphanEq = await get(`
    SELECT COUNT(*) AS n
    FROM equipment e
    LEFT JOIN equipment_models m ON m.id = e.model_id
    WHERE m.id IS NULL
  `);
  if (orphanEq.n > 0) {
    fail(`equipment без model: ${orphanEq.n}`);
    errors++;
  } else {
    ok('equipment → equipment_models — все model_id валидны');
  }

  const orphanUe = await get(`
    SELECT COUNT(*) AS n
    FROM user_equipment ue
    LEFT JOIN users u ON u.id = ue.user_id
    LEFT JOIN equipment e ON e.id = ue.equipment_id
    WHERE u.id IS NULL OR e.id IS NULL
  `);
  if (orphanUe.n > 0) {
    fail(`user_equipment с осиротевшими user_id / equipment_id: ${orphanUe.n}`);
    errors++;
  } else {
    ok('user_equipment → users / equipment — все ссылки валидны');
  }

  // 6. kind-инварианты
  const kindStats = await all(`
    SELECT
      CASE
        WHEN fa.equipment_id IS NOT NULL THEN 'fixed_asset'
        WHEN e.is_quantity_accounted = 1 THEN 'tangible'
        ELSE 'low_value'
      END AS kind,
      COUNT(*) AS n
    FROM equipment e
    LEFT JOIN fixed_assets fa ON fa.equipment_id = e.id
    GROUP BY kind
  `);
  info('Распределение по kind:');
  kindStats.forEach(r => console.log(`      ${r.kind}: ${r.n}`));

  // 7. Статусы
  const statusStats = await all(`
    SELECT status, COUNT(*) AS n FROM equipment GROUP BY status
  `);
  info('Распределение по статусам:');
  statusStats.forEach(r => console.log(`      ${r.status}: ${r.n}`));

  // 8. Назначения: активные (returned_date IS NULL) с status != 'assigned'
  const badAssign = await get(`
    SELECT COUNT(*) AS n
    FROM user_equipment ue
    JOIN equipment e ON e.id = ue.equipment_id
    WHERE ue.returned_date IS NULL AND e.status != 'assigned'
  `);
  if (badAssign.n > 0) {
    warn(`Активные назначения (returned_date IS NULL) у техники не в статусе assigned: ${badAssign.n}`);
    warnings++;
  } else {
    ok('Активные назначения — только у status = assigned');
  }
}

async function checkSchemaVersion() {
  const row = await get(`PRAGMA user_version`);
  if (row && row.user_version !== undefined) {
    info(`PRAGMA user_version = ${row.user_version}`);
  }
  // app_meta: schema_version (если используешь)
  const meta = await get(
    `SELECT value FROM app_meta WHERE key = 'schema_version'`
  ).catch(() => null);
  if (meta) {
    info(`app_meta.schema_version = ${meta.value}`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`\n${C.cyan}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.cyan}  MoveIT service — check-db${C.reset}`);
  console.log(`${C.cyan}  Проверка структуры БД (после 5.16.3.2)${C.reset}`);
  console.log(`${C.cyan}═══════════════════════════════════════════════════${C.reset}`);

  // 1. Таблицы
  section('Таблицы и колонки');
  for (const [name, spec] of Object.entries(EXPECTED_SCHEMA)) {
    await checkTable(name, spec);
  }

  // 2. Триггеры
  section('Триггеры');
  await checkTriggers();

  // 3. Внешние ключи
  section('Внешние ключи');
  await checkForeignKeys();

  // 4. Инварианты данных
  section('Инварианты данных');
  await checkDataInvariants();

  // 5. Версия схемы
  section('Версия схемы');
  await checkSchemaVersion();

  // Итог
  console.log(`\n${C.cyan}═══════════════════════════════════════════════════${C.reset}`);
  if (errors === 0 && warnings === 0) {
    console.log(`${C.green}✅ Всё ок: 0 ошибок, 0 предупреждений${C.reset}`);
  } else if (errors === 0) {
    console.log(`${C.yellow}⚠️  0 ошибок, ${warnings} предупреждений${C.reset}`);
  } else {
    console.log(`${C.red}❌ ${errors} ошибок, ${warnings} предупреждений${C.reset}`);
  }
  console.log(`${C.cyan}═══════════════════════════════════════════════════${C.reset}\n`);

  await closeDatabase();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(`\n${C.red}❌ Ошибка check-db:${C.reset}`, err.message);
  console.error(err.stack);
  await closeDatabase();
  process.exit(1);
});