// database/modules/equipment.js
// ============================================================
// Работа с техникой (экземплярами ТМЦ): CRUD + назначения + место.
//
// СОГЛАШЕНИЕ ПО ИМЕНАМ (v3.3.1)
// ------------------------------------------------------------
// Экземпляр (equipment) ссылается на модель (equipment_models)
// через model_id. Название, производитель, категория и тип
// живут ТОЛЬКО на модели — в equipment их больше нет.
//
// Что отдаём наружу (алиасы честные, без обманок):
//   e.id, e.model_id, e.inventory_number, e.serial_number,
//   e.status, e.cell_id, e.workplace_id,
//   e.purchase_date, e.warranty_until, e.description,
//   e.created_at, e.updated_at,
//
//   m.name          AS model_name,
//   m.corporate_id  AS model_corporate_id,
//   m.manufacturer  AS model_manufacturer,
//   m.category_id   AS category_id,      -- FK на категорию (на модели)
//   m.type_id       AS type_id,          -- FK на тип (на модели)
//
//   c.name AS category_name, c.icon AS category_icon,
//   t.name AS type_name,     t.icon AS type_icon,
//
//   -- место: склад
//   cell.name, cell.code, rack.name, zone.name,
//   wh.id AS warehouse_id, wh.name AS warehouse_name,
//
//   -- место: рабочее место
//   wp.name AS workplace_name, wp.code AS workplace_code,
//   r.id AS room_id, r.name AS room_name,
//   o.id AS office_id, o.name AS office_name,
//
//   -- владелец (если назначено)
//   u.id AS user_id, u.full_name AS user_name,
//   u.department AS user_department,
//   ue.assigned_date, ue.condition_on_assign,
//   ue.notes AS assignment_notes, ue.assignment_status
//
// Запись (addEquipment / updateEquipment) принимает:
//   model_id (обязателен), inventory_number, serial_number,
//   status, cell_id, workplace_id,
//   purchase_date, warranty_until, description
//
// Уникальность inventory_number / serial_number проверяется
// программно (checkUniqueSerialAndInventory) + SQLite UNIQUE.
// ============================================================

const { checkCellAvailability } = require('./cells');

// ============================================================
// ХЕЛПЕР: SQL-фрагмент scope для роли mol
// ============================================================
// Возвращает { clause: string, params: any[] }.
// Для admin/supervisor/user/undefined — clause пустой, params пустой.
// Для mol — фильтр «свои экземпляры»:
//   responsible_user_id = userId
//   OR техника в ячейке одного из своих складов
//   OR техника на рабочем месте одного из своих офисов
//
// Реализуем подзапросами, чтобы не тащить JOIN-ы в COUNT.
function buildEquipmentScope(scope = {}) {
  const { userId, role } = scope;
  if (!userId || !role) return { clause: '', params: [] };
  if (role !== 'mol') return { clause: '', params: [] };

  const clause = `(
    e.responsible_user_id = ?
    OR e.cell_id IN (
      SELECT c.id FROM cells c
      JOIN racks r ON r.id = c.rack_id
      JOIN zones z ON z.id = r.zone_id
      WHERE z.warehouse_id IN (
        SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ?
      )
    )
    OR e.workplace_id IN (
      SELECT wp.id FROM workplaces wp
      JOIN rooms r ON r.id = wp.room_id
      WHERE r.office_id IN (
        SELECT office_id FROM office_responsibles WHERE user_id = ?
      )
    )
  )`;
  return { clause, params: [userId, userId, userId] };
}

