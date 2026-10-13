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

/**
 * Случайная дата в прошлом
 */
function randomDate(daysAgoMin, daysAgoMax) {
  const daysAgo = Math.floor(Math.random() * (daysAgoMax - daysAgoMin)) + daysAgoMin;
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Случайный элемент массива
 */
function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// СПРАВОЧНЫЕ ДАННЫЕ
// ============================================================

// ВНИМАНИЕ: admin НЕ включён — он создаётся в migrate.js
const USERS_DATA = [
  // Администраторы (кроме admin — он уже есть)
  { username: 'manager', email: 'manager@company.com', full_name: 'Смирнов Алексей Петрович', department: 'Администрация', phone: '+7(999)000-00-02', role: 'admin' },
  
  // IT-отдел
  { username: 'ivanov', email: 'ivanov@company.com', full_name: 'Иван Иванов', department: 'IT-отдел', phone: '+7(999)111-22-33', role: 'user' },
  { username: 'kozlov', email: 'kozlov@company.com', full_name: 'Козлов Юрий Борисович', department: 'IT-отдел', phone: '+7(999)111-22-34', role: 'user' },
  { username: 'novikov', email: 'novikov@company.com', full_name: 'Новиков Дмитрий Сергеевич', department: 'IT-отдел', phone: '+7(999)111-22-35', role: 'user' },
  
  // Бухгалтерия
  { username: 'petrova', email: 'petrova@company.com', full_name: 'Мария Петрова', department: 'Бухгалтерия', phone: '+7(999)444-55-66', role: 'user' },
  { username: 'kuznetsova', email: 'kuznetsova@company.com', full_name: 'Кузнецова Ольга Ивановна', department: 'Бухгалтерия', phone: '+7(999)444-55-67', role: 'user' },
  
  // Отдел продаж
  { username: 'sidorov', email: 'sidorov@company.com', full_name: 'Пётр Сидоров', department: 'Отдел продаж', phone: '+7(999)777-88-99', role: 'user' },
  { username: 'morozov', email: 'morozov@company.com', full_name: 'Морозов Андрей Владимирович', department: 'Отдел продаж', phone: '+7(999)777-88-98', role: 'user' },
  { username: 'volkov', email: 'volkov@company.com', full_name: 'Волков Сергей Николаевич', department: 'Отдел продаж', phone: '+7(999)777-88-97', role: 'user' },
  
  // HR
  { username: 'smirnova', email: 'smirnova@company.com', full_name: 'Анна Смирнова', department: 'HR-отдел', phone: '+7(999)000-11-22', role: 'user' },
  { username: 'sokolova', email: 'sokolova@company.com', full_name: 'Соколова Екатерина Андреевна', department: 'HR-отдел', phone: '+7(999)000-11-23', role: 'user' },
  
  // Маркетинг
  { username: 'popov', email: 'popov@company.com', full_name: 'Попов Максим Олегович', department: 'Маркетинг', phone: '+7(999)222-33-44', role: 'user' },
  { username: 'lebedeva', email: 'lebedeva@company.com', full_name: 'Лебедева Наталья Викторовна', department: 'Маркетинг', phone: '+7(999)222-33-45', role: 'user' },
  
  // Логистика
  { username: 'orlov', email: 'orlov@company.com', full_name: 'Орлов Виктор Александрович', department: 'Логистика', phone: '+7(999)555-66-77', role: 'user' },
  { username: 'fedorov', email: 'fedorov@company.com', full_name: 'Фёдоров Игорь Валентинович', department: 'Логистика', phone: '+7(999)555-66-78', role: 'user' },
];

// Каждая запись — это "name" (тип из справочника) + модель
// Тип будет найден в справочнике по полю name
const EQUIPMENT_DATA = [
  // Ноутбуки
  { name: 'Ноутбук', model: 'Dell Latitude 5540', manufacturer: 'Dell', serial: 'DL5540-001' },
  { name: 'Ноутбук', model: 'Dell Latitude 5540', manufacturer: 'Dell', serial: 'DL5540-002' },
  { name: 'Ноутбук', model: 'HP ProBook 450 G10', manufacturer: 'HP', serial: 'HP450-001' },
  { name: 'Ноутбук', model: 'HP ProBook 450 G10', manufacturer: 'HP', serial: 'HP450-002' },
  { name: 'Ноутбук', model: 'Lenovo ThinkPad E15', manufacturer: 'Lenovo', serial: 'LNE15-001' },
  { name: 'Ноутбук', model: 'Lenovo ThinkPad E15', manufacturer: 'Lenovo', serial: 'LNE15-002' },
  { name: 'Ноутбук', model: 'Apple MacBook Air 13" M2', manufacturer: 'Apple', serial: 'MBA-M2-001' },
  { name: 'Ноутбук', model: 'Apple MacBook Pro 14" M3', manufacturer: 'Apple', serial: 'MBP-M3-001' },
  { name: 'Ноутбук', model: 'Asus VivoBook 15', manufacturer: 'Asus', serial: 'ASUS-VB-001' },
  { name: 'Ноутбук', model: 'Acer Aspire 5', manufacturer: 'Acer', serial: 'ACER-AS-001' },
  
  // Мониторы
  { name: 'Монитор', model: 'Dell UltraSharp U2723QE 27"', manufacturer: 'Dell', serial: 'DELL-U27-001' },
  { name: 'Монитор', model: 'Dell UltraSharp U2723QE 27"', manufacturer: 'Dell', serial: 'DELL-U27-002' },
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

const CONDITIONS = [
  'В хорошем состоянии',
  'Новая',
  'Требуется внимание',
  'С дефектами'
];

// ============================================================
// ПРОВЕРКА СТРУКТУРЫ БД
// ============================================================

async function checkStructure() {
  const requiredTables = [
    'users',
    'equipment',
    'equipment_models',
    'equipment_categories',
    'equipment_types',
    'user_equipment',
    'activity_log',
    'app_meta'
  ];
  
  for (const table of requiredTables) {
    const exists = await get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [table]
    );
    
    if (!exists) {
      console.error('');
      console.error(`❌ Таблица "${table}" не найдена!`);
      console.error('');
      console.error('   Сначала запустите миграцию:');
      console.error('   npm run migrate');
      console.error('');
      process.exit(1);
    }
  }
  
  // Проверяем, что админ существует
  const admin = await get(`SELECT id, username FROM users WHERE role = 'admin' LIMIT 1`);
  if (!admin) {
    console.error('');
    console.error('❌ Администратор не найден!');
    console.error('');
    console.error('   Сначала запустите миграцию:');
    console.error('   npm run migrate');
    console.error('');
    process.exit(1);
  }
  
  // Проверяем, что справочник заполнен
  const categoriesCount = await get('SELECT COUNT(*) as count FROM equipment_categories');
  if (categoriesCount.count === 0) {
    console.error('');
    console.error('❌ Справочник категорий пуст!');
    console.error('');
    console.error('   Сначала запустите миграцию:');
    console.error('   npm run migrate');
    console.error('');
    process.exit(1);
  }
}

// ============================================================
// ПРОВЕРКА СУЩЕСТВУЮЩИХ ДАННЫХ
// ============================================================

async function checkExistingData() {
  const users = await get(`SELECT COUNT(*) as count FROM users WHERE username != 'admin'`);
  const equipment = await get('SELECT COUNT(*) as count FROM equipment');
  
  return {
    users: users.count,
    equipment: equipment.count
  };
}

// ============================================================
// ОЧИСТКА ДЕМО-ДАННЫХ
// ============================================================

/**
 * Удалить файл сессий
 */
async function clearSessionsFile() {
  const sessionsPath = path.join(dataDir, 'sessions.db');
  const filesToDelete = [
    sessionsPath,
    sessionsPath + '-journal',
    sessionsPath + '-wal',
    sessionsPath + '-shm'
  ];
  
  let deleted = 0;
  
  for (const filePath of filesToDelete) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        deleted++;
      } catch (err) {
        log(`   ⚠️  Не удалось удалить ${path.basename(filePath)}: ${err.message}`, true);
      }
    }
  }
  
  if (deleted > 0) {
    log(`   ✅ Файлы сессий удалены (${deleted})`, true);
  }
}

