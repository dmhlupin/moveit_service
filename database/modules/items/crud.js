// database/modules/items/crud.js
// Остатки (items). Только SQL. Scope (МОЛ) — отдельным слоем.

module.exports = function(ctx) {
  const { db, all, get, run } = ctx;

  async function getItems(filters = {}, scopeWhere = null) {
    const where = [];
    const params = [];

    if (filters.kind) {
      where.push('m.kind = ?');
      params.push(filters.kind);
    }
    if (filters.is_active !== undefined) {
      where.push('s.is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }
    if (filters.warehouse_id) {
      where.push('s.warehouse_id = ?');
      params.push(filters.warehouse_id);
    }
    if (filters.model_id) {
      where.push('s.model_id = ?');
      params.push(filters.model_id);
    }
    if (filters.low_stock) {
      where.push('s.quantity <= s.min_quantity AND s.min_quantity > 0');
    }

    if (scopeWhere && scopeWhere.sql) {
      where.push(scopeWhere.sql);
      params.push(...scopeWhere.params);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await all(`
      SELECT s.*,
             m.name         AS model_name,
             m.unit         AS unit,
             m.kind         AS kind,
             m.corporate_id AS corporate_id,
             c.name         AS category_name,
             t.name         AS type_name,
             w.name         AS warehouse_name
        FROM items s
        JOIN item_models      m ON m.id = s.model_id
        JOIN item_categories  c ON c.id = m.category_id
        JOIN item_types       t ON t.id = m.type_id
        JOIN warehouses       w ON w.id = s.warehouse_id
        ${whereSql}
       ORDER BY m.name COLLATE NOCASE, w.name COLLATE NOCASE
    `, params);

    return rows || [];
  }

  async function getItemById(id) {
    const row = await get(`
      SELECT s.*,
             m.name         AS model_name,
             m.unit         AS unit,
             m.kind         AS kind,
             m.corporate_id AS corporate_id,
             c.name         AS category_name,
             t.name         AS type_name,
             w.name         AS warehouse_name
        FROM items s
        JOIN item_models      m ON m.id = s.model_id
        JOIN item_categories  c ON c.id = m.category_id
        JOIN item_types       t ON t.id = m.type_id
        JOIN warehouses       w ON w.id = s.warehouse_id
       WHERE s.id = ?
    `, [id]);

    return row || null;
  }

  async function createItem(data) {
    const result = await run(`
      INSERT INTO items
        (model_id, warehouse_id, quantity, min_quantity, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      data.model_id,
      data.warehouse_id,
      data.quantity ?? 0,
      data.min_quantity ?? 0,
      data.is_active === undefined ? 1 : (data.is_active ? 1 : 0),
    ]);

    return { id: result.lastID };
  }

  async function updateItem(id, data) {
    const result = await run(`
      UPDATE items
         SET quantity     = ?,
             min_quantity = ?,
             is_active    = ?,
             updated_at   = CURRENT_TIMESTAMP
       WHERE id = ?
    `, [
      data.quantity ?? 0,
      data.min_quantity ?? 0,
      data.is_active === undefined ? 1 : (data.is_active ? 1 : 0),
      id,
    ]);

    return { changes: result.changes };
  }

  async function deleteItem(id) {
    const result = await run('DELETE FROM items WHERE id = ?', [id]);
    return { changes: result.changes };
  }

  // Атомарный приход/расход остатка.
  // Через голый db — нужен serialize + BEGIN/COMMIT/ROLLBACK.
  function adjustItemQuantity(id, delta) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE');

        db.get(
          'SELECT quantity FROM items WHERE id = ?',
          [id],
          (err, row) => {
            if (err) {
              return db.run('ROLLBACK', () => reject(err));
            }
            if (!row) {
              return db.run('ROLLBACK', () => reject(new Error('not_found')));
            }

            const next = (row.quantity || 0) + Number(delta);
            if (next < 0) {
              return db.run('ROLLBACK', () => reject(new Error('negative_quantity')));
            }

            db.run(
              'UPDATE items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [next, id],
              function(err2) {
                if (err2) {
                  return db.run('ROLLBACK', () => reject(err2));
                }
                db.run('COMMIT', (err3) => {
                  if (err3) reject(err3);
                  else resolve({ id, quantity: next });
                });
              }
            );
          }
        );
      });
    });
  }

  return {
    getItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem,
    adjustItemQuantity,
  };
};