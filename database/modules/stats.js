// database/modules/stats.js
// Общая статистика системы

module.exports = ({ db, run, get, all }) => ({
  
  /**
   * Получить сводную статистику по системе
   * Используется в админ-панели и на дашборде
   */
  getStats(scope = {}) {
    return new Promise((resolve, reject) => {
      const isMol = scope.role === 'mol';
      const uid = parseInt(scope.userId, 10) || 0;
      const fAnd = isMol ? ` AND responsible_user_id = ${uid}` : '';
      const fWhere = isMol ? ` WHERE responsible_user_id = ${uid}` : '';

      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM equipment${fWhere}) as total_equipment,
          (SELECT COUNT(*) FROM equipment WHERE status = 'available'${fAnd}) as available_equipment,
          (SELECT COUNT(*) FROM equipment WHERE status = 'placed'${fAnd}) as placed_equipment,
          (SELECT COUNT(*) FROM equipment WHERE status = 'assigned'${fAnd}) as assigned_equipment,
          (SELECT COUNT(*) FROM equipment WHERE status = 'maintenance'${fAnd}) as maintenance_equipment,
          (SELECT COUNT(*) FROM equipment WHERE status = 'retired'${fAnd}) as retired_equipment,
          (SELECT COUNT(*) FROM equipment
            WHERE status = 'available'
              AND cell_id IS NULL
              AND workplace_id IS NULL${fAnd}
          ) as unplaced_equipment,
          (SELECT COUNT(*) FROM user_equipment WHERE returned_date IS NULL) as active_assignments
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
});