/**
 * Очистка демо-данных
 * 
 * ВАЖНО: НЕ трогаем:
 * - admin (и других админов с role='admin')
 * - equipment_categories
 * - equipment_types
 * - app_meta
 */
async function clearDemoData() {
  log('\n🗑️  Очистка демо-данных...', true);
  
  await run('PRAGMA foreign_keys = OFF');
  
  // Удаляем демо-данные (порядок важен: сначала зависимые)
  await run('DELETE FROM activity_log');
  await run('DELETE FROM user_equipment');
  await run('DELETE FROM equipment');
  await run('DELETE FROM equipment_models');
  
  // Удаляем всех пользователей КРОМЕ админов
  const deleted = await run(`DELETE FROM users WHERE role != 'admin'`);
  log(`   ✅ Удалено пользователей: ${deleted.changes}`, true);
  
  // Сбрасываем счётчики автоинкремента
  // НЕ трогаем equipment_categories и equipment_types — там свои ID
  await run(`DELETE FROM sqlite_sequence WHERE name IN ('users', 'equipment', 'equipment_models', 'user_equipment', 'activity_log')`);
  
  await run('PRAGMA foreign_keys = ON');
  
  // Обновляем версию БД (все старые сессии станут невалидными)
  const newVersion = Date.now().toString();
  await run(`
    INSERT INTO app_meta (key, value, updated_at) 
    VALUES ('db_seed_version', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET 
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `, [newVersion]);
  log(`   ✅ Версия БД обновлена`, true);
  
  // Удаляем сессии
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
  
  // Сначала добавляем существующего admin (создан migrate.js)
  const admin = await get(`SELECT id, username, full_name, role, department FROM users WHERE username = 'admin'`);
  if (admin) {
    createdUsers.push({
      id: admin.id,
      username: admin.username,
      full_name: admin.full_name,
      role: admin.role,
      department: admin.department || 'Администрация'
    });
  }
  
  // Создаём остальных пользователей
  for (const userData of USERS_DATA) {
    // Проверяем, нет ли уже такого пользователя
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
    `, [
      userData.username,
      userData.email,
      userData.full_name,
      userData.department,
      userData.phone,
      hash,
      userData.role
    ]);
    
    createdUsers.push({ ...userData, id: result.lastID });
    
    const icon = userData.role === 'admin' ? '👑' : '👤';
    log(`   ✅ ${icon} ${userData.username} (${userData.full_name})`, true);
  }
  
  return createdUsers;
}

// ============================================================
// СОЗДАНИЕ МОДЕЛЕЙ ТМЦ
// ============================================================

/**
 * Собирает уникальные модели из EQUIPMENT_DATA.
 * Ключ — комбинация (name, model, manufacturer).
 *
 * @returns {Array<{corporate_id, name, manufacturer, category_id, type_id, model_key}>}
 */
async function buildModelsFromEquipmentData() {
  // Справочник типов
  const types = await all(`
    SELECT t.id, t.name, t.category_id
    FROM equipment_types t
    JOIN equipment_categories c ON t.category_id = c.id
  `);

  const typeMap = {};
  for (const t of types) {
    typeMap[t.name] = { type_id: t.id, category_id: t.category_id };
  }

  // Уникальные модели
  const modelMap = new Map(); // key → { name, manufacturer, category_id, type_id }
  const notFoundTypes = new Set();

  for (const eq of EQUIPMENT_DATA) {
    const typeInfo = typeMap[eq.name];
    if (!typeInfo) {
      notFoundTypes.add(eq.name);
      continue;
    }

    const key = `${eq.name}|${eq.model}|${eq.manufacturer || ''}`;
    if (!modelMap.has(key)) {
      modelMap.set(key, {
        name: eq.model,                       // название модели
        manufacturer: eq.manufacturer || null,
        category_id: typeInfo.category_id,
        type_id: typeInfo.type_id,
        type_name: eq.name,                   // 'Ноутбук', 'Монитор', ... (для DESCRIPTIONS)
      });
    }
  }

  if (notFoundTypes.size > 0) {
    log(`   ⚠️  Типы не найдены в справочнике: ${[...notFoundTypes].join(', ')}`, true);
  }

  // Присваиваем corporate_id
  const models = [];
  let counter = 1;
  for (const [key, m] of modelMap) {
    models.push({
      corporate_id: `MOD-${String(counter).padStart(4, '0')}`,
      name: m.name,
      manufacturer: m.manufacturer,
      category_id: m.category_id,
      type_id: m.type_id,
      type_name: m.type_name,
      model_key: key,                       // служебное — для сопоставления
    });
    counter++;
  }

  return models;
}

/**
 * Создать модели ТМЦ.
 * @returns {Promise<Map<model_key, model_id>>} — соответствие «ключ → ID»
 */
async function createEquipmentModels() {
  log('\n🧩 Создание моделей ТМЦ...', true);

  const models = await buildModelsFromEquipmentData();

  if (models.length === 0) {
    log('   ⚠️  Не удалось собрать ни одной модели', true);
    return new Map();
  }

  const keyToId = new Map();
  let created = 0;

  for (const m of models) {
    const description = DESCRIPTIONS[m.type_name] || null;
    const result = await run(`
      INSERT INTO equipment_models
        (corporate_id, name, manufacturer, category_id, type_id, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      m.corporate_id,
      m.name,
      m.manufacturer,
      m.category_id,
      m.type_id,
      description,
    ]);

    keyToId.set(m.model_key, result.lastID);
    created++;

    const mfr = m.manufacturer ? ` (${m.manufacturer})` : '';
    log(`   ✅ ${m.corporate_id} — ${m.name}${mfr}`, true);
  }

  log(`   ✅ Создано моделей: ${created}`, true);
  return keyToId;
}

