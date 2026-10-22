// database/modules/warehouses/crud.js
// CRUD: склады / зоны / стеллажи / ячейки.

const { buildWarehouseScope } = require('./scope');

module.exports = ({ db }) => ({
  // ============================================================
  // СКЛАДЫ
  // ============================================================

  getAllWarehouses(scope = {}) {
    const s = buildWarehouseScope(scope);
    const where = s.clause ? `WHERE ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          w.id, w.name, w.address, w.description, w.is_default, w.is_active,
          w.created_at, w.updated_at,
          (SELECT COUNT(*) FROM zones WHERE warehouse_id = w.id AND is_active = 1) as zones_count,
          (SELECT COUNT(*) FROM racks r JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND r.is_active = 1) as racks_count,
          (SELECT COUNT(*) FROM cells c JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND c.is_active = 1) as cells_count,
          (SELECT COUNT(*) FROM equipment e JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id) as equipment_count
        FROM warehouses w
        ${where}
        ORDER BY w.is_default DESC, w.name ASC
      `, s.params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },

  getWarehouseById(id, scope = {}) {
    const s = buildWarehouseScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT w.*,
          (SELECT COUNT(*) FROM zones WHERE warehouse_id = w.id) as zones_count,
          (SELECT COUNT(*) FROM equipment e JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id) as equipment_count
        FROM warehouses w
        WHERE w.id = ? ${extraWhere}
      `, [id, ...s.params], (err, row) => err ? reject(err) : resolve(row));
    });
  },

  getDefaultWarehouse() {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM warehouses WHERE is_default = 1 AND is_active = 1 LIMIT 1`,
        (err, row) => err ? reject(err) : resolve(row));
    });
  },

  createWarehouse(data) {
    return new Promise((resolve, reject) => {
      const { name, address, description, is_default } = data;
      const doInsert = () => {
        db.run(`INSERT INTO warehouses (name, address, description, is_default, is_active)
                VALUES (?, ?, ?, ?, 1)`,
          [name, address || null, description || null, is_default ? 1 : 0],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, ...data });
          });
      };
      if (is_default) {
        db.run('UPDATE warehouses SET is_default = 0', (err) => {
          if (err) reject(err);
          else doInsert();
        });
      } else {
        doInsert();
      }
    });
  },

  updateWarehouse(id, data) {
    return new Promise((resolve, reject) => {
      const { name, address, description, is_default, is_active } = data;
      const doUpdate = () => {
        db.run(`UPDATE warehouses
                SET name = ?, address = ?, description = ?,
                    is_default = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          [name, address || null, description || null, is_default ? 1 : 0,
           is_active !== undefined ? (is_active ? 1 : 0) : 1, id],
          function(err) {
            if (err) reject(err);
            else if (this.changes === 0) reject(new Error('Склад не найден'));
            else resolve({ id, ...data });
          });
      };
      if (is_default) {
        db.run('UPDATE warehouses SET is_default = 0 WHERE id != ?', [id], (err) => {
          if (err) reject(err);
          else doUpdate();
        });
      } else {
        doUpdate();
      }
    });
  },

  deleteWarehouse(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT is_default FROM warehouses WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Склад не найден'));
        if (row.is_default) return reject(new Error('Нельзя удалить склад по умолчанию. Сначала назначьте другой.'));

        db.get('SELECT COUNT(*) as count FROM zones WHERE warehouse_id = ?', [id], (err, zonesRow) => {
          if (err) return reject(err);
          if (zonesRow.count > 0) {
            return reject(new Error(`Нельзя удалить склад: в нём ${zonesRow.count} зон. Сначала удалите зоны.`));
          }
          db.run('DELETE FROM warehouses WHERE id = ?', [id], function(err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes });
          });
        });
      });
    });
  },

  setDefaultWarehouse(id) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('UPDATE warehouses SET is_default = 0', (err) => {
          if (err) { db.run('ROLLBACK'); return reject(err); }
          db.run('UPDATE warehouses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id], function(err) {
            if (err) { db.run('ROLLBACK'); return reject(err); }
            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve({ updated: this.changes });
            });
          });
        });
      });
    });
  },

  // ============================================================
  // ЗОНЫ
  // ============================================================

  getZonesByWarehouse(warehouseId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT z.id, z.warehouse_id, z.name, z.description, z.sort_order, z.is_active,
          z.created_at, z.updated_at,
          (SELECT COUNT(*) FROM racks WHERE zone_id = z.id AND is_active = 1) as racks_count,
          (SELECT COUNT(*) FROM equipment e JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id WHERE r.zone_id = z.id) as equipment_count
        FROM zones z
        WHERE z.warehouse_id = ?
        ORDER BY z.sort_order ASC, z.name ASC
      `, [warehouseId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },

  getAllZones() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT z.*, w.name as warehouse_name
              FROM zones z JOIN warehouses w ON z.warehouse_id = w.id
              ORDER BY w.name ASC, z.sort_order ASC, z.name ASC`,
        (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },

  getZoneById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT z.*, w.name as warehouse_name
              FROM zones z JOIN warehouses w ON z.warehouse_id = w.id
              WHERE z.id = ?`,
        [id], (err, row) => err ? reject(err) : resolve(row));
    });
  },

  createZone(data) {
    return new Promise((resolve, reject) => {
      const { warehouse_id, name, description, sort_order } = data;
      db.get('SELECT id FROM warehouses WHERE id = ?', [warehouse_id], (err, wh) => {
        if (err) return reject(err);
        if (!wh) return reject(new Error('Склад не найден'));
        db.run(`INSERT INTO zones (warehouse_id, name, description, sort_order, is_active)
                VALUES (?, ?, ?, ?, 1)`,
          [warehouse_id, name, description || null, sort_order || 0],
          function(err) {
            if (err) {
              if (err.message.includes('UNIQUE')) reject(new Error('Зона с таким названием уже есть в этом складе'));
              else reject(err);
            } else {
              resolve({ id: this.lastID, ...data });
            }
          });
      });
    });
  },

  updateZone(id, data) {
    return new Promise((resolve, reject) => {
      const { name, description, sort_order, is_active } = data;
      db.run(`UPDATE zones
              SET name = ?, description = ?, sort_order = ?,
                  is_active = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        [name, description || null, sort_order || 0,
         is_active !== undefined ? (is_active ? 1 : 0) : 1, id],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) reject(new Error('Зона с таким названием уже есть'));
            else reject(err);
          } else if (this.changes === 0) {
            reject(new Error('Зона не найдена'));
          } else {
            resolve({ id, ...data });
          }
        });
    });
  },

  deleteZone(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM racks WHERE zone_id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (row.count > 0) {
          return reject(new Error(`Нельзя удалить зону: в ней ${row.count} стеллажей. Сначала удалите стеллажи.`));
        }
        db.run('DELETE FROM zones WHERE id = ?', [id], function(err) {
          if (err) reject(err);
          else resolve({ deleted: this.changes });
        });
      });
    });
  },

  // ============================================================
  // СТЕЛЛАЖИ
  // ============================================================

  getRacksByZone(zoneId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT r.id, r.zone_id, r.name, r.description, r.sort_order, r.is_active,
          r.created_at, r.updated_at,
          (SELECT COUNT(*) FROM cells WHERE rack_id = r.id AND is_active = 1) as cells_count,
          (SELECT COUNT(*) FROM equipment e JOIN cells c ON e.cell_id = c.id
            WHERE c.rack_id = r.id) as equipment_count
        FROM racks r
        WHERE r.zone_id = ?
        ORDER BY r.sort_order ASC, r.name ASC
      `, [zoneId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },

  getRackById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT r.*, z.name as zone_name, z.warehouse_id, w.name as warehouse_name
              FROM racks r JOIN zones z ON r.zone_id = z.id
              JOIN warehouses w ON z.warehouse_id = w.id
              WHERE r.id = ?`,
        [id], (err, row) => err ? reject(err) : resolve(row));
    });
  },

  createRack(data) {
    return new Promise((resolve, reject) => {
      const { zone_id, name, description, sort_order } = data;
      db.get('SELECT id FROM zones WHERE id = ?', [zone_id], (err, zone) => {
        if (err) return reject(err);
        if (!zone) return reject(new Error('Зона не найдена'));
        db.run(`INSERT INTO racks (zone_id, name, description, sort_order, is_active)
                VALUES (?, ?, ?, ?, 1)`,
          [zone_id, name, description || null, sort_order || 0],
          function(err) {
            if (err) {
              if (err.message.includes('UNIQUE')) reject(new Error('Стеллаж с таким названием уже есть в этой зоне'));
              else reject(err);
            } else {
              resolve({ id: this.lastID, ...data });
            }
          });
      });
    });
  },

  updateRack(id, data) {
    return new Promise((resolve, reject) => {
      const { name, description, sort_order, is_active } = data;
      db.run(`UPDATE racks
              SET name = ?, description = ?, sort_order = ?,
                  is_active = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        [name, description || null, sort_order || 0,
         is_active !== undefined ? (is_active ? 1 : 0) : 1, id],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) reject(new Error('Стеллаж с таким названием уже есть'));
            else reject(err);
          } else if (this.changes === 0) {
            reject(new Error('Стеллаж не найден'));
          } else {
            resolve({ id, ...data });
          }
        });
    });
  },

  deleteRack(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM cells WHERE rack_id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (row.count > 0) {
          return reject(new Error(`Нельзя удалить стеллаж: в нём ${row.count} ячеек. Сначала удалите ячейки.`));
        }
        db.run('DELETE FROM racks WHERE id = ?', [id], function(err) {
          if (err) reject(err);
          else resolve({ deleted: this.changes });
        });
      });
    });
  },

  // ============================================================
  // ЯЧЕЙКИ
  // ============================================================

  getCellsByRack(rackId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT c.id, c.rack_id, c.name, c.code, c.capacity, c.is_full, c.description,
          c.sort_order, c.is_active, c.created_at, c.updated_at,
          (SELECT COUNT(*) FROM equipment WHERE cell_id = c.id) as equipment_count
        FROM cells c
        WHERE c.rack_id = ?
        ORDER BY c.sort_order ASC, c.name ASC
      `, [rackId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },

  getCellById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT c.*, r.name as rack_name, r.zone_id,
                z.name as zone_name, z.warehouse_id, w.name as warehouse_name
              FROM cells c JOIN racks r ON c.rack_id = r.id
              JOIN zones z ON r.zone_id = z.id
              JOIN warehouses w ON z.warehouse_id = w.id
              WHERE c.id = ?`,
        [id], (err, row) => err ? reject(err) : resolve(row));
    });
  },

  createCell(data) {
    return new Promise((resolve, reject) => {
      const { rack_id, name, code, capacity, description, sort_order, is_full } = data;
      db.get('SELECT id FROM racks WHERE id = ?', [rack_id], (err, rack) => {
        if (err) return reject(err);
        if (!rack) return reject(new Error('Стеллаж не найден'));
        db.run(`INSERT INTO cells (rack_id, name, code, capacity, description, sort_order, is_full, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [rack_id, name, code || null, capacity || null, description || null,
           sort_order || 0, is_full ? 1 : 0],
          function(err) {
            if (err) {
              if (err.message.includes('UNIQUE')) reject(new Error('Ячейка с таким названием уже есть в этом стеллаже'));
              else reject(err);
            } else {
              resolve({ id: this.lastID, ...data });
            }
          });
      });
    });
  },

  updateCell(id, data) {
    return new Promise((resolve, reject) => {
      const { name, code, capacity, description, sort_order, is_active, is_full } = data;
      db.run(`UPDATE cells
              SET name = ?, code = ?, capacity = ?, description = ?,
                  sort_order = ?, is_full = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        [name, code || null, capacity || null, description || null, sort_order || 0,
         is_full ? 1 : 0, is_active !== undefined ? (is_active ? 1 : 0) : 1, id],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) reject(new Error('Ячейка с таким названием уже есть'));
            else reject(err);
          } else if (this.changes === 0) {
            reject(new Error('Ячейка не найдена'));
          } else {
            resolve({ id, ...data });
          }
        });
    });
  },

  deleteCell(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM equipment WHERE cell_id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (row.count > 0) {
          return reject(new Error(`Нельзя удалить ячейку: в ней ${row.count} единиц техники.`));
        }
        db.run('DELETE FROM cells WHERE id = ?', [id], function(err) {
          if (err) reject(err);
          else resolve({ deleted: this.changes });
        });
      });
    });
  },

  getCellFullPath(cellId) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT w.name as warehouse_name, z.name as zone_name, r.name as rack_name,
                c.name as cell_name, c.code
              FROM cells c JOIN racks r ON c.rack_id = r.id
              JOIN zones z ON r.zone_id = z.id
              JOIN warehouses w ON z.warehouse_id = w.id
              WHERE c.id = ?`,
        [cellId], (err, row) => err ? reject(err) : resolve(row));
    });
  },
});