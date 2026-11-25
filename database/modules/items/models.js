// database/modules/items/models.js
// Номенклатура (item_models). Только SQL, параметризованные запросы.

module.exports = function(ctx) {
  const { all, get, run } = ctx;

  async function getItemModels(filters = {}) {
    const where = [];
    const params = [];

    if (filters.kind) {
      where.push('m.kind = ?');
      params.push(filters.kind);
    }
    if (filters.is_active !== undefined) {
      where.push('m.is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }
    if (filters.category_id) {
      where.push('m.category_id = ?');
      params.push(filters.category_id);
    }
    if (filters.type_id) {
      where.push('m.type_id = ?');
      params.push(filters.type_id);
    }
    if (filters.search) {
      where.push('(m.name LIKE ? OR m.corporate_id LIKE ?)');
      const like = `%${filters.search}%`;
      params.push(like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await all(`
      SELECT m.*,
             c.name AS category_name,
             t.name AS type_name
        FROM item_models m
        JOIN item_categories c ON c.id = m.category_id
        JOIN item_types      t ON t.id = m.type_id
        ${whereSql}
       ORDER BY m.name COLLATE NOCASE
    `, params);

    return rows || [];
  }

  async function getItemModelById(id) {
    const row = await get(`
      SELECT m.*,
             c.name AS category_name,
             t.name AS type_name
        FROM item_models m
        JOIN item_categories c ON c.id = m.category_id
        JOIN item_types      t ON t.id = m.type_id
       WHERE m.id = ?
    `, [id]);

    return row || null;
  }

  async function createItemModel(data) {
    const result = await run(`
      INSERT INTO item_models
        (corporate_id, name, unit, kind, category_id, type_id, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.corporate_id,
      data.name,
      data.unit || 'шт',
      data.kind || 'consumable',
      data.category_id,
      data.type_id,
      data.description || null,
    ]);

    return { id: result.lastID };
  }

  async function updateItemModel(id, data) {
    const result = await run(`
      UPDATE item_models
         SET corporate_id = ?,
             name         = ?,
             unit         = ?,
             category_id  = ?,
             type_id      = ?,
             description  = ?,
             updated_at   = CURRENT_TIMESTAMP
       WHERE id = ?
    `, [
      data.corporate_id,
      data.name,
      data.unit || 'шт',
      data.category_id,
      data.type_id,
      data.description || null,
      id,
    ]);

    return { changes: result.changes };
  }

  async function deleteItemModel(id) {
    const row = await get(
      'SELECT COUNT(*) AS cnt FROM items WHERE model_id = ?',
      [id]
    );

    if (row && row.cnt > 0) {
      throw new Error('model_has_stock');
    }

    const result = await run('DELETE FROM item_models WHERE id = ?', [id]);
    return { changes: result.changes };
  }
  // ============================================================
  // 5.16.2b.1: справочники для фильтров / селектов (только чтение)
  // ============================================================

  async function getItemCategories(onlyActive = true) {
    const whereSql = onlyActive ? 'WHERE is_active = 1' : '';
    const rows = await all(`
      SELECT id, name, icon, sort_order, is_active
        FROM item_categories
        ${whereSql}
       ORDER BY sort_order, name COLLATE NOCASE
    `);
    return rows || [];
  }

  async function getItemTypes(categoryId = null, onlyActive = true) {
    const where = [];
    const params = [];

    if (onlyActive) {
      where.push('is_active = 1');
    }
    if (categoryId) {
      where.push('category_id = ?');
      params.push(categoryId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await all(`
      SELECT id, category_id, name, icon, sort_order, is_active
        FROM item_types
        ${whereSql}
       ORDER BY sort_order, name COLLATE NOCASE
    `, params);

    return rows || [];
  }

  async function getItemWarehouses(onlyActive = true) {
    const whereSql = onlyActive ? 'WHERE is_active = 1' : '';
    const rows = await all(`
      SELECT id, name, address, is_default
        FROM warehouses
        ${whereSql}
       ORDER BY is_default DESC, name COLLATE NOCASE
    `);
    return rows || [];
  }
  return {
    getItemModels,
    getItemModelById,
    createItemModel,
    updateItemModel,
    deleteItemModel,
        // 5.16.2b.1: справочники
    getItemCategories,
    getItemTypes,
    getItemWarehouses,
  };
};