// database/modules/warehouses.js
// Работа со складами: иерархия Склад → Зона → Стеллаж → Ячейка

// ============================================================
// ХЕЛПЕР: SQL-фрагмент scope для роли mol (Этап 4)
// ============================================================
// Возвращает { clause: string, params: any[] }.
// Для admin/supervisor/undefined — clause пустой, params пустой.
// Для mol — фильтр «склады, за которые он ответственный»:
//   w.id IN (SELECT warehouse_id FROM warehouse_responsibles
//            WHERE user_id = ?)
// Для user — заведомо ложное условие (списки для роли user закрыты).
function buildWarehouseScope(scope = {}) {
  const { userId, role } = scope;
  if (!userId || !role) return { clause: '', params: [] };
  if (role === 'admin' || role === 'supervisor') return { clause: '', params: [] };
  if (role === 'mol') {
    return {
      clause: `w.id IN (SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ?)`,
      params: [userId]
    };
  }
  // user и любые другие — пусто
  return { clause: '1=0', params: [] };
}

module.exports = ({ db, run, get, all }) => ({

  // ============================================================
  // СКЛАДЫ (warehouses)
  // ============================================================

  /**
   * Получить все склады с количеством зон, стеллажей, ячеек и техники
   */
  getAllWarehouses(scope = {}) {
    const s = buildWarehouseScope(scope);
    const where = s.clause ? `WHERE ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          w.id,
          w.name,
          w.address,
          w.description,
          w.is_default,
          w.is_active,
          w.created_at,
          w.updated_at,
          (SELECT COUNT(*) FROM zones WHERE warehouse_id = w.id AND is_active = 1) as zones_count,
          (SELECT COUNT(*) FROM racks r 
            JOIN zones z ON r.zone_id = z.id 
            WHERE z.warehouse_id = w.id AND r.is_active = 1
          ) as racks_count,
          (SELECT COUNT(*) FROM cells c 
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND c.is_active = 1
          ) as cells_count,
          (SELECT COUNT(*) FROM equipment e 
            JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id
          ) as equipment_count
        FROM warehouses w
        ${where}
        ORDER BY w.is_default DESC, w.name ASC
      `, s.params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Получить склад по ID
   */
  getWarehouseById(id, scope = {}) {
    const s = buildWarehouseScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          w.*,
          (SELECT COUNT(*) FROM zones WHERE warehouse_id = w.id) as zones_count,
          (SELECT COUNT(*) FROM equipment e 
            JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id
          ) as equipment_count
        FROM warehouses w
        WHERE w.id = ? ${extraWhere}
      `, [id, ...s.params], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Получить склад по умолчанию
   */
  getDefaultWarehouse() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM warehouses 
        WHERE is_default = 1 AND is_active = 1
        LIMIT 1
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Создать склад
   */
  createWarehouse(data) {
    return new Promise((resolve, reject) => {
      const { name, address, description, is_default } = data;

      const doInsert = () => {
        db.run(`
          INSERT INTO warehouses (name, address, description, is_default, is_active)
          VALUES (?, ?, ?, ?, 1)
        `, [
          name,
          address || null,
          description || null,
          is_default ? 1 : 0
        ], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ id: this.lastID, ...data });
        });
      };

      // Если is_default = 1 — сбрасываем у других
      if (is_default) {
        db.run('UPDATE warehouses SET is_default = 0', (err) => {
          if (err) {
            reject(err);
            return;
          }
          doInsert();
        });
      } else {
        doInsert();
      }
    });
  },

  /**
   * Обновить склад
   */
  updateWarehouse(id, data) {
    return new Promise((resolve, reject) => {
      const { name, address, description, is_default, is_active } = data;

      const doUpdate = () => {
        db.run(`
          UPDATE warehouses 
          SET name = ?, address = ?, description = ?, 
              is_default = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          name,
          address || null,
          description || null,
          is_default ? 1 : 0,
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          id
        ], function(err) {
          if (err) {
            reject(err);
            return;
          }
          if (this.changes === 0) {
            reject(new Error('Склад не найден'));
            return;
          }
          resolve({ id, ...data });
        });
      };

      // Если is_default = 1 — сбрасываем у других
      if (is_default) {
        db.run('UPDATE warehouses SET is_default = 0 WHERE id != ?', [id], (err) => {
          if (err) {
            reject(err);
            return;
          }
          doUpdate();
        });
      } else {
        doUpdate();
      }
    });
  },

  /**
   * Удалить склад
   * Нельзя удалить, если есть зоны или это склад по умолчанию
   */
  deleteWarehouse(id) {
    return new Promise((resolve, reject) => {
      // Проверяем, не склад ли по умолчанию
      db.get('SELECT is_default FROM warehouses WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (!row) {
          reject(new Error('Склад не найден'));
          return;
        }
        if (row.is_default) {
          reject(new Error('Нельзя удалить склад по умолчанию. Сначала назначьте другой.'));
          return;
        }

        // Проверяем зоны
        db.get('SELECT COUNT(*) as count FROM zones WHERE warehouse_id = ?', [id], (err, zonesRow) => {
          if (err) {
            reject(err);
            return;
          }
          if (zonesRow.count > 0) {
            reject(new Error(`Нельзя удалить склад: в нём ${zonesRow.count} зон. Сначала удалите зоны.`));
            return;
          }

          db.run('DELETE FROM warehouses WHERE id = ?', [id], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve({ deleted: this.changes });
          });
        });
      });
    });
  },

  /**
   * Установить склад по умолчанию
   */
  setDefaultWarehouse(id) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run('UPDATE warehouses SET is_default = 0', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          db.run('UPDATE warehouses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id], function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            db.run('COMMIT', (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve({ updated: this.changes });
            });
          });
        });
      });
    });
  },

  // ============================================================
  // ЗОНЫ (zones)
  // ============================================================

  /**
   * Получить все зоны склада
   */
  getZonesByWarehouse(warehouseId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          z.id,
          z.warehouse_id,
          z.name,
          z.description,
          z.sort_order,
          z.is_active,
          z.created_at,
          z.updated_at,
          (SELECT COUNT(*) FROM racks WHERE zone_id = z.id AND is_active = 1) as racks_count,
          (SELECT COUNT(*) FROM equipment e 
            JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id
            WHERE r.zone_id = z.id
          ) as equipment_count
        FROM zones z
        WHERE z.warehouse_id = ?
        ORDER BY z.sort_order ASC, z.name ASC
      `, [warehouseId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Получить все зоны (всех складов)
   */
  getAllZones() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          z.*,
          w.name as warehouse_name
        FROM zones z
        JOIN warehouses w ON z.warehouse_id = w.id
        ORDER BY w.name ASC, z.sort_order ASC, z.name ASC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Получить зону по ID
   */
  getZoneById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          z.*,
          w.name as warehouse_name
        FROM zones z
        JOIN warehouses w ON z.warehouse_id = w.id
        WHERE z.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Создать зону
   */
  createZone(data) {
    return new Promise((resolve, reject) => {
      const { warehouse_id, name, description, sort_order } = data;

      // Проверяем склад
      db.get('SELECT id FROM warehouses WHERE id = ?', [warehouse_id], (err, wh) => {
        if (err) {
          reject(err);
          return;
        }
        if (!wh) {
          reject(new Error('Склад не найден'));
          return;
        }

        db.run(`
          INSERT INTO zones (warehouse_id, name, description, sort_order, is_active)
          VALUES (?, ?, ?, ?, 1)
        `, [warehouse_id, name, description || null, sort_order || 0], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              reject(new Error('Зона с таким названием уже есть в этом складе'));
            } else {
              reject(err);
            }
            return;
          }
          resolve({ id: this.lastID, ...data });
        });
      });
    });
  },

  /**
   * Обновить зону
   */
  updateZone(id, data) {
    return new Promise((resolve, reject) => {
      const { name, description, sort_order, is_active } = data;

      db.run(`
        UPDATE zones 
        SET name = ?, description = ?, sort_order = ?, 
            is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name,
        description || null,
        sort_order || 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
      ], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            reject(new Error('Зона с таким названием уже есть'));
          } else {
            reject(err);
          }
          return;
        }
        if (this.changes === 0) {
          reject(new Error('Зона не найдена'));
          return;
        }
        resolve({ id, ...data });
      });
    });
  },

  /**
   * Удалить зону
   */
  deleteZone(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM racks WHERE zone_id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row.count > 0) {
          reject(new Error(`Нельзя удалить зону: в ней ${row.count} стеллажей. Сначала удалите стеллажи.`));
          return;
        }

        db.run('DELETE FROM zones WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ deleted: this.changes });
        });
      });
    });
  },

  // ============================================================
  // СТЕЛЛАЖИ (racks)
  // ============================================================

  /**
   * Получить стеллажи зоны
   */
  getRacksByZone(zoneId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          r.id,
          r.zone_id,
          r.name,
          r.description,
          r.sort_order,
          r.is_active,
          r.created_at,
          r.updated_at,
          (SELECT COUNT(*) FROM cells WHERE rack_id = r.id AND is_active = 1) as cells_count,
          (SELECT COUNT(*) FROM equipment e 
            JOIN cells c ON e.cell_id = c.id
            WHERE c.rack_id = r.id
          ) as equipment_count
        FROM racks r
        WHERE r.zone_id = ?
        ORDER BY r.sort_order ASC, r.name ASC
      `, [zoneId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Получить стеллаж по ID
   */
  getRackById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          r.*,
          z.name as zone_name,
          z.warehouse_id,
          w.name as warehouse_name
        FROM racks r
        JOIN zones z ON r.zone_id = z.id
        JOIN warehouses w ON z.warehouse_id = w.id
        WHERE r.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Создать стеллаж
   */
  createRack(data) {
    return new Promise((resolve, reject) => {
      const { zone_id, name, description, sort_order } = data;

      // Проверяем зону
      db.get('SELECT id FROM zones WHERE id = ?', [zone_id], (err, zone) => {
        if (err) {
          reject(err);
          return;
        }
        if (!zone) {
          reject(new Error('Зона не найдена'));
          return;
        }

        db.run(`
          INSERT INTO racks (zone_id, name, description, sort_order, is_active)
          VALUES (?, ?, ?, ?, 1)
        `, [zone_id, name, description || null, sort_order || 0], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              reject(new Error('Стеллаж с таким названием уже есть в этой зоне'));
            } else {
              reject(err);
            }
            return;
          }
          resolve({ id: this.lastID, ...data });
        });
      });
    });
  },

  // Создать несколько стеллажей в зоне (транзакция)
  createRacksBatch(zoneId, baseName, description, quantity) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const created = [];
        let error = null;

        const stmt = db.prepare(`
          INSERT INTO racks (zone_id, name, description, sort_order, is_active)
          VALUES (?, ?, ?, ?, 1)
        `);

        for (let i = 1; i <= quantity; i++) {
          const name = `${baseName} ${i}`;
          stmt.run([zoneId, name, description || null, 0], function(err) {
            if (err && !error) {
              error = err;
            } else if (!err) {
              created.push({ id: this.lastID, name });
            }
          });
        }

        stmt.finalize((err) => {
          if (err || error) {
            db.run('ROLLBACK');
            reject(error || err);
          } else {
            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve(created);
            });
          }
        });
      });
    });
  },

  /**
   * Обновить стеллаж
   */
  updateRack(id, data) {
    return new Promise((resolve, reject) => {
      const { name, description, sort_order, is_active } = data;

      db.run(`
        UPDATE racks 
        SET name = ?, description = ?, sort_order = ?, 
            is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name,
        description || null,
        sort_order || 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
      ], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            reject(new Error('Стеллаж с таким названием уже есть'));
          } else {
            reject(err);
          }
          return;
        }
        if (this.changes === 0) {
          reject(new Error('Стеллаж не найден'));
          return;
        }
        resolve({ id, ...data });
      });
    });
  },

  /**
   * Удалить стеллаж
   */
  deleteRack(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM cells WHERE rack_id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row.count > 0) {
          reject(new Error(`Нельзя удалить стеллаж: в нём ${row.count} ячеек. Сначала удалите ячейки.`));
          return;
        }

        db.run('DELETE FROM racks WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ deleted: this.changes });
        });
      });
    });
  },

  // ============================================================
  // ЯЧЕЙКИ (cells)
  // ============================================================

  /**
   * Получить ячейки стеллажа
   */
  getCellsByRack(rackId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          c.id,
          c.rack_id,
          c.name,
          c.code,
          c.capacity,
          c.is_full,
          c.description,
          c.sort_order,
          c.is_active,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM equipment WHERE cell_id = c.id) as equipment_count
        FROM cells c
        WHERE c.rack_id = ?
        ORDER BY c.sort_order ASC, c.name ASC
      `, [rackId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Получить ячейку по ID
   */
  getCellById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          c.*,
          r.name as rack_name,
          r.zone_id,
          z.name as zone_name,
          z.warehouse_id,
          w.name as warehouse_name
        FROM cells c
        JOIN racks r ON c.rack_id = r.id
        JOIN zones z ON r.zone_id = z.id
        JOIN warehouses w ON z.warehouse_id = w.id
        WHERE c.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Создать ячейку
   */
  createCell(data) {
    return new Promise((resolve, reject) => {
      const { rack_id, name, code, capacity, description, sort_order, is_full } = data;

      // Проверяем стеллаж
      db.get('SELECT id FROM racks WHERE id = ?', [rack_id], (err, rack) => {
        if (err) {
          reject(err);
          return;
        }
        if (!rack) {
          reject(new Error('Стеллаж не найден'));
          return;
        }

        db.run(`
          INSERT INTO cells (rack_id, name, code, capacity, description, sort_order, is_full, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [rack_id, name, code || null, capacity || null, description || null, sort_order || 0, is_full ? 1 : 0], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              reject(new Error('Ячейка с таким названием уже есть в этом стеллаже'));
            } else {
              reject(err);
            }
            return;
          }
          resolve({ id: this.lastID, ...data });
        });
      });
    });
  },

  /**
   * Обновить ячейку
   */
  updateCell(id, data) {
    return new Promise((resolve, reject) => {
      const { name, code, capacity, description, sort_order, is_active, is_full } = data;

      db.run(`
        UPDATE cells 
        SET name = ?, code = ?, capacity = ?, description = ?, 
            sort_order = ?, is_full = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name,
        code || null,
        capacity || null,
        description || null,
        sort_order || 0,
        is_full ? 1 : 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
      ], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            reject(new Error('Ячейка с таким названием уже есть'));
          } else {
            reject(err);
          }
          return;
        }
        if (this.changes === 0) {
          reject(new Error('Ячейка не найдена'));
          return;
        }
        resolve({ id, ...data });
      });
    });
  },

  /**
   * Удалить ячейку
   * Нельзя удалить, если в ней техника
   */
  deleteCell(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM equipment WHERE cell_id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row.count > 0) {
          reject(new Error(`Нельзя удалить ячейку: в ней ${row.count} единиц техники.`));
          return;
        }

        db.run('DELETE FROM cells WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ deleted: this.changes });
        });
      });
    });
  },

  /**
   * Получить полный адрес ячейки (для отображения)
   */
  getCellFullPath(cellId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          w.name as warehouse_name,
          z.name as zone_name,
          r.name as rack_name,
          c.name as cell_name,
          c.code
        FROM cells c
        JOIN racks r ON c.rack_id = r.id
        JOIN zones z ON r.zone_id = z.id
        JOIN warehouses w ON z.warehouse_id = w.id
        WHERE c.id = ?
      `, [cellId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Получить дерево складов (склады → зоны → стеллажи → ячейки)
   */
  getWarehouseTree(warehouseId = null, scope = {}) {
    const s = buildWarehouseScope(scope);
    return new Promise((resolve, reject) => {
      const conditions = [];
      const params = [];
      if (warehouseId) {
        conditions.push('w.id = ?');
        params.push(warehouseId);
      }
      if (s.clause) {
        conditions.push(s.clause);
        params.push(...s.params);
      }
      const warehouseFilter = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      db.all(`
        SELECT 
          w.id as warehouse_id,
          w.name as warehouse_name,
          w.is_default,
          z.id as zone_id,
          z.name as zone_name,
          z.sort_order as zone_sort,
          r.id as rack_id,
          r.name as rack_name,
          r.description as rack_description, -- 🆕 Добавлено
          r.sort_order as rack_sort,
          c.id as cell_id,
          c.name as cell_name,
          c.code as cell_code,
          c.capacity as cell_capacity,
          c.is_full as cell_is_full,
          c.sort_order as cell_sort,
          (SELECT COUNT(*) FROM equipment WHERE cell_id = c.id) as equipment_count
        FROM warehouses w
        LEFT JOIN zones z ON z.warehouse_id = w.id AND z.is_active = 1
        LEFT JOIN racks r ON r.zone_id = z.id AND r.is_active = 1
        LEFT JOIN cells c ON c.rack_id = r.id AND c.is_active = 1
        ${warehouseFilter}
        ORDER BY w.name, z.sort_order, z.name, r.sort_order, r.name, c.sort_order, c.name
      `, params, (err, rows) => {
        if (err) { reject(err); return; }
        // ... группировка без изменений ...
        
        // Группируем в дерево
        const tree = {};
        (rows || []).forEach(row => {
          if (!tree[row.warehouse_id]) {
            tree[row.warehouse_id] = {
              id: row.warehouse_id,
              name: row.warehouse_name,
              is_default: row.is_default,
              zones: {}
            };
          }
          
          if (row.zone_id) {
            if (!tree[row.warehouse_id].zones[row.zone_id]) {
              tree[row.warehouse_id].zones[row.zone_id] = {
                id: row.zone_id,
                name: row.zone_name,
                racks: {}
              };
            }
            
            if (row.rack_id) {
              if (!tree[row.warehouse_id].zones[row.zone_id].racks[row.rack_id]) {
                tree[row.warehouse_id].zones[row.zone_id].racks[row.rack_id] = {
                  id: row.rack_id,
                  name: row.rack_name,
                  description: row.rack_description, // 🆕 Добавлено
                  cells: []
                };
              }
              
              if (row.cell_id) {
                tree[row.warehouse_id].zones[row.zone_id].racks[row.rack_id].cells.push({
                  id: row.cell_id,
                  name: row.cell_name,
                  code: row.cell_code,
                  capacity: row.cell_capacity,
                  is_full: row.cell_is_full,
                  equipment_count: row.equipment_count
                });
              }
            }
          }
        });
        
        // Преобразуем объекты в массивы
        const result = Object.values(tree).map(w => ({
          ...w,
          zones: Object.values(w.zones).map(z => ({
            ...z,
            racks: Object.values(z.racks)
          }))
        }));
        
        resolve(result);
      });
    });
  },

  /**
   * Получить всю технику в ячейке
   */
  getEquipmentInCell(cellId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          e.id,
          e.inventory_number,
          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          e.status,
          m.category_id  AS category_id,
          m.type_id      AS type_id,
          c.name as category_name,
          c.icon as category_icon,
          t.name as type_name,
          t.icon as type_icon
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        WHERE e.cell_id = ?
        ORDER BY e.inventory_number
      `, [cellId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },



  /**
   * Статистика по складам (с учётом scope).
   * Для mol — только его склады и техника в них.
   */
  getWarehouseStats(scope = {}) {
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;

    // Для mol — только его склады / техника.
    const molWh = isMol ? `w.id IN (SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ${uid})` : '1=1';
    const molEq = isMol ? `e.responsible_user_id = ${uid}` : '1=1';

    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM warehouses w WHERE w.is_active = 1 AND ${molWh}) as total_warehouses,
          (SELECT COUNT(*) FROM zones z
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE z.is_active = 1 AND ${molWh}) as total_zones,
          (SELECT COUNT(*) FROM racks r
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE r.is_active = 1 AND ${molWh}) as total_racks,
          (SELECT COUNT(*) FROM cells c
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE c.is_active = 1 AND ${molWh}) as total_cells,
          (SELECT COUNT(*) FROM equipment e
            JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE ${molWh} AND ${molEq}) as equipment_on_stock,
          (SELECT COUNT(*) FROM equipment e
            WHERE e.cell_id IS NULL AND e.status = 'available' AND ${molEq}) as equipment_without_cell
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  
  // ============================================================
  // ИНВЕНТАРИЗАЦИЯ
  // ============================================================
  
  /**
   * Сводка по всем складам для страницы инвентаризации
   * Возвращает: список складов с полной статистикой
   */
  getInventorySummary(scope = {}) {
    const s = buildWarehouseScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          w.id,
          w.name,
          w.address,
          w.is_default,
          w.is_active,
          (SELECT COUNT(*) FROM zones z WHERE z.warehouse_id = w.id AND z.is_active = 1) as zones_count,
          (SELECT COUNT(*) FROM racks r 
            JOIN zones z ON r.zone_id = z.id 
            WHERE z.warehouse_id = w.id AND r.is_active = 1
          ) as racks_count,
          (SELECT COUNT(*) FROM cells c 
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND c.is_active = 1
          ) as cells_count,
          (SELECT COUNT(*) FROM equipment e 
            JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id
          ) as equipment_count,
          (SELECT COALESCE(SUM(c.capacity), 0) FROM cells c 
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND c.is_active = 1 AND c.is_full = 0
          ) as total_capacity,
          (SELECT COUNT(*) FROM cells c 
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND c.is_active = 1 AND c.is_full = 1
          ) as cells_full
        FROM warehouses w
        WHERE w.is_active = 1 ${extraWhere}
        ORDER BY w.is_default DESC, w.name ASC
      `, s.params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Считаем процент заполнения
        const result = (rows || []).map(w => ({
          ...w,
          fill_percent: w.total_capacity > 0 
            ? Math.round((w.equipment_count / w.total_capacity) * 100)
            : (w.cells_count > 0 ? Math.round((w.equipment_count / w.cells_count) * 100) : 0)
        }));
        
        resolve(result);
      });
    });
  },
  
  /**
   * Полный список техники на складе (для инвентаризации)
   */
  getWarehouseInventory(warehouseId, scope = {}) {
    const s = buildWarehouseScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          e.id,
          e.inventory_number,
          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          e.serial_number,
          e.status,
          e.purchase_date,
          e.warranty_until,
          m.category_id  AS category_id,
          m.type_id      AS type_id,
          c.name as category_name,
          c.icon as category_icon,
          t.name as type_name,
          t.icon as type_icon,
          cell.id as cell_id,
          cell.name as cell_name,
          cell.code as cell_code,
          rack.name as rack_name,
          zone.name as zone_name
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        JOIN cells cell ON e.cell_id = cell.id
        JOIN racks rack ON cell.rack_id = rack.id
        JOIN zones zone ON rack.zone_id = zone.id
        JOIN warehouses w ON zone.warehouse_id = w.id
        WHERE zone.warehouse_id = ? ${extraWhere}
        ORDER BY zone.sort_order, zone.name, rack.sort_order, rack.name, cell.sort_order, cell.name
      `, [warehouseId, ...s.params], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  },
  
  /**
   * Заполненность ячеек склада
   * Возвращает: список ячеек с процентом заполнения
   */
  getCellOccupancy(warehouseId, scope = {}) {
    const s = buildWarehouseScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          c.id,
          c.name,
          c.code,
          c.capacity,
          c.is_full,
          (SELECT COUNT(*) FROM equipment e WHERE e.cell_id = c.id) as current_count,
          rack.name as rack_name,
          zone.name as zone_name
        FROM cells c
        JOIN racks rack ON c.rack_id = rack.id
        JOIN zones zone ON rack.zone_id = zone.id
        JOIN warehouses w ON zone.warehouse_id = w.id
        WHERE zone.warehouse_id = ? AND c.is_active = 1 ${extraWhere}
        ORDER BY zone.sort_order, zone.name, rack.sort_order, rack.name, c.sort_order, c.name
      `, [warehouseId, ...s.params], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Процент заполнения: is_full → 100%, capacity → пропорция, иначе 0/100
        const result = (rows || []).map(c => {
          let percent = 0;
          if (c.is_full === 1) {
            percent = 100;
          } else if (c.capacity > 0) {
            percent = Math.round((c.current_count / c.capacity) * 100);
          } else {
            percent = c.current_count > 0 ? 100 : 0;
          }
          return { ...c, percent };
        });
        
        resolve(result);
      });
    });
  },
  
  /**
   * Общая статистика инвентаризации (с учётом scope).
   */
  getInventoryTotals(scope = {}) {
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;

    const molWh = isMol ? `w.id IN (SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ${uid})` : '1=1';
    const molEq = isMol ? `e.responsible_user_id = ${uid}` : '1=1';

    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM warehouses w WHERE w.is_active = 1 AND ${molWh}) as total_warehouses,
          (SELECT COUNT(*) FROM zones z
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE z.is_active = 1 AND ${molWh}) as total_zones,
          (SELECT COUNT(*) FROM racks r
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE r.is_active = 1 AND ${molWh}) as total_racks,
          (SELECT COUNT(*) FROM cells c
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE c.is_active = 1 AND ${molWh}) as total_cells,
          (SELECT COUNT(*) FROM equipment e
            WHERE e.cell_id IS NOT NULL AND ${molEq}) as equipment_on_stock,
          (SELECT COUNT(*) FROM equipment e
            WHERE e.status = 'available' AND e.cell_id IS NULL AND ${molEq}) as available_without_cell,
          (SELECT COUNT(*) FROM equipment e
            WHERE e.status = 'assigned' AND ${molEq}) as equipment_assigned,
          (SELECT COALESCE(SUM(c.capacity), 0) FROM cells c
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE c.is_active = 1 AND c.is_full = 0 AND ${molWh}) as total_capacity,
          (SELECT COUNT(*) FROM cells c
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE c.is_active = 1 AND c.is_full = 1 AND ${molWh}) as cells_full
      `, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row || {});
      });
    });
  },

  // ============================================================
  // ВИРТУАЛЬНЫЕ СКЛАДЫ: maintenance / retired (2.11.14)
  // ============================================================

  /**
   * Сводка по «виртуальным складам»:
   *   - maintenance — техника в ремонте
   *   - retired     — списанная техника
   *
   * Техника в этих статусах может физически лежать в ячейках
   * обычных складов (cell_id), но не может быть на рабочем месте.
   *
   * Для mol — только его экземпляры и его склады.
   */
  getSpecialStatusSummary(scope = {}) {
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molEq = isMol ? ` AND e.responsible_user_id = ${uid}` : '';
    const molWh = isMol ? `AND w.id IN (SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ${uid})` : '';

    return new Promise((resolve, reject) => {
      const statuses = ['maintenance', 'retired'];
      const result = {};

      let pending = statuses.length;

      const finishOne = () => {
        pending -= 1;
        if (pending === 0) resolve(result);
      };

      statuses.forEach(status => {
        // 1) Общее + с ячейкой / без (с учётом scope)
        db.get(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN e.cell_id IS NOT NULL THEN 1 ELSE 0 END) AS with_cell,
            SUM(CASE WHEN e.cell_id IS NULL     THEN 1 ELSE 0 END) AS without_cell
          FROM equipment e
          WHERE e.status = ?${molEq}
        `, [status], (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          const bucket = {
            total: row?.total || 0,
            with_cell: row?.with_cell || 0,
            without_cell: row?.without_cell || 0,
            by_warehouse: [],
          };

          // 2) Разбивка по складам (с учётом scope)
          db.all(`
            SELECT
              w.id   AS warehouse_id,
              w.name AS warehouse_name,
              COUNT(*) AS count
            FROM equipment e
            JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE e.status = ?${molEq} ${molWh}
            GROUP BY w.id, w.name
            ORDER BY count DESC, w.name ASC
          `, [status], (err2, rows) => {
            if (err2) {
              reject(err2);
              return;
            }
            bucket.by_warehouse = rows || [];
            result[status] = bucket;
            finishOne();
          });
        });
      });
    });
  },

    // ============================================================
  // 🆕 МАССОВОЕ СОЗДАНИЕ СТЕЛЛАЖЕЙ (5.0.1.2)
  // ============================================================

  /**
   * Создать несколько стеллажей в зоне (транзакция).
   * Названия: "{baseName} 1", "{baseName} 2", ...
   */
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

  // ============================================================
  // 🆕 МАССОВОЕ СОЗДАНИЕ ЯЧЕЕК (5.0.1.3)
  // ============================================================

  /**
   * Создать несколько ячеек в стеллаже (транзакция).
   * Коды: "{rackCode}-01", "{rackCode}-02", ...
   */
  createCellsBatch(rackId, rackName, count, capacity) {
    return new Promise((resolve, reject) => {
      // Код стеллажа — последний токен в названии
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