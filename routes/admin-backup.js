const path = require('path');
const fs = require('fs');
const { db } = require('../database/db');
const { logAction } = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'database.db');

async function downloadBackupAPI(req, res) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tmpName = `database.backup-${ts}.db`;
    const tmpPath = path.join(DATA_DIR, tmpName);

    try {
        // Консистентная копия (SQLite .backup())
        await new Promise((resolve, reject) => {
            db.backup(tmpPath, (err) => err ? reject(err) : resolve());
        });

        // Логируем
        logAction(req.session.userId, req.session.userName, 'system_backup', 'system', null, {
            filename: tmpName,
            size: fs.statSync(tmpPath).size,
        });

        // Отдаём как скачивание
        const downloadName = `moveit-backup-${ts}.db`;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Content-Length', fs.statSync(tmpPath).size);

        const stream = fs.createReadStream(tmpPath);
        stream.pipe(res);

        stream.on('end', () => {
            // Удаляем временный файл
            fs.unlink(tmpPath, (e) => { if (e) console.warn('unlink:', e); });
        });
        stream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Ошибка скачивания' });
        });
    } catch (error) {
        console.error('❌ Backup error:', error);
        // Чистим tmp
        fs.unlink(tmpPath, () => {});
        if (!res.headersSent) res.status(500).json({ error: 'Не удалось создать бэкап' });
    }
}

module.exports = { downloadBackupAPI };