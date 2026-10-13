#!/usr/bin/env node
// scripts/check-css.js
// Проверка: все ли CSS-переменные из theme.css объявлены,
// все ли нужные классы есть в components.css

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public', 'css');

// ------------------------------------------------------------
// 1. Собираем все объявленные переменные в theme.css
// ------------------------------------------------------------
function collectDeclaredVars(filePath) {
  const css = fs.readFileSync(filePath, 'utf8');
  const declared = new Set();
  // ищем --var-name: ... ; внутри :root и любых блоков
  const re = /(--[a-zA-Z0-9-]+)\s*:/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    declared.add(m[1]);
  }
  return declared;
}

// ------------------------------------------------------------
// 2. Собираем все используемые переменные в CSS-файле
// ------------------------------------------------------------
function collectUsedVars(filePath) {
  const css = fs.readFileSync(filePath, 'utf8');
  const used = new Set();
  const re = /var\(\s*(--[a-zA-Z0-9-]+)/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    used.add(m[1]);
  }
  return used;
}

// ------------------------------------------------------------
// 3. Собираем все объявленные классы в CSS-файле
// ------------------------------------------------------------
function collectDeclaredClasses(filePath) {
  const css = fs.readFileSync(filePath, 'utf8');
  const declared = new Set();
  // ищем .class-name (не в :not(), не в псевдоклассах)
  // упрощённо: .[\w-]+ за которым следует { , , : пробел
  const re = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    declared.add(m[1]);
  }
  return declared;
}

// ------------------------------------------------------------
// 4. Проверка переменных в CSS-файлах
// ------------------------------------------------------------
function checkVars(themeVars, files) {
  console.log('\n📦 Проверка CSS-переменных\n');
  let totalMissing = 0;

  for (const file of files) {
    const fullPath = path.join(PUBLIC, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  ${file} — не найден, пропуск`);
      continue;
    }
    const used = collectUsedVars(fullPath);
    const missing = [...used].filter(v => !themeVars.has(v));
    if (missing.length === 0) {
      console.log(`✅ ${file} — все переменные объявлены (${used.size} шт.)`);
    } else {
      console.log(`❌ ${file} — отсутствуют переменные (${missing.length}):`);
      missing.forEach(v => console.log(`     ${v}`));
      totalMissing += missing.length;
    }
  }
  return totalMissing;
}

// ------------------------------------------------------------
// 5. Проверка классов в components.css
// ------------------------------------------------------------
function checkClasses(required, filePath, fileLabel = 'components.css') {
  console.log(`\n📦 Проверка классов в ${fileLabel}\n`);
  const declared = collectDeclaredClasses(filePath);
  let totalMissing = 0;
  const byGroup = {};

  for (const [group, classes] of Object.entries(required)) {
    byGroup[group] = { ok: [], missing: [] };
    for (const cls of classes) {
      if (declared.has(cls)) {
        byGroup[group].ok.push(cls);
      } else {
        byGroup[group].missing.push(cls);
      }
    }
  }

  for (const [group, { ok, missing }] of Object.entries(byGroup)) {
    if (missing.length === 0) {
      console.log(`✅ ${group} — все классы на месте (${ok.length})`);
    } else {
      console.log(`❌ ${group} — отсутствуют (${missing.length} из ${ok.length + missing.length}):`);
      missing.forEach(c => console.log(`     .${c}`));
      totalMissing += missing.length;
    }
  }
  return totalMissing;
}

// ------------------------------------------------------------
// 6. Проверка плейсхолдеров в views/*.html
// ------------------------------------------------------------
function checkPlaceholders(viewFile, expected) {
  const fullPath = path.join(ROOT, 'views', viewFile);
  if (!fs.existsSync(fullPath)) {
    return { file: viewFile, ok: false, reason: 'не найден' };
  }
  const html = fs.readFileSync(fullPath, 'utf8');
  const missing = expected.filter(p => !html.includes(p));
  return { file: viewFile, missing };
}

// ------------------------------------------------------------
// 7. Автопроверка: все {{...}} из views/*.html должны иметь replace в JS
// ------------------------------------------------------------

/**
 * Собирает плейсхолдеры {{...}} и {{{...}}} из HTML.
 * Возвращает Map: placeholder -> [строки, где встречается]
 */
function collectPlaceholdersFromHtml(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const map = new Map();
  // поддерживаем {{{...}}} (тройные) и {{...}}
  const re = /\{\{\{?([\w.\-:]+)\}?\}\}/g;
  let m;
  const lines = html.split('\n');
  while ((m = re.exec(html)) !== null) {
    const name = m[1];
    // находим номер строки
    const before = html.substring(0, m.index);
    const lineNum = before.split('\n').length;
    const key = m[0].startsWith('{{{') ? `{{{${name}}}}` : `{{${name}}}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ line: lineNum, raw: lines[lineNum - 1].trim().slice(0, 120) });
  }
  return map;
}

