// database/modules/profile.js
// Личный кабинет: профиль, своя техника, статистика

module.exports = ({ db, run, get, all }) => ({
  
  /**
   * Получить активную технику пользователя
   * (только выданную, не возвращённую)
   */
  getUserActiveEquipment(userId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          e.id,
          e.inventory_number,
          e.responsible_user_id,
          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          e.serial_number,
          e.description,
          ue.assigned_date,
          ue.condition_on_assign,
          ue.notes,
          ue.id as assignment_id
        FROM user_equipment ue
        JOIN equipment e ON ue.equipment_id = e.id
        JOIN equipment_models m ON m.id = e.model_id
        WHERE ue.user_id = ? AND ue.returned_date IS NULL
        ORDER BY ue.assigned_date DESC
      `, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Получить всю историю техники пользователя
   * (включая возвращённую)
   */
  getUserEquipmentHistory(userId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          e.id,
          e.inventory_number,
          e.responsible_user_id,
          m.name         AS model_name,
          m.corporate_id AS model_corporate_id,
          m.manufacturer AS model_manufacturer,
          ue.assigned_date,
          ue.returned_date,
          ue.condition_on_assign,
          ue.condition_on_return,
          ue.notes,
          CASE 
            WHEN ue.returned_date IS NULL THEN 'active'
            ELSE 'returned'
          END as status
        FROM user_equipment ue
        JOIN equipment e ON ue.equipment_id = e.id
        JOIN equipment_models m ON m.id = e.model_id
        WHERE ue.user_id = ?
        ORDER BY ue.assigned_date DESC
      `, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Обновить профиль пользователя (без пароля)
   */
  updateUserProfile(userId, data) {
    return new Promise((resolve, reject) => {
      const { email, full_name, department, phone } = data;
      
      db.run(`
        UPDATE users 
        SET email = ?, full_name = ?, department = ?, phone = ?, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [email, full_name, department, phone, userId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        if (this.changes === 0) {
          reject(new Error('Пользователь не найден'));
          return;
        }
        resolve({ id: userId, ...data });
      });
    });
  },
  
  /**
   * Получить статистику пользователя
   * (активная техника / всего получено / возвращено)
   */
  getUserStats(userId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM user_equipment WHERE user_id = ? AND returned_date IS NULL) as active_equipment,
          (SELECT COUNT(*) FROM user_equipment WHERE user_id = ?) as total_equipment,
          (SELECT COUNT(*) FROM user_equipment WHERE user_id = ? AND returned_date IS NOT NULL) as returned_equipment
      `, [userId, userId, userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
});