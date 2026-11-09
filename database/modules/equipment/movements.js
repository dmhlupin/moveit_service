// database/modules/equipment/movements.js
// ============================================================
// Перемещения: moveEquipmentToCellDetailed, getEquipmentMoves.
// 1:1 по поведению (транзакция BEGIN/COMMIT/ROLLBACK — как в 5.14.3).
// ============================================================

module.exports = ({ db, run, get, all }, helpers) => {
  const { checkCellAvailability } = helpers;

  return {

    /**
     * Переместить технику в ячейку (расширенная версия).
     */
    async moveEquipmentToCellDetailed(equipmentId, cellId, userId = null, userName = null) {
      await run('BEGIN');
      try {
        const eq = await get(`
          SELECT
            e.id, e.inventory_number, e.cell_id, e.status,
            m.name AS model_name,
            cell.name AS cell_name, cell.code AS cell_code
          FROM equipment e
          JOIN equipment_models m ON m.id = e.model_id
          LEFT JOIN cells cell ON e.cell_id = cell.id
          WHERE e.id = ?
        `, [equipmentId]);

        if (!eq) throw new Error('Техника не найдена');

        // Убрать из ячейки
        if (!cellId) {
          await run(`
            UPDATE equipment
            SET cell_id = NULL,
                status = CASE WHEN status IN ('available', 'placed') THEN 'available' ELSE status END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [equipmentId]);

          await run('COMMIT');
          return {
            success: true,
            equipment_id: equipmentId,
            inventory_number: eq.inventory_number,
            model_name: eq.model_name,
            from_cell_id: eq.cell_id,
            from_cell_name: eq.cell_name,
            from_cell_code: eq.cell_code,
            to_cell_id: null, to_cell_name: null, to_cell_code: null,
          };
        }

        // Уже в этой ячейке
        if (eq.cell_id === parseInt(cellId, 10)) {
          await run('ROLLBACK');
          return {
            success: true,
            already_there: true,
            equipment_id: equipmentId,
            inventory_number: eq.inventory_number,
          };
        }

        // Проверка доступности
        const check = await checkCellAvailability(db, cellId, equipmentId);
        if (!check.ok) {
          if (check.reason === 'cell_not_found') throw new Error('Ячейка не найдена');
          if (check.reason === 'is_full')       throw new Error(`Ячейка ${check.label} отмечена как заполненная`);
          if (check.reason === 'over_capacity') throw new Error(`Ячейка ${check.label} переполнена (${check.cell.current_count}/${check.cell.capacity})`);
          throw new Error(`Ячейка недоступна (${check.reason})`);
        }

        await run(`
          UPDATE equipment
          SET cell_id = ?,
              workplace_id = NULL,
              status = CASE WHEN status IN ('available', 'placed') THEN 'available' ELSE status END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [cellId, equipmentId]);

        await run('COMMIT');
        return {
          success: true,
          equipment_id: equipmentId,
          inventory_number: eq.inventory_number,
          model_name: eq.model_name,
          from_cell_id: eq.cell_id,
          from_cell_name: eq.cell_name,
          from_cell_code: eq.cell_code,
          to_cell_id: check.cell.id,
          to_cell_name: check.cell.name,
          to_cell_code: check.cell.code,
          to_warehouse_name: check.cell.warehouse_name,
          to_zone_name: check.cell.zone_name,
          to_rack_name: check.cell.rack_name,
        };
      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
    },

    /**
     * История перемещений экземпляра (из activity_log).
     */
    getEquipmentMoves(equipmentId) {
      return new Promise((resolve, reject) => {
        db.all(`
          SELECT
            al.id, al.user_id, al.username, al.action,
            al.details, al.created_at,
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