/**
 * Собирает все плейсхолдеры, которые где-то заменяются в JS.
 * Ищем .replace('{{x}}', ...) и .replace(/\{\{x\}\}/g, ...) и .replace("{{x}}", ...)
 * а также похожие конструкции с template literal.
 */
function collectReplacedPlaceholders(jsFiles) {
  const set = new Set();
  for (const file of jsFiles) {
    const js = fs.readFileSync(file, 'utf8');

    // 1. Простой формат: '{{id}}', "{{id}}", {{{x}}}, `{{id}}`
    //    (в том числе внутри .replace('{{id}}', ...))
    const simple = /\{\{\{?([\w.\-:]+)\}?\}\}/g;
    let m;
    while ((m = simple.exec(js)) !== null) {
      set.add(m[0]); // сохраняем точный вид: '{{id}}' или '{{{types_json}}}'
    }

    // 2. Экранированный формат (в регулярках): \{\{id\}\}
    //    Учитываем экранированные точки: \{\{office\.id\}\}
    const escaped = /\\\{\\\{([\w.\\\-:]+?)\\\}\\\}/g;
    while ((m = escaped.exec(js)) !== null) {
      const name = m[1].replace(/\\\./g, '.');
      set.add(`{{${name}}}`);
    }
  }
  return set;
}

function checkAllPlaceholders() {
  console.log('\n' + '─'.repeat(60));
  console.log('📦 Автопроверка плейсхолдеров views/*.html → routes/*.js\n');

  const viewsDir = path.join(ROOT, 'views');
  const routesDir = path.join(ROOT, 'routes');
  const utilsDir = path.join(ROOT, 'utils');

  if (!fs.existsSync(viewsDir)) {
    console.log('⚠️  views/ не найден, пропуск');
    return 0;
  }

  // 1. Собираем JS-файлы, где может быть replace
  const jsFiles = [];
  for (const dir of [routesDir, utilsDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.js')) jsFiles.push(path.join(dir, f));
    }
  }

  // 2. Собираем "заменяемые" плейсхолдеры
  const replaced = collectReplacedPlaceholders(jsFiles);

  // 3. Обходим views
  const htmlFiles = fs.readdirSync(viewsDir).filter(f => f.endsWith('.html'));

  // Известные плейсхолдеры, которые заменяются НЕ в routes/, а в layout.js
  // (или других местах) — оставляем в белом списке.


const whitelist = new Set([
  // Общие из layout.js
  '{{title}}', '{{content}}', '{{pageCss}}', '{{pageJs}}',
  '{{user}}', '{{username}}', '{{userRole}}', '{{currentYear}}',
  // Клиентские шаблоны (Handlebars/Vue)
  '{{this.name}}', '{{this.file}}',
  // ... по мере появления
]);

const whitelistPatterns = [
  /^\{\{this\.[\w.]+\}\}$/,   // {{this.*}} — клиентские шаблоны
];

function isWhitelisted(key) {
  if (whitelist.has(key)) return true;
  return whitelistPatterns.some(re => re.test(key));
}

  let totalIssues = 0;

  for (const file of htmlFiles) {
    const fullPath = path.join(viewsDir, file);
    const placeholders = collectPlaceholdersFromHtml(fullPath);

    const missing = [];
    for (const [key, occurrences] of placeholders) {
      if (replaced.has(key)) continue;
      if (isWhitelisted(key)) continue;
      missing.push({ key, occurrences });
    }

    if (missing.length === 0) {
      console.log(`✅ ${file} — все плейсхолдеры обрабатываются (${placeholders.size})`);
    } else {
      console.log(`❌ ${file} — НЕ обрабатываются (${missing.length} из ${placeholders.size}):`);
      for (const { key, occurrences } of missing) {
        console.log(`     ${key}   (${occurrences.length}×)`);
        // показываем первую строку для контекста
        const occ = occurrences[0];
        console.log(`       ↳ строка ${occ.line}: ${occ.raw}`);
      }
      totalIssues += missing.length;
    }
  }

  return totalIssues;
}

