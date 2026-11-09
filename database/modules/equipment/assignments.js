// database/modules/equipment/assignments.js
// ============================================================
// Назначения: assignEquipment, returnEquipmentByEquipmentId.
// 1:1 по поведению (транзакции BEGIN/COMMIT/ROLLBACK — как в 5.14.3).
// ============================================================

module.exports = ({ db, run, get, all }) => {

  return {

    /**
     * Назначить технику пользователю.
     */
    async assignEquipment(userId, equipmentId, condition, notes, assignedByUserId = null) {
      await run('BEGIN');
      try {
        const user = await get('SELECT id, is_active FROM users WHERE id = ?', [userId]);
        if (!user) throw new Error('Пользователь не найден');
        if (!user.is_active) throw new Error('Пользователь заблокирован');

        const eq = await get('SELECT id, status FROM equipment WHERE id = ?', [equipmentId]);
        if (!eq) throw new Error('Техника не найдена');
        if (eq.status !== 'available') {
          throw new Error(`Техника не может быть назначена (текущий статус: ${eq.status})`);
        }

        const activeAssignment = await get(
          `SELECT id FROM user_equipment
           WHERE equipment_id = ? AND returned_date IS NULL`,
          [equipmentId]
        );
        if (activeAssignment) {
          await run(`
            UPDATE user_equipment
            SET returned_date = CURRENT_TIMESTAMP,
                condition_on_return = 'Автовозврат: переназначение',
                notes = COALESCE(notes, '') || ' | Автовозврат при переназначении'
            WHERE id = ?
          `, [activeAssignment.id]);
        }

        const insertResult = await run(`
          INSERT INTO user_equipment
            (user_id, equipment_id, condition_on_assign, notes, assigned_by_user_id)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, equipmentId, condition || 'В хорошем состоянии', notes, assignedByUserId || null]);

        await run(`
          UPDATE equipment
          SET status = 'assigned', cell_id = NULL, workplace_id = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [equipmentId]);

        await run('COMMIT');
        return {
          assignment_id: insertResult.lastID,
          user_id: userId,
          equipment_id: equipmentId,
          previous_returned: !!activeAssignment,
        };
      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
    },

    /**
     * Вернуть технику по equipmentId.
     */
    async returnEquipmentByEquipmentId(equipmentId, condition = 'В хорошем состоянии', notes = '') {
      await run('BEGIN');
      try {
        const assignment = await get(
          `SELECT id, user_id FROM user_equipment
           WHERE equipment_id = ? AND returned_date IS NULL`,
          [equipmentId]
        );

        if (!assignment) {
          await run('ROLLBACK');
          return { success: false, message: 'Активное назначение не найдено' };
        }

        await run(`
          UPDATE user_equipment
          SET returned_date = CURRENT_TIMESTAMP,
              condition_on_return = ?,
              notes = COALESCE(notes, '') || CASE WHEN ? != '' THEN ' | ' || ? ELSE '' END
          WHERE id = ?
        `, [condition, notes, notes, assignment.id]);

        await run(`
          UPDATE equipment
          SET status = 'available', cell_id = NULL, workplace_id = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [equipmentId]);

        await run('COMMIT');
        return {
          success: true,
          assignment_id: assignment.id,
          user_id: assignment.user_id,
          equipment_id: equipmentId,
        };
      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
    },

  };
};