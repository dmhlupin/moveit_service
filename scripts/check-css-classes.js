// scripts/check-css-classes.js
// ============================================================
// Проверка «потери» CSS-классов при удалении файла.
//
// Использование:
//   node scripts/check-css-classes.js public/css/manage.css
//   npm run check-css-classes -- public/css/manage.css
//
// Что делает:
//   1. Читает указанный CSS-файл (source).
//   2. Извлекает из него все классы (.class-name).
//   3. Рекурсивно читает все остальные CSS-файлы в public/css/**/*.css
//      (кроме source).
//   4. Проверяет, есть ли каждый класс из source хотя бы в одном
//      другом файле.
//   5. Выводит список «потерянных» классов (которые есть только
//      в source).
//   6. Завершается с exit code 1, если потери есть.
// ============================================================

const fs = require('fs');
const path = require('path');

// ============================================================
// АРГУМЕНТЫ
// ============================================================

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Укажите путь к CSS-файлу для проверки.');
  console.error('   Пример: node scripts/check-css-classes.js public/css/manage.css');
  process.exit(1);
}

const sourceFile = path.resolve(args[0]);

if (!fs.existsSync(sourceFile)) {
  console.error(`❌ Файл не найден: ${sourceFile}`);
  process.exit(1);
}

if (!sourceFile.endsWith('.css')) {
  console.error(`❌ Указанный файл не является CSS: ${sourceFile}`);
  process.exit(1);
}

// ============================================================
// ИЗВЛЕЧЕНИЕ КЛАССОВ ИЗ CSS
// ============================================================

/**
 * Извлекает все классы из CSS-текста.
 * Ищет селекторы вида .class-name (буквы, цифры, дефисы, подчеркивания).
 * Игнорирует комментарии и строки в @media / @keyframes.
 *
 * @param {string} cssText
 * @returns {Set<string>}
 */
function extractClasses(cssText) {
  const classes = new Set();

  // Убираем комментарии /* ... */
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

  // Ищем все .class-name
  // \.[a-zA-Z_][a-zA-Z0-9_-]* — точка + буква/подчеркивание + остальное
  const regex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  let match;
  while ((match = regex.exec(withoutComments)) !== null) {
    const className = match[1];

    // Пропускаем числа (например, .5rem — не класс, а значение)
    // и псевдоклассы (уже отфильтрованы, т.к. начинаются с :)
    // Пропускаем служебные (например, .0 — из float: 0.5)
    if (/^\d/.test(className)) continue;

    classes.add(className);
  }

  return classes;
}

// ============================================================
// РЕКУРСИВНЫЙ ОБХОД CSS-ФАЙЛОВ
// ============================================================

/**
 * Рекурсивно собирает все .css-файлы в директории.
 * @param {string} dir
 * @returns {string[]}
 */
function findCssFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...findCssFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      result.push(fullPath);
    }
  }
  return result;
}

// ============================================================
// ОСНОВНАЯ ЛОГИКА
// ============================================================

function main() {
  console.log('🔍 Проверка CSS-классов');
  console.log('   Исходный файл:', path.relative(process.cwd(), sourceFile));
  console.log('');

  // 1. Читаем source
  const sourceCss = fs.readFileSync(sourceFile, 'utf8');
  const sourceClasses = extractClasses(sourceCss);
  console.log(`   Классов в исходном файле: ${sourceClasses.size}`);
  console.log('');

  // 2. Собираем все остальные CSS
  const cssRoot = path.join(__dirname, '..', 'public', 'css');
  const allCssFiles = findCssFiles(cssRoot).filter(f => f !== sourceFile);

  console.log(`   Других CSS-файлов для проверки: ${allCssFiles.length}`);
  console.log('');

  // 3. Собираем классы из всех остальных файлов
  const otherClasses = new Set();
  for (const file of allCssFiles) {
    const css = fs.readFileSync(file, 'utf8');
    const classes = extractClasses(css);
    for (const cls of classes) {
      otherClasses.add(cls);
    }
  }
  console.log(`   Уникальных классов в остальных файлах: ${otherClasses.size}`);
  console.log('');

  // 4. Ищем потерянные классы
  const lost = [];
  for (const cls of sourceClasses) {
    if (!otherClasses.has(cls)) {
      lost.push(cls);
    }
  }

  // 5. Вывод результата
  if (lost.length === 0) {
    console.log('✅ Все классы из исходного файла есть и в других CSS-файлах.');
    console.log('   Потерь при удалении не будет.');
    process.exit(0);
  }

  console.log(`❌ Найдены классы, которые есть ТОЛЬКО в исходном файле (${lost.length}):`);
  console.log('   При удалении файла они «потеряются» — стили перестанут применяться.');
  console.log('');
  lost.sort().forEach(cls => {
    console.log(`   .${cls}`);
  });
  console.log('');
  console.log('💡 Добавьте эти классы в другой CSS-файл (или удалите из HTML/JS, если они не нужны).');
  process.exit(1);
}

main();