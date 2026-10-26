// routes/settings/api.js
// 5.11.5: бэкап базы данных.
// 5.11.5-fix2: db.backup() на Windows создаёт 0-байтные файлы (баг sqlite3).
//              Используем VACUUM INTO (SQLite 3.27+) — консистентно, кроссплатформенно.

const path = require('path');
const fs = require('fs');
const { db } = require('../../database/db');
const { logAction } = require('../../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const MAX_BACKUPS = 30;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function rotateBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('moveit-backup-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const toDelete = files.slice(MAX_BACKUPS);
    toDelete.forEach(f => {
      fs.unlink(path.join(BACKUP_DIR, f.name), (e) => {
        if (e) console.warn('⚠️ rotate unlink:', e.message);
      });
    });
  } catch (e) {
    console.warn('⚠️ rotateBackups error:', e.message);
  }
}

/**
 * Консистентная копия БД через VACUUM INTO (SQLite 3.27+).
 * Путь экранируется ('' → '), параметры не поддерживаются.
 */
function vacuumInto(filePath) {
  return new Promise((resolve, reject) => {
    const safePath = filePath.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${safePath}'`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * GET /api/admin/backup/download
 * VACUUM INTO → data/backups/ → res.download().
 * Файл остаётся в data/backups/ (архив), ротация — последние 30.
 */
async function downloadBackupAPI(req, res) {
  ensureBackupDir();

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `moveit-backup-${ts}.db`;
  const filePath = path.join(BACKUP_DIR, fileName);

  try {
    // Консистентная копия — VACUUM INTO
    await vacuumInto(filePath);

    // Проверка, что файл реально записан
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      throw new Error('Бэкап создан, но файл пустой (VACUUM INTO не сработал)');
    }

    // Логируем
    try {
      await logAction({
        req,
        action: 'system_backup',
        entityType: 'system',
        entityId: null,
        details: JSON.stringify({ filename: fileName, size: stat.size }),
      });
    } catch (logErr) {
      console.warn('⚠️ Не удалось залогировать бэкап:', logErr.message);
    }

    // Ротация (в фоне)
    setImmediate(() => rotateBackups());

    // Отдаём файл (он остаётся в data/backups/)
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('❌ res.download error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Ошибка скачивания бэкапа' });
        }
      }
    });
  } catch (error) {
    console.error('❌ Backup error:', error);
    // Удаляем битый / пустой файл (handle не держится после VACUUM INTO)
    fs.unlink(filePath, (e) => {
      if (e && e.code !== 'ENOENT') console.warn('⚠️ unlink failed backup:', e.message);
    });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Не удалось создать бэкап базы' });
    }
  }
}

module.exports = { downloadBackupAPI };