// ============================================================
// MAIN
// ============================================================

console.log('🔍 Проверка CSS и шаблонов MoveIT service\n');
console.log('─'.repeat(60));

const themePath = path.join(PUBLIC, 'theme.css');
const componentsPath = path.join(PUBLIC, 'components.css');

if (!fs.existsSync(themePath)) {
  console.error('❌ theme.css не найден');
  process.exit(1);
}
if (!fs.existsSync(componentsPath)) {
  console.error('❌ components.css не найден');
  process.exit(1);
}

// --- 1. Переменные ---
const themeVars = collectDeclaredVars(themePath);
console.log(`\n📋 Объявлено переменных в theme.css: ${themeVars.size}\n`);

const cssFilesToCheck = [
  'admin-add.css',
  'admin-edit.css',
  'catalog.css',
  'logs.css',
  'components.css',
  'layout.css',
  'warehouses.css',
  'warehouse-details.css',
  'workplace-details.css',
  'inventory.css',
  'pdf.css',
  'workplaces.css',
  'admin-models.css',
];

const missingVars = checkVars(themeVars, cssFilesToCheck);

// --- 2. Классы в components.css ---
console.log('\n' + '─'.repeat(60));
console.log('📋 Объявлено классов в components.css: ' + collectDeclaredClasses(componentsPath).size);

// Классы, которые должны быть в components.css
const requiredInComponents = {
  'Формы (1.6.3)': [
    'required',
    'help-text',
  ],
  'Модалки (существующие)': [
    'modal-overlay',
    'modal',
    'modal-header',
    'modal-close',
    'modal-actions',
  ],
  'Info-боксы (1.7.1)': [
    'info-box',
    'info-box-icon',
  ],
  'Пароль (1.7.1)': [
    'password-warning',
    'password-display',
    'password-username',
  ],
  'Общие компоненты': [
    'card',
    'card-header',
    'card-title',
    'card-body',
    'form-group',
    'form-row',
    'form-actions',
    'btn',
    'btn-primary',
    'btn-ghost',
    'btn-sm',
  ],
};

// Классы, которые должны быть в layout.css
const requiredInLayout = {
  'Каркас страницы': [
    'page-header',
    'page-title',
    'page-subtitle',
    'page-actions',
  ],
  'Общий каркас (проверка)': [
    'app-layout',
    'app-sidebar',
    'app-header',
    'app-main',
    'app-footer',
  ],
};

const missingClassesComponents = checkClasses(requiredInComponents, componentsPath, 'components.css');
console.log('\n' + '─'.repeat(60));
const layoutPath = path.join(PUBLIC, 'layout.css');
const missingClassesLayout = checkClasses(requiredInLayout, layoutPath, 'layout.css');
const missingClasses = missingClassesComponents + missingClassesLayout;