// ============================================================
// СОЗДАНИЕ ЭКЗЕМПЛЯРОВ ТЕХНИКИ
// ============================================================

async function createEquipment(modelKeyToId) {
  log('\n📦 Создание экземпляров техники...', true);

  const createdEquipment = [];
  let counter = 1;
  let skipped = 0;

  for (const eqData of EQUIPMENT_DATA) {
    const key = `${eqData.name}|${eqData.model}|${eqData.manufacturer || ''}`;
    const modelId = modelKeyToId.get(key);

    if (!modelId) {
      log(`   ⚠️  Нет модели для: ${eqData.model} — пропускаем`, true);
      skipped++;
      counter++;
      continue;
    }

    const inventoryNumber = `EQ-${String(counter).padStart(4, '0')}`;

    // Дата покупки: от 30 до 730 дней назад
    const purchaseDate = randomDate(30, 730);

    // Гарантия: +1, +2 или +3 года
    const warrantyYears = Math.floor(Math.random() * 3) + 1;
    const purchaseDateObj = new Date(purchaseDate);
    const warrantyDate = new Date(purchaseDateObj);
    warrantyDate.setFullYear(warrantyDate.getFullYear() + warrantyYears);
    const warrantyUntil = warrantyDate.toISOString().slice(0, 10);

    // Статус: 60% assigned, 40% available
    const status = Math.random() < 0.6 ? 'assigned' : 'available';

    const result = await run(`
      INSERT INTO equipment
        (model_id, inventory_number, serial_number, status,
         purchase_date, warranty_until, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      modelId,
      inventoryNumber,
      eqData.serial,
      status,
      purchaseDate.slice(0, 10),
      warrantyUntil,
      null,                                 // описание живёт на модели
    ]);

    createdEquipment.push({
      id: result.lastID,
      model_id: modelId,
      inventory_number: inventoryNumber,
      serial_number: eqData.serial,
      status,
      purchase_date: purchaseDate.slice(0, 10),
    });

    counter++;
  }

  log(`   ✅ Создано экземпляров: ${createdEquipment.length}`, true);
  if (skipped > 0) {
    log(`   ⚠️  Пропущено: ${skipped}`, true);
  }

  return createdEquipment;
}

// ============================================================
// СОЗДАНИЕ НАЗНАЧЕНИЙ
// ============================================================

async function createAssignments(users, equipment) {
  log('\n📋 Создание назначений...', true);
  
  // Отделяем обычных пользователей от админов
  const regularUsers = users.filter(u => u.role === 'user');
  
  if (regularUsers.length === 0) {
    log('   ⚠️  Нет обычных пользователей для назначений', true);
    return;
  }
  
  let activeCount = 0;
  let returnedCount = 0;
  
  // ===== Активные назначения (для assigned техники) =====
  const assignedEquipment = equipment.filter(e => e.status === 'assigned');
  
  for (const eq of assignedEquipment) {
    const user = random(regularUsers);
    const assignedDate = randomDate(5, 180);
    const conditionOnAssign = random(CONDITIONS);
    
    await run(`
      INSERT INTO user_equipment (user_id, equipment_id, assigned_date, condition_on_assign, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [
      user.id,
      eq.id,
      assignedDate,
      conditionOnAssign,
      'Назначено при первичном вводе'
    ]);
    
    activeCount++;
  }
  
  // ===== История (для available техники) =====
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
        INSERT INTO user_equipment 
        (user_id, equipment_id, assigned_date, returned_date, condition_on_assign, condition_on_return, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        user.id,
        eq.id,
        assignedDate,
        returnedDate,
        random(CONDITIONS),
        random(CONDITIONS),
        'Возвращено при плановой замене'
      ]);
      
      returnedCount++;
    }
  }
  
  log(`   ✅ Активных назначений: ${activeCount}`, true);
  log(`   ✅ Возвращённых назначений: ${returnedCount}`, true);
}

