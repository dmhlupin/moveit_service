// database/modules/warehouses/equipment-in-cell.js
// Техника в ячейке (для карточки ячейки в дереве склада).

module.exports = ({ db }) => ({
  /**
   * Получить всю технику в ячейке.
   * Используется в карточке ячейки (/admin/warehouses/:id).
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
        `, [cellId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },
});