// --- 3. Плейсхолдеры в шаблонах ---
console.log('\n' + '─'.repeat(60));
console.log('📦 Проверка плейсхолдеров в views/\n');

const placeholderChecks = [
  {
    file: 'admin-user-add.html',
    expected: ['id="username"', 'id="email"', 'id="full_name"', 'id="department"',
               'id="phone"', 'id="role"', 'id="submitBtn"', 'id="passwordModal"',
               'id="tempPasswordValue"', 'id="passwordUsername"',
               'id="addUserForm"', 'class="modal-overlay"', 'class="modal"',
               'class="modal-header"', 'class="modal-actions"'],
  },
  {
    file: 'admin-user-edit.html',
    expected: ['id="userId"', 'id="currentRole"', 'id="username"', 'id="email"',
               'id="full_name"', 'id="department"', 'id="phone"', 'id="role"',
               'id="submitBtn"', 'id="editUserForm"', '{{id}}', '{{role}}',
               '{{username}}', '{{email}}'],
  },
  {
    file: 'admin-add.html',
    expected: ['id="addForm"', 'id="inventory_number"', 'id="model_id"',
               'id="serial_number"', 'id="warehouseId"', 'id="zoneId"',
               'id="rackId"', 'id="cellId"', 'id="submitBtn"',
               'class="form-actions"', 'class="card"',
               '{{model_options}}'],
  },
  {
    file: 'admin-edit.html',
    expected: ['id="equipmentId"', 'id="currentStatus"', 'id="currentModelId"',
               'id="currentCellId"', 'id="currentWorkplaceId"',
               'id="statusWarning"', 'id="statusInfo"', 'id="assignSection"',
               'id="warehouseBlock"', 'id="workplaceBlock"', 'id="workplaceId"',
               'name="locationType"',
               'id="model_id"', 'id="submitBtn"',
               '{{status_options}}', '{{user_options}}',
               '{{model_options}}', '{{selected_model_id}}',
               '{{info_model_name}}', '{{info_corporate_id}}', '{{info_manufacturer}}',
               '{{workplace_id}}'],
  },
  
  {
    file: 'admin-warehouses.html',
    expected: ['id="warehouseModal"', 'id="warehouseForm"', 'id="warehouseId"',
               'id="warehouseName"', 'id="warehousesList"', 'id="deleteModal"',
               'id="activeGroup"', 'onclick="openWarehouseModal()"',
               'onsubmit="saveWarehouse(event)"',
               'class="stats-grid"', 'class="warehouses-grid"',
               'class="page-header"', 'class="page-actions"',
               '{{total_warehouses}}', '{{total_zones}}', '{{total_racks}}',
               '{{total_cells}}', '{{equipment_on_stock}}'],
  },

  {
    file: 'equipment.html',
    expected: [
              'id="filterCategory"', 'id="filterType"', 'id="filterWarehouse"',
              'id="filterWorkplace"',
              'id="filterStatus"', 'id="equipmentTableBody"',
              'id="viewEquipmentModal"', 'id="viewEquipmentBody"',
              '{{category_options}}', '{{type_options}}',           // 🆕
              '{{warehouse_options}}',
              '{{workplace_options}}',
              '{{status_options}}',                                 // 🆕
              '{{search_value}}',                                   // 🆕
              '{{equipment_rows}}',
              '{{pagination}}',                                     // 🆕
              '{{placed_equipment}}',
              '{{unplaced_equipment}}',
              'onchange="applyFilters()"',
              'onclick="resetFilters()"',
              'onclick="filterUnplaced()"',                         // 🆕
    ],
  },
  {
    file: 'admin-warehouse-details.html',
    expected: ['id="pageData"', 'id="warehouseSubtitle"', 'id="warehouseBadges"',
               'id="warehouseDescription"', 'id="warehouseTree"',
               'id="zoneModal"', 'id="rackModal"', 'id="cellModal"',
               'id="cellViewModal"', 'id="cellViewBody"', 'id="deleteModal"',
               'data-warehouse-id', 'data-warehouse-name',
               'onclick="editWarehouseInfo()"', 'onclick="openZoneModal()"',
               'onclick="expandAll()"', 'onclick="collapseAll()"',
               'class="warehouse-info-panel"', 'class="tree-section"',
               'view-user-modal',
               '{{warehouse.id}}', '{{warehouse.name}}', '{{warehouse.description}}'],
  },
  {
    file: 'admin-workplaces.html',
    expected: [
              'id="officeModal"', 'id="officeForm"', 'id="officeId"',
              'id="officeName"', 'id="officesList"', 'id="deleteModal"',
              'id="activeGroup"',
              'onclick="openOfficeModal()"',
              'onsubmit="saveOffice(event)"',
              'class="stats-grid"', 'class="offices-grid"',
              'class="page-header"', 'class="page-actions"',
              '{{total_offices}}', '{{total_rooms}}', '{{total_workplaces}}',
              '{{equipment_on_workplaces}}', '{{equipment_unassigned}}',
    ],
  },
  {
    file: 'admin-workplace-details.html',
    expected: [
              'id="pageData"', 'data-office-id', 'data-office-name',
              'id="officeSubtitle"', 'id="officeBadges"', 'id="officeDescription"',
              'id="officeTree"',
              'id="roomModal"', 'id="workplaceModal"', 'id="workplaceViewModal"',
              'id="deleteModal"', 'id="deleteWarning"', 'id="deleteWarningText"',
              'onclick="editOfficeInfo()"', 'onclick="openRoomModal()"',
              'onclick="expandAll()"', 'onclick="collapseAll()"',
              'onclick="loadOfficeTree()"',
              'onsubmit="saveRoom(event)"', 'onsubmit="saveWorkplace(event)"',
              'class="office-info-panel"', 'class="tree-section"',
              'view-user-modal',
              '{{office.id}}', '{{office.name}}', '{{office.description}}',
              'id="workplaceViewBody"',
    ],
  },
  {
    file: 'admin-models.html',
    expected: [        
    ],
  },
];

