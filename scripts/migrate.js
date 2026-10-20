// scripts/migrate.js
// Миграция базы данных: структура + наполнение справочника + склады

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');
const db = new sqlite3.Database(dbPath);

// ============================================================
// ПРОМИС-ОБЁРТКИ ДЛЯ SQLITE
// ============================================================

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
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

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ============================================================
// УТИЛИТЫ
// ============================================================

async function tableExists(table) {
  const result = await get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [table]
  );
  return !!result;
}

async function columnExists(table, column) {
  const columns = await all(`PRAGMA table_info(${table})`);
  return columns.some(c => c.name === column);
}

async function addColumnIfMissing(table, column, definition) {
  const exists = await columnExists(table, column);
  if (exists) {
    console.log(`  ⏭️  Поле уже есть: ${table}.${column}`);
    return false;
  }
  await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  ✅ Добавлено поле: ${table}.${column}`);
  return true;
}

async function createIndexIfMissing(indexName, table, columns, extra = '') {
  await run(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${columns}) ${extra}`);
}

// ============================================================
// ЭТАП 1: СОЗДАНИЕ ТАБЛИЦ
// ============================================================

async function createUsersTable() {
  const exists = await tableExists('users');
  
  if (!exists) {
    console.log('📋 Создание таблицы users...');
    await run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        department TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица users создана\n');
    return;
  }
  
  console.log('📋 Таблица users существует, проверяем поля...');
  
  await addColumnIfMissing('users', 'password_hash', 'TEXT');
  await addColumnIfMissing('users', 'role', `TEXT NOT NULL DEFAULT 'user'`);
  await addColumnIfMissing('users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'last_login', 'DATETIME');
  console.log('');
}

async function createEquipmentTable() {
  const exists = await tableExists('equipment');
  
  if (!exists) {
    console.log('📋 Создание таблицы equipment...');
    await run(`
      CREATE TABLE equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        model TEXT,
        serial_number TEXT,
        manufacturer TEXT,
        purchase_date DATE,
        warranty_until DATE,
        status TEXT DEFAULT 'available',
        description TEXT,
        category_id INTEGER REFERENCES equipment_categories(id) ON DELETE SET NULL,
        type_id INTEGER REFERENCES equipment_types(id) ON DELETE SET NULL,
        cell_id INTEGER REFERENCES cells(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица equipment создана\n');
    return;
  }
  
  console.log('📋 Таблица equipment существует, проверяем поля...');
  await addColumnIfMissing('equipment', 'category_id', 'INTEGER REFERENCES equipment_categories(id) ON DELETE SET NULL');
  await addColumnIfMissing('equipment', 'type_id', 'INTEGER REFERENCES equipment_types(id) ON DELETE SET NULL');
  console.log('');
}

async function createUserEquipmentTable() {
  const exists = await tableExists('user_equipment');
  
  if (exists) {
    console.log('⏭️  Таблица user_equipment уже существует\n');
    return;
  }
  
  console.log('📋 Создание таблицы user_equipment...');
  await run(`
    CREATE TABLE user_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      returned_date DATETIME,
      condition_on_assign TEXT,
      condition_on_return TEXT,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
      UNIQUE(user_id, equipment_id, returned_date)
    )
  `);
  console.log('✅ Таблица user_equipment создана\n');
}

async function createCategoriesTable() {
  const exists = await tableExists('equipment_categories');
  
  if (exists) {
    console.log('⏭️  Таблица equipment_categories уже существует\n');
    return;
  }
  
  console.log('📋 Создание таблицы equipment_categories...');
  await run(`
    CREATE TABLE equipment_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Таблица equipment_categories создана\n');
}

async function createTypesTable() {
  const exists = await tableExists('equipment_types');
  
  if (exists) {
    console.log('⏭️  Таблица equipment_types уже существует\n');
    return;
  }
  
  console.log('📋 Создание таблицы equipment_types...');
  await run(`
    CREATE TABLE equipment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES equipment_categories(id) ON DELETE RESTRICT,
      UNIQUE(category_id, name)
    )
  `);
  console.log('✅ Таблица equipment_types создана\n');
}

async function createActivityLogTable() {
  const exists = await tableExists('activity_log');
  
  if (exists) {
    console.log('⏭️  Таблица activity_log уже существует\n');
    return;
  }
  
  console.log('📋 Создание таблицы activity_log...');
  await run(`
    CREATE TABLE activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ Таблица activity_log создана\n');
}

async function createAppMetaTable() {
  const exists = await tableExists('app_meta');
  
  if (!exists) {
    console.log('📋 Создание таблицы app_meta...');
    await run(`
      CREATE TABLE app_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await run(`
      INSERT INTO app_meta (key, value) 
      VALUES ('db_seed_version', ?)
    `, [Date.now().toString()]);
    
    console.log('✅ Таблица app_meta создана');
    console.log('✅ Установлена начальная версия БД\n');
    return;
  }
  
  console.log('⏭️  Таблица app_meta уже существует\n');
}

// ============================================================
// ЭТАП 1.5: ТАБЛИЦЫ СКЛАДОВ
// ============================================================

async function createWarehousesTable() {
  const exists = await tableExists('warehouses');
  
  if (exists) {
    console.log('⏭️  Таблица warehouses уже существует\n');
    return;
  }
  
  console.log('📋 Создание таблицы warehouses (склады)...');
  await run(`
    CREATE TABLE warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT,
      description TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Таблица warehouses создана\n');
}

async function createZonesTable() {
  const exists = await tableExists('zones');
  
  if (exists) {
    console.log('⏭️  Таблица zones уже существует\n');
    return;
  }
  
  console.log('📋 Создание таблицы zones (зоны)...');
  await run(`
    CREATE TABLE zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
      UNIQUE(warehouse_id, name)
    )
  `);
  console.log('✅ Таблица zones создана\n');
}

async function createRacksTable() {
  const exists = await tableExists('racks');
  
  if (exists) {
    console.log('⏭️  Таблица racks уже существует\n');
    return;
  }
  
  console.log('📋 Создание таблицы racks (стеллажи)...');
  await run(`
    CREATE TABLE racks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
      UNIQUE(zone_id, name)
    )
  `);
  console.log('✅ Таблица racks создана\n');
}

async function createCellsTable() {
  const exists = await tableExists('cells');
  
  if (exists) {
    console.log('⏭️  Таблица cells уже существует\n');
    return;
  }
  
  console.log('📋 Создание таблицы cells (ячейки)...');
  await run(`
    CREATE TABLE cells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rack_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      capacity INTEGER,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rack_id) REFERENCES racks(id) ON DELETE CASCADE,
      UNIQUE(rack_id, name)
    )
  `);
  console.log('✅ Таблица cells создана\n');
}

async function addCellIdToEquipment() {
  const exists = await tableExists('equipment');
  if (!exists) return;
  
  console.log('📋 Проверка поля cell_id в equipment...');
  const cellFieldExists = await columnExists('equipment', 'cell_id');
  
  if (!cellFieldExists) {
    await run(`ALTER TABLE equipment ADD COLUMN cell_id INTEGER REFERENCES cells(id) ON DELETE SET NULL`);
    console.log('  ✅ Добавлено поле: equipment.cell_id');
  } else {
    console.log('  ⏭️  Поле equipment.cell_id уже есть');
  }
  console.log('');
}

async function createWarehousesIndexes() {
  console.log('📋 Создание индексов для складов...');
  
  await createIndexIfMissing('idx_warehouses_default', 'warehouses', 'is_default');
  await createIndexIfMissing('idx_warehouses_active', 'warehouses', 'is_active');
  await createIndexIfMissing('idx_zones_warehouse', 'zones', 'warehouse_id');
  await createIndexIfMissing('idx_zones_sort', 'zones', 'sort_order');
  await createIndexIfMissing('idx_racks_zone', 'racks', 'zone_id');
  await createIndexIfMissing('idx_racks_sort', 'racks', 'sort_order');
  await createIndexIfMissing('idx_cells_rack', 'cells', 'rack_id');
  await createIndexIfMissing('idx_cells_sort', 'cells', 'sort_order');
  await createIndexIfMissing('idx_equipment_cell', 'equipment', 'cell_id');
  
  console.log('✅ Индексы созданы\n');
}

// ============================================================
// ЭТАП 1.6: ОБЩИЕ ИНДЕКСЫ
// ============================================================

async function createIndexes() {
  console.log('📋 Создание общих индексов...');
  
  // Пользователи
  await createIndexIfMissing('idx_users_role', 'users', 'role');
  await createIndexIfMissing('idx_users_active', 'users', 'is_active');
  
  // Техника
  await createIndexIfMissing('idx_equipment_status', 'equipment', 'status');
  await createIndexIfMissing('idx_equipment_category', 'equipment', 'category_id');
  await createIndexIfMissing('idx_equipment_type', 'equipment', 'type_id');
  await createIndexIfMissing('idx_equipment_inventory', 'equipment', 'inventory_number');
  
  // Назначения
  await createIndexIfMissing('idx_user_equipment_user', 'user_equipment', 'user_id');
  await createIndexIfMissing('idx_user_equipment_equipment', 'user_equipment', 'equipment_id');
  await createIndexIfMissing('idx_user_equipment_active', 'user_equipment', 'equipment_id, returned_date');
  
  // Справочник
  await createIndexIfMissing('idx_categories_sort', 'equipment_categories', 'sort_order');
  await createIndexIfMissing('idx_types_category', 'equipment_types', 'category_id');
  await createIndexIfMissing('idx_types_sort', 'equipment_types', 'sort_order');
  
  // Логи
  await createIndexIfMissing('idx_activity_log_user', 'activity_log', 'user_id');
  await createIndexIfMissing('idx_activity_log_action', 'activity_log', 'action');
  await createIndexIfMissing('idx_activity_log_created', 'activity_log', 'created_at DESC');
  
  console.log('✅ Общие индексы созданы\n');
}

// ============================================================
// ЭТАП 2: ДАННЫЕ ПОЛЬЗОВАТЕЛЕЙ
// ============================================================

async function ensureAdminExists() {
  const admin = await get(`SELECT id, username FROM users WHERE role = 'admin' LIMIT 1`);
  
  if (admin) {
    console.log(`👤 Администратор уже существует: ${admin.username}\n`);
    return;
  }
  
  console.log('👤 Создание администратора...');
  
  const password = 'Admin123!';
  const hash = await bcrypt.hash(password, 10);
  
  await run(`
    INSERT INTO users (username, email, full_name, password_hash, role, is_active, must_change_password)
    VALUES (?, ?, ?, ?, 'admin', 1, 1)
  `, [
    'admin',
    'admin@company.com',
    'Администратор системы',
    hash
  ]);
  
  console.log('✅ Создан администратор:');
  console.log('   Логин:  admin');
  console.log(`   Пароль: ${password}`);
  console.log('   ⚠️  Смените пароль после первого входа!\n');
}

async function setDefaultPasswordsForExistingUsers() {
  const usersWithoutPassword = await all(
    `SELECT id, username FROM users WHERE password_hash IS NULL OR password_hash = ''`
  );
  
  if (usersWithoutPassword.length === 0) {
    return;
  }
  
  console.log(`🔑 Установка пароля по умолчанию для ${usersWithoutPassword.length} пользователей...`);
  
  const password = 'ChangeMe123!';
  const hash = await bcrypt.hash(password, 10);
  
  for (const user of usersWithoutPassword) {
    await run(
      `UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`,
      [hash, user.id]
    );
    console.log(`  ✅ ${user.username} — пароль: ${password}`);
  }
  
  console.log('');
}

// ============================================================
// ЭТАП 3: СПРАВОЧНИК КАТЕГОРИЙ И ТИПОВ
// ============================================================

const CATALOG_DATA = [
  {
    name: 'Компьютерная техника',
    icon: '💻',
    description: 'Ноутбуки, системные блоки, моноблоки',
    types: [
      { name: 'Ноутбук', icon: '💻' },
      { name: 'Системный блок', icon: '🖥️' },
      { name: 'Моноблок', icon: '🖥️' },
      { name: 'Планшет', icon: '📱' },
      { name: 'Рабочая станция', icon: '🖥️' }
    ]
  },
  {
    name: 'Периферия',
    icon: '🖱️',
    description: 'Мониторы, клавиатуры, мыши, гарнитуры',
    types: [
      { name: 'Монитор', icon: '🖥️' },
      { name: 'Клавиатура', icon: '⌨️' },
      { name: 'Мышь', icon: '🖱️' },
      { name: 'Гарнитура', icon: '🎧' },
      { name: 'Веб-камера', icon: '📷' },
      { name: 'Микрофон', icon: '🎤' }
    ]
  },
  {
    name: 'Оргтехника',
    icon: '🖨️',
    description: 'Принтеры, МФУ, сканеры',
    types: [
      { name: 'Принтер', icon: '🖨️' },
      { name: 'МФУ', icon: '🖨️' },
      { name: 'Сканер', icon: '📠' },
      { name: 'Копир', icon: '📠' },
      { name: 'Шредер', icon: '🗑️' }
    ]
  },
  {
    name: 'Мобильные устройства',
    icon: '📱',
    description: 'Смартфоны, планшеты, умные часы',
    types: [
      { name: 'Смартфон', icon: '📱' },
      { name: 'Планшет', icon: '📱' },
      { name: 'Умные часы', icon: '⌚' }
    ]
  },
  {
    name: 'Сетевое оборудование',
    icon: '🌐',
    description: 'Коммутаторы, маршрутизаторы, точки доступа',
    types: [
      { name: 'Коммутатор', icon: '🔀' },
      { name: 'Маршрутизатор', icon: '📡' },
      { name: 'Точка доступа', icon: '📶' },
      { name: 'Модем', icon: '📞' }
    ]
  },
  {
    name: 'Серверное оборудование',
    icon: '🖧',
    description: 'Серверы, СХД, ИБП',
    types: [
      { name: 'Сервер', icon: '🖥️' },
      { name: 'СХД', icon: '💾' },
      { name: 'ИБП', icon: '🔋' }
    ]
  },
  {
    name: 'Аксессуары',
    icon: '📎',
    description: 'Хабы, док-станции, кабели',
    types: [
      { name: 'USB-хаб', icon: '🔌' },
      { name: 'Док-станция', icon: '🔌' },
      { name: 'Кабель', icon: '🔌' },
      { name: 'Переходник', icon: '🔌' },
      { name: 'Сумка/чехол', icon: '👝' }
    ]
  },
  {
    name: 'Бытовое оборудование',
    icon: '🏢',
    description: 'Кондиционеры, холодильники, кулеры',
    types: [
      { name: 'Кондиционер', icon: '❄️' },
      { name: 'Холодильник', icon: '🧊' },
      { name: 'Кулер для воды', icon: '💧' },
      { name: 'Микроволновка', icon: '🔥' }
    ]
  }
];

async function seedCategoriesAndTypes() {
  const existing = await get('SELECT COUNT(*) as count FROM equipment_categories');
  
  if (existing.count > 0) {
    console.log(`📊 Категории уже существуют (${existing.count}), пропускаем заполнение\n`);
    return;
  }
  
  console.log('📝 Создание категорий и типов техники...');
  
  let totalCategories = 0;
  let totalTypes = 0;
  
  for (const [catIndex, catData] of CATALOG_DATA.entries()) {
    const catResult = await run(`
      INSERT INTO equipment_categories (name, description, icon, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [catData.name, catData.description, catData.icon, catIndex]);
    
    totalCategories++;
    
    for (const [typeIndex, typeData] of catData.types.entries()) {
      await run(`
        INSERT INTO equipment_types (category_id, name, icon, sort_order, is_active)
        VALUES (?, ?, ?, ?, 1)
      `, [catResult.lastID, typeData.name, typeData.icon || null, typeIndex]);
      
      totalTypes++;
    }
    
    console.log(`   ✅ ${catData.icon} ${catData.name} (${catData.types.length} типов)`);
  }
  
  console.log('');
  console.log(`✅ Создано категорий: ${totalCategories}`);
  console.log(`✅ Создано типов: ${totalTypes}\n`);
}

