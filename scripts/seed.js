// scripts/seed.js
// Заполнение базы данных тестовыми данными
// ВАЖНО: Перед запуском должен быть выполнен `npm run migrate`

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// ============================================================
// АРГУМЕНТЫ КОМАНДНОЙ СТРОКИ
// ============================================================

const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const quiet = args.includes('--quiet') || args.includes('-q');

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
// УТИЛИТЫ ДЛЯ ВЫВОДА
// ============================================================

function log(msg, always = false) {
  if (!quiet || always) console.log(msg);
}

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
// УТИЛИТЫ ДЛЯ ГЕНЕРАЦИИ ДАННЫХ
// ============================================================

function randomDate(daysAgoMin, daysAgoMax) {
  const daysAgo = Math.floor(Math.random() * (daysAgoMax - daysAgoMin)) + daysAgoMin;
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// СПРАВОЧНЫЕ ДАННЫЕ
// ============================================================

const USERS_DATA = [
  { username: 'manager', email: 'manager@company.com', full_name: 'Смирнов Алексей Петрович', department: 'Администрация', phone: '+7(999)000-00-02', role: 'admin' },
  { username: 'ivanov', email: 'ivanov@company.com', full_name: 'Иван Иванов', department: 'IT-отдел', phone: '+7(999)111-22-33', role: 'user' },
  { username: 'kozlov', email: 'kozlov@company.com', full_name: 'Козлов Юрий Борисович', department: 'IT-отдел', phone: '+7(999)111-22-34', role: 'mol' },
  { username: 'novikov', email: 'novikov@company.com', full_name: 'Новиков Дмитрий Сергеевич', department: 'IT-отдел', phone: '+7(999)111-22-35', role: 'mol' },
  { username: 'petrova', email: 'petrova@company.com', full_name: 'Мария Петрова', department: 'Бухгалтерия', phone: '+7(999)444-55-66', role: 'user' },
  { username: 'kuznetsova', email: 'kuznetsova@company.com', full_name: 'Кузнецова Ольга Ивановна', department: 'Бухгалтерия', phone: '+7(999)444-55-67', role: 'user' },
  { username: 'sidorov', email: 'sidorov@company.com', full_name: 'Пётр Сидоров', department: 'Отдел продаж', phone: '+7(999)777-88-99', role: 'user' },
  { username: 'morozov', email: 'morozov@company.com', full_name: 'Морозов Андрей Владимирович', department: 'Отдел продаж', phone: '+7(999)777-88-98', role: 'user' },
  { username: 'volkov', email: 'volkov@company.com', full_name: 'Волков Сергей Николаевич', department: 'Отдел продаж', phone: '+7(999)777-88-97', role: 'mol' },
  { username: 'smirnova', email: 'smirnova@company.com', full_name: 'Анна Смирнова', department: 'HR-отдел', phone: '+7(999)000-11-22', role: 'user' },
  { username: 'sokolova', email: 'sokolova@company.com', full_name: 'Соколова Екатерина Андреевна', department: 'HR-отдел', phone: '+7(999)000-11-23', role: 'supervisor' },
  { username: 'popov', email: 'popov@company.com', full_name: 'Попов Максим Олегович', department: 'Маркетинг', phone: '+7(999)222-33-44', role: 'user' },
  { username: 'lebedeva', email: 'lebedeva@company.com', full_name: 'Лебедева Наталья Викторовна', department: 'Маркетинг', phone: '+7(999)222-33-45', role: 'user' },
  { username: 'orlov', email: 'orlov@company.com', full_name: 'Орлов Виктор Александрович', department: 'Логистика', phone: '+7(999)555-66-77', role: 'user' },
  { username: 'fedorov', email: 'fedorov@company.com', full_name: 'Фёдоров Игорь Валентинович', department: 'Логистика', phone: '+7(999)555-66-78', role: 'user' },
];

// ~60 единиц техники (разные модели)
const EQUIPMENT_DATA = [
  // Ноутбуки
  { name: 'Ноутбук', model: 'Dell Latitude 5540', manufacturer: 'Dell', serial: 'DL5540-001' },
  { name: 'Ноутбук', model: 'Dell Latitude 5540', manufacturer: 'Dell', serial: 'DL5540-002' },
  { name: 'Ноутбук', model: 'Dell Latitude 5540', manufacturer: 'Dell', serial: 'DL5540-003' },
  { name: 'Ноутбук', model: 'HP ProBook 450 G10', manufacturer: 'HP', serial: 'HP450-001' },
  { name: 'Ноутбук', model: 'HP ProBook 450 G10', manufacturer: 'HP', serial: 'HP450-002' },
  { name: 'Ноутбук', model: 'HP ProBook 450 G10', manufacturer: 'HP', serial: 'HP450-003' },
  { name: 'Ноутбук', model: 'Lenovo ThinkPad E15', manufacturer: 'Lenovo', serial: 'LNE15-001' },
  { name: 'Ноутбук', model: 'Lenovo ThinkPad E15', manufacturer: 'Lenovo', serial: 'LNE15-002' },
  { name: 'Ноутбук', model: 'Apple MacBook Air 13" M2', manufacturer: 'Apple', serial: 'MBA-M2-001' },
  { name: 'Ноутбук', model: 'Apple MacBook Pro 14" M3', manufacturer: 'Apple', serial: 'MBP-M3-001' },
  { name: 'Ноутбук', model: 'Asus VivoBook 15', manufacturer: 'Asus', serial: 'ASUS-VB-001' },
  { name: 'Ноутбук', model: 'Acer Aspire 5', manufacturer: 'Acer', serial: 'ACER-AS-001' },

  // Мониторы
  { name: 'Монитор', model: 'Dell UltraSharp U2723QE 27"', manufacturer: 'Dell', serial: 'DELL-U27-001' },
  { name: 'Монитор', model: 'Dell UltraSharp U2723QE 27"', manufacturer: 'Dell', serial: 'DELL-U27-002' },
  { name: 'Монитор', model: 'Dell UltraSharp U2723QE 27"', manufacturer: 'Dell', serial: 'DELL-U27-003' },
  { name: 'Монитор', model: 'LG 27UP850 27"', manufacturer: 'LG', serial: 'LG-27UP-001' },
  { name: 'Монитор', model: 'LG 27UP850 27"', manufacturer: 'LG', serial: 'LG-27UP-002' },
  { name: 'Монитор', model: 'Samsung ViewFinity S8 27"', manufacturer: 'Samsung', serial: 'SAM-S8-001' },
  { name: 'Монитор', model: 'Acer Nitro VG271 27"', manufacturer: 'Acer', serial: 'ACER-VG-001' },

  // Периферия
  { name: 'Клавиатура', model: 'Logitech MX Keys', manufacturer: 'Logitech', serial: 'LOG-MXK-001' },
  { name: 'Клавиатура', model: 'Logitech MX Keys', manufacturer: 'Logitech', serial: 'LOG-MXK-002' },
  { name: 'Клавиатура', model: 'Logitech MX Keys', manufacturer: 'Logitech', serial: 'LOG-MXK-003' },
  { name: 'Мышь', model: 'Logitech MX Master 3S', manufacturer: 'Logitech', serial: 'LOG-MX3-001' },
  { name: 'Мышь', model: 'Logitech MX Master 3S', manufacturer: 'Logitech', serial: 'LOG-MX3-002' },
  { name: 'Мышь', model: 'Logitech MX Master 3S', manufacturer: 'Logitech', serial: 'LOG-MX3-003' },
  { name: 'Гарнитура', model: 'Jabra Evolve2 65', manufacturer: 'Jabra', serial: 'JAB-EV2-001' },
  { name: 'Гарнитура', model: 'Jabra Evolve2 65', manufacturer: 'Jabra', serial: 'JAB-EV2-002' },
  { name: 'Веб-камера', model: 'Logitech Brio 4K', manufacturer: 'Logitech', serial: 'LOG-BRIO-001' },
  { name: 'Веб-камера', model: 'Logitech Brio 4K', manufacturer: 'Logitech', serial: 'LOG-BRIO-002' },

  // Мобильные
  { name: 'Смартфон', model: 'Apple iPhone 14', manufacturer: 'Apple', serial: 'IPH14-001' },
  { name: 'Смартфон', model: 'Samsung Galaxy S23', manufacturer: 'Samsung', serial: 'SAM-S23-001' },
  { name: 'Планшет', model: 'Apple iPad Air 5', manufacturer: 'Apple', serial: 'IPAD-5-001' },
  { name: 'Планшет', model: 'Samsung Galaxy Tab S8', manufacturer: 'Samsung', serial: 'SAM-TABS8-001' },

  // Оргтехника
  { name: 'Принтер', model: 'HP LaserJet Pro M404dn', manufacturer: 'HP', serial: 'HP-M404-001' },
  { name: 'Принтер', model: 'Canon i-SENSYS MF443dw', manufacturer: 'Canon', serial: 'CAN-MF443-001' },
  { name: 'МФУ', model: 'Kyocera ECOSYS M5526cdn', manufacturer: 'Kyocera', serial: 'KYO-M5526-001' },
  { name: 'Сканер', model: 'Epson WorkForce DS-530 II', manufacturer: 'Epson', serial: 'EPS-DS530-001' },

  // Серверное/сетевое
  { name: 'Сервер', model: 'Dell PowerEdge R450', manufacturer: 'Dell', serial: 'DELL-R450-001' },
  { name: 'Сервер', model: 'Dell PowerEdge R450', manufacturer: 'Dell', serial: 'DELL-R450-002' },
  { name: 'Коммутатор', model: 'Cisco Catalyst 1000-24T', manufacturer: 'Cisco', serial: 'CIS-CAT-001' },
  { name: 'Маршрутизатор', model: 'MikroTik CCR2004', manufacturer: 'MikroTik', serial: 'MIK-CCR-001' },

  // Аксессуары
  { name: 'USB-хаб', model: 'Anker PowerExpand 8-in-1', manufacturer: 'Anker', serial: 'ANK-PE8-001' },
  { name: 'USB-хаб', model: 'Anker PowerExpand 8-in-1', manufacturer: 'Anker', serial: 'ANK-PE8-002' },
  { name: 'Док-станция', model: 'Dell WD19S', manufacturer: 'Dell', serial: 'DELL-WD19-001' },
  { name: 'Док-станция', model: 'Dell WD19S', manufacturer: 'Dell', serial: 'DELL-WD19-002' },
];

const DESCRIPTIONS = {
  'Ноутбук': 'Рабочий ноутбук для сотрудника',
  'Монитор': 'Монитор для рабочего места',
  'Клавиатура': 'Беспроводная клавиатура',
  'Мышь': 'Беспроводная эргономичная мышь',
  'Гарнитура': 'Гарнитура для звонков и видеоконференций',
  'Веб-камера': 'Веб-камера 4K для видеоконференций',
  'Смартфон': 'Корпоративный смартфон',
  'Планшет': 'Планшет для работы с документами',
  'Принтер': 'Лазерный принтер для офиса',
  'МФУ': 'Многофункциональное устройство',
  'Сканер': 'Сканер документов',
  'Сервер': 'Сервер для внутренних сервисов',
  'Коммутатор': 'Сетевой коммутатор',
  'Маршрутизатор': 'Маршрутизатор для офисной сети',
  'USB-хаб': 'USB-хаб для подключения периферии',
  'Док-станция': 'Док-станция для ноутбука'
};

const CONDITIONS = ['В хорошем состоянии', 'Новая', 'Требуется внимание', 'С дефектами'];

// ============================================================
// ПРОВЕРКА СТРУКТУРЫ БД
// ============================================================

async function checkStructure() {
  const requiredTables = [
    'users', 'equipment', 'equipment_models', 'equipment_categories',
    'equipment_types', 'user_equipment', 'activity_log', 'app_meta',
    'warehouse_responsibles', 'office_responsibles',
    'warehouses', 'zones', 'racks', 'cells',
    'offices', 'rooms', 'workplaces',
  ];
  
  for (const table of requiredTables) {
    const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
    if (!exists) {
      console.error(`❌ Таблица "${table}" не найдена! Сначала запустите: npm run migrate`);
      process.exit(1);
    }
  }
  
  const admin = await get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (!admin) {
    console.error('❌ Администратор не найден! Сначала запустите: npm run migrate');
    process.exit(1);
  }
  
  const categoriesCount = await get('SELECT COUNT(*) as count FROM equipment_categories');
  if (categoriesCount.count === 0) {
    console.error('❌ Справочник категорий пуст! Сначала запустите: npm run migrate');
    process.exit(1);
  }
}

// ============================================================
// ПРОВЕРКА СУЩЕСТВУЮЩИХ ДАННЫХ
// ============================================================

async function checkExistingData() {
  const users = await get(`SELECT COUNT(*) as count FROM users WHERE username != 'admin'`);
  const equipment = await get('SELECT COUNT(*) as count FROM equipment');
  return { users: users.count, equipment: equipment.count };
}

// ============================================================
// ОЧИСТКА ДЕМО-ДАННЫХ
// ============================================================

async function clearSessionsFile() {
  const sessionsPath = path.join(dataDir, 'sessions.db');
  const filesToDelete = [sessionsPath, sessionsPath + '-journal', sessionsPath + '-wal', sessionsPath + '-shm'];
  let deleted = 0;
  for (const filePath of filesToDelete) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); deleted++; } catch (err) {}
    }
  }
  if (deleted > 0) log(`   ✅ Файлы сессий удалены (${deleted})`, true);
}