let totalPlaceholderIssues = 0;
for (const check of placeholderChecks) {
  const result = checkPlaceholders(check.file, check.expected);
  if (result.reason) {
    console.log(`⚠️  ${result.file} — ${result.reason}`);
  } else if (result.missing.length === 0) {
    console.log(`✅ ${result.file} — все плейсхолдеры на месте (${check.expected.length})`);
  } else {
    console.log(`❌ ${result.file} — отсутствуют (${result.missing.length}):`);
    result.missing.forEach(p => console.log(`     ${p}`));
    totalPlaceholderIssues += result.missing.length;
  }
}

// --- 3b. Автопроверка всех плейсхолдеров ---
const autoPlaceholderIssues = checkAllPlaceholders();
totalPlaceholderIssues += autoPlaceholderIssues;

// ------------------------------------------------------------
// ИТОГ
// ------------------------------------------------------------
console.log('\n' + '─'.repeat(60));
console.log('📊 ИТОГ\n');

const totalIssues = missingVars + missingClasses + totalPlaceholderIssues;

if (totalIssues === 0) {
  console.log('✅ Все проверки пройдены. Можно коммитить.\n');
  process.exit(0);
} else {
  console.log(`❌ Найдено проблем: ${totalIssues}`);
  console.log(`   • Переменные theme.css:       ${missingVars}`);
  console.log(`   • Классы components.css:      ${missingClasses}`);
  console.log(`   • Плейсхолдеры в views/:      ${totalPlaceholderIssues}`);
  console.log('\nПоправь и запусти снова.\n');
  process.exit(1);
}