async function mapExistingEquipment() {
  // Если equipment уже пересоздана под новую схему (model_id) —
  // старых полей name/type_id нет, миграция не нужна.
  const hasName = await columnExists('equipment', 'name');
  const hasTypeId = await columnExists('equipment', 'type_id');

  if (!hasName || !hasTypeId) {
    console.log('⏭️  equipment уже в новой схеме (name/type_id отсутствуют), пропуск\n');
    return;
  }

  const untyped = await all(`SELECT id, name FROM equipment WHERE type_id IS NULL`);
  
  if (untyped.length === 0) {
    console.log('⏭️  Вся техника уже имеет категории и типы\n');
    return;
  }
  
  console.log(`🔗 Привязка ${untyped.length} единиц техники к категориям...`);
  
  let mapped = 0;
  let notMapped = 0;
  
  for (const eq of untyped) {
    const type = await get(`
      SELECT t.id as type_id, t.category_id
      FROM equipment_types t
      WHERE LOWER(t.name) = LOWER(?)
      LIMIT 1
    `, [eq.name]);
    
    if (type) {
      await run(`
        UPDATE equipment 
        SET type_id = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [type.type_id, type.category_id, eq.id]);
      mapped++;
    } else {
      console.log(`   ⚠️  Тип не найден: "${eq.name}" (ID: ${eq.id})`);
      notMapped++;
    }
  }
  
  console.log(`✅ Привязано: ${mapped}`);
  if (notMapped > 0) {
    console.log(`⚠️  Не привязано: ${notMapped}`);
    console.log(`   Привяжите вручную через админ-панель\n`);
  } else {
    console.log('');
  }
}

// ============================================================
// ЭТАП 4: НАЧАЛЬНЫЕ СКЛАДЫ (базовый склад)
// ============================================================

/**
 * Начальные данные для складов:
 * 2 склада → 3 зоны → 6 стеллажей → 20 ячеек
 */
async function seedWarehouses() {
  const existing = await get('SELECT COUNT(*) as count FROM warehouses');
  
  if (existing.count > 0) {
    console.log(`📊 Склады уже существуют (${existing.count}), пропускаем заполнение\n`);
    return;
  }
  
  console.log('📝 Создание начальных складов и адресного хранения...\n');
  
  // ============================================================
  // СКЛАД 1: Основной офис (по умолчанию)
  // ============================================================
  
  const wh1 = await run(`
    INSERT INTO warehouses (name, address, description, is_default, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [
    'Основной офис',
    'г. Москва, ул. Ленина, д. 10',
    'Главный склад компании. Здесь хранится основная часть техники.'
  ]);
  
  console.log(`✅ 🏢 Создан склад: Основной офис (по умолчанию)`);
  
  // Зона A — Компьютерная техника
  const zoneA = await run(`
    INSERT INTO zones (warehouse_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [
    wh1.lastID,
    'Зона A',
    'Компьютерная техника и ноутбуки'
  ]);
  
  console.log(`   ✅ 📍 Зона A (Компьютерная техника)`);
  
  // Стеллажи в зоне A
  const rackA1 = await run(`
    INSERT INTO racks (zone_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [zoneA.lastID, 'Стеллаж A-01', 'Ноутбуки']);
  
  const rackA2 = await run(`
    INSERT INTO racks (zone_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 2, 1)
  `, [zoneA.lastID, 'Стеллаж A-02', 'Мониторы и периферия']);
  
  console.log(`      ✅ 🗄️  Стеллаж A-01 (Ноутбуки)`);
  console.log(`      ✅ 🗄️  Стеллаж A-02 (Мониторы и периферия)`);
  
  // Ячейки на стеллаже A-01
  const cellsA1 = [
    { name: 'Ячейка 1', code: 'A-01-01', capacity: 5 },
    { name: 'Ячейка 2', code: 'A-01-02', capacity: 5 },
    { name: 'Ячейка 3', code: 'A-01-03', capacity: 5 },
    { name: 'Ячейка 4', code: 'A-01-04', capacity: 5 },
  ];
  
  for (const [i, cell] of cellsA1.entries()) {
    await run(`
      INSERT INTO cells (rack_id, name, code, capacity, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [rackA1.lastID, cell.name, cell.code, cell.capacity, i + 1]);
  }
  console.log(`         ✅ ${cellsA1.length} ячеек`);
  
  // Ячейки на стеллаже A-02
  const cellsA2 = [
    { name: 'Ячейка 1', code: 'A-02-01', capacity: 10 },
    { name: 'Ячейка 2', code: 'A-02-02', capacity: 10 },
    { name: 'Ячейка 3', code: 'A-02-03', capacity: 10 },
  ];
  
  for (const [i, cell] of cellsA2.entries()) {
    await run(`
      INSERT INTO cells (rack_id, name, code, capacity, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [rackA2.lastID, cell.name, cell.code, cell.capacity, i + 1]);
  }
  console.log(`         ✅ ${cellsA2.length} ячеек`);
  
  // Зона B — Оргтехника
  const zoneB = await run(`
    INSERT INTO zones (warehouse_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 2, 1)
  `, [
    wh1.lastID,
    'Зона B',
    'Оргтехника и принтеры'
  ]);
  
  console.log(`   ✅ 📍 Зона B (Оргтехника)`);
  
  const rackB1 = await run(`
    INSERT INTO racks (zone_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [zoneB.lastID, 'Стеллаж B-01', 'Принтеры и МФУ']);
  
  console.log(`      ✅ 🗄️  Стеллаж B-01 (Принтеры и МФУ)`);
  
  const cellsB1 = [
    { name: 'Ячейка 1', code: 'B-01-01', capacity: 3 },
    { name: 'Ячейка 2', code: 'B-01-02', capacity: 3 },
    { name: 'Ячейка 3', code: 'B-01-03', capacity: 3 },
  ];
  
  for (const [i, cell] of cellsB1.entries()) {
    await run(`
      INSERT INTO cells (rack_id, name, code, capacity, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [rackB1.lastID, cell.name, cell.code, cell.capacity, i + 1]);
  }
  console.log(`         ✅ ${cellsB1.length} ячеек`);
  
  console.log('');
  
  // ============================================================
  // СКЛАД 2: Удалённый офис (склад резерва)
  // ============================================================
  
  const wh2 = await run(`
    INSERT INTO warehouses (name, address, description, is_default, is_active)
    VALUES (?, ?, ?, 0, 1)
  `, [
    'Удалённый офис',
    'г. Москва, ул. Пушкина, д. 25',
    'Резервный склад для хранения неиспользуемой техники.'
  ]);
  
  console.log(`✅ 🏢 Создан склад: Удалённый офис`);
  
  // Зона хранения
  const zoneC = await run(`
    INSERT INTO zones (warehouse_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [
    wh2.lastID,
    'Основная зона',
    'Общее хранение'
  ]);
  
  console.log(`   ✅ 📍 Основная зона`);
  
  const rackC1 = await run(`
    INSERT INTO racks (zone_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [zoneC.lastID, 'Стеллаж C-01', 'Резервная техника']);
  
  console.log(`      ✅ 🗄️  Стеллаж C-01 (Резервная техника)`);
  
  const cellsC1 = [
    { name: 'Ячейка 1', code: 'C-01-01', capacity: 15 },
    { name: 'Ячейка 2', code: 'C-01-02', capacity: 15 },
    { name: 'Ячейка 3', code: 'C-01-03', capacity: 15 },
    { name: 'Ячейка 4', code: 'C-01-04', capacity: 15 },
    { name: 'Ячейка 5', code: 'C-01-05', capacity: 15 },
    { name: 'Ячейка 6', code: 'C-01-06', capacity: 15 },
    { name: 'Ячейка 7', code: 'C-01-07', capacity: 15 },
  ];
  
  for (const [i, cell] of cellsC1.entries()) {
    await run(`
      INSERT INTO cells (rack_id, name, code, capacity, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [rackC1.lastID, cell.name, cell.code, cell.capacity, i + 1]);
  }
  console.log(`         ✅ ${cellsC1.length} ячеек`);
  
  console.log('');
  console.log('✅ Итого:');
  console.log(`   🏢 Складов:    2`);
  console.log(`   📍 Зон:        3`);
  console.log(`   🗄️  Стеллажей:  6`);
  console.log(`   📦 Ячеек:      ${cellsA1.length + cellsA2.length + cellsB1.length + cellsC1.length}`);
  console.log('');
}


// ============================================================
// ЭТАП 4.5: РАБОЧИЕ МЕСТА (офис → кабинет → место)
// ============================================================

async function createOfficesTable() {
  const exists = await tableExists('offices');

  if (exists) {
    console.log('⏭️  Таблица offices уже существует\n');
    return;
  }

  console.log('📋 Создание таблицы offices (офисы)...');
  await run(`
    CREATE TABLE offices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT,
      description TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Таблица offices создана\n');
}

async function createRoomsTable() {
  const exists = await tableExists('rooms');

  if (exists) {
    console.log('⏭️  Таблица rooms уже существует\n');
    return;
  }

  console.log('📋 Создание таблицы rooms (кабинеты)...');
  await run(`
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      office_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE,
      UNIQUE(office_id, name)
    )
  `);
  console.log('✅ Таблица rooms создана\n');
}

async function createWorkplacesTable() {
  const exists = await tableExists('workplaces');

  if (exists) {
    console.log('⏭️  Таблица workplaces уже существует\n');
    return;
  }

  console.log('📋 Создание таблицы workplaces (рабочие места)...');
  await run(`
    CREATE TABLE workplaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      UNIQUE(room_id, name)
    )
  `);
  console.log('✅ Таблица workplaces создана\n');
}

async function addWorkplaceIdToEquipment() {
  const exists = await tableExists('equipment');
  if (!exists) return;

  console.log('📋 Проверка поля workplace_id в equipment...');
  const fieldExists = await columnExists('equipment', 'workplace_id');

  if (!fieldExists) {
    await run(`ALTER TABLE equipment ADD COLUMN workplace_id INTEGER REFERENCES workplaces(id) ON DELETE SET NULL`);
    console.log('  ✅ Добавлено поле: equipment.workplace_id');
  } else {
    console.log('  ⏭️  Поле equipment.workplace_id уже есть');
  }
  console.log('');
}

async function createWorkplacesIndexes() {
  console.log('📋 Создание индексов для рабочих мест...');

  await createIndexIfMissing('idx_offices_default', 'offices', 'is_default');
  await createIndexIfMissing('idx_offices_active', 'offices', 'is_active');
  await createIndexIfMissing('idx_rooms_office', 'rooms', 'office_id');
  await createIndexIfMissing('idx_rooms_sort', 'rooms', 'sort_order');
  await createIndexIfMissing('idx_workplaces_room', 'workplaces', 'room_id');
  await createIndexIfMissing('idx_workplaces_sort', 'workplaces', 'sort_order');
  await createIndexIfMissing('idx_equipment_workplace', 'equipment', 'workplace_id');

  console.log('✅ Индексы для рабочих мест созданы\n');
}

/**
 * Начальные данные для рабочих мест:
 * 2 офиса → 4 кабинета → 8 рабочих мест
 */
async function seedOffices() {
  const existing = await get('SELECT COUNT(*) as count FROM offices');

  if (existing.count > 0) {
    console.log(`📊 Офисы уже существуют (${existing.count}), пропускаем заполнение\n`);
    return;
  }

  console.log('📝 Создание начальных офисов, кабинетов и рабочих мест...\n');

  // ============================================================
  // ОФИС 1: Головной офис (по умолчанию)
  // ============================================================

  const off1 = await run(`
    INSERT INTO offices (name, address, description, is_default, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [
    'Головной офис',
    'г. Москва, ул. Ленина, д. 10',
    'Центральный офис компании.'
  ]);

  console.log(`✅ 🏢 Создан офис: Головной офис (по умолчанию)`);

  // Кабинет 101 — IT-отдел
  const room101 = await run(`
    INSERT INTO rooms (office_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [off1.lastID, 'Кабинет 101', 'IT-отдел']);

  console.log(`   ✅ 🚪 Кабинет 101 (IT-отдел)`);

  const wp101 = [
    { name: 'Рабочее место 101-1', code: 'МСК-101-1' },
    { name: 'Рабочее место 101-2', code: 'МСК-101-2' },
  ];

  for (const [i, w] of wp101.entries()) {
    await run(`
      INSERT INTO workplaces (room_id, name, code, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [room101.lastID, w.name, w.code, i + 1]);
  }
  console.log(`      ✅ ${wp101.length} рабочих мест`);

  // Кабинет 102 — Бухгалтерия
  const room102 = await run(`
    INSERT INTO rooms (office_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 2, 1)
  `, [off1.lastID, 'Кабинет 102', 'Бухгалтерия']);

  console.log(`   ✅ 🚪 Кабинет 102 (Бухгалтерия)`);

  const wp102 = [
    { name: 'Рабочее место 102-1', code: 'МСК-102-1' },
    { name: 'Рабочее место 102-2', code: 'МСК-102-2' },
  ];

  for (const [i, w] of wp102.entries()) {
    await run(`
      INSERT INTO workplaces (room_id, name, code, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [room102.lastID, w.name, w.code, i + 1]);
  }
  console.log(`      ✅ ${wp102.length} рабочих мест`);

  console.log('');

  // ============================================================
  // ОФИС 2: Региональный офис
  // ============================================================

  const off2 = await run(`
    INSERT INTO offices (name, address, description, is_default, is_active)
    VALUES (?, ?, ?, 0, 1)
  `, [
    'Региональный офис',
    'г. Санкт-Петербург, ул. Пушкина, д. 25',
    'Региональное представительство.'
  ]);

  console.log(`✅ 🏢 Создан офис: Региональный офис`);

  // Кабинет 201 — Отдел продаж
  const room201 = await run(`
    INSERT INTO rooms (office_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 1, 1)
  `, [off2.lastID, 'Кабинет 201', 'Отдел продаж']);

  console.log(`   ✅ 🚪 Кабинет 201 (Отдел продаж)`);

  const wp201 = [
    { name: 'Рабочее место 201-1', code: 'СПБ-201-1' },
    { name: 'Рабочее место 201-2', code: 'СПБ-201-2' },
  ];

  for (const [i, w] of wp201.entries()) {
    await run(`
      INSERT INTO workplaces (room_id, name, code, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [room201.lastID, w.name, w.code, i + 1]);
  }
  console.log(`      ✅ ${wp201.length} рабочих мест`);

  // Кабинет 202 — Техподдержка
  const room202 = await run(`
    INSERT INTO rooms (office_id, name, description, sort_order, is_active)
    VALUES (?, ?, ?, 2, 1)
  `, [off2.lastID, 'Кабинет 202', 'Техподдержка']);

  console.log(`   ✅ 🚪 Кабинет 202 (Техподдержка)`);

  const wp202 = [
    { name: 'Рабочее место 202-1', code: 'СПБ-202-1' },
    { name: 'Рабочее место 202-2', code: 'СПБ-202-2' },
  ];

  for (const [i, w] of wp202.entries()) {
    await run(`
      INSERT INTO workplaces (room_id, name, code, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [room202.lastID, w.name, w.code, i + 1]);
  }
  console.log(`      ✅ ${wp202.length} рабочих мест`);

  console.log('');
  console.log('✅ Итого:');
  console.log(`   🏢 Офисов:          2`);
  console.log(`   🚪 Кабинетов:       4`);
  console.log(`   💺 Рабочих мест:    ${wp101.length + wp102.length + wp201.length + wp202.length}`);
  console.log('');
}

// ============================================================
// ЭТАП 4.6: СТАТУС 'placed' ДЛЯ ТЕХНИКИ НА РАБОЧИХ МЕСТАХ
// ============================================================

/**
 * Проставить status = 'placed' для техники, которая находится
 * на рабочем месте (workplace_id IS NOT NULL), но имеет статус
 * 'available' (наследие ранних версий).
 *
 * Идемпотентно: повторный запуск не находит записей для обновления.
 */
async function migrateEquipmentPlacedStatus() {
  const exists = await tableExists('equipment');
  if (!exists) return;

  const hasWorkplaceId = await columnExists('equipment', 'workplace_id');
  if (!hasWorkplaceId) return;

  // Если equipment уже пересоздана под новую схему — статус 'placed'
  // всё равно актуален, но `available → placed` в новой схеме
  // бессмысленно (новых записей с available + workplace_id быть не может).
  // Пропуск.
  const hasModelId = await columnExists('equipment', 'model_id');
  if (hasModelId) {
    console.log('⏭️  equipment уже в новой схеме (model_id есть), пропуск\n');
    return;
  }

  console.log('📋 Миграция статуса: available → placed (для техники на рабочих местах)...');

  const result = await run(`
    UPDATE equipment
    SET status = 'placed', updated_at = CURRENT_TIMESTAMP
    WHERE workplace_id IS NOT NULL AND status = 'available'
  `);

  if (result.changes > 0) {
    console.log(`  ✅ Обновлено записей: ${result.changes}`);
  } else {
    console.log('  ⏭️  Записей для обновления нет');
  }
  console.log('');
}

// ============================================================
// ЭТАП 4.7: ФЛАГ is_full ДЛЯ ЯЧЕЕК СКЛАДА
// ============================================================

/**
 * Добавить ячейкам флаг is_full (заполнена вручную).
 * Заодно — обнулить capacity у всех ячеек, т.к. старые значения
 * (5/10/15 из seed) были проставлены «на глазок» и не отражают
 * реальную вместимость (монитор ≠ мышь).
 *
 * После миграции: по умолчанию ячейка без ограничений. Админ может
 * вручную отметить «Заполнена» или задать числовой лимит.
 */
async function migrateCellsIsFull() {
  const exists = await tableExists('cells');
  if (!exists) return;

  console.log('📋 Миграция ячеек: флаг is_full + сброс capacity...');

  const hasIsFull = await columnExists('cells', 'is_full');
  if (!hasIsFull) {
    await run(`ALTER TABLE cells ADD COLUMN is_full INTEGER NOT NULL DEFAULT 0`);
    console.log('  ✅ Добавлено поле: cells.is_full');
  } else {
    console.log('  ⏭️  Поле cells.is_full уже есть');
  }

  // Обнуляем capacity только если в ячейках есть ненулевые значения
  const withCapacity = await get(
    `SELECT COUNT(*) as count FROM cells WHERE capacity IS NOT NULL`
  );

  if (withCapacity.count > 0) {
    await run(`UPDATE cells SET capacity = NULL WHERE capacity IS NOT NULL`);
    console.log(`  ✅ Сброшено capacity у ${withCapacity.count} ячеек (без ограничений)`);
  } else {
    console.log('  ⏭️  Нет ячеек с capacity');
  }
  console.log('');
}

// ============================================================
// ЭТАП 4.8: УДАЛЕНИЕ capacity У РАБОЧИХ МЕСТ
// ============================================================

/**
 * Убрать поле capacity у рабочих мест.
 *
 * SQLite 3.35+ умеет DROP COLUMN — используем его.
 * На старых версиях обнуляем (код всё равно больше не читает).
 */
async function migrateWorkplacesDropCapacity() {
  const exists = await tableExists('workplaces');
  if (!exists) return;

  console.log('📋 Миграция рабочих мест: удаление capacity...');

  const hasCapacity = await columnExists('workplaces', 'capacity');
  if (!hasCapacity) {
    console.log('  ⏭️  Поле workplaces.capacity уже отсутствует');
    console.log('');
    return;
  }

  // Проверяем версию SQLite
  const verRow = await get('SELECT sqlite_version() AS v');
  const [maj, min] = (verRow.v || '0.0').split('.').map(Number);
  const supportsDrop = maj > 3 || (maj === 3 && min >= 35);

  if (supportsDrop) {
    await run(`ALTER TABLE workplaces DROP COLUMN capacity`);
    console.log(`  ✅ Колонка workplaces.capacity удалена (SQLite ${verRow.v})`);
  } else {
    await run(`UPDATE workplaces SET capacity = NULL WHERE capacity IS NOT NULL`);
    console.log(`  ⚠️  SQLite ${verRow.v} < 3.35 — capacity обнулена, но не удалена`);
  }
  console.log('');
}


// ============================================================
// ЭТАП 4.9: МОДЕЛИ ТМЦ (equipment_models)
// ============================================================
//
// Крупная переработка модели данных (v3.x):
//   - Вводится таблица equipment_models — обобщённое описание
//     устройства (corporate_id, name, manufacturer, category, type).
//   - equipment становится «экземпляром»: ссылается на модель
//     через model_id, теряет name/model/manufacturer/category_id/type_id.
//   - inventory_number и serial_number могут быть NULL,
//     но если заполнены — обязаны быть уникальными.
//
// Старые данные не мигрируем — таблица equipment пересоздаётся
// пустой. user_equipment тоже пересоздаётся (FK на equipment).
// ============================================================

async function createEquipmentModelsTable() {
  const exists = await tableExists('equipment_models');
  if (exists) {
    console.log('⏭️  Таблица equipment_models уже существует\n');
    return;
  }

  console.log('📋 Создание таблицы equipment_models (модели ТМЦ)...');
  await run(`
    CREATE TABLE equipment_models (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      corporate_id TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      manufacturer TEXT,
      category_id  INTEGER NOT NULL,
      type_id      INTEGER NOT NULL,
      description  TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES equipment_categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (type_id)     REFERENCES equipment_types(id)      ON DELETE RESTRICT
    )
  `);
  console.log('✅ Таблица equipment_models создана\n');
}

async function migrateEquipmentToInstances() {
  const exists = await tableExists('equipment');
  if (!exists) return;

  const hasModelId = await columnExists('equipment', 'model_id');
  if (hasModelId) {
    console.log('⏭️  Таблица equipment уже в новой схеме (model_id есть)\n');
    return;
  }

  console.log('📋 Пересоздание таблицы equipment (плоская → экземпляры)...');
  console.log('   ⚠️  Старые данные equipment будут удалены');
  console.log('   ⚠️  Таблица user_equipment также будет пересоздана\n');

  // Убираем FK-зависимую user_equipment (пересоздадим ниже)
  await run('DROP TABLE IF EXISTS user_equipment');

  // Пересоздаём equipment в новой схеме
  await run('DROP TABLE IF EXISTS equipment');
  await run(`
    CREATE TABLE equipment (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id         INTEGER NOT NULL,
      inventory_number TEXT UNIQUE,
      serial_number    TEXT UNIQUE,
      status           TEXT DEFAULT 'available',
      cell_id          INTEGER REFERENCES cells(id)        ON DELETE SET NULL,
      workplace_id     INTEGER REFERENCES workplaces(id)   ON DELETE SET NULL,
      purchase_date    DATE,
      warranty_until   DATE,
      description      TEXT,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (model_id) REFERENCES equipment_models(id) ON DELETE RESTRICT
    )
  `);

  // Возвращаем user_equipment — теперь с FK на новую equipment
  await run(`
    CREATE TABLE user_equipment (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id              INTEGER NOT NULL,
      equipment_id         INTEGER NOT NULL,
      assigned_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
      returned_date        DATETIME,
      condition_on_assign  TEXT,
      condition_on_return  TEXT,
      notes                TEXT,
      FOREIGN KEY (user_id)      REFERENCES users(id)     ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
      UNIQUE(user_id, equipment_id, returned_date)
    )
  `);

  console.log('✅ Таблица equipment пересоздана в новой схеме');
  console.log('✅ Таблица user_equipment пересоздана\n');
}

async function createEquipmentModelsIndexes() {
  console.log('📋 Создание индексов для моделей и экземпляров...');

  // Модели
  await createIndexIfMissing('idx_models_corporate', 'equipment_models', 'corporate_id');
  await createIndexIfMissing('idx_models_name',      'equipment_models', 'name');
  await createIndexIfMissing('idx_models_category',  'equipment_models', 'category_id');
  await createIndexIfMissing('idx_models_type',      'equipment_models', 'type_id');
  await createIndexIfMissing('idx_models_manufacturer', 'equipment_models', 'manufacturer');

  // Экземпляры
  await createIndexIfMissing('idx_equipment_model',        'equipment', 'model_id');
  await createIndexIfMissing('idx_equipment_status',       'equipment', 'status');
  await createIndexIfMissing('idx_equipment_cell',         'equipment', 'cell_id');
  await createIndexIfMissing('idx_equipment_workplace',    'equipment', 'workplace_id');
  await createIndexIfMissing('idx_equipment_inventory',    'equipment', 'inventory_number');
  await createIndexIfMissing('idx_equipment_serial',       'equipment', 'serial_number');

  console.log('✅ Индексы созданы\n');
}

// ============================================================
// ЭТАП 4.10: РОЛЕВАЯ МОДЕЛЬ — МОЛ (материально ответственные лица)
// ============================================================
//
// Ролевая модель расширяется до 4 ролей:
//   admin | supervisor | mol | user
//
// Появляется понятие МОЛ — материально ответственное лицо.
// МОЛ отвечает за:
//   - конкретные склады  (warehouse_responsibles, many-to-many)
//   - конкретные офисы    (office_responsibles,    many-to-many)
//   - конкретные экземпляры техники (equipment.responsible_user_id)
//
// Все FK — ON DELETE CASCADE для связок и SET NULL для экземпляров:
//   - уволили МОЛа → связки складов/офисов удалились автоматически;
//   - экземпляры на руках остаются, но без ответственного
//     (админ назначит нового).
// ============================================================

async function createWarehouseResponsiblesTable() {
  const exists = await tableExists('warehouse_responsibles');
  if (exists) {
    console.log('⏭️  Таблица warehouse_responsibles уже существует\n');
    return;
  }

  console.log('📋 Создание таблицы warehouse_responsibles (МОЛ за склады)...');
  await run(`
    CREATE TABLE warehouse_responsibles (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL,
      user_id      INTEGER NOT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(warehouse_id, user_id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE
    )
  `);
  console.log('✅ Таблица warehouse_responsibles создана\n');
}

async function createOfficeResponsiblesTable() {
  const exists = await tableExists('office_responsibles');
  if (exists) {
    console.log('⏭️  Таблица office_responsibles уже существует\n');
    return;
  }

  console.log('📋 Создание таблицы office_responsibles (МОЛ за офисы)...');
  await run(`
    CREATE TABLE office_responsibles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      office_id  INTEGER NOT NULL,
      user_id    INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(office_id, user_id),
      FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
    )
  `);
  console.log('✅ Таблица office_responsibles создана\n');
}

async function addResponsibleUserIdToEquipment() {
  const exists = await tableExists('equipment');
  if (!exists) return;

  console.log('📋 Проверка поля responsible_user_id в equipment...');
  const hasField = await columnExists('equipment', 'responsible_user_id');

  if (!hasField) {
    // SQLite не даёт добавить колонку с ON DELETE SET NULL через ALTER TABLE,
    // если таблица создана до этого. Поэтому добавляем без FK-констрейнта
    // (он не критичен: SET NULL отрабатывает только при удалении users,
    //  а в новых схемах оно и так не удаляет строки equipment).
    // При свежей миграции (equipment создан через CREATE TABLE)
    // поле добавляется как REFERENCES users(id) ON DELETE SET NULL.
    await run(`ALTER TABLE equipment ADD COLUMN responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    console.log('  ✅ Добавлено поле: equipment.responsible_user_id');
  } else {
    console.log('  ⏭️  Поле equipment.responsible_user_id уже есть');
  }
  console.log('');
}

async function createRoleResponsiblesIndexes() {
  console.log('📋 Создание индексов для ролевой модели...');

  await createIndexIfMissing('idx_wh_resp_user',        'warehouse_responsibles', 'user_id');
  await createIndexIfMissing('idx_wh_resp_wh',          'warehouse_responsibles', 'warehouse_id');
  await createIndexIfMissing('idx_office_resp_user',    'office_responsibles',    'user_id');
  await createIndexIfMissing('idx_office_resp_office',  'office_responsibles',    'office_id');
  await createIndexIfMissing('idx_equipment_responsible','equipment',              'responsible_user_id');

  console.log('✅ Индексы ролевой модели созданы\n');
}

/**
 * Добавить колонку import_id в таблицы (для отмены импорта).
 * Идемпотентно: если колонка уже есть — пропускаем.
 */
function migrateImportIdColumns() {
  return new Promise((resolve, reject) => {
    const tables = [
      'equipment',
      'equipment_models',
      'equipment_categories',
      'equipment_types',
    ];

    let pending = tables.length;

    const done = (err) => {
      if (err) reject(err);
      else {
        pending -= 1;
        if (pending === 0) resolve();
      }
    };

    tables.forEach(table => {
      db.all(`PRAGMA table_info(${table})`, (err, rows) => {
        if (err) {
          done(err);
          return;
        }

        const hasImportId = rows.some(r => r.name === 'import_id');
        if (hasImportId) {
          done();
          return;
        }

        db.run(`ALTER TABLE ${table} ADD COLUMN import_id TEXT`, (err) => {
          if (err) {
            console.error(`❌ ${table}.import_id:`, err.message);
            done(err);
          } else {
            console.log(`✅ ${table}.import_id добавлена`);
            done();
          }
        });
      });
    });
  });
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ МИГРАЦИИ
// ============================================================

async function migrate() {
  try {
    console.log('═══════════════════════════════════════════════');
    console.log('🔄 МИГРАЦИЯ БАЗЫ ДАННЫХ');
    console.log('═══════════════════════════════════════════════\n');
    
    // ===== ЭТАП 1: Структура БД =====
    console.log('📦 ЭТАП 1: Структура базы данных\n');
    
    await createUsersTable();
    await createCategoriesTable();
    await createTypesTable();
    await createEquipmentTable();
    await createUserEquipmentTable();
    
    // 🆕 Таблицы складов (порядок важен!)
    await createWarehousesTable();
    await createZonesTable();
    await createRacksTable();
    await createCellsTable();
    await addCellIdToEquipment();
    
    await createActivityLogTable();
    await createAppMetaTable();
    await createIndexes();
    await createWarehousesIndexes();
    
    // ===== ЭТАП 2: Данные пользователей =====
    console.log('👥 ЭТАП 2: Пользователи\n');
    
    await setDefaultPasswordsForExistingUsers();
    await ensureAdminExists();
    
    // ===== ЭТАП 3: Справочник =====
    console.log('📚 ЭТАП 3: Справочник категорий и типов\n');
    
    await seedCategoriesAndTypes();
    await mapExistingEquipment();
    
    // ===== ЭТАП 4: Склады =====
    console.log('🏢 ЭТАП 4: Склады\n');
    
    await seedWarehouses();

    // ===== ЭТАП 4.5: Рабочие места =====
    console.log('🏢 ЭТАП 4.5: Рабочие места (офис → кабинет → место)\n');

    await createOfficesTable();
    await createRoomsTable();
    await createWorkplacesTable();
    await addWorkplaceIdToEquipment();
    await createWorkplacesIndexes();
    await seedOffices();
    await migrateEquipmentPlacedStatus();
    await migrateCellsIsFull();
    await migrateWorkplacesDropCapacity(); 

        // ===== ЭТАП 4.9: Модели ТМЦ (equipment_models) =====
    console.log('🧩 ЭТАП 4.9: Модели ТМЦ (equipment_models)\n');

    await createEquipmentModelsTable();
    await migrateEquipmentToInstances();
    await createEquipmentModelsIndexes();
      // Добавление id импорта
    await migrateImportIdColumns();

        // ===== ЭТАП 4.10: Ролевая модель — МОЛ =====
    console.log('👔 ЭТАП 4.10: Ролевая модель — МОЛ\n');

    await createWarehouseResponsiblesTable();
    await createOfficeResponsiblesTable();
    await addResponsibleUserIdToEquipment();
    await createRoleResponsiblesIndexes();

    // ===== ИТОГИ =====
    console.log('═══════════════════════════════════════════════');
    console.log('✅ МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО');
    console.log('═══════════════════════════════════════════════\n');
    
    // Статистика
    const stats = await get(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM equipment_categories) as categories,
        (SELECT COUNT(*) FROM equipment_types) as types,
        (SELECT COUNT(*) FROM equipment_models) as models,
        (SELECT COUNT(*) FROM equipment) as equipment,
        (SELECT COUNT(*) FROM users WHERE role = 'mol') as mol_users,
        (SELECT COUNT(*) FROM warehouse_responsibles) as wh_responsibles,
        (SELECT COUNT(*) FROM office_responsibles) as office_responsibles,
        (SELECT COUNT(*) FROM warehouses) as warehouses,
        (SELECT COUNT(*) FROM zones) as zones,
        (SELECT COUNT(*) FROM racks) as racks,
        (SELECT COUNT(*) FROM cells) as cells,
        (SELECT COUNT(*) FROM offices) as offices,
        (SELECT COUNT(*) FROM rooms) as rooms,
        (SELECT COUNT(*) FROM workplaces) as workplaces,
        (SELECT COUNT(*) FROM equipment WHERE status = 'placed') as equipment_placed
    `);
    
    console.log('📊 Итоговая статистика:');
    console.log(`   👥 Пользователей:  ${stats.users}`);
    console.log(`   📁 Категорий:      ${stats.categories}`);
    console.log(`   📦 Типов:          ${stats.types}`);
    console.log(`   🔧 Единиц техники: ${stats.equipment}`);
    console.log(`   🪑 Из них на местах: ${stats.equipment_placed}`);
    console.log(`   🏢 Складов:        ${stats.warehouses}`);
    console.log(`   📍 Зон:            ${stats.zones}`);
    console.log(`   🗄️  Стеллажей:      ${stats.racks}`);
    console.log(`   📦 Ячеек:          ${stats.cells}`);
    console.log(`   🏢 Офисов:         ${stats.offices}`);
    console.log(`   🚪 Кабинетов:      ${stats.rooms}`);
    console.log(`   💺 Рабочих мест:   ${stats.workplaces}`);
    console.log(`   🧩 Моделей ТМЦ:    ${stats.models}`);
    console.log(`   👔 МОЛ:            ${stats.mol_users}`);
    console.log(`   🔗 Связок МОЛ↔склад: ${stats.wh_responsibles}`);
    console.log(`   🔗 Связок МОЛ↔офис:  ${stats.office_responsibles}`);
    console.log('');
    
  } catch (error) {
    console.error('\n❌ ОШИБКА МИГРАЦИИ:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}


// ============================================================
// ЗАПУСК
// ============================================================

migrate();