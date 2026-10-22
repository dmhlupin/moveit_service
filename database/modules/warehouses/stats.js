// database/modules/warehouses/stats.js
// Статистика по складам с учётом scope.

module.exports = ({ db }) => ({
  getWarehouseStats(scope = {}) {
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
          (SELECT COUNT(*) FROM equipment e JOIN cells c ON e.cell_id = c.id
            JOIN racks r ON c.rack_id = r.id JOIN zones z ON r.zone_id = z.id
            JOIN warehouses w ON z.warehouse_id = w.id
            WHERE ${molWh} AND ${molEq}) as equipment_on_stock,
          (SELECT COUNT(*) FROM equipment e
            WHERE e.cell_id IS NULL AND e.status = 'available' AND ${molEq}) as equipment_without_cell
      `, (err, row) => err ? reject(err) : resolve(row));
    });
  },
});