async function clearDemoData() {
  log('\n🗑️  Очистка демо-данных...', true);
  await run('PRAGMA foreign_keys = OFF');
  
  await run('DELETE FROM activity_log');
  await run('DELETE FROM user_equipment');
  await run('DELETE FROM equipment');
  await run('DELETE FROM equipment_models');
  await run('DELETE FROM warehouse_responsibles');
  await run('DELETE FROM office_responsibles');
  
  const deleted = await run(`DELETE FROM users WHERE role != 'admin'`);
  log(`   ✅ Удалено пользователей: ${deleted.changes}`, true);
  
  await run(`DELETE FROM sqlite_sequence WHERE name IN ('users', 'equipment', 'equipment_models', 'user_equipment', 'activity_log')`);
  await run('PRAGMA foreign_keys = ON');
  
  const newVersion = Date.now().toString();
  await run(`
    INSERT INTO app_meta (key, value, updated_at) 
    VALUES ('db_seed_version', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `, [newVersion]);
  log(`   ✅ Версия БД обновлена`, true);
  
  await clearSessionsFile();
  log('   ✅ Демо-данные очищены', true);
}

// ============================================================
// СОЗДАНИЕ ПОЛЬЗОВАТЕЛЕЙ
// ============================================================

async function createUsers() {
  log('\n👥 Создание пользователей...', true);
  
  const adminHash = await bcrypt.hash('Admin123!', 10);
  const userHash = await bcrypt.hash('ChangeMe123!', 10);
  const createdUsers = [];
  
  const admin = await get(`SELECT id, username, full_name, role, department FROM users WHERE username = 'admin'`);
  if (admin) {
    createdUsers.push({ id: admin.id, username: admin.username, full_name: admin.full_name, role: admin.role, department: admin.department || 'Администрация' });
  }
  
  for (const userData of USERS_DATA) {
    const existing = await get('SELECT id FROM users WHERE username = ?', [userData.username]);
    if (existing) {
      log(`   ⏭️  ${userData.username} уже существует`, true);
      createdUsers.push({ ...userData, id: existing.id });
      continue;
    }
    
    const hash = userData.role === 'admin' ? adminHash : userHash;
    const result = await run(`
      INSERT INTO users (username, email, full_name, department, phone, password_hash, role, is_active, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
    `, [userData.username, userData.email, userData.full_name, userData.department, userData.phone, hash, userData.role]);
    
    createdUsers.push({ ...userData, id: result.lastID });
    const icon = userData.role === 'admin' ? '👑' : '👤';
    log(`   ✅ ${icon} ${userData.username} (${userData.full_name})`, true);
  }
  return createdUsers;
}

