// scripts/check-db.js
// ============================================================
// Проверка структуры БД на соответствие текущему состоянию
// программы (после 5.16.2b).
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
// Эталон: что ожидает код (после 5.16.3.3, сверено с migrate.js)
// ============================================================
// ВАЖНО: при добавлении новой таблицы / колонки в migrate.js —
// обновить этот эталон. Иначе check-db будет «зелёным», но
// код упадёт на реальной БД.
// ============================================================

const EXPECTED_SCHEMA = {
  // ---------- Пользователи / роли ----------
  users: {
    columns: {
      id:                   { type: 'INTEGER', notnull: 0 },
      username:             { type: 'TEXT',    notnull: 1 },
      email:                { type: 'TEXT',    notnull: 1 },
      password_hash:        { type: 'TEXT',    notnull: 1 },
      full_name:            { type: 'TEXT' },
      department:           { type: 'TEXT' },
      phone:                { type: 'TEXT' },
      role:                 { type: 'TEXT',    notnull: 1, default: "'user'" },
      is_active:            { type: 'INTEGER', notnull: 1, default: '1' },
      must_change_password: { type: 'INTEGER', notnull: 1, default: '0' },
      last_login:           { type: 'DATETIME' },
      created_at:           { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:           { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['username'], ['email']],
    indexes: ['idx_users_role', 'idx_users_active'],
  },

  // ---------- Справочник ----------
  equipment_categories: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      name:        { type: 'TEXT',    notnull: 1 },
      description: { type: 'TEXT' },
      icon:        { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      import_id:   { type: 'TEXT' },   // 5.4.x: для отмены импорта
    },
    unique: [['name']],
    indexes: ['idx_categories_sort'],
  },

  equipment_types: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      category_id: { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      description: { type: 'TEXT' },
      icon:        { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      import_id:   { type: 'TEXT' },
    },
    unique: [['category_id', 'name']],
    indexes: ['idx_types_category', 'idx_types_sort'],
  },

  // ---------- Номенклатура / экземпляры ----------
  equipment_models: {
    columns: {
      id:           { type: 'INTEGER', notnull: 0 },
      corporate_id: { type: 'TEXT',    notnull: 1 },
      name:         { type: 'TEXT',    notnull: 1 },
      manufacturer: { type: 'TEXT' },
      category_id:  { type: 'INTEGER', notnull: 1 },
      type_id:      { type: 'INTEGER', notnull: 1 },
      description:  { type: 'TEXT' },
      created_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      import_id:    { type: 'TEXT' },
    },
    unique: [['corporate_id']],
    indexes: ['idx_models_category', 'idx_models_type', 'idx_models_corporate', 'idx_models_name'],
  },

  equipment: {
    columns: {
      id:                    { type: 'INTEGER', notnull: 0 },
      model_id:              { type: 'INTEGER', notnull: 1 },
      inventory_number:      { type: 'TEXT' },
      serial_number:         { type: 'TEXT' },
      status:                { type: 'TEXT',    default: "'available'" },  // notnull=0 в БД (наследие)
      cell_id:               { type: 'INTEGER' },
      workplace_id:          { type: 'INTEGER' },
      responsible_user_id:   { type: 'INTEGER' },   // 4.10
      purchase_date:         { type: 'DATE' },
      warranty_until:        { type: 'DATE' },
      description:           { type: 'TEXT' },
      created_at:            { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:            { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      is_quantity_accounted: { type: 'INTEGER', notnull: 1, default: '1' },  // 5.15
      import_id:             { type: 'TEXT' },
      // legacy: category_id / type_id — рудимент до 3.x, не используются
      category_id:           { type: 'INTEGER', legacy: true },
      type_id:               { type: 'INTEGER', legacy: true },
      // assigned_by_user_id — НЕ существует в equipment (только в user_equipment)
    },
    unique: [['inventory_number'], ['serial_number']],
    indexes: [
      'idx_equipment_status', 'idx_equipment_cell', 'idx_equipment_workplace',
      'idx_equipment_responsible', 'idx_equipment_model', 'idx_equipment_inventory',
      'idx_equipment_serial',
    ],
  },

  fixed_assets: {
    columns: {
      equipment_id:       { type: 'INTEGER', notnull: 1, primaryKey: true },
      commissioning_date: { type: 'TEXT',    notnull: 1 },
      initial_cost:       { type: 'REAL' },
      useful_life_months: { type: 'INTEGER' },
      created_at:         { type: 'TEXT',    notnull: 1, default: "datetime('now')" },
      updated_at:         { type: 'TEXT',    notnull: 1, default: "datetime('now')" },
    },
    unique: [],  // equipment_id — INTEGER PRIMARY KEY (rowid, уникален неявно)
    indexes: ['idx_fixed_assets_commissioning'],
  },

  user_equipment: {
    columns: {
      id:                  { type: 'INTEGER', notnull: 0 },
      user_id:             { type: 'INTEGER', notnull: 1 },
      equipment_id:        { type: 'INTEGER', notnull: 1 },
      assigned_date:       { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      returned_date:       { type: 'DATETIME' },
      condition_on_assign: { type: 'TEXT' },
      condition_on_return: { type: 'TEXT' },
      notes:               { type: 'TEXT' },
      assigned_by_user_id: { type: 'INTEGER' },   // 5.11.2
    },
    unique: [['user_id', 'equipment_id', 'returned_date']],
    indexes: ['idx_user_equipment_user', 'idx_user_equipment_equipment', 'idx_user_equipment_active'],
  },

  // ---------- Склады ----------
  warehouses: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      name:        { type: 'TEXT',    notnull: 1 },
      address:     { type: 'TEXT' },
      description: { type: 'TEXT' },
      is_default:  { type: 'INTEGER', notnull: 1, default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['name']],
    indexes: ['idx_warehouses_default', 'idx_warehouses_active'],
  },

  zones: {
    columns: {
      id:           { type: 'INTEGER', notnull: 0 },
      warehouse_id: { type: 'INTEGER', notnull: 1 },
      name:         { type: 'TEXT',    notnull: 1 },
      description:  { type: 'TEXT' },
      sort_order:   { type: 'INTEGER', default: '0' },
      is_active:    { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['warehouse_id', 'name']],
    indexes: ['idx_zones_warehouse', 'idx_zones_sort'],
  },

  racks: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      zone_id:     { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      description: { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['zone_id', 'name']],
    indexes: ['idx_racks_zone', 'idx_racks_sort'],
  },

  cells: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      rack_id:     { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      code:        { type: 'TEXT' },
      capacity:    { type: 'INTEGER' },
      description: { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      is_full:     { type: 'INTEGER', notnull: 1, default: '0' },  // 4.7
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['rack_id', 'name']],
    indexes: ['idx_cells_rack', 'idx_cells_sort'],
  },

  // ---------- Рабочие места ----------
  offices: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      name:        { type: 'TEXT',    notnull: 1 },
      address:     { type: 'TEXT' },
      description: { type: 'TEXT' },
      is_default:  { type: 'INTEGER', notnull: 1, default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['name']],
    indexes: ['idx_offices_default', 'idx_offices_active'],
  },

  rooms: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      office_id:   { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      description: { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['office_id', 'name']],
    indexes: ['idx_rooms_office', 'idx_rooms_sort'],
  },

  workplaces: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      room_id:     { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      code:        { type: 'TEXT' },
      description: { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      // capacity удалена в 4.8 (DROP COLUMN на SQLite 3.35+)
    },
    unique: [['room_id', 'name']],
    indexes: ['idx_workplaces_room', 'idx_workplaces_sort'],
  },

  // ---------- МОЛ ----------
  warehouse_responsibles: {
    columns: {
      id:           { type: 'INTEGER', notnull: 0 },
      warehouse_id: { type: 'INTEGER', notnull: 1 },
      user_id:      { type: 'INTEGER', notnull: 1 },
      created_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['warehouse_id', 'user_id']],
    indexes: ['idx_wh_resp_user', 'idx_wh_resp_wh'],
  },

  office_responsibles: {
    columns: {
      id:         { type: 'INTEGER', notnull: 0 },
      office_id:  { type: 'INTEGER', notnull: 1 },
      user_id:    { type: 'INTEGER', notnull: 1 },
      created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['office_id', 'user_id']],
    indexes: ['idx_office_resp_user', 'idx_office_resp_office'],
  },

  // ---------- Логи / мета ----------
  activity_log: {
    columns: {
      id:         { type: 'INTEGER', notnull: 0 },
      user_id:    { type: 'INTEGER' },
      username:   { type: 'TEXT' },
      action:     { type: 'TEXT', notnull: 1 },
      entity_type:{ type: 'TEXT' },
      entity_id:  { type: 'INTEGER' },
      details:    { type: 'TEXT' },
      ip_address: { type: 'TEXT' },
      user_agent: { type: 'TEXT' },
      created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [],
    indexes: ['idx_activity_log_user', 'idx_activity_log_action', 'idx_activity_log_created'],
  },

  app_meta: {
    columns: {
      key:        { type: 'TEXT', notnull: 0 },  // PRIMARY KEY, но SQLite допускает NULL (один)
      value:      { type: 'TEXT' },
      updated_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [],
    indexes: [],
  },

  // ---------- Импорт ----------
  import_history: {
    columns: {
      id:               { type: 'INTEGER', notnull: 0 },
      import_id:        { type: 'TEXT',    notnull: 1 },
      user_id:          { type: 'INTEGER', notnull: 1 },
      equipment_count:  { type: 'INTEGER', default: '0' },
      models_count:     { type: 'INTEGER', default: '0' },
      categories_count: { type: 'INTEGER', default: '0' },
      types_count:      { type: 'INTEGER', default: '0' },
      created_at:       { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      canceled_at:      { type: 'DATETIME' },
      canceled_by:      { type: 'INTEGER' },
    },
    unique: [['import_id']],
    indexes: [],
  },

  
  // ---------- Номенклатура: расходники + запчасти (5.16.2) ----------
  item_categories: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      name:        { type: 'TEXT',    notnull: 1 },
      description: { type: 'TEXT' },
      icon:        { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['name']],
    indexes: ['idx_item_cat_sort', 'idx_item_cat_active'],
  },

  item_types: {
    columns: {
      id:          { type: 'INTEGER', notnull: 0 },
      category_id: { type: 'INTEGER', notnull: 1 },
      name:        { type: 'TEXT',    notnull: 1 },
      description: { type: 'TEXT' },
      icon:        { type: 'TEXT' },
      sort_order:  { type: 'INTEGER', default: '0' },
      is_active:   { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:  { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['category_id', 'name']],
    indexes: ['idx_item_type_cat', 'idx_item_type_sort', 'idx_item_type_active'],
  },

  item_models: {
    columns: {
      id:           { type: 'INTEGER', notnull: 0 },
      corporate_id: { type: 'TEXT',    notnull: 1 },
      name:         { type: 'TEXT',    notnull: 1 },
      unit:         { type: 'TEXT',    notnull: 1, default: "'шт'" },
      kind:         { type: 'TEXT',    notnull: 1, default: "'consumable'" },
      category_id:  { type: 'INTEGER', notnull: 1 },
      type_id:      { type: 'INTEGER', notnull: 1 },
      description:  { type: 'TEXT' },
      is_active:    { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['corporate_id']],
    indexes: [
      'idx_item_models_corporate', 'idx_item_models_name',
      'idx_item_models_kind', 'idx_item_models_cat', 'idx_item_models_type',
    ],
  },

  items: {
    columns: {
      id:           { type: 'INTEGER', notnull: 0 },
      model_id:     { type: 'INTEGER', notnull: 1 },
      warehouse_id: { type: 'INTEGER', notnull: 1 },
      quantity:     { type: 'REAL',    notnull: 1, default: '0' },
      min_quantity: { type: 'REAL',    notnull: 1, default: '0' },
      is_active:    { type: 'INTEGER', notnull: 1, default: '1' },
      created_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
      updated_at:   { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    },
    unique: [['model_id', 'warehouse_id']],
    indexes: ['idx_items_model', 'idx_items_warehouse', 'idx_items_active'],
  },
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
  
  item_types: [
    { from: 'category_id', table: 'item_categories', to: 'id' },
  ],
  
  item_models: [
    { from: 'category_id', table: 'item_categories', to: 'id' },
    { from: 'type_id',     table: 'item_types',      to: 'id' },
  ],
  
  items: [
    { from: 'model_id',     table: 'item_models', to: 'id' },
    { from: 'warehouse_id', table: 'warehouses',  to: 'id' },
  ],
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
    const SQLITE_TEXT_TYPES = ['TEXT', 'DATETIME', 'DATE'];
    const actualType = (actual.type || '').toUpperCase();
    const expectedType = (colSpec.type || '').toUpperCase();
    const typesEquivalent =
      (SQLITE_TEXT_TYPES.includes(actualType) && SQLITE_TEXT_TYPES.includes(expectedType)) ||
      actualType === expectedType;
    if (colSpec.type && !typesEquivalent) {
      warn(`  ${name}.${colName} — тип "${actual.type}", ожидается "${colSpec.type}"`);
      warnings++;
    }
    // NOT NULL
    // Для INTEGER PRIMARY KEY (rowid-алиас) SQLite всегда отдаёт
    // notnull=0 в PRAGMA table_info — не считаем это расхождением.
    if (colSpec.notnull !== undefined
        && actual.notnull !== colSpec.notnull
        && !(colSpec.primaryKey === true && actual.notnull === 0)) {
      warn(`  ${name}.${colName} — notnull=${actual.notnull}, ожидается ${colSpec.notnull}`);
      warnings++;
    }
    // DEFAULT
    if (colSpec.default !== undefined && colSpec.default !== null) {
      const norm = (v) => (v || '').toString()
        .replace(/\s+/g, '')
        .replace(/datetime\('now'\)/i, 'CURRENT_TIMESTAMP')
        .replace(/^null$/i, 'NULL')
        .toUpperCase();
      if (norm(actual.dflt_value) !== norm(colSpec.default)) {
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
  // legacy-колонки: описаны в эталоне с legacy: true — не ругаемся

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
    // Если это одна колонка и в эталоне помечена primaryKey — не требуем UNIQUE-индекс
    const isPk = uq.length === 1
      && spec.columns[uq[0]]
      && spec.columns[uq[0]].primaryKey === true;
    if (isPk) continue;

    const found = indexes.some(i => i.unique);
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
  console.log(`${C.cyan}  Проверка структуры БД (после 5.16.2b)${C.reset}`);
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