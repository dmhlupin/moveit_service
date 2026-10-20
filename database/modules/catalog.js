// database/modules/catalog.js
// Работа со справочником: категории и типы техники

module.exports = ({ db, run, get, all }) => ({
  
  // ============================================================
  // КАТЕГОРИИ
  // ============================================================
  
  /**
   * Получить все категории с количеством моделей и экземпляров
   */
  getAllCategories() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          c.id,
          c.name,
          c.description,
          c.icon,
          c.sort_order,
          c.is_active,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM equipment_types WHERE category_id = c.id AND is_active = 1) as types_count,
          (SELECT COUNT(*) FROM equipment_models WHERE category_id = c.id) as models_count,
          (SELECT COUNT(*)
             FROM equipment e
             JOIN equipment_models m ON m.id = e.model_id
            WHERE m.category_id = c.id) as equipment_count
        FROM equipment_categories c
        ORDER BY c.sort_order ASC, c.name ASC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Получить категорию по ID
   */
  getCategoryById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM equipment_types WHERE category_id = c.id) as types_count,
          (SELECT COUNT(*) FROM equipment_models WHERE category_id = c.id) as models_count,
          (SELECT COUNT(*)
             FROM equipment e
             JOIN equipment_models m ON m.id = e.model_id
            WHERE m.category_id = c.id) as equipment_count
        FROM equipment_categories c
        WHERE c.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  
  /**
   * Создать категорию
   */
  createCategory(data) {
    return new Promise((resolve, reject) => {
      const { name, description, icon, sort_order, import_id } = data;
      
      db.run(`
        INSERT INTO equipment_categories (name, description, icon, sort_order, is_active, import_id)
        VALUES (?, ?, ?, ?, 1, ?)
      `, [name, description || null, icon || null, sort_order || 0, import_id || null], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, ...data });
      });
    });
  },
  
  /**
   * Обновить категорию
   */
  updateCategory(id, data) {
    return new Promise((resolve, reject) => {
      const { name, description, icon, sort_order, is_active } = data;
      
      db.run(`
        UPDATE equipment_categories 
        SET name = ?, description = ?, icon = ?, sort_order = ?, 
            is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name, 
        description || null, 
        icon || null, 
        sort_order !== undefined ? sort_order : 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        if (this.changes === 0) {
          reject(new Error('Категория не найдена'));
          return;
        }
        resolve({ id, ...data });
      });
    });
  },
  
  /**
   * Удалить категорию
   * Нельзя удалить, если есть типы или модели с этой категорией
   */
  deleteCategory(id) {
    return new Promise((resolve, reject) => {
      // Проверяем типы
      db.get(
        'SELECT COUNT(*) as count FROM equipment_types WHERE category_id = ?',
        [id],
        (err, typesRow) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (typesRow.count > 0) {
            reject(new Error(`Нельзя удалить категорию: в ней ${typesRow.count} типов. Сначала удалите типы.`));
            return;
          }
          
          // Проверяем модели
          db.get(
            'SELECT COUNT(*) as count FROM equipment_models WHERE category_id = ?',
            [id],
            (err, modelsRow) => {
              if (err) {
                reject(err);
                return;
              }
              
              if (modelsRow.count > 0) {
                reject(new Error(`Нельзя удалить категорию: к ней привязано ${modelsRow.count} моделей.`));
                return;
              }
              
              db.run('DELETE FROM equipment_categories WHERE id = ?', [id], function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve({ deleted: this.changes });
              });
            }
          );
        }
      );
    });
  },
  
  /**
   * Изменить порядок категорий
   */
  reorderCategories(order) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(order) || order.length === 0) {
        reject(new Error('Ожидается непустой массив order'));
        return;
      }
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(`
          UPDATE equipment_categories 
          SET sort_order = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);
        
        let hasError = false;
        order.forEach(item => {
          stmt.run(item.sort_order, item.id, (err) => {
            if (err) hasError = true;
          });
        });
        
        stmt.finalize((err) => {
          if (err || hasError) {
            db.run('ROLLBACK');
            reject(err || new Error('Ошибка обновления порядка'));
            return;
          }
          
          db.run('COMMIT', (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve({ updated: order.length });
          });
        });
      });
    });
  },
  
  // ============================================================
  // ТИПЫ
  // ============================================================
  
  /**
   * Получить все типы (с опциональной фильтрацией по категории)
   */
  getAllTypes(categoryId = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT 
          t.id,
          t.category_id,
          t.name,
          t.description,
          t.icon,
          t.sort_order,
          t.is_active,
          t.created_at,
          t.updated_at,
          c.name as category_name,
          c.icon as category_icon,
          (SELECT COUNT(*) FROM equipment_models WHERE type_id = t.id) as models_count,
          (SELECT COUNT(*)
             FROM equipment e
             JOIN equipment_models m ON m.id = e.model_id
            WHERE m.type_id = t.id) as equipment_count
        FROM equipment_types t
        JOIN equipment_categories c ON t.category_id = c.id
        WHERE 1=1
      `;
      const params = [];
      
      if (categoryId) {
        sql += ' AND t.category_id = ?';
        params.push(categoryId);
      }
      
      sql += ' ORDER BY c.sort_order ASC, t.sort_order ASC, t.name ASC';
      
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  
  /**
   * Получить тип по ID
   */
  getTypeById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          t.*,
          c.name as category_name,
          (SELECT COUNT(*) FROM equipment_models WHERE type_id = t.id) as models_count,
          (SELECT COUNT(*)
             FROM equipment e
             JOIN equipment_models m ON m.id = e.model_id
            WHERE m.type_id = t.id) as equipment_count
        FROM equipment_types t
        JOIN equipment_categories c ON t.category_id = c.id
        WHERE t.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  
  /**
   * Создать тип
   */
  createType(data) {
    return new Promise((resolve, reject) => {
      const { category_id, name, description, icon, sort_order, import_id } = data;
      
      db.get('SELECT id FROM equipment_categories WHERE id = ?', [category_id], (err, cat) => {
        if (err) {
          reject(err);
          return;
        }
        if (!cat) {
          reject(new Error('Категория не найдена'));
          return;
        }
        
        db.run(`
          INSERT INTO equipment_types (category_id, name, description, icon, sort_order, is_active, import_id)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `, [category_id, name, description || null, icon || null, sort_order || 0, import_id || null], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error('Тип с таким названием уже существует в этой категории'));
            } else {
              reject(err);
            }
            return;
          }
          resolve({ id: this.lastID, ...data });
        });
      });
    });
  },
  
  /**
   * Обновить тип
   */
  updateType(id, data) {
    return new Promise((resolve, reject) => {
      const { category_id, name, description, icon, sort_order, is_active } = data;
      
      db.run(`
        UPDATE equipment_types 
        SET category_id = ?, name = ?, description = ?, icon = ?, 
            sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        category_id,
        name, 
        description || null, 
        icon || null, 
        sort_order !== undefined ? sort_order : 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
      ], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('Тип с таким названием уже существует в этой категории'));
          } else {
            reject(err);
          }
          return;
        }
        if (this.changes === 0) {
          reject(new Error('Тип не найден'));
          return;
        }
        resolve({ id, ...data });
      });
    });
  },
  
  /**
   * Удалить тип
   * Нельзя удалить, если есть модели с этим типом
   */
  deleteType(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM equipment_models WHERE type_id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (row.count > 0) {
            reject(new Error(`Нельзя удалить тип: к нему привязано ${row.count} моделей.`));
            return;
          }
          
          db.run('DELETE FROM equipment_types WHERE id = ?', [id], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve({ deleted: this.changes });
          });
        }
      );
    });
  },
  
  /**
   * Изменить порядок типов
   */
  reorderTypes(order) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(order) || order.length === 0) {
        reject(new Error('Ожидается непустой массив order'));
        return;
      }
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(`
          UPDATE equipment_types 
          SET sort_order = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);
        
        let hasError = false;
        order.forEach(item => {
          stmt.run(item.sort_order, item.id, (err) => {
            if (err) hasError = true;
          });
        });
        
        stmt.finalize((err) => {
          if (err || hasError) {
            db.run('ROLLBACK');
            reject(err || new Error('Ошибка обновления порядка'));
            return;
          }
          
          db.run('COMMIT', (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve({ updated: order.length });
          });
        });
      });
    });
  }
  
});