// ============================================================
// ПРИВЯЗКИ МОЛ
// ============================================================

async function createMolResponsibles(users) {
  log('\n🧑‍💼 Создание привязок МОЛ...', true);
  const kozlov = users.find(u => u.username === 'kozlov');
  const volkov = users.find(u => u.username === 'volkov');
  const novikov = users.find(u => u.username === 'novikov');
  
  if (!kozlov && !volkov && !novikov) {
    log('   ⚠️  Ни один МОЛ не найден, пропускаем', true);
    return;
  }

  const whMain = await get(`SELECT id FROM warehouses WHERE name = 'Основной офис' LIMIT 1`);
  const whRemote = await get(`SELECT id FROM warehouses WHERE name = 'Удалённый офис' LIMIT 1`);
  const offHead = await get(`SELECT id FROM offices WHERE name = 'Головной офис' LIMIT 1`);
  const offRegion = await get(`SELECT id FROM offices WHERE name = 'Региональный офис' LIMIT 1`);

  const assignments = [];
  if (kozlov && whMain) {
    await run(`INSERT OR IGNORE INTO warehouse_responsibles (warehouse_id, user_id) VALUES (?, ?)`, [whMain.id, kozlov.id]);
    assignments.push(`   ✅ ${kozlov.full_name} → склад «Основной офис»`);
  }
  if (volkov && whRemote) {
    await run(`INSERT OR IGNORE INTO warehouse_responsibles (warehouse_id, user_id) VALUES (?, ?)`, [whRemote.id, volkov.id]);
    assignments.push(`   ✅ ${volkov.full_name} → склад «Удалённый офис»`);
  }
  if (novikov && offHead) {
    await run(`INSERT OR IGNORE INTO office_responsibles (office_id, user_id) VALUES (?, ?)`, [offHead.id, novikov.id]);
    assignments.push(`   ✅ ${novikov.full_name} → офис «Головной офис»`);
  }
  if (volkov && offRegion) {
    await run(`INSERT OR IGNORE INTO office_responsibles (office_id, user_id) VALUES (?, ?)`, [offRegion.id, volkov.id]);
    assignments.push(`   ✅ ${volkov.full_name} → офис «Региональный офис»`);
  }
  assignments.forEach(a => log(a, true));
}

