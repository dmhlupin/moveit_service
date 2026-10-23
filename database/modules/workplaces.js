// database/modules/workplaces.js
// Работа с рабочими местами: иерархия Офис → Кабинет → Рабочее место

// ============================================================
// ХЕЛПЕР: SQL-фрагмент scope для роли mol (Этап 4)
// ============================================================
// Аналог buildWarehouseScope, но для офисов:
//   o.id IN (SELECT office_id FROM office_responsibles
//            WHERE user_id = ?)
function buildOfficeScope(scope = {}) {
  const { userId, role } = scope;
  if (!userId || !role) return { clause: '', params: [] };
  if (role === 'admin' || role === 'supervisor') return { clause: '', params: [] };
  if (role === 'mol') {
    return {
      clause: `o.id IN (SELECT office_id FROM office_responsibles WHERE user_id = ?)`,
      params: [userId]
    };
  }
  return { clause: '1=0', params: [] };
}

module.exports = ({ db, run, get, all }) => ({

  // ============================================================
  // ОФИСЫ (offices)
  // ============================================================

  /**
   * Получить все офисы с количеством кабинетов, рабочих мест и техники
   */
  getAllOffices(scope = {}) {
    const s = buildOfficeScope(scope);
    const where = s.clause ? `WHERE ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          o.id,
          o.name,
          o.address,
          o.description,
          o.is_default,
          o.is_active,
          o.created_at,
          o.updated_at,
          (SELECT COUNT(*) FROM rooms WHERE office_id = o.id AND is_active = 1) as rooms_count,
          (SELECT COUNT(*) FROM workplaces w
            JOIN rooms r ON w.room_id = r.id
            WHERE r.office_id = o.id AND w.is_active = 1
          ) as workplaces_count,
          (SELECT COUNT(*) FROM equipment e
            JOIN workplaces w ON e.workplace_id = w.id
            JOIN rooms r ON w.room_id = r.id
            WHERE r.office_id = o.id
          ) as equipment_count
        FROM offices o
        ${where}
        ORDER BY o.is_default DESC, o.name ASC
      `, s.params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Получить офис по ID
   */
  getOfficeById(id, scope = {}) {
    const s = buildOfficeScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT
          o.*,
          (SELECT COUNT(*) FROM rooms WHERE office_id = o.id) as rooms_count,
          (SELECT COUNT(*) FROM equipment e
            JOIN workplaces w ON e.workplace_id = w.id
            JOIN rooms r ON w.room_id = r.id
            WHERE r.office_id = o.id
          ) as equipment_count
        FROM offices o
        WHERE o.id = ? ${extraWhere}
      `, [id, ...s.params], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Получить офис по умолчанию
   */
  getDefaultOffice() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM offices
        WHERE is_default = 1 AND is_active = 1
        LIMIT 1
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Создать офис
   */
  createOffice(data) {
    return new Promise((resolve, reject) => {
      const { name, address, description, is_default } = data;

      const doInsert = () => {
        db.run(`
          INSERT INTO offices (name, address, description, is_default, is_active)
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
        db.run('UPDATE offices SET is_default = 0', (err) => {
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
   * Обновить офис
   */
  updateOffice(id, data) {
    return new Promise((resolve, reject) => {
      const { name, address, description, is_default, is_active } = data;

      const doUpdate = () => {
        db.run(`
          UPDATE offices
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
            reject(new Error('Офис не найден'));
            return;
          }
          resolve({ id, ...data });
        });
      };

      // Если is_default = 1 — сбрасываем у других
      if (is_default) {
        db.run('UPDATE offices SET is_default = 0 WHERE id != ?', [id], (err) => {
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
   * Удалить офис
   * Нельзя удалить, если есть кабинеты или это офис по умолчанию
   */
  deleteOffice(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT is_default FROM offices WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (!row) {
          reject(new Error('Офис не найден'));
          return;
        }
        if (row.is_default) {
          reject(new Error('Нельзя удалить офис по умолчанию. Сначала назначьте другой.'));
          return;
        }

        db.get('SELECT COUNT(*) as count FROM rooms WHERE office_id = ?', [id], (err, roomsRow) => {
          if (err) {
            reject(err);
            return;
          }
          if (roomsRow.count > 0) {
            reject(new Error(`Нельзя удалить офис: в нём ${roomsRow.count} кабинетов. Сначала удалите кабинеты.`));
            return;
          }

          db.run('DELETE FROM offices WHERE id = ?', [id], function(err) {
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
   * Установить офис по умолчанию
   */
  setDefaultOffice(id) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run('UPDATE offices SET is_default = 0', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }

          db.run('UPDATE offices SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id], function(err) {
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
  // КАБИНЕТЫ (rooms)
  // ============================================================

  /**
   * Получить кабинеты офиса
   */
  getRoomsByOffice(officeId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          r.id,
          r.office_id,
          r.name,
          r.description,
          r.sort_order,
          r.is_active,
          r.created_at,
          r.updated_at,
          (SELECT COUNT(*) FROM workplaces WHERE room_id = r.id AND is_active = 1) as workplaces_count,
          (SELECT COUNT(*) FROM equipment e
            JOIN workplaces w ON e.workplace_id = w.id
            WHERE w.room_id = r.id
          ) as equipment_count
        FROM rooms r
        WHERE r.office_id = ?
        ORDER BY r.sort_order ASC, r.name ASC
      `, [officeId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Получить кабинет по ID (с адресом офиса)
   */
  getRoomById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT
          r.*,
          o.name as office_name,
          o.address as office_address
        FROM rooms r
        JOIN offices o ON r.office_id = o.id
        WHERE r.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Создать кабинет
   */
  createRoom(data) {
    return new Promise((resolve, reject) => {
      const { office_id, name, description, sort_order } = data;

      // Проверяем офис
      db.get('SELECT id FROM offices WHERE id = ?', [office_id], (err, office) => {
        if (err) {
          reject(err);
          return;
        }
        if (!office) {
          reject(new Error('Офис не найден'));
          return;
        }

        db.run(`
          INSERT INTO rooms (office_id, name, description, sort_order, is_active)
          VALUES (?, ?, ?, ?, 1)
        `, [office_id, name, description || null, sort_order || 0], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              reject(new Error('Кабинет с таким названием уже есть в этом офисе'));
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
   * Обновить кабинет
   */
  updateRoom(id, data) {
    return new Promise((resolve, reject) => {
      const { name, description, sort_order, is_active } = data;

      db.run(`
        UPDATE rooms
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
            reject(new Error('Кабинет с таким названием уже есть'));
          } else {
            reject(err);
          }
          return;
        }
        if (this.changes === 0) {
          reject(new Error('Кабинет не найден'));
          return;
        }
        resolve({ id, ...data });
      });
    });
  },

  /**
   * Удалить кабинет
   * Нельзя удалить, если в нём есть рабочие места
   */
  deleteRoom(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM workplaces WHERE room_id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row.count > 0) {
          reject(new Error(`Нельзя удалить кабинет: в нём ${row.count} рабочих мест. Сначала удалите рабочие места.`));
          return;
        }

        db.run('DELETE FROM rooms WHERE id = ?', [id], function(err) {
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
  // РАБОЧИЕ МЕСТА (workplaces)
  // ============================================================

  /**
   * Получить рабочие места кабинета
   */
  getWorkplacesByRoom(roomId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          w.id,
          w.room_id,
          w.name,
          w.code,
          w.description,
          w.sort_order,
          w.is_active,
          w.created_at,
          w.updated_at,
          (SELECT COUNT(*) FROM equipment WHERE workplace_id = w.id) as equipment_count
        FROM workplaces w
        WHERE w.room_id = ?
        ORDER BY w.sort_order ASC, w.name ASC
      `, [roomId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Получить рабочее место по ID (с полным адресом офис → кабинет)
   */
  getWorkplaceById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT
          w.*,
          r.name as room_name,
          r.office_id,
          o.name as office_name,
          o.address as office_address,
          (SELECT COUNT(*) FROM equipment WHERE workplace_id = w.id) as equipment_count
        FROM workplaces w
        JOIN rooms r ON w.room_id = r.id
        JOIN offices o ON r.office_id = o.id
        WHERE w.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Создать рабочее место
   */
  createWorkplace(data) {
    return new Promise((resolve, reject) => {
      const { room_id, name, code, description, sort_order } = data;

      // Проверяем кабинет
      db.get('SELECT id FROM rooms WHERE id = ?', [room_id], (err, room) => {
        if (err) {
          reject(err);
          return;
        }
        if (!room) {
          reject(new Error('Кабинет не найден'));
          return;
        }

        db.run(`
          INSERT INTO workplaces (room_id, name, code, description, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `, [
          room_id,
          name,
          code || null,
          description || null,
          sort_order || 0
        ], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              reject(new Error('Рабочее место с таким названием уже есть в этом кабинете'));
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
   * Обновить рабочее место
   */
  updateWorkplace(id, data) {
    return new Promise((resolve, reject) => {
      const { name, code, description, sort_order, is_active } = data;

      db.run(`
        UPDATE workplaces
        SET name = ?, code = ?, description = ?,
            sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name,
        code || null,
        description || null,
        sort_order || 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
      ], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            reject(new Error('Рабочее место с таким названием уже есть'));
          } else {
            reject(err);
          }
          return;
        }
        if (this.changes === 0) {
          reject(new Error('Рабочее место не найдено'));
          return;
        }
        resolve({ id, ...data });
      });
    });
  },

  /**
   * Удалить рабочее место
   * Нельзя удалить, если на нём есть техника
   */
  deleteWorkplace(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM equipment WHERE workplace_id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row.count > 0) {
          reject(new Error(`Нельзя удалить рабочее место: на нём ${row.count} единиц техники. Сначала переместите технику.`));
          return;
        }

        db.run('DELETE FROM workplaces WHERE id = ?', [id], function(err) {
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
  // ДЕРЕВО И АГРЕГАТЫ
  // ============================================================

  /**
   * Получить дерево одного офиса: офис → кабинеты → рабочие места
   * Техника НЕ включается (только счётчики equipment_count)
   */
    getOfficeTree(officeId, scope = {}) {
    const s = buildOfficeScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          o.id as office_id,
          o.name as office_name,
          o.address as office_address,
          o.is_default,
          r.id as room_id,
          r.name as room_name,
          r.description as room_description,
          r.sort_order as room_sort,
          w.id as workplace_id,
          w.name as workplace_name,
          w.code as workplace_code,
          w.description as workplace_description,   -- 🆕
          w.sort_order as workplace_sort,
          (SELECT COUNT(*) FROM equipment WHERE workplace_id = w.id) as equipment_count
        FROM offices o
        LEFT JOIN rooms r ON r.office_id = o.id AND r.is_active = 1
        LEFT JOIN workplaces w ON w.room_id = r.id AND w.is_active = 1
        WHERE o.id = ? ${extraWhere}
        ORDER BY r.sort_order, r.name, w.sort_order, w.name
      `, [officeId, ...s.params], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        if (!rows || rows.length === 0) {
          resolve(null);
          return;
        }

        // Группируем в дерево
        const office = {
          id: rows[0].office_id,
          name: rows[0].office_name,
          address: rows[0].office_address,
          is_default: rows[0].is_default,
          rooms: {}
        };

        rows.forEach(row => {
          if (row.room_id) {
            if (!office.rooms[row.room_id]) {
              office.rooms[row.room_id] = {
                id: row.room_id,
                name: row.room_name,
                description: row.room_description,
                sort_order: row.room_sort,
                workplaces: []
              };
            }

            if (row.workplace_id) {
              office.rooms[row.room_id].workplaces.push({
                id: row.workplace_id,
                name: row.workplace_name,
                code: row.workplace_code,
                description: row.workplace_description,   // 🆕
                sort_order: row.workplace_sort,
                equipment_count: row.equipment_count
              });
            }
          }
        });

        // Объекты → массивы
        resolve({
          ...office,
          rooms: Object.values(office.rooms)
        });
      });
    });
  },

  /**
   * Получить дерево всех офисов (для общей страницы)
   */
  getFullWorkplaceTree(scope = {}) {
    const s = buildOfficeScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          o.id as office_id,
          o.name as office_name,
          o.address as office_address,
          o.is_default,
          r.id as room_id,
          r.name as room_name,
          r.sort_order as room_sort,
          w.id as workplace_id,
          w.name as workplace_name,
          w.code as workplace_code,
          w.description as workplace_description,   -- 🆕
          w.sort_order as workplace_sort,
          (SELECT COUNT(*) FROM equipment WHERE workplace_id = w.id) as equipment_count
        FROM offices o
        LEFT JOIN rooms r ON r.office_id = o.id AND r.is_active = 1
        LEFT JOIN workplaces w ON w.room_id = r.id AND w.is_active = 1
        WHERE o.is_active = 1 ${extraWhere}
        ORDER BY o.is_default DESC, o.name, r.sort_order, r.name, w.sort_order, w.name
      `, s.params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const tree = {};

        (rows || []).forEach(row => {
          if (!tree[row.office_id]) {
            tree[row.office_id] = {
              id: row.office_id,
              name: row.office_name,
              address: row.office_address,
              is_default: row.is_default,
              rooms: {}
            };
          }

          if (row.room_id) {
            if (!tree[row.office_id].rooms[row.room_id]) {
              tree[row.office_id].rooms[row.room_id] = {
                id: row.room_id,
                name: row.room_name,
                sort_order: row.room_sort,
                workplaces: []
              };
            }

            if (row.workplace_id) {
              tree[row.office_id].rooms[row.room_id].workplaces.push({
                id: row.workplace_id,
                name: row.workplace_name,
                code: row.workplace_code,
                description: row.workplace_description,   // 🆕
                equipment_count: row.equipment_count
              });
            }
          }
        });

        resolve(Object.values(tree).map(o => ({
          ...o,
          rooms: Object.values(o.rooms)
        })));
      });
    });
  },
  
  // ============================================================
  // ТЕХНИКА НА РАБОЧЕМ МЕСТЕ
  // ============================================================

  /**
   * Получить всю технику на рабочем месте
   * 5.9.0(a): scope — МОЛ видит только технику в своих офисах.
   */
  getWorkplaceEquipment(workplaceId, scope = {}) {
    const s = buildOfficeScope(scope);
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
          t.icon as type_icon
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        JOIN workplaces w ON e.workplace_id = w.id
        JOIN rooms r ON w.room_id = r.id
        JOIN offices o ON r.office_id = o.id
        WHERE e.workplace_id = ? ${extraWhere}
        ORDER BY c.sort_order, t.sort_order, e.inventory_number
      `, [workplaceId, ...s.params], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Переместить технику на рабочее место
   * При этом обнуляется cell_id (техника «или на складе, или на рабочем месте»)
   */
  moveEquipmentToWorkplace(equipmentId, workplaceId) {
    return new Promise((resolve, reject) => {
      // Проверяем технику
      db.get(`
        SELECT
          e.id,
          e.inventory_number,
          m.name AS model_name,
          e.cell_id,
          e.workplace_id
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        WHERE e.id = ?
      `, [equipmentId], (err, eq) => {
        if (err) {
          reject(err);
          return;
        }
        if (!eq) {
          reject(new Error('Техника не найдена'));
          return;
        }

        // Проверяем рабочее место (если указано)
        const checkWorkplace = (callback) => {
          if (!workplaceId) {
            callback(null);
            return;
          }
          db.get('SELECT id FROM workplaces WHERE id = ?', [workplaceId], (err, wp) => {
            if (err) {
              reject(err);
              return;
            }
            if (!wp) {
              reject(new Error('Рабочее место не найдено'));
              return;
            }
            callback(wp);
          });
        };

        checkWorkplace(() => {
          db.run(`
            UPDATE equipment
            SET workplace_id = ?,
                cell_id = NULL,
                status = CASE WHEN status IN ('available', 'placed') THEN 'placed' ELSE status END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [workplaceId, equipmentId], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve({
              updated: this.changes,
              old_workplace_id: eq.workplace_id,
              new_workplace_id: workplaceId,
              old_cell_id: eq.cell_id,
              model_name: eq.model_name,
              inventory_number: eq.inventory_number,   // 🆕
            });
          });
        });
      });
    });
  },

  // ============================================================
  // СТАТИСТИКА
  // ============================================================

  /**
   * Общая статистика по рабочим местам
   * 5.9.0(a): scope — для МОЛа считаем только его офисы и его технику.
   */
  getWorkplaceStats(scope = {}) {
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;

    const molOffice = isMol
      ? `AND o.id IN (SELECT office_id FROM office_responsibles WHERE user_id = ${uid})`
      : '';
    const molRoom = isMol
      ? `AND r.office_id IN (SELECT office_id FROM office_responsibles WHERE user_id = ${uid})`
      : '';
    const molWp = isMol
      ? `AND r.office_id IN (SELECT office_id FROM office_responsibles WHERE user_id = ${uid})`
      : '';
    const molEq = isMol ? `AND e.responsible_user_id = ${uid}` : '';

    return new Promise((resolve, reject) => {
      db.get(`
        SELECT
          (SELECT COUNT(*) FROM offices o
            WHERE o.is_active = 1 ${molOffice}) as total_offices,
          (SELECT COUNT(*) FROM rooms r
            JOIN offices o ON r.office_id = o.id
            WHERE r.is_active = 1 AND o.is_active = 1 ${molRoom}) as total_rooms,
          (SELECT COUNT(*) FROM workplaces w
            JOIN rooms r ON w.room_id = r.id
            JOIN offices o ON r.office_id = o.id
            WHERE w.is_active = 1 AND r.is_active = 1 AND o.is_active = 1 ${molWp}) as total_workplaces,
          (SELECT COUNT(*) FROM equipment e
            WHERE e.workplace_id IS NOT NULL ${molEq}) as equipment_on_workplaces,
          (SELECT COUNT(*) FROM equipment e
            WHERE e.workplace_id IS NULL AND e.cell_id IS NULL AND e.status = 'available' ${molEq}) as equipment_unassigned,
          (SELECT COUNT(*) FROM equipment e
            WHERE e.workplace_id IS NULL AND e.cell_id IS NOT NULL ${molEq}) as equipment_on_stock
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  },

  /**
   * Сводка по всем офисам (для страницы /admin/workplaces и инвентаризации)
   * 5.9.3: scope-для МОЛа — только его офисы и его техника.
   */
  getWorkplaceSummary(scope = {}) {
    const s = buildOfficeScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';

    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molEq = isMol ? `AND e.responsible_user_id = ${uid}` : '';

    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          o.id,
          o.name,
          o.address,
          o.is_default,
          o.is_active,
          (SELECT COUNT(*) FROM rooms r
            WHERE r.office_id = o.id AND r.is_active = 1) as rooms_count,
          (SELECT COUNT(*) FROM workplaces w
            JOIN rooms r ON w.room_id = r.id
            WHERE r.office_id = o.id AND w.is_active = 1) as workplaces_count,
          (SELECT COUNT(*) FROM equipment e
            JOIN workplaces w ON e.workplace_id = w.id
            JOIN rooms r ON w.room_id = r.id
            WHERE r.office_id = o.id ${molEq}) as equipment_count
        FROM offices o
        WHERE o.is_active = 1 ${extraWhere}
        ORDER BY o.is_default DESC, o.name ASC
      `, s.params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const result = (rows || []).map(o => ({
          ...o,
          fill_percent: o.workplaces_count > 0
            ? Math.round((o.equipment_count / o.workplaces_count) * 100)
            : 0,
        }));

        resolve(result);
      });
    });
  },

  /**
   * Техника в офисе (для инвентаризации рабочих мест)
   * 5.9.4a: scope — для МОЛа только его техника (responsible_user_id).
   */
  getOfficeEquipment(officeId, scope = {}) {
    const s = buildOfficeScope(scope);
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molEq = isMol ? `AND e.responsible_user_id = ${uid}` : '';
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
          ru.full_name AS responsible_user_name,
          e.purchase_date,
          e.warranty_until,
          m.category_id  AS category_id,
          m.type_id      AS type_id,
          c.name as category_name,
          c.icon as category_icon,
          t.name as type_name,
          t.icon as type_icon,
          w.id as workplace_id,
          w.name as workplace_name,
          w.code as workplace_code,
          r.name as room_name,
          o.name as office_name
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        JOIN workplaces w ON e.workplace_id = w.id
        JOIN rooms r ON w.room_id = r.id
        JOIN offices o ON r.office_id = o.id
        LEFT JOIN users ru ON ru.id = e.responsible_user_id
        WHERE r.office_id = ? ${molEq} ${extraWhere}
        ORDER BY r.sort_order, r.name, w.sort_order, w.name, c.sort_order, t.sort_order
      `, [officeId, ...s.params], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  },

  /**
   * Заполненность рабочих мест офиса
   * Возвращает: список мест с процентом заполнения
   */
  getWorkplaceOccupancy(officeId, scope = {}) {
    const s = buildOfficeScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molEq = isMol ? `AND e.responsible_user_id = ${uid}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          w.id,
          w.name,
          w.code,
          (SELECT COUNT(*) FROM equipment e WHERE e.workplace_id = w.id ${molEq}) as current_count,
          r.name as room_name,
          o.name as office_name
        FROM workplaces w
        JOIN rooms r ON w.room_id = r.id
        JOIN offices o ON r.office_id = o.id
        WHERE r.office_id = ? AND w.is_active = 1 ${extraWhere}
        ORDER BY r.sort_order, r.name, w.sort_order, w.name
      `, [officeId, ...s.params], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        // Без capacity — «заполнено» = есть ли хоть что-то
        const result = (rows || []).map(w => ({
          ...w,
          percent: w.current_count > 0 ? 100 : 0
        }));

        resolve(result);
      });
    });
  },

    /**
   * 🆕 5.0.2.1: Получить следующий номер рабочего места в кабинете.
   * Возвращает { next_name, next_code, current_count }.
   */
  getNextWorkplaceNumber(roomId) {
    return new Promise((resolve, reject) => {
      // Получаем кабинет
      db.get('SELECT id, name, office_id FROM rooms WHERE id = ?', [roomId], (err, room) => {
        if (err) return reject(err);
        if (!room) return reject(new Error('Кабинет не найден'));

        // Считаем количество мест
        db.get('SELECT COUNT(*) as count FROM workplaces WHERE room_id = ?', [roomId], (err, row) => {
          if (err) return reject(err);

          const nextNum = (row?.count || 0) + 1;
          const nextName = `Место ${nextNum}`;

          // Код из названия кабинета: "Кабинет 311" → "311", "Каб. 311А" → "311А"
          let roomCode = '';
          if (room.name) {
            // Берём последний токен: "311", "311А", "101"
            const parts = room.name.trim().split(/\s+/);
            roomCode = parts.length > 1 ? parts[parts.length - 1] : parts[0];
            // Убираем нецифровые символы в начале, если нужно (по желанию)
            // roomCode = roomCode.replace(/^[^\dА-Яа-я]+/, '');
          }

          const nextCode = roomCode
            ? `${roomCode}-${String(nextNum).padStart(2, '0')}`
            : '';

          resolve({
            next_name: nextName,
            next_code: nextCode,
            current_count: row?.count || 0,
          });
        });
      });
    });
  },

});