// database/modules/dashboard.js
// Данные для дашборда: статистика, активность, требующее внимания

module.exports = ({ db, run, get, all }) => ({
  
    /**
     * Получить расширенную статистику для дашборда
     */
  getDashboardStats(scope = {}) {
    return new Promise((resolve, reject) => {
      const isMol = scope.role === 'mol';
      const uid = parseInt(scope.userId, 10) || 0;
      const f = isMol ? ` WHERE e.responsible_user_id = ${uid}` : '';
      const fAnd = isMol ? ` AND e.responsible_user_id = ${uid}` : '';

      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM equipment e${f}) as total_equipment,
          (SELECT COUNT(*) FROM equipment e WHERE e.status = 'available'${fAnd}) as available_equipment,
          (SELECT COUNT(*) FROM equipment e WHERE e.status = 'assigned'${fAnd}) as assigned_equipment,
          (SELECT COUNT(*) FROM equipment e WHERE e.status = 'maintenance'${fAnd}) as maintenance_equipment,
          (SELECT COUNT(*) FROM equipment e WHERE e.status = 'retired'${fAnd}) as retired_equipment,
          (SELECT COUNT(*) FROM users WHERE is_active = 1) as active_users,
          (SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1) as admins_count,
          (SELECT COUNT(*) FROM users WHERE is_active = 0) as blocked_users,
          (SELECT COUNT(*) FROM user_equipment WHERE returned_date IS NULL) as active_assignments,
          (SELECT COUNT(*) FROM activity_log WHERE created_at >= datetime('now', '-1 day')) as actions_today
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
    
    /**
     * Получить последние действия пользователей
     */
  getRecentActivity(limit = 10, scope = {}) {
    return new Promise((resolve, reject) => {
      const isMol = scope.role === 'mol';
      const uid = parseInt(scope.userId, 10) || 0;
      const where = isMol ? `WHERE al.user_id = ${uid}` : '';

      db.all(`
        SELECT 
          al.id, al.user_id, al.username, al.action, al.entity_type,
          al.entity_id, al.details, al.created_at,
          u.full_name as user_full_name,
          u.department as user_department
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ${where}
        ORDER BY al.id DESC
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Получить технику, требующую внимания:
   * - в ремонте
   * - истекающая гарантия
   * - просроченная гарантия
   * - без владельца > 6 месяцев
   *
   * 🆕 scope: { userId, role } — для mol фильтруем по responsible_user_id.
   */
  getEquipmentNeedingAttention(scope = {}) {
    return new Promise((resolve, reject) => {
      const isMol = scope.role === 'mol';
      const uid = parseInt(scope.userId, 10) || 0;
      const molFilter = isMol ? ` AND e.responsible_user_id = ${uid}` : '';

      // Техника в ремонте
      const maintenancePromise = new Promise((res, rej) => {
        db.all(`
          SELECT
            e.id,
            e.inventory_number,
            m.name         AS model_name,
            m.corporate_id AS model_corporate_id,
            e.status
          FROM equipment e
          JOIN equipment_models m ON m.id = e.model_id
          WHERE e.status = 'maintenance'${molFilter}
          ORDER BY e.updated_at DESC
          LIMIT 5
        `, (err, rows) => {
          if (err) rej(err);
          else res(rows || []);
        });
      });
      
      // Гарантия истекает в ближайшие 30 дней
      const warrantySoonPromise = new Promise((res, rej) => {
        db.all(`
          SELECT
            e.id,
            e.inventory_number,
            m.name         AS model_name,
            m.corporate_id AS model_corporate_id,
            e.warranty_until,
            CAST(julianday(e.warranty_until) - julianday('now') AS INTEGER) as days_left
          FROM equipment e
          JOIN equipment_models m ON m.id = e.model_id
          WHERE e.warranty_until IS NOT NULL
            AND e.warranty_until >= date('now')
            AND e.warranty_until <= date('now', '+30 days')${molFilter}
          ORDER BY e.warranty_until ASC
          LIMIT 10
        `, (err, rows) => {
          if (err) rej(err);
          else res(rows || []);
        });
      });
      
      // Просроченная гарантия
      const warrantyExpiredPromise = new Promise((res, rej) => {
        db.all(`
          SELECT
            e.id,
            e.inventory_number,
            m.name         AS model_name,
            m.corporate_id AS model_corporate_id,
            e.warranty_until,
            CAST(julianday('now') - julianday(e.warranty_until) AS INTEGER) as days_expired
          FROM equipment e
          JOIN equipment_models m ON m.id = e.model_id
          WHERE e.warranty_until IS NOT NULL
            AND e.warranty_until < date('now')${molFilter}
          ORDER BY e.warranty_until ASC
          LIMIT 10
        `, (err, rows) => {
          if (err) rej(err);
          else res(rows || []);
        });
      });
      
      // Техника долго без владельца (available > 180 дней от покупки)
      const longAvailablePromise = new Promise((res, rej) => {
        db.all(`
          SELECT
            e.id,
            e.inventory_number,
            m.name         AS model_name,
            m.corporate_id AS model_corporate_id,
            e.purchase_date
          FROM equipment e
          JOIN equipment_models m ON m.id = e.model_id
          WHERE e.status = 'available'
            AND e.purchase_date IS NOT NULL
            AND e.purchase_date <= date('now', '-180 days')${molFilter}
          ORDER BY e.purchase_date ASC
          LIMIT 5
        `, (err, rows) => {
          if (err) rej(err);
          else res(rows || []);
        });
      });
      
      Promise.all([
        maintenancePromise,
        warrantySoonPromise,
        warrantyExpiredPromise,
        longAvailablePromise
      ]).then(([maintenance, warrantySoon, warrantyExpired, longAvailable]) => {
        resolve({
          maintenance,
          warrantySoon,
          warrantyExpired,
          longAvailable
        });
      }).catch(reject);
    });
  },
  
  /**
   * Получить данные для графика активности
   * (по дням за N дней, включая пустые дни)
   */
  getDashboardActivityByDay(days = 14) {
    return new Promise((resolve, reject) => {
      db.all(`
        WITH RECURSIVE dates(d) AS (
          SELECT date('now', '-' || (? - 1) || ' days')
          UNION ALL
          SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
        )
        SELECT 
          dates.d as date,
          COALESCE(COUNT(al.id), 0) as count
        FROM dates
        LEFT JOIN activity_log al ON date(al.created_at) = dates.d
        GROUP BY dates.d
        ORDER BY dates.d ASC
      `, [days], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Получить топ активных пользователей за 30 дней
   *
   * 🆕 scope: { userId, role } — для mol показываем только его самого.
   */
  getTopUsers(limit = 5, scope = {}) {
    return new Promise((resolve, reject) => {
      const isMol = scope.role === 'mol';
      const uid = parseInt(scope.userId, 10) || 0;
      const molFilter = isMol ? ` AND u.id = ${uid}` : '';

      db.all(`
        SELECT 
          u.id,
          u.username,
          u.full_name,
          u.department,
          COUNT(al.id) as actions_count
        FROM users u
        JOIN activity_log al ON u.id = al.user_id
        WHERE al.created_at >= datetime('now', '-30 days')${molFilter}
        GROUP BY u.id
        ORDER BY actions_count DESC
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Получить статистику по категориям для дашборда
   * Возвращает: список категорий с количеством техники и процентом
   */
  getCategoryStats(scope = {}) {
    return new Promise((resolve, reject) => {
      const isMol = scope.role === 'mol';
      const uid = parseInt(scope.userId, 10) || 0;
      const molFilter = isMol ? ` AND e.responsible_user_id = ${uid}` : '';

      db.all(`
        SELECT 
          c.id, c.name, c.icon, c.sort_order,
          (SELECT COUNT(*) FROM equipment e
            JOIN equipment_models m ON m.id = e.model_id
            WHERE m.category_id = c.id${molFilter}
          ) as equipment_count,
          (SELECT COUNT(*) FROM equipment_types WHERE category_id = c.id AND is_active = 1) as types_count
        FROM equipment_categories c
        WHERE c.is_active = 1
        ORDER BY equipment_count DESC, c.sort_order ASC
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const total = (rows || []).reduce((sum, r) => sum + (r.equipment_count || 0), 0);
        const result = (rows || []).map(r => ({
          ...r,
          percent: total > 0 ? Math.round((r.equipment_count / total) * 100) : 0
        }));
        resolve({ categories: result, total });
      });
    });
  },  
});