// ============================================================
// СОЗДАНИЕ ЛОГОВ АКТИВНОСТИ
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
  
  // Разворачиваем по весам
  const weightedActions = [];
  actions.forEach(a => {
    for (let i = 0; i < a.weight; i++) weightedActions.push(a.action);
  });
  
  const totalLogs = 150;
  let created = 0;
  
  for (let i = 0; i < totalLogs; i++) {
    const user = random(users);
    const action = random(weightedActions);
    const daysAgo = Math.random() * 30;
    const logDate = new Date();
    logDate.setDate(logDate.getDate() - daysAgo);
    logDate.setHours(
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 60),
      Math.floor(Math.random() * 60)
    );
    
    const createdAt = logDate.toISOString().slice(0, 19).replace('T', ' ');
    
    let details = null;
    if (action === 'login') {
      details = JSON.stringify({ role: user.role });
    } else if (action === 'equipment_assign' || action === 'equipment_return') {
      details = JSON.stringify({
        inventory_number: `EQ-${String(Math.floor(Math.random() * 40) + 1).padStart(4, '0')}`
      });
    } else if (action === 'user_create' || action === 'user_update') {
      details = JSON.stringify({ username: `user${Math.floor(Math.random() * 100)}` });
    }
    
    await run(`
      INSERT INTO activity_log (user_id, username, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      user.id,
      user.username,
      action,
      details,
      '127.0.0.1',
      createdAt
    ]);
    
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
    
    // ===== 1. Проверка структуры БД =====
    await checkStructure();
    
    // ===== 2. Проверка существующих данных =====
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
    
    // ===== 3. Очистка (если --force) =====
    if (force && (existing.users > 0 || existing.equipment > 0)) {
      await clearDemoData();
    }
    
    // ===== 4. Создание демо-данных =====
    const users = await createUsers();
    const modelKeyToId = await createEquipmentModels();
    const equipment = await createEquipment(modelKeyToId);
    await createAssignments(users, equipment);
    await createActivityLog(users);
    
    // ===== 5. Итоги =====
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
    console.log('   👤 Обычные пользователи (пароль ChangeMe123!):');
    console.log('      • ivanov, kozlov, novikov       (IT-отдел)');
    console.log('      • petrova, kuznetsova           (Бухгалтерия)');
    console.log('      • sidorov, morozov, volkov      (Отдел продаж)');
    console.log('      • smirnova, sokolova            (HR-отдел)');
    console.log('      • popov, lebedeva               (Маркетинг)');
    console.log('      • orlov, fedorov                (Логистика)');
    console.log('');
    console.log('🧩 Модели ТМЦ:  ~20 моделей (ноутбуки, мониторы, периферия...)');
    console.log('📦 Экземпляры:  40 единиц техники');
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