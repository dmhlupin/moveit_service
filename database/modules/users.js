// database/modules/users.js
// Работа с пользователями: CRUD, детали, удаление

module.exports = ({ db, run, get, all }) => ({
  
  /**
   * Получить всех пользователей
   */
  getAllUsers() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM users ORDER BY full_name',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },
  
  /**
   * Получить пользователя по ID
   */
  getUserById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },
  
  /**
   * Получить пользователя с расширенной информацией
   * (включая количество техники)
   */
  getUserWithDetails(userId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          u.*,
          (SELECT COUNT(*) FROM user_equipment WHERE user_id = u.id AND returned_date IS NULL) as active_equipment_count,
          (SELECT COUNT(*) FROM user_equipment WHERE user_id = u.id) as total_equipment_count
        FROM users u
        WHERE u.id = ?
      `, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  
  /**
   * Получить всех пользователей с расширенной информацией
   * (включая количество техники)
   */
  getAllUsersWithDetails() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.department,
          u.phone,
          u.role,
          u.is_active,
          u.must_change_password,
          u.last_login,
          u.created_at,
          (SELECT COUNT(*) FROM user_equipment WHERE user_id = u.id AND returned_date IS NULL) as active_equipment_count,
          (SELECT COUNT(*) FROM user_equipment WHERE user_id = u.id) as total_equipment_count
        FROM users u
        ORDER BY u.is_active DESC, u.full_name ASC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Получить всех пользователей с их техникой (сводка)
   * Используется на странице /users
   */
  getUsersWithEquipment() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          u.*,
          GROUP_CONCAT(
            m.name || ' (' || e.inventory_number || ')', 
            ', '
          ) as equipment_list,
          COUNT(ue.id) as equipment_count
        FROM users u
        LEFT JOIN user_equipment ue ON u.id = ue.user_id AND ue.returned_date IS NULL
        LEFT JOIN equipment e ON ue.equipment_id = e.id
        LEFT JOIN equipment_models m ON m.id = e.model_id
        GROUP BY u.id
        ORDER BY u.full_name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Создать пользователя с паролем
   */
  createUserWithPassword(userData) {
    return new Promise((resolve, reject) => {
      const { 
        username, email, full_name, department, phone, 
        password_hash, role = 'user', must_change_password = 1 
      } = userData;
      
      db.run(`
        INSERT INTO users 
        (username, email, full_name, department, phone, password_hash, role, is_active, must_change_password) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `, [
        username, email, full_name, department, phone, 
        password_hash, role, must_change_password
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, ...userData });
      });
    });
  },
  
  /**
   * Проверить, существует ли пользователь с таким логином или email
   */
  checkUserExists(username, email, excludeId = null) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT id, username, email FROM users WHERE (username = ? OR email = ?)';
      const params = [username, email];
      
      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }
      
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  
  /**
   * Удалить пользователя с авто-возвратом всей его техники
   * Использует транзакцию для атомарности
   */
  deleteUserWithEquipmentReturn(userId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 1. Находим всю активную технику пользователя
        db.all(
          `SELECT equipment_id FROM user_equipment 
           WHERE user_id = ? AND returned_date IS NULL`,
          [userId],
          (err, rows) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const equipmentIds = rows.map(r => r.equipment_id);
            
            // 2. Возвращаем технику (устанавливаем returned_date)
            db.run(`
              UPDATE user_equipment 
              SET returned_date = CURRENT_TIMESTAMP, 
                  condition_on_return = 'Возвращена при удалении пользователя',
                  notes = COALESCE(notes, '') || ' | Автовозврат при удалении пользователя'
              WHERE user_id = ? AND returned_date IS NULL
            `, [userId], function(err) {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              // 3. Обновляем статус техники на available
              const updateEquipmentStatus = (callback) => {
                if (equipmentIds.length > 0) {
                  const placeholders = equipmentIds.map(() => '?').join(',');
                  db.run(`
                    UPDATE equipment 
                    SET status = 'available', updated_at = CURRENT_TIMESTAMP 
                    WHERE id IN (${placeholders})
                  `, equipmentIds, callback);
                } else {
                  callback(null);
                }
              };
              
              updateEquipmentStatus((err) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                
                // 4. Удаляем пользователя
                db.run(
                  'DELETE FROM users WHERE id = ?',
                  [userId],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      reject(err);
                      return;
                    }
                    
                    const deleted = this.changes;
                    
                    db.run('COMMIT', (err) => {
                      if (err) {
                        reject(err);
                        return;
                      }
                      
                      resolve({
                        deleted,
                        equipment_returned: equipmentIds.length
                      });
                    });
                  }
                );
              });
            });
          }
        );
      });
    });
  }
  
});