// ============================================================
// МОДЕЛИ ТМЦ
// ============================================================

async function buildModelsFromEquipmentData() {
  const types = await all(`
    SELECT t.id, t.name, t.category_id
    FROM equipment_types t
    JOIN equipment_categories c ON t.category_id = c.id
  `);

  const typeMap = {};
  for (const t of types) typeMap[t.name] = { type_id: t.id, category_id: t.category_id };

  const modelMap = new Map();
  const notFoundTypes = new Set();

  for (const eq of EQUIPMENT_DATA) {
    const typeInfo = typeMap[eq.name];
    if (!typeInfo) { notFoundTypes.add(eq.name); continue; }

    const key = `${eq.name}|${eq.model}|${eq.manufacturer || ''}`;
    if (!modelMap.has(key)) {
      modelMap.set(key, {
        name: eq.model, manufacturer: eq.manufacturer || null,
        category_id: typeInfo.category_id, type_id: typeInfo.type_id,
        type_name: eq.name,
      });
    }
  }

  if (notFoundTypes.size > 0) log(`   ⚠️  Типы не найдены: ${[...notFoundTypes].join(', ')}`, true);

  const models = [];
  let counter = 1;
  for (const [key, m] of modelMap) {
    models.push({ corporate_id: `MOD-${String(counter).padStart(4, '0')}`, ...m, model_key: key });
    counter++;
  }
  return models;
}

