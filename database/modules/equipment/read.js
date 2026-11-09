// database/modules/equipment/read.js
// ============================================================
// Чтение: списки, карточка, счётчики, история назначений.
// Все SELECT-ы — как в database/modules/equipment.js (до 5.15.1a),
// 1:1 по поведению.
// ============================================================

const { buildEquipmentScope } = require('./scope');

module.exports = ({ db, run, get, all }) => {
    return {
        /**
         * Получить всю технику с данными модели и текущим владельцем.
         */
        getAllEquipment(scope = {}) {
            const s = buildEquipmentScope(scope);
            return new Promise((resolve, reject) => {
                const where = s.clause ? `WHERE ${s.clause}` : '';
                db.all(`
        SELECT
          e.id, e.model_id, e.inventory_number, e.serial_number,
          e.status, e.cell_id, e.workplace_id,
          e.responsible_user_id,
          ru.full_name AS responsible_user_name,
          ru.username  AS responsible_user_username,
          e.purchase_date, e.warranty_until, e.description,
          e.created_at, e.updated_at,

          e.is_quantity_accounted,
          CASE WHEN fa.equipment_id IS NOT NULL THEN 1 ELSE 0 END AS is_fixed_asset,
          fa.commissioning_date,
          fa.initial_cost,
          fa.useful_life_months,

          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,

          c.name AS category_name, c.icon AS category_icon,
          t.name AS type_name,     t.icon AS type_icon,

          u.id AS user_id, u.full_name AS user_name, u.department AS user_department,
          ue.assigned_date, ue.condition_on_assign,
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
        LEFT JOIN users ru ON e.responsible_user_id = ru.id
        LEFT JOIN fixed_assets fa ON fa.equipment_id = e.id
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
          e.id, e.model_id, e.inventory_number, e.serial_number,
          e.status, e.cell_id, e.workplace_id,
          e.responsible_user_id,
          ru.full_name AS responsible_user_name,
          ru.username  AS responsible_user_username,
          e.purchase_date, e.warranty_until, e.description,
          e.created_at, e.updated_at,

          e.is_quantity_accounted,
          CASE WHEN fa.equipment_id IS NOT NULL THEN 1 ELSE 0 END AS is_fixed_asset,
          fa.commissioning_date,
          fa.initial_cost,
          fa.useful_life_months,

          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,

          c.name AS category_name, c.icon AS category_icon,
          t.name AS type_name,     t.icon AS type_icon,

          cell.name AS cell_name, cell.code AS cell_code,
          rack.name AS rack_name, zone.name AS zone_name,
          wh.id AS warehouse_id, wh.name AS warehouse_name,

          wp.id AS workplace_id, wp.name AS workplace_name, wp.code AS workplace_code,
          r.id AS room_id, r.name AS room_name,
          o.id AS office_id, o.name AS office_name,

          u.id AS user_id, u.full_name AS user_name, u.department AS user_department,
          ue.assigned_date, ue.condition_on_assign,
          ue.notes AS assignment_notes

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
        LEFT JOIN users ru ON e.responsible_user_id = ru.id
        LEFT JOIN fixed_assets fa ON fa.equipment_id = e.id
        WHERE e.id = ? ${extraWhere}
      `, [id, ...s.params], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        },

        /**
         * Техника с полным адресом хранения + фильтры + пагинация.
         */
        getEquipmentWithLocation(filters = {}, scope = {}) {
            const s = buildEquipmentScope(scope);
            return new Promise((resolve, reject) => {
                const {
                    category_id = null,
                    type_id = null,
                    model_id = null,
                    status = null,
                    search = null,
                    warehouse_id = null,
                    workplace_id = null,
                    mol_id = null,
                    is_fixed_asset     = null,   // 🆕 5.15.2: true/false → 1/0
                    quantity_only      = false,  // 🆕 5.15.2: только учитываемые
                    corporate_id = null,
                    model_name = null,
                    unplaced = false,
                    stale = false,
                    sort = 'id',
                    order = 'asc',
                    limit = null,
                    offset = 0,
                    include_total = false,
                    only_mine = false,
                } = filters;

                const where = ['1=1'];
                const whereParams = [];
                if (s.clause) { where.push(s.clause); whereParams.push(...s.params); }

                if (category_id) { where.push('m.category_id = ?'); whereParams.push(category_id); }
                if (type_id) { where.push('m.type_id = ?'); whereParams.push(type_id); }
                if (model_id) { where.push('m.id = ?'); whereParams.push(model_id); }
                if (status) { where.push('e.status = ?'); whereParams.push(status); }
                if (warehouse_id) { where.push('wh.id = ?'); whereParams.push(warehouse_id); }
                if (workplace_id) { where.push('e.workplace_id = ?'); whereParams.push(workplace_id); }
                if (mol_id) { where.push('e.responsible_user_id = ?'); whereParams.push(mol_id); }
                if (is_fixed_asset === true)  { where.push(`fa.equipment_id IS NOT NULL`); }
                if (is_fixed_asset === false) { where.push(`fa.equipment_id IS NULL`); }
                if (quantity_only)            { where.push('e.is_quantity_accounted = 1'); }
                if (only_mine && scope.userId && scope.role === 'mol') {
                    where.push('e.responsible_user_id = ?');
                    whereParams.push(scope.userId);
                }
                if (unplaced) { where.push(`(e.status = 'available' AND e.cell_id IS NULL AND e.workplace_id IS NULL)`); }
                if (stale) {
                    where.push(`(
          e.cell_id IS NOT NULL
          AND e.status IN ('available', 'placed')
          AND e.updated_at < datetime('now', '-3 months')
        )`);
                }
                if (corporate_id) {
                    where.push('m.corporate_id COLLATE NOCASE LIKE ?');
                    whereParams.push(`%${corporate_id}%`);
                }
                if (model_name) {
                    where.push('m.name COLLATE NOCASE LIKE ?');
                    whereParams.push(`%${model_name}%`);
                }
                if (search) {
                    where.push(`(
          e.inventory_number COLLATE NOCASE LIKE ? OR
          e.serial_number    COLLATE NOCASE LIKE ? OR
          m.name             COLLATE NOCASE LIKE ? OR
          m.corporate_id     COLLATE NOCASE LIKE ? OR
          m.manufacturer     COLLATE NOCASE LIKE ? OR
          u.full_name        COLLATE NOCASE LIKE ? OR
          u.username         COLLATE NOCASE LIKE ? OR
          cell.code          COLLATE NOCASE LIKE ? OR
          wp.name            COLLATE NOCASE LIKE ? OR
          wp.code            COLLATE NOCASE LIKE ?
        )`);
                    const term = `%${search}%`;
                    for (let i = 0; i < 10; i++) whereParams.push(term);
                }

                const whereSql = `WHERE ${where.join(' AND ')}`;

                const SORT_MAP = {
                    id: 'e.id',
                    inventory_number: 'e.inventory_number',
                    model_name: 'm.name',
                    corporate_id: 'm.corporate_id',
                    category: 'c.name',
                    type: 't.name',
                    description: 'e.description',
                    status: 'e.status',
                    assigned: 'u.full_name',
                    responsible: 'ru.full_name',
                    location: `COALESCE(cell.code, wp.name)`,
                    created_at: 'e.created_at',
                    purchase_date: 'e.purchase_date',
                    commissioning_date: 'fa.commissioning_date',
                    quantity_accounted: 'e.is_quantity_accounted',
                    fixed_asset:        `CASE WHEN fa.equipment_id IS NOT NULL THEN 1 ELSE 0 END`,
                };
                const sortSql = SORT_MAP[sort] || 'e.id';
                const orderSql = (String(order).toLowerCase() === 'desc') ? 'DESC' : 'ASC';

                const baseSelect = `
        SELECT
          e.id, e.model_id, e.inventory_number, e.serial_number,
          e.status, e.cell_id, e.workplace_id,
          e.responsible_user_id,
          ru.full_name AS responsible_user_name,
          ru.username  AS responsible_user_username,
          e.purchase_date, e.warranty_until, e.description,
          e.created_at, e.updated_at,

          e.is_quantity_accounted,
          CASE WHEN fa.equipment_id IS NOT NULL THEN 1 ELSE 0 END AS is_fixed_asset,
          fa.commissioning_date,
          fa.initial_cost,
          fa.useful_life_months,

          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,

          c.name AS category_name, c.icon AS category_icon,
          t.name AS type_name,     t.icon AS type_icon,

          u.id AS user_id, u.full_name AS user_name, u.department AS user_department,
          ue.assigned_date, ue.condition_on_assign,

          cell.name AS cell_name, cell.code AS cell_code,
          rack.name AS rack_name, zone.name AS zone_name,
          wh.id AS warehouse_id, wh.name AS warehouse_name,
          wp.name AS workplace_name, wp.code AS workplace_code,
          r.id AS room_id, r.name AS room_name,
          o.id AS office_id, o.name AS office_name
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types      t ON t.id = m.type_id
        LEFT JOIN user_equipment ue ON e.id = ue.equipment_id AND ue.returned_date IS NULL
        LEFT JOIN users u ON ue.user_id = u.id
        LEFT JOIN users ru ON e.responsible_user_id = ru.id
        LEFT JOIN fixed_assets fa ON fa.equipment_id = e.id
        LEFT JOIN cells      cell ON e.cell_id = cell.id
        LEFT JOIN racks      rack ON cell.rack_id = rack.id
        LEFT JOIN zones      zone ON rack.zone_id = zone.id
        LEFT JOIN warehouses wh   ON zone.warehouse_id = wh.id
        LEFT JOIN workplaces wp   ON e.workplace_id = wp.id
        LEFT JOIN rooms      r    ON wp.room_id = r.id
        LEFT JOIN offices    o    ON r.office_id = o.id
      `;

                let itemsSql = `${baseSelect} ${whereSql} ORDER BY ${sortSql} ${orderSql}, e.id ASC`;
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
        LEFT JOIN fixed_assets fa ON fa.equipment_id = e.id
        ${whereSql}
      `;

                db.get(countSql, whereParams, (err, countRow) => {
                    if (err) { reject(err); return; }
                    db.all(itemsSql, itemsParams, (err, rows) => {
                        if (err) { reject(err); return; }
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
         * Техника с информацией о текущем владельце (массив).
         */
        getEquipmentWithUsers() {
            return new Promise((resolve, reject) => {
                db.all(`
        SELECT
          e.id, e.model_id, e.inventory_number, e.serial_number,
          e.status, e.cell_id, e.workplace_id,
          e.responsible_user_id,
          ru.full_name AS responsible_user_name,
          ru.username  AS responsible_user_username,
          e.purchase_date, e.warranty_until, e.description,
          e.created_at, e.updated_at,

          e.is_quantity_accounted,
          CASE WHEN fa.equipment_id IS NOT NULL THEN 1 ELSE 0 END AS is_fixed_asset,
          fa.commissioning_date,
          fa.initial_cost,
          fa.useful_life_months,

          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          m.category_id  AS category_id,
          m.type_id      AS type_id,

          c.name AS category_name, c.icon AS category_icon,
          t.name AS type_name,     t.icon AS type_icon,

          u.id AS user_id, u.full_name AS user_name, u.department AS user_department,
          ue.assigned_date, ue.condition_on_assign,
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
        LEFT JOIN users ru ON e.responsible_user_id = ru.id
        LEFT JOIN fixed_assets fa ON fa.equipment_id = e.id
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
          ue.id, ue.user_id, ue.equipment_id,
          ue.assigned_date, ue.returned_date,
          ue.condition_on_assign, ue.condition_on_return, ue.notes,
          u.username, u.full_name, u.department, u.email,
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
         * Доступная техника (status = 'available').
         */
        getAvailableEquipment() {
            return new Promise((resolve, reject) => {
                db.all(`
        SELECT
          e.id, e.model_id, e.inventory_number, e.serial_number,
          e.status, e.cell_id, e.workplace_id,
          e.is_quantity_accounted,
          CASE WHEN fa.equipment_id IS NOT NULL THEN 1 ELSE 0 END AS is_fixed_asset,
          fa.commissioning_date,
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
        LEFT JOIN fixed_assets fa ON fa.equipment_id = e.id
        WHERE e.status = 'available'
        ORDER BY m.name, e.inventory_number
      `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
        },

        /**
         * Счётчики техники по категориям.
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
                    if (err) { reject(err); return; }
                    const counts = {};
                    (rows || []).forEach(row => { counts[row.category_id] = row.count; });
                    resolve(counts);
                });
            });
        },

        /**
         * Счётчики техники по типам.
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
                    if (err) { reject(err); return; }
                    const counts = {};
                    (rows || []).forEach(row => { counts[row.type_id] = row.count; });
                    resolve(counts);
                });
            });
        },
    };
};