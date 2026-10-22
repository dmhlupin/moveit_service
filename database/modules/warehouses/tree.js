// database/modules/warehouses/tree.js
// Дерево складов: склады → зоны → стеллажи → ячейки.

const { buildWarehouseScope } = require('./scope');

module.exports = ({ db }) => ({
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
          w.id as warehouse_id, w.name as warehouse_name, w.is_default,
          z.id as zone_id, z.name as zone_name, z.sort_order as zone_sort,
          r.id as rack_id, r.name as rack_name, r.description as rack_description,
          r.sort_order as rack_sort,
          c.id as cell_id, c.name as cell_name, c.code as cell_code,
          c.capacity as cell_capacity, c.is_full as cell_is_full, c.sort_order as cell_sort,
          (SELECT COUNT(*) FROM equipment WHERE cell_id = c.id) as equipment_count
        FROM warehouses w
        LEFT JOIN zones z ON z.warehouse_id = w.id AND z.is_active = 1
        LEFT JOIN racks r ON r.zone_id = z.id AND r.is_active = 1
        LEFT JOIN cells c ON c.rack_id = r.id AND c.is_active = 1
        ${warehouseFilter}
        ORDER BY w.name, z.sort_order, z.name, r.sort_order, r.name, c.sort_order, c.name
      `, params, (err, rows) => {
        if (err) return reject(err);

        const tree = {};
        (rows || []).forEach(row => {
          if (!tree[row.warehouse_id]) {
            tree[row.warehouse_id] = {
              id: row.warehouse_id,
              name: row.warehouse_name,
              is_default: row.is_default,
              zones: {},
            };
          }
          if (row.zone_id) {
            if (!tree[row.warehouse_id].zones[row.zone_id]) {
              tree[row.warehouse_id].zones[row.zone_id] = {
                id: row.zone_id,
                name: row.zone_name,
                racks: {},
              };
            }
            if (row.rack_id) {
              if (!tree[row.warehouse_id].zones[row.zone_id].racks[row.rack_id]) {
                tree[row.warehouse_id].zones[row.zone_id].racks[row.rack_id] = {
                  id: row.rack_id,
                  name: row.rack_name,
                  description: row.rack_description,
                  cells: [],
                };
              }
              if (row.cell_id) {
                tree[row.warehouse_id].zones[row.zone_id].racks[row.rack_id].cells.push({
                  id: row.cell_id,
                  name: row.cell_name,
                  code: row.cell_code,
                  capacity: row.cell_capacity,
                  is_full: row.cell_is_full,
                  equipment_count: row.equipment_count,
                });
              }
            }
          }
        });

        const result = Object.values(tree).map(w => ({
          ...w,
          zones: Object.values(w.zones).map(z => ({
            ...z,
            racks: Object.values(z.racks),
          })),
        }));

        resolve(result);
      });
    });
  },
});