async function createEquipmentModels() {
  log('\n🧩 Создание моделей ТМЦ...', true);
  const models = await buildModelsFromEquipmentData();
  if (models.length === 0) { log('   ⚠️  Не удалось собрать ни одной модели', true); return new Map(); }

  const keyToId = new Map();
  let created = 0;
  for (const m of models) {
    const description = DESCRIPTIONS[m.type_name] || null;
    const result = await run(`
      INSERT INTO equipment_models (corporate_id, name, manufacturer, category_id, type_id, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [m.corporate_id, m.name, m.manufacturer, m.category_id, m.type_id, description]);
    keyToId.set(m.model_key, result.lastID);
    created++;
    log(`   ✅ ${m.corporate_id} — ${m.name}${m.manufacturer ? ` (${m.manufacturer})` : ''}`, true);
  }
  log(`   ✅ Создано моделей: ${created}`, true);
  return keyToId;
}

// ============================================================
// ЭКЗЕМПЛЯРЫ ТЕХНИКИ (С РАСПРЕДЕЛЕНИЕМ ПО СТАТУСАМ И МЕСТАМ)
// ============================================================

async function createEquipment(modelKeyToId, users) {
  log('\n📦 Создание экземпляров техники...', true);

  const mols = (users || []).filter(u => u.role === 'mol');
  
  // Получаем все ячейки и рабочие места для распределения
  const cells = await all(`SELECT id FROM cells`);
  const workplaces = await all(`SELECT id FROM workplaces`);
  
  const createdEquipment = [];
  let counter = 1;
  let skipped = 0;

  for (const eqData of EQUIPMENT_DATA) {
    const key = `${eqData.name}|${eqData.model}|${eqData.manufacturer || ''}`;
    const modelId = modelKeyToId.get(key);
    if (!modelId) { skipped++; counter++; continue; }

    const inventoryNumber = `EQ-${String(counter).padStart(4, '0')}`;
    const purchaseDate = randomDate(30, 730);
    const warrantyYears = Math.floor(Math.random() * 3) + 1;
    const warrantyDate = new Date(purchaseDate);
    warrantyDate.setFullYear(warrantyDate.getFullYear() + warrantyYears);
    const warrantyUntil = warrantyDate.toISOString().slice(0, 10);

    // === РАСПРЕДЕЛЕНИЕ СТАТУСОВ ===
    let status = 'available';
    let cellId = null;
    let workplaceId = null;
    let responsibleUserId = null;
    let updatedAt = null; // для "залежавшейся"

    const rand = Math.random();
    
    if (rand < 0.35) {
      // 35% — assigned (назначена пользователю)
      status = 'assigned';
      responsibleUserId = mols.length > 0 ? mols[Math.floor(Math.random() * mols.length)].id : null;
    } else if (rand < 0.65) {
      // 30% — available (доступна)
      status = 'available';
      responsibleUserId = mols.length > 0 ? mols[Math.floor(Math.random() * mols.length)].id : null;
      
      // 50% из них — в ячейке, 20% — "потеряшки" (без места), 30% — на рабочем месте
      const subRand = Math.random();
      if (subRand < 0.5 && cells.length > 0) {
        cellId = cells[Math.floor(Math.random() * cells.length)].id;
        updatedAt = randomDate(120, 200); // "залежавшаяся" (> 3 мес.)
      } else if (subRand < 0.7) {
        // "потеряшка" — без cell_id и workplace_id
      } else if (workplaces.length > 0) {
        workplaceId = workplaces[Math.floor(Math.random() * workplaces.length)].id;
        status = 'placed';
      }
    } else if (rand < 0.75) {
      // 10% — maintenance (в ремонте)
      status = 'maintenance';
      responsibleUserId = mols.length > 0 ? mols[Math.floor(Math.random() * mols.length)].id : null;
      if (cells.length > 0) cellId = cells[Math.floor(Math.random() * cells.length)].id;
    } else if (rand < 0.85) {
      // 10% — retired (списана)
      status = 'retired';
      responsibleUserId = mols.length > 0 ? mols[Math.floor(Math.random() * mols.length)].id : null;
    } else {
      // 15% — placed (на рабочем месте)
      status = 'placed';
      if (workplaces.length > 0) workplaceId = workplaces[Math.floor(Math.random() * workplaces.length)].id;
      responsibleUserId = mols.length > 0 ? mols[Math.floor(Math.random() * mols.length)].id : null;
    }

    // Описание (у некоторых)
    const descriptions = [
      'Царапина на корпусе', 'Требует замены батареи', 'Новый, в упаковке',
      'Без дефектов', 'Небольшой скол', 'Проверено, работает',
    ];
    const description = Math.random() < 0.3 ? random(descriptions) : null;

    const result = await run(`
      INSERT INTO equipment
        (model_id, inventory_number, serial_number, status,
         cell_id, workplace_id, purchase_date, warranty_until,
         description, responsible_user_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `, [
      modelId, inventoryNumber, eqData.serial, status,
      cellId, workplaceId, purchaseDate.slice(0, 10), warrantyUntil,
      description, responsibleUserId, updatedAt,
    ]);

    createdEquipment.push({ id: result.lastID, model_id: modelId, inventory_number: inventoryNumber, serial_number: eqData.serial, status, cell_id: cellId, workplace_id: workplaceId, responsible_user_id: responsibleUserId });
    counter++;
  }

  log(`   ✅ Создано экземпляров: ${createdEquipment.length}`, true);
  if (skipped > 0) log(`   ⚠️  Пропущено: ${skipped}`, true);
  return createdEquipment;
}

// ============================================================
// НАЗНАЧЕНИЯ
// ============================================================

async function createAssignments(users, equipment) {
  log('\n📋 Создание назначений...', true);
  const regularUsers = users.filter(u => u.role === 'user');
  if (regularUsers.length === 0) { log('   ⚠️  Нет обычных пользователей для назначений', true); return; }
  
  let activeCount = 0;
  let returnedCount = 0;
  
  const assignedEquipment = equipment.filter(e => e.status === 'assigned');
  for (const eq of assignedEquipment) {
    const user = random(regularUsers);
    const assignedDate = randomDate(5, 180);
    const conditionOnAssign = random(CONDITIONS);
    
    await run(`
      INSERT INTO user_equipment (user_id, equipment_id, assigned_date, condition_on_assign, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [user.id, eq.id, assignedDate, conditionOnAssign, 'Назначено при первичном вводе']);
    activeCount++;
  }
  
  const availableEquipment = equipment.filter(e => e.status === 'available');
  const historyLimit = Math.min(15, availableEquipment.length);
  for (let i = 0; i < historyLimit; i++) {
    const eq = availableEquipment[i];
    const count = Math.floor(Math.random() * 2) + 1;
    for (let j = 0; j < count; j++) {
      const user = random(regularUsers);
      const assignedDate = randomDate(60, 365);
      const returnedDate = randomDate(5, 55);
      if (returnedDate < assignedDate) continue;
      
      await run(`
        INSERT INTO user_equipment (user_id, equipment_id, assigned_date, returned_date, condition_on_assign, condition_on_return, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [user.id, eq.id, assignedDate, returnedDate, random(CONDITIONS), random(CONDITIONS), 'Возвращено при плановой замене']);
      returnedCount++;
    }
  }
  
  log(`   ✅ Активных назначений: ${activeCount}`, true);
  log(`   ✅ Возвращённых назначений: ${returnedCount}`, true);
}

// ============================================================
// ЛОГИ АКТИВНОСТИ
// ============================================================

async function createActivityLog(users) {
  log('\n📊 Создание логов активности...', true);
  
  const actions = [
    { action: 'login', weight: 50 },
    { action: 'logout', weight: 40 },
    { action: 'equipment_update', weight: 15 },
    { action: 'equipment_assign', weight: 20 },
    { action: 'equipment_return', weight: 10 },
    { action: 'user_create', weight: 5 },
    { action: 'user_update', weight: 5 },
    { action: 'profile_update', weight: 8 },
    { action: 'password_change', weight: 3 },
  ];
  
  const weightedActions = [];
  actions.forEach(a => { for (let i = 0; i < a.weight; i++) weightedActions.push(a.action); });
  
  const totalLogs = 150;
  let created = 0;
  for (let i = 0; i < totalLogs; i++) {
    const user = random(users);
    const action = random(weightedActions);
    const daysAgo = Math.random() * 30;
    const logDate = new Date();
    logDate.setDate(logDate.getDate() - daysAgo);
    logDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
    const createdAt = logDate.toISOString().slice(0, 19).replace('T', ' ');
    
    let details = null;
    if (action === 'login') details = JSON.stringify({ role: user.role });
    else if (action === 'equipment_assign' || action === 'equipment_return') details = JSON.stringify({ inventory_number: `EQ-${String(Math.floor(Math.random() * 40) + 1).padStart(4, '0')}` });
    else if (action === 'user_create' || action === 'user_update') details = JSON.stringify({ username: `user${Math.floor(Math.random() * 100)}` });
    
    await run(`
      INSERT INTO activity_log (user_id, username, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user.id, user.username, action, details, '127.0.0.1', createdAt]);
    created++;
  }
  log(`   ✅ Создано ${created} записей логов`, true);
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

async function seed() {
  try {
    console.log('');
    console.log('🌱 ═══════════════════════════════════════════════════');
    console.log('🌱  ЗАПОЛНЕНИЕ БАЗЫ ДАННЫХ ТЕСТОВЫМИ ДАННЫМИ');
    console.log('🌱 ═══════════════════════════════════════════════════');
    
    await checkStructure();
    const existing = await checkExistingData();
    
    if ((existing.users > 0 || existing.equipment > 0) && !force) {
      console.log('');
      console.log('⚠️  В базе данных уже есть демо-данные:');
      console.log(`   👥 Пользователей: ${existing.users}`);
      console.log(`   📦 Техники:       ${existing.equipment}`);
      console.log('');
      console.log('   Для перезаписи используйте:');
      console.log('   npm run seed -- --force');
      console.log('');
      process.exit(0);
    }
    
    if (force && (existing.users > 0 || existing.equipment > 0)) {
      await clearDemoData();
    }
    
    const users = await createUsers();
    const modelKeyToId = await createEquipmentModels();
    await createMolResponsibles(users);
    const equipment = await createEquipment(modelKeyToId, users);
    await createAssignments(users, equipment);
    await createActivityLog(users);
    
    console.log('');
    console.log('🌱 ═══════════════════════════════════════════════════');
    console.log('✅ БАЗА ДАННЫХ УСПЕШНО ЗАПОЛНЕНА!');
    console.log('🌱 ═══════════════════════════════════════════════════');
    console.log('');
    console.log('👥 Пользователи:');
    console.log('');
    console.log('   👑 Администраторы (пароль Admin123!):');
    console.log('      • admin     (создан migrate.js)');
    console.log('      • manager');
    console.log('');
    console.log('   👁️  Супервизор (пароль ChangeMe123!):');
    console.log('      • sokolova                      (HR-отдел)');
    console.log('');
    console.log('   🧑‍💼 МОЛ (пароль ChangeMe123!):');
    console.log('      • kozlov      (IT)      → склад «Основной офис»');
    console.log('      • volkov      (Продажи) → склад «Удалённый офис»');
    console.log('      • novikov     (IT)      → офис «Головной офис»');
    console.log('      • volkov                → офис «Региональный офис»');
    console.log('');
    console.log('   👤 Обычные пользователи (пароль ChangeMe123!):');
    console.log('      • ivanov                        (IT-отдел)');
    console.log('      • petrova, kuznetsova           (Бухгалтерия)');
    console.log('      • sidorov, morozov              (Отдел продаж)');
    console.log('      • smirnova                      (HR-отдел)');
    console.log('      • popov, lebedeva               (Маркетинг)');
    console.log('      • orlov, fedorov                (Логистика)');
    console.log('');
    console.log('🧩 Модели ТМЦ:  ~20 моделей');
    console.log('📦 Экземпляры:  ~50 единиц (с разными статусами и местами)');
    console.log('');
    console.log('⚠️  ВСЕМ пользователям при первом входе');
    console.log('    будет предложено сменить пароль.');
    console.log('');
    console.log('🌱 ═══════════════════════════════════════════════════');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ ОШИБКА ПРИ ЗАПОЛНЕНИИ БД:');
    console.error('');
    console.error('   ' + error.message);
    console.error('');
    console.error(error.stack);
    console.error('');
    process.exit(1);
  } finally {
    db.close();
  }
}

// ============================================================
// ЗАПУСК
// ============================================================

seed();