module.exports = ({ db, run, get, all }) => {

  // ============================================================
  // 🆕 ЛОКАЛЬНЫЙ ХЕЛПЕР — не на объекте, а в замыкании,
  //     чтобы не зависеть от `this` при деструктуризации в db.js
  // ============================================================

  /**
   * Проверяет уникальность inventory_number и serial_number.
   * NULL разрешён и не считается коллизией.
   */
  async function checkUniqueSerialAndInventory(inventoryNumber, serialNumber, excludeId = null) {
    const inv = inventoryNumber ? String(inventoryNumber).trim() : null;
    const sn  = serialNumber    ? String(serialNumber).trim()    : null;

    if (inv) {
      const params = [inv];
      let sql = `SELECT id FROM equipment WHERE inventory_number = ?`;
      if (excludeId) { sql += ` AND id != ?`; params.push(excludeId); }
      const row = await get(sql, params);
      if (row) {
        return { ok: false, reason: 'duplicate_inventory_number', field: 'inventory_number', conflict_id: row.id };
      }
    }

    if (sn) {
      const params = [sn];
      let sql = `SELECT id FROM equipment WHERE serial_number = ?`;
      if (excludeId) { sql += ` AND id != ?`; params.push(excludeId); }
      const row = await get(sql, params);
      if (row) {
        return { ok: false, reason: 'duplicate_serial_number', field: 'serial_number', conflict_id: row.id };
      }
    }

    return { ok: true };
  }

  return {

    // 🆕 Общий хелпер — экспортируем для роутов (admin.js)
    checkCellAvailability(cellId, excludeEquipmentId = null) {
      return checkCellAvailability(db, cellId, excludeEquipmentId);
    },

    // 🆕 Обёртка наружу — для роутов, если понадобится
    checkUniqueSerialAndInventory,

  // ============================================================
  // ЧТЕНИЕ
  // ============================================================

  /**
   * Получить всю технику с данными модели (name, manufacturer,
   * категория, тип) и текущим владельцем.
   */
  getAllEquipment(scope = {}) {
    const s = buildEquipmentScope(scope);
    return new Promise((resolve, reject) => {
      const where = s.clause ? `WHERE ${s.clause}` : '';
      db.all(`
        SELECT
          e.id,
          e.model_id,
          e.inventory_number,
          e.serial_number,
          e.status,
          e.cell_id,
          e.workplace_id,
          e.responsible_user_id,
          e.purchase_date,
          e.warranty_until,
          e.description,
          e.created_at,
          e.updated_at,

          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,

          c.name AS category_name,
          c.icon AS category_icon,
          t.name AS type_name,
          t.icon AS type_icon,

          u.id          AS user_id,
          u.full_name   AS user_name,
          u.department  AS user_department,
          ue.assigned_date,
          ue.condition_on_assign,
          ue.notes      AS assignment_notes,

          CASE
            WHEN ue.returned_date IS NULL AND e.status = 'assigned' THEN 'active'
            WHEN ue.returned_date IS NOT NULL THEN 'returned'
            ELSE 'available'
          END AS assignment_status

        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        LEFT JOIN user_equipment ue ON e.id = ue.equipment_id AND ue.returned_date IS NULL
        LEFT JOIN users u ON ue.user_id = u.id
        ${where}
        ORDER BY m.name, e.inventory_number
      `, s.params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Техника по ID — с моделью, категорией, типом, адресом и владельцем.
   */
  getEquipmentById(id, scope = {}) {
    const s = buildEquipmentScope(scope);
    return new Promise((resolve, reject) => {
      const extraWhere = s.clause ? `AND ${s.clause}` : '';
      db.get(`
        SELECT
          e.id,
          e.model_id,
          e.inventory_number,
          e.serial_number,
          e.status,
          e.cell_id,
          e.workplace_id,
          e.responsible_user_id,
          e.purchase_date,
          e.warranty_until,
          e.description,
          e.created_at,
          e.updated_at,

          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,

          c.name AS category_name,
          c.icon AS category_icon,
          t.name AS type_name,
          t.icon AS type_icon,

          cell.name  AS cell_name,
          cell.code  AS cell_code,
          rack.name  AS rack_name,
          zone.name  AS zone_name,
          wh.id      AS warehouse_id,
          wh.name    AS warehouse_name,

          wp.id      AS workplace_id,
          wp.name    AS workplace_name,
          wp.code    AS workplace_code,
          r.id       AS room_id,
          r.name     AS room_name,
          o.id       AS office_id,
          o.name     AS office_name,

          u.id          AS user_id,
          u.full_name   AS user_name,
          u.department  AS user_department,
          ue.assigned_date,
          ue.condition_on_assign,
          ue.notes      AS assignment_notes

        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        LEFT JOIN cells      cell ON e.cell_id = cell.id
        LEFT JOIN racks      rack ON cell.rack_id = rack.id
        LEFT JOIN zones      zone ON rack.zone_id = zone.id
        LEFT JOIN warehouses wh   ON zone.warehouse_id = wh.id
        LEFT JOIN workplaces wp   ON e.workplace_id = wp.id
        LEFT JOIN rooms      r    ON wp.room_id = r.id
        LEFT JOIN offices    o    ON r.office_id = o.id
        LEFT JOIN user_equipment ue ON e.id = ue.equipment_id AND ue.returned_date IS NULL
        LEFT JOIN users u ON ue.user_id = u.id
        WHERE e.id = ? ${extraWhere}
      `, [id, ...s.params], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Техника с полным адресом хранения + фильтры + пагинация.
   * Фильтры: category_id, type_id, status, search, warehouse_id,
   *          workplace_id, unplaced; limit / offset / include_total.
   */
  getEquipmentWithLocation(filters = {}, scope = {}) {
    const s = buildEquipmentScope(scope);
    return new Promise((resolve, reject) => {
      const {
        category_id  = null,
        type_id      = null,
        status       = null,
        search       = null,
        warehouse_id = null,
        workplace_id = null,
        unplaced     = false,
        limit        = null,
        offset       = 0,
        include_total = false,
      } = filters;

      // Общие условия WHERE
      const where = ['1=1'];
      const whereParams = [];
      if (s.clause) {
        where.push(s.clause);
        whereParams.push(...s.params);
      }

      if (category_id) {
        where.push('m.category_id = ?');
        whereParams.push(category_id);
      }
      if (type_id) {
        where.push('m.type_id = ?');
        whereParams.push(type_id);
      }
      if (status) {
        where.push('e.status = ?');
        whereParams.push(status);
      }
      if (warehouse_id) {
        where.push('wh.id = ?');
        whereParams.push(warehouse_id);
      }
      if (workplace_id) {
        where.push('e.workplace_id = ?');
        whereParams.push(workplace_id);
      }
      if (unplaced) {
        where.push(`(e.status = 'available' AND e.cell_id IS NULL AND e.workplace_id IS NULL)`);
      }
      if (search) {
        where.push(`(
          e.inventory_number LIKE ? OR
          e.serial_number    LIKE ? OR
          m.name             LIKE ? OR
          m.corporate_id     LIKE ? OR
          m.manufacturer     LIKE ? OR
          u.full_name        LIKE ? OR
          u.username         LIKE ? OR
          cell.code          LIKE ? OR
          wp.name            LIKE ? OR
          wp.code            LIKE ?
        )`);
        const term = `%${search}%`;
        for (let i = 0; i < 10; i++) whereParams.push(term);
      }

      const whereSql = `WHERE ${where.join(' AND ')}`;

      const baseSelect = `
        SELECT
          e.id,
          e.model_id,
          e.inventory_number,
          e.serial_number,
          e.status,
          e.cell_id,
          e.workplace_id,
          e.responsible_user_id,
          e.purchase_date,
          e.warranty_until,
          e.description,
          e.created_at,
          e.updated_at,

          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,

          c.name AS category_name,
          c.icon AS category_icon,
          t.name AS type_name,
          t.icon AS type_icon,

          u.id         AS user_id,
          u.full_name  AS user_name,
          u.department AS user_department,
          ue.assigned_date,
          ue.condition_on_assign,

          cell.name AS cell_name,
          cell.code AS cell_code,
          rack.name AS rack_name,
          zone.name AS zone_name,
          wh.id     AS warehouse_id,
          wh.name   AS warehouse_name,
          wp.name   AS workplace_name,
          wp.code   AS workplace_code,
          r.id      AS room_id,
          r.name    AS room_name,
          o.id      AS office_id,
          o.name    AS office_name
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        LEFT JOIN user_equipment ue ON e.id = ue.equipment_id AND ue.returned_date IS NULL
        LEFT JOIN users u ON ue.user_id = u.id
        LEFT JOIN cells      cell ON e.cell_id = cell.id
        LEFT JOIN racks      rack ON cell.rack_id = rack.id
        LEFT JOIN zones      zone ON rack.zone_id = zone.id
        LEFT JOIN warehouses wh   ON zone.warehouse_id = wh.id
        LEFT JOIN workplaces wp   ON e.workplace_id = wp.id
        LEFT JOIN rooms      r    ON wp.room_id = r.id
        LEFT JOIN offices    o    ON r.office_id = o.id
      `;

      let itemsSql = `${baseSelect} ${whereSql} ORDER BY e.inventory_number ASC`;
      const itemsParams = [...whereParams];

      if (limit) {
        itemsSql += ' LIMIT ? OFFSET ?';
        itemsParams.push(limit, offset);
      }

      if (!include_total) {
        db.all(itemsSql, itemsParams, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
        return;
      }

      // Считаем total по тем же фильтрам (без LIMIT/OFFSET)
      const countSql = `
        SELECT COUNT(*) AS total
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN user_equipment ue ON e.id = ue.equipment_id AND ue.returned_date IS NULL
        LEFT JOIN users u ON ue.user_id = u.id
        LEFT JOIN cells      cell ON e.cell_id = cell.id
        LEFT JOIN racks      rack ON cell.rack_id = rack.id
        LEFT JOIN zones      zone ON rack.zone_id = zone.id
        LEFT JOIN warehouses wh   ON zone.warehouse_id = wh.id
        LEFT JOIN workplaces wp   ON e.workplace_id = wp.id
        ${whereSql}
      `;

      db.get(countSql, whereParams, (err, countRow) => {
        if (err) {
          reject(err);
          return;
        }
        db.all(itemsSql, itemsParams, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            items: rows || [],
            total: countRow ? countRow.total : 0,
            limit,
            offset,
          });
        });
      });
    });
  },

  /**
   * Техника с информацией о текущем владельце.
   * Возвращает массив (совместимо с routes/catalog.js).
   */
  getEquipmentWithUsers() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          e.id,
          e.model_id,
          e.inventory_number,
          e.serial_number,
          e.status,
          e.cell_id,
          e.workplace_id,
          e.responsible_user_id,
          e.purchase_date,
          e.warranty_until,
          e.description,
          e.created_at,
          e.updated_at,

          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,

          c.name AS category_name,
          c.icon AS category_icon,
          t.name AS type_name,
          t.icon AS type_icon,

          u.id         AS user_id,
          u.full_name  AS user_name,
          u.department AS user_department,
          ue.assigned_date,
          ue.condition_on_assign,
          ue.notes AS assignment_notes,

          CASE
            WHEN ue.returned_date IS NULL AND e.status = 'assigned' THEN 'active'
            WHEN ue.returned_date IS NOT NULL THEN 'returned'
            ELSE 'available'
          END AS assignment_status

        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        LEFT JOIN user_equipment ue ON e.id = ue.equipment_id AND ue.returned_date IS NULL
        LEFT JOIN users u ON ue.user_id = u.id
        ORDER BY m.name, e.inventory_number
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * История назначений экземпляра.
   */
  getEquipmentHistory(equipmentId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          ue.id,
          ue.user_id,
          ue.equipment_id,
          ue.assigned_date,
          ue.returned_date,
          ue.condition_on_assign,
          ue.condition_on_return,
          ue.notes,
          u.username,
          u.full_name,
          u.department,
          u.email,
          CASE
            WHEN ue.returned_date IS NULL THEN 'active'
            ELSE 'returned'
          END AS status
        FROM user_equipment ue
        JOIN users u ON ue.user_id = u.id
        WHERE ue.equipment_id = ?
        ORDER BY ue.id DESC
      `, [equipmentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Доступная техника (status = 'available') — с данными модели.
   */
  getAvailableEquipment() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          e.id,
          e.model_id,
          e.inventory_number,
          e.serial_number,
          e.status,
          e.cell_id,
          e.workplace_id,
          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,
          c.name AS category_name,
          t.name AS type_name
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        WHERE e.status = 'available'
        ORDER BY m.name, e.inventory_number
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Счётчики техники по категориям (category_id живёт на модели).
   * @returns {Promise<Object>} { [category_id]: count }
   */
  getEquipmentCountsByCategory() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT m.category_id AS category_id, COUNT(*) AS count
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        WHERE m.category_id IS NOT NULL
        GROUP BY m.category_id
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const counts = {};
        (rows || []).forEach(row => {
          counts[row.category_id] = row.count;
        });
        resolve(counts);
      });
    });
  },

  /**
   * Счётчики техники по типам (type_id живёт на модели).
   * @returns {Promise<Object>} { [type_id]: count }
   */
  getEquipmentCountsByType() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT m.type_id AS type_id, COUNT(*) AS count
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        WHERE m.type_id IS NOT NULL
        GROUP BY m.type_id
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const counts = {};
        (rows || []).forEach(row => {
          counts[row.type_id] = row.count;
        });
        resolve(counts);
      });
    });
  },
    // ============================================================
  // СОЗДАНИЕ / ОБНОВЛЕНИЕ / УДАЛЕНИЕ
  // ============================================================

  /**
   * Добавить экземпляр техники.
   *
   * Принимает:
   *   model_id          — обязателен
   *   inventory_number  — NULL разрешён, но UNIQUE
   *   serial_number     — NULL разрешён, но UNIQUE
   *   status            — по умолчанию 'available'
   *   cell_id, workplace_id
   *   purchase_date, warranty_until, description
   *
   * Программно проверяет уникальность inventory_number / serial_number.
   */
  async addEquipment(eqData) {
    const {
      model_id,
      inventory_number = null,
      serial_number    = null,
      status           = 'available',
      cell_id          = null,
      workplace_id     = null,
      purchase_date    = null,
      warranty_until   = null,
      description      = null,
      responsible_user_id = null,   // 🆕 Этап 4
    } = eqData;

    if (!model_id) {
      throw new Error('Не указана модель техники (model_id)');
    }

    // Проверяем, что модель существует
    const model = await get(
      'SELECT id FROM equipment_models WHERE id = ?',
      [model_id]
    );
    if (!model) {
      throw new Error('Модель не найдена');
    }

    // Программная проверка уникальности
    const uniq = await checkUniqueSerialAndInventory(
      inventory_number, serial_number, null
    );
    if (!uniq.ok) {
      if (uniq.reason === 'duplicate_inventory_number') {
        throw new Error(`Инвентарный номер "${inventory_number}" уже используется`);
      }
      if (uniq.reason === 'duplicate_serial_number') {
        throw new Error(`Серийный номер "${serial_number}" уже используется`);
      }
      throw new Error('Нарушение уникальности');
    }

    const inv = inventory_number ? String(inventory_number).trim() : null;
    const sn  = serial_number    ? String(serial_number).trim()    : null;

    const result = await run(`
      INSERT INTO equipment
        (model_id, inventory_number, serial_number, status,
         cell_id, workplace_id,
         purchase_date, warranty_until, description,
         responsible_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      model_id, inv, sn, status || 'available',
      cell_id || null, workplace_id || null,
      purchase_date || null, warranty_until || null, description || null,
      responsible_user_id || null,
    ]);

    return { id: result.lastID, ...eqData };
  },

  /**
   * Обновить экземпляр техники.
   *
   * - Программно проверяет уникальность inventory_number / serial_number
   *   (с исключением текущего id).
   * - При переходе assigned → available: закрывает активное назначение,
   *   обнуляет cell_id и workplace_id.
   */
  async updateEquipment(id, eqData) {
    if (!id || isNaN(id)) {
      throw new Error('Неверный ID техники');
    }
    const idNum = parseInt(id, 10);

    const {
      model_id,
      inventory_number = null,
      serial_number    = null,
      status           = 'available',
      cell_id          = null,
      workplace_id     = null,
      purchase_date    = null,
      warranty_until   = null,
      description      = null,
      responsible_user_id = undefined,   // 🆕 Этап 4: undefined = не трогать
    } = eqData;

    if (!model_id) {
      throw new Error('Не указана модель техники (model_id)');
    }

    // Существует ли экземпляр?
    const equipment = await get(
      'SELECT id, status FROM equipment WHERE id = ?',
      [idNum]
    );
    if (!equipment) {
      throw new Error('Техника не найдена');
    }

    // Модель существует?
    const model = await get(
      'SELECT id FROM equipment_models WHERE id = ?',
      [model_id]
    );
    if (!model) {
      throw new Error('Модель не найдена');
    }

    // Программная проверка уникальности (с исключением текущего id)
    const uniq = await checkUniqueSerialAndInventory(
      inventory_number, serial_number, idNum
    );
    if (!uniq.ok) {
      if (uniq.reason === 'duplicate_inventory_number') {
        throw new Error(`Инвентарный номер "${inventory_number}" уже используется`);
      }
      if (uniq.reason === 'duplicate_serial_number') {
        throw new Error(`Серийный номер "${serial_number}" уже используется`);
      }
      throw new Error('Нарушение уникальности');
    }

    const inv = inventory_number ? String(inventory_number).trim() : null;
    const sn  = serial_number    ? String(serial_number).trim()    : null;

    const oldStatus = equipment.status;

    // Сценарий: assigned → available — автовозврат
    if (oldStatus === 'assigned' && status === 'available') {
      const assignment = await get(
        `SELECT id FROM user_equipment
         WHERE equipment_id = ? AND returned_date IS NULL`,
        [idNum]
      );

      const setRespSql = (responsible_user_id !== undefined)
        ? ', responsible_user_id = ?'
        : '';
      const paramsResp = (responsible_user_id !== undefined)
        ? [responsible_user_id]
        : [];

      const upd = await run(`
        UPDATE equipment
        SET model_id = ?,
            inventory_number = ?,
            serial_number = ?,
            status = ?,
            description = ?,
            purchase_date = ?,
            warranty_until = ?,
            cell_id = NULL,
            workplace_id = NULL
            ${setRespSql},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        model_id, inv, sn, status, description,
        purchase_date || null, warranty_until || null,
        ...paramsResp,
        idNum
      ]);

      if (upd.changes === 0) {
        throw new Error('Техника не найдена');
      }

      if (assignment) {
        await run(`
          UPDATE user_equipment
          SET returned_date = CURRENT_TIMESTAMP,
              condition_on_return = ?
          WHERE id = ?
        `, ['Возвращена при изменении статуса', assignment.id]);
      }

      return { id: idNum, ...eqData, returned: !!assignment };
    }

    // Обычное обновление. responsible_user_id меняем только если он
    // передан явно (undefined = не трогать).
    const setRespSql = (responsible_user_id !== undefined)
      ? ', responsible_user_id = ?'
      : '';
    const paramsResp = (responsible_user_id !== undefined)
      ? [responsible_user_id]
      : [];

    const upd = await run(`
      UPDATE equipment
      SET model_id = ?,
          inventory_number = ?,
          serial_number = ?,
          status = ?,
          description = ?,
          purchase_date = ?,
          warranty_until = ?,
          cell_id = ?,
          workplace_id = ?
          ${setRespSql},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      model_id, inv, sn, status, description,
      purchase_date || null, warranty_until || null,
      cell_id || null, workplace_id || null,
      ...paramsResp,
      idNum
    ]);

    if (upd.changes === 0) {
      throw new Error('Техника не найдена');
    }

    return { id: idNum, ...eqData, returned: false };
  },

  /**
   * Удалить экземпляр.
   * Запрещено, если есть активное назначение или статус assigned.
   */
  async deleteEquipment(id) {
    const row = await get(
      `SELECT id FROM user_equipment
       WHERE equipment_id = ? AND returned_date IS NULL`,
      [id]
    );
    if (row) {
      throw new Error('Невозможно удалить технику, она назначена пользователю');
    }

    const result = await run('DELETE FROM equipment WHERE id = ?', [id]);
    return { deleted: result.changes };
  },

  // ============================================================
  // НАЗНАЧЕНИЯ
  // ============================================================

  /**
   * Назначить технику пользователю.
   * - Закрывает предыдущее активное назначение (если есть).
   * - Ставит status = 'assigned', обнуляет cell_id и workplace_id.
   */
  assignEquipment(userId, equipmentId, condition, notes = '') {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, is_active FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) { reject(err); return; }
        if (!user) { reject(new Error('Пользователь не найден')); return; }
        if (!user.is_active) { reject(new Error('Пользователь заблокирован')); return; }

        db.get('SELECT id, status FROM equipment WHERE id = ?', [equipmentId], (err, eq) => {
          if (err) { reject(err); return; }
          if (!eq) { reject(new Error('Техника не найдена')); return; }
          if (eq.status !== 'available') {
            reject(new Error(`Техника не может быть назначена (текущий статус: ${eq.status})`));
            return;
          }

          db.get(
            `SELECT id FROM user_equipment
             WHERE equipment_id = ? AND returned_date IS NULL`,
            [equipmentId],
            (err, activeAssignment) => {
              if (err) { reject(err); return; }

              const createNewAssignment = () => {
                db.run(`
                  INSERT INTO user_equipment
                    (user_id, equipment_id, condition_on_assign, notes)
                  VALUES (?, ?, ?, ?)
                `, [userId, equipmentId, condition || 'В хорошем состоянии', notes], function(err) {
                  if (err) { reject(err); return; }
                  const assignmentId = this.lastID;

                  db.run(`
                    UPDATE equipment
                    SET status = 'assigned',
                        cell_id = NULL,
                        workplace_id = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                  `, [equipmentId], function(err) {
                    if (err) { reject(err); return; }
                    resolve({
                      assignment_id: assignmentId,
                      user_id: userId,
                      equipment_id: equipmentId,
                      previous_returned: false,
                    });
                  });
                });
              };

              if (activeAssignment) {
                db.run(`
                  UPDATE user_equipment
                  SET returned_date = CURRENT_TIMESTAMP,
                      condition_on_return = 'Автовозврат: переназначение',
                      notes = COALESCE(notes, '') || ' | Автовозврат при переназначении'
                  WHERE id = ?
                `, [activeAssignment.id], (err) => {
                  if (err) console.error('Ошибка закрытия старого назначения:', err.message);
                  createNewAssignment();
                });
              } else {
                createNewAssignment();
              }
            }
          );
        });
      });
    });
  },

  /**
   * Вернуть технику по equipmentId.
   * Ставит returned_date, status = 'available', обнуляет cell_id и workplace_id.
   */
  returnEquipmentByEquipmentId(equipmentId, condition = 'В хорошем состоянии', notes = '') {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, user_id FROM user_equipment
         WHERE equipment_id = ? AND returned_date IS NULL`,
        [equipmentId],
        (err, assignment) => {
          if (err) { reject(err); return; }
          if (!assignment) {
            resolve({ success: false, message: 'Активное назначение не найдено' });
            return;
          }

          db.run(`
            UPDATE user_equipment
            SET returned_date = CURRENT_TIMESTAMP,
                condition_on_return = ?,
                notes = COALESCE(notes, '') || CASE WHEN ? != '' THEN ' | ' || ? ELSE '' END
            WHERE id = ?
          `, [condition, notes, notes, assignment.id], function(err) {
            if (err) { reject(err); return; }

            db.run(`
              UPDATE equipment
              SET status = 'available',
                  cell_id = NULL,
                  workplace_id = NULL,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [equipmentId], function(err) {
              if (err) { reject(err); return; }
              resolve({
                success: true,
                assignment_id: assignment.id,
                user_id: assignment.user_id,
                equipment_id: equipmentId,
              });
            });
          });
        }
      );
    });
  },

  // ============================================================
  // ПЕРЕМЕЩЕНИЯ
  // ============================================================

  /**
   * Переместить технику в ячейку (расширенная версия).
   * Проверяет capacity/is_full через checkCellAvailability,
   * обновляет статус, возвращает старую и новую ячейки.
   */
  moveEquipmentToCellDetailed(equipmentId, cellId, userId = null, userName = null) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT
          e.id, e.inventory_number, e.cell_id, e.status,
          m.name AS model_name,
          cell.name AS cell_name, cell.code AS cell_code
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN cells cell ON e.cell_id = cell.id
        WHERE e.id = ?
      `, [equipmentId], (err, eq) => {
        if (err) { reject(err); return; }
        if (!eq) { reject(new Error('Техника не найдена')); return; }

        // Убрать из ячейки
        if (!cellId) {
          db.run(`
            UPDATE equipment
            SET cell_id = NULL,
                status = CASE WHEN status IN ('available', 'placed') THEN 'available' ELSE status END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [equipmentId], function(err) {
            if (err) { reject(err); return; }
            resolve({
              success: true,
              equipment_id: equipmentId,
              inventory_number: eq.inventory_number,
              model_name: eq.model_name,
              from_cell_id: eq.cell_id,
              from_cell_name: eq.cell_name,
              from_cell_code: eq.cell_code,
              to_cell_id: null,
              to_cell_name: null,
              to_cell_code: null,
            });
          });
          return;
        }

        // Уже в этой ячейке
        if (eq.cell_id === parseInt(cellId, 10)) {
          resolve({
            success: true,
            already_there: true,
            equipment_id: equipmentId,
            inventory_number: eq.inventory_number,
          });
          return;
        }

        // Проверка ячейки
        checkCellAvailability(db, cellId, equipmentId)
          .then(({ ok, reason, cell, label }) => {
            if (!ok) {
              if (reason === 'cell_not_found') return reject(new Error('Ячейка не найдена'));
              if (reason === 'is_full')       return reject(new Error(`Ячейка ${label} отмечена как заполненная`));
              if (reason === 'over_capacity') return reject(new Error(`Ячейка ${label} переполнена (${cell.current_count}/${cell.capacity})`));
              return reject(new Error(`Ячейка недоступна (${reason})`));
            }

            db.run(`
              UPDATE equipment
              SET cell_id = ?,
                  workplace_id = NULL,
                  status = CASE WHEN status IN ('available', 'placed') THEN 'available' ELSE status END,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [cellId, equipmentId], function(err) {
              if (err) { reject(err); return; }
              resolve({
                success: true,
                equipment_id: equipmentId,
                inventory_number: eq.inventory_number,
                model_name: eq.model_name,
                from_cell_id: eq.cell_id,
                from_cell_name: eq.cell_name,
                from_cell_code: eq.cell_code,
                to_cell_id: cell.id,
                to_cell_name: cell.name,
                to_cell_code: cell.code,
                to_warehouse_name: cell.warehouse_name,
                to_zone_name: cell.zone_name,
                to_rack_name: cell.rack_name,
              });
            });
          })
          .catch(reject);
      });
    });
  },

  /**
   * История перемещений экземпляра (из activity_log).
   */
  getEquipmentMoves(equipmentId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          al.id,
          al.user_id,
          al.username,
          al.action,
          al.details,
          al.created_at,
          u.full_name  AS user_full_name,
          u.department AS user_department
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.entity_type = 'equipment'
          AND al.entity_id = ?
          AND al.action = 'equipment_move'
        ORDER BY al.id DESC
      `, [equipmentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  };
};