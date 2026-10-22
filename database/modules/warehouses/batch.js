// database/modules/warehouses/batch.js
// Массовое создание стеллажей / ячеек (5.0.1).

module.exports = ({ db }) => ({
  createRacksBatch(zoneId, baseName, description, quantity) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const created = [];
        let error = null;

        const stmt = db.prepare(`
          INSERT INTO racks (zone_id, name, description, sort_order, is_active)
          VALUES (?, ?, ?, 0, 1)
        `);

        for (let i = 1; i <= quantity; i++) {
          const name = `${baseName} ${i}`;
          stmt.run([zoneId, name, description || null], function(err) {
            if (err && !error) error = err;
            else if (!err) created.push({ id: this.lastID, name });
          });
        }

        stmt.finalize((err) => {
          if (err || error) {
            db.run('ROLLBACK');
            reject(error || err);
          } else {
            db.run('COMMIT', (commitErr) => {
              if (commitErr) reject(commitErr);
              else resolve(created);
            });
          }
        });
      });
    });
  },

  createCellsBatch(rackId, rackName, count, capacity) {
    return new Promise((resolve, reject) => {
      let rackCode = '';
      if (rackName) {
        const parts = rackName.trim().split(/\s+/);
        rackCode = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const created = [];
        let error = null;

        const stmt = db.prepare(`
          INSERT INTO cells (rack_id, name, code, capacity, description, sort_order, is_full, is_active)
          VALUES (?, ?, ?, ?, NULL, 0, 0, 1)
        `);

        for (let i = 1; i <= count; i++) {
          const name = `Ячейка ${i}`;
          const code = rackCode ? `${rackCode}-${String(i).padStart(2, '0')}` : null;
          stmt.run([rackId, name, code, capacity || null], function(err) {
            if (err && !error) error = err;
            else if (!err) created.push({ id: this.lastID, name, code });
          });
        }

        stmt.finalize((err) => {
          if (err || error) {
            db.run('ROLLBACK');
            reject(error || err);
          } else {
            db.run('COMMIT', (commitErr) => {
              if (commitErr) reject(commitErr);
              else resolve(created);
            });
          }
        });
      });
    });
  },
});