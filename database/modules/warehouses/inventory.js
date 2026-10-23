// database/modules/warehouses/inventory.js
// Инвентаризация: summary, inventory, occupancy, totals, special status.

const { buildWarehouseScope } = require('./scope');

module.exports = ({ db }) => ({
  getInventorySummary(scope = {}) {
    const s = buildWarehouseScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molEq = isMol ? `AND e.responsible_user_id = ${uid}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          w.id, w.name, w.address, w.is_default, w.is_active,
          (SELECT COUNT(*) FROM zones z WHERE z.warehouse_id = w.id AND z.is_active = 1) as zones_count,
          (SELECT COUNT(*) FROM racks r JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND r.is_active = 1) as racks_count,
          (SELECT COUNT(*) FROM cells c JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND c.is_active = 1) as cells_count,
          (SELECT COUNT(*) FROM equipment e JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id ${molEq}) as equipment_count,
          (SELECT COALESCE(SUM(c.capacity), 0) FROM cells c
            JOIN racks r ON c.rack_id = r.id JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND c.is_active = 1 AND c.is_full = 0) as total_capacity,
          (SELECT COUNT(*) FROM cells c JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            WHERE z.warehouse_id = w.id AND c.is_active = 1 AND c.is_full = 1) as cells_full
        FROM warehouses w
        WHERE w.is_active = 1 ${extraWhere}
        ORDER BY w.is_default DESC, w.name ASC
      `, s.params, (err, rows) => {
        if (err) return reject(err);
        const result = (rows || []).map(w => ({
          ...w,
          fill_percent: w.total_capacity > 0
            ? Math.round((w.equipment_count / w.total_capacity) * 100)
            : (w.cells_count > 0 ? Math.round((w.equipment_count / w.cells_count) * 100) : 0),
        }));
        resolve(result);
      });
    });
  },

  getWarehouseInventory(warehouseId, scope = {}) {
    const s = buildWarehouseScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molEq = isMol ? `AND e.responsible_user_id = ${uid}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          e.id, e.inventory_number,
          m.name AS model_name, m.corporate_id AS model_corporate_id, m.manufacturer AS model_manufacturer,
          e.serial_number, e.status, e.purchase_date, e.warranty_until,
          e.responsible_user_id,
          ru.full_name AS responsible_user_name,
          m.category_id AS category_id, m.type_id AS type_id,
          c.name as category_name, c.icon as category_icon,
          t.name as type_name, t.icon as type_icon,
          cell.id as cell_id, cell.name as cell_name, cell.code as cell_code,
          rack.name as rack_name, zone.name as zone_name
        FROM equipment e
        JOIN equipment_models m ON m.id = e.model_id
        LEFT JOIN equipment_categories c ON c.id = m.category_id
        LEFT JOIN equipment_types t ON t.id = m.type_id
        JOIN cells cell ON e.cell_id = cell.id
        JOIN racks rack ON cell.rack_id = rack.id
        JOIN zones zone ON rack.zone_id = zone.id
        JOIN warehouses w ON zone.warehouse_id = w.id
        LEFT JOIN users ru ON ru.id = e.responsible_user_id
        WHERE zone.warehouse_id = ? ${molEq} ${extraWhere}
        ORDER BY zone.sort_order, zone.name, rack.sort_order, rack.name, cell.sort_order, cell.name
      `, [warehouseId, ...s.params], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },

  getCellOccupancy(warehouseId, scope = {}) {
    const s = buildWarehouseScope(scope);
    const extraWhere = s.clause ? `AND ${s.clause}` : '';
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molEq = isMol ? `AND e.responsible_user_id = ${uid}` : '';
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          c.id, c.name, c.code, c.capacity, c.is_full,
            (SELECT COUNT(*) FROM equipment e WHERE e.cell_id = c.id ${molEq}) as current_count,
          rack.name as rack_name, zone.name as zone_name
        FROM cells c
        JOIN racks rack ON c.rack_id = rack.id
        JOIN zones zone ON rack.zone_id = zone.id
        JOIN warehouses w ON zone.warehouse_id = w.id
        WHERE zone.warehouse_id = ? AND c.is_active = 1 ${extraWhere}
        ORDER BY zone.sort_order, zone.name, rack.sort_order, rack.name, c.sort_order, c.name
      `, [warehouseId, ...s.params], (err, rows) => {
        if (err) return reject(err);
        const result = (rows || []).map(c => {
          let percent = 0;
          if (c.is_full === 1) percent = 100;
          else if (c.capacity > 0) percent = Math.round((c.current_count / c.capacity) * 100);
          else percent = c.current_count > 0 ? 100 : 0;
          return { ...c, percent };
        });
        resolve(result);
      });
    });
  },

  getInventoryTotals(scope = {}) {
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molWh = isMol
      ? `w.id IN (SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ${uid})`
      : '1=1';
    const molEq = isMol ? `e.responsible_user_id = ${uid}` : '1=1';

    return new Promise((resolve, reject) => {
      db.get(`
        SELECT
          (SELECT COUNT(*) FROM warehouses w WHERE w.is_active = 1 AND ${molWh}) as total_warehouses,
          (SELECT COUNT(*) FROM zones z JOIN warehouses w ON z.warehouse_id = w.id
            WHERE z.is_active = 1 AND ${molWh}) as total_zones,
          (SELECT COUNT(*) FROM racks r JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE r.is_active = 1 AND ${molWh}) as total_racks,
          (SELECT COUNT(*) FROM cells c JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id JOIN warehouses w ON z.warehouse_id = w.id
            WHERE c.is_active = 1 AND ${molWh}) as total_cells,
          (SELECT COUNT(*) FROM equipment e WHERE e.cell_id IS NOT NULL AND ${molEq}) as equipment_on_stock,
          (SELECT COUNT(*) FROM equipment e WHERE e.status = 'available' AND e.cell_id IS NULL AND ${molEq}) as available_without_cell,
          (SELECT COUNT(*) FROM equipment e WHERE e.status = 'assigned' AND ${molEq}) as equipment_assigned,
          (SELECT COALESCE(SUM(c.capacity), 0) FROM cells c
            JOIN racks r ON c.rack_id = r.id JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE c.is_active = 1 AND c.is_full = 0 AND ${molWh}) as total_capacity,
          (SELECT COUNT(*) FROM cells c JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id JOIN warehouses w ON z.warehouse_id = w.id
            WHERE c.is_active = 1 AND c.is_full = 1 AND ${molWh}) as cells_full
      `, (err, row) => err ? reject(err) : resolve(row || {}));
    });
  },

  getSpecialStatusSummary(scope = {}) {
    const isMol = scope.role === 'mol';
    const uid = parseInt(scope.userId, 10) || 0;
    const molEq = isMol ? ` AND e.responsible_user_id = ${uid}` : '';
    const molWh = isMol
      ? `AND w.id IN (SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ${uid})`
      : '';

    return new Promise((resolve, reject) => {
      const statuses = ['maintenance', 'retired'];
      const result = {};
      let pending = statuses.length;
      const finishOne = () => { pending -= 1; if (pending === 0) resolve(result); };

      statuses.forEach(status => {
        db.get(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN e.cell_id IS NOT NULL THEN 1 ELSE 0 END) AS with_cell,
            SUM(CASE WHEN e.cell_id IS NULL THEN 1 ELSE 0 END) AS without_cell
          FROM equipment e
          WHERE e.status = ?${molEq}
        `, [status], (err, row) => {
          if (err) return reject(err);
          const bucket = {
            total: row?.total || 0,
            with_cell: row?.with_cell || 0,
            without_cell: row?.without_cell || 0,
            by_warehouse: [],
          };
          db.all(`
            SELECT w.id AS warehouse_id, w.name AS warehouse_name, COUNT(*) AS count
            FROM equipment e
            JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id
            JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE e.status = ?${molEq} ${molWh}
            GROUP BY w.id, w.name
            ORDER BY count DESC, w.name ASC
          `, [status], (err2, rows) => {
            if (err2) return reject(err2);
            bucket.by_warehouse = rows || [];
            result[status] = bucket;
            finishOne();
          });
        });
      });
    });
  },
});