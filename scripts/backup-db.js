#!/usr/bin/env node
// scripts/backup-db.js
// Резервное копирование базы данных MoveIT service.
//
// Использование:
//   node scripts/backup-db.js                     — обычный бэкап в data/backups/
//   node scripts/backup-db.js --out D:\backups    — в кастомную папку
//   node scripts/backup-db.js --keep 30           — хранить 30 последних (по умолчанию 14)
//   node scripts/backup-db.js --compress          — gzip (по умолчанию без сжатия)
//   node scripts/backup-db.js --silent            — без консольного вывода
//
// Что делает:
//   1. Проверяет, что data/database.db существует.
//   2. Делает консистентный снимок через sqlite3 .backup (а не fs.copyFile),
//      чтобы не поймать «полу-записанное» состояние при работающем сервере.
//   3. Складывает в data/backups/database-YYYY-MM-DD_HH-mm-ss.db[.gz]
//   4. Чистит старые бэкапы (оставляет --keep последних).
//   5. Пишет короткий лог в консоль и (опционально) в data/backups/backup.log.

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ============================================================
// АРГУМЕНТЫ
// ============================================================

const args = process.argv.slice(2);
const getArg = (name, def = null) => {
  const idx = args.indexOf(name);
  if (idx === -1) return def;
  return args[idx + 1] || def;
};
const hasFlag = (name) => args.includes(name);

const CUSTOM_OUT = getArg('--out', null);
const KEEP = parseInt(getArg('--keep', '14'), 10) || 14;
const COMPRESS = hasFlag('--compress');
const SILENT = hasFlag('--silent');

// ============================================================
// ПУТИ
// ============================================================

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'database.db');
const BACKUP_DIR = CUSTOM_OUT
  ? path.resolve(CUSTOM_OUT)
  : path.join(ROOT, 'data', 'backups');
const LOG_PATH = path.join(BACKUP_DIR, 'backup.log');

// ============================================================
// ЛОГИРОВАНИЕ
// ============================================================

function log(msg) {
  if (!SILENT) console.log(msg);
}

function appendLog(line) {
  try {
    const stamp = new Date().toISOString();
    fs.appendFileSync(LOG_PATH, `[${stamp}] ${line}\n`, 'utf8');
  } catch {
    // лог не критичен
  }
}

// ============================================================
// УТИЛИТЫ
// ============================================================

function formatDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' +
    pad(d.getMonth() + 1) + '-' +
    pad(d.getDate()) + '_' +
    pad(d.getHours()) + '-' +
    pad(d.getMinutes()) + '-' +
    pad(d.getSeconds())
  );
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// ============================================================
// СНИМОК ЧЕРЕЗ sqlite3 .backup (безопасно при работающем сервере)
// ============================================================

function backupDatabase() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DB_PATH)) {
      return reject(new Error(`Файл БД не найден: ${DB_PATH}`));
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      log(`📁 Создана папка бэкапов: ${BACKUP_DIR}`);
    }

    const stamp = formatDate(new Date());
    const baseName = `database-${stamp}.db`;
    const targetPath = path.join(BACKUP_DIR, baseName);

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);

      // Явный пошаговый API: backup.step → backup.finish → db.close
      // Это гарантирует, что к моменту close() бэкап завершён.
      const backup = db.backup(targetPath);

      backup.step(-1, (stepErr) => {
        if (stepErr) {
          // Пытаемся корректно закрыть, даже если бэкап упал
          try { backup.finish(() => {}); } catch {}
          db.close(() => {});
          return reject(stepErr);
        }

        backup.finish((finishErr) => {
          if (finishErr) {
            db.close(() => {});
            return reject(finishErr);
          }

          // Бэкап завершён и зафинализирован — теперь безопасно закрывать
          db.close((closeErr) => {
            if (closeErr) return reject(closeErr);

            const size = fs.statSync(targetPath).size;
            log(`✅ Бэкап создан: ${targetPath}`);
            log(`   📦 Размер: ${humanSize(size)}`);

            resolve({ path: targetPath, size, stamp });
          });
        });
      });
    });
  });
}

// ============================================================
// СЖАТИЕ (опционально)
// ============================================================

function compressFile(inputPath) {
  return new Promise((resolve, reject) => {
    const gzPath = inputPath + '.gz';
    const src = fs.createReadStream(inputPath);
    const dst = fs.createWriteStream(gzPath);
    const gz = zlib.createGzip({ level: 9 });

    src.pipe(gz).pipe(dst);

    src.on('error', reject);
    gz.on('error', reject);
    dst.on('error', reject);
    dst.on('finish', () => {
      // Удаляем исходник после успешного сжатия
      fs.unlinkSync(inputPath);
      const size = fs.statSync(gzPath).size;
      resolve({ path: gzPath, size });
    });
  });
}

// ============================================================
// ОЧИСТКА СТАРЫХ БЭКАПОВ
// ============================================================

function cleanupOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return { deleted: 0, kept: 0 };

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => /^database-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db(\.gz)?$/.test(f))
    .map((f) => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime); // новые сверху

  const toDelete = files.slice(KEEP);
  toDelete.forEach((f) => {
    try {
      fs.unlinkSync(f.path);
    } catch {
      // тихо
    }
  });

  return { deleted: toDelete.length, kept: Math.min(files.length, KEEP) };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const start = Date.now();

  log('═══════════════════════════════════════════════');
  log('💾 БЭКАП БАЗЫ ДАННЫХ MoveIT service');
  log('═══════════════════════════════════════════════');
  log(`   📂 Источник:   ${DB_PATH}`);
  log(`   📁 Назначение: ${BACKUP_DIR}`);
  log(`   🗂️  Хранить:    ${KEEP} последних`);
  log(`   🗜️  Сжатие:     ${COMPRESS ? 'да (gzip)' : 'нет'}`);
  log('');

  let result = { path: null, size: 0 };
  try {
    const backup = await backupDatabase();
    result.path = backup.path;
    result.size = backup.size;

    if (COMPRESS) {
      log('🗜️  Сжатие...');
      const compressed = await compressFile(backup.path);
      result.path = compressed.path;
      result.size = compressed.size;
      log(`✅ Сжато: ${result.path}`);
      log(`   📦 Размер: ${humanSize(compressed.size)}`);
    }

    log('');
    const cleanup = cleanupOldBackups();
    if (cleanup.deleted > 0) {
      log(`🧹 Удалено старых бэкапов: ${cleanup.deleted} (оставлено ${cleanup.kept})`);
    } else {
      log(`🧹 Старых бэкапов не было — оставлено ${cleanup.kept}`);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    log('');
    log(`✅ Готово за ${elapsed} с.`);
    log('═══════════════════════════════════════════════');

    appendLog(`OK path=${result.path} size=${result.size} keep=${KEEP} compress=${COMPRESS}`);

    // Возвращаем для использования в скриптах
    process.exitCode = 0;
  } catch (error) {
    console.error('');
    console.error('❌ ОШИБКА БЭКАПА:', error.message);
    console.error(error.stack);
    appendLog(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}

main();