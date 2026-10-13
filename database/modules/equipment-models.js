// database/modules/equipment-models.js
// ============================================================
// Модели ТМЦ (equipment_models)
//
// Модель — это обобщённое описание устройства:
//   corporate_id + name + manufacturer + category + type.
//
// Экземпляры (equipment) ссылаются на модель через model_id.
// У модели может быть 0..N экземпляров.
// ============================================================

module.exports = ({ db, run, get, all }) => ({
  
  // ============================================================
  // ЧТЕНИЕ
  // ============================================================
  
  /**
   * Все модели с фильтрами и пагинацией
   *
   * @param {Object} opts
   * @param {number|null} opts.category_id
   * @param {number|null} opts.type_id
   * @param {string|null} opts.search       — по corporate_id, name, manufacturer
   * @param {number|null} opts.limit
   * @param {number|null} opts.offset
   * @param {boolean}     opts.include_total
   * @returns {Promise<Array|{items, total, limit, offset}>}
   */
  async getAllModels(opts = {}) {
    const {
      category_id = null,
      type_id = null,
      search = null,
      limit = null,
      offset = null,
      include_total = false,
    } = opts;
    
    const where = [];
    const params = [];
    
    if (category_id) {
      where.push('m.category_id = ?');
      params.push(category_id);
    }
    if (type_id) {
      where.push('m.type_id = ?');
      params.push(type_id);
    }
    if (search) {
      where.push(`(
        m.corporate_id LIKE ? OR
        m.name LIKE ? OR
        m.manufacturer LIKE ?
      )`);
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    
    let limitSql = '';
    if (limit !== null && limit !== undefined) {
      limitSql = `LIMIT ?`;
      params.push(limit);
      if (offset !== null && offset !== undefined) {
        limitSql += ` OFFSET ?`;
        params.push(offset);
      }
    }
    
    const itemsSql = `
      SELECT
        m.id,
        m.corporate_id,
        m.name,
        m.manufacturer,
        m.category_id,
        m.type_id,
        m.description,
        m.created_at,
        m.updated_at,
        c.name  AS category_name,
        c.icon  AS category_icon,
        t.name  AS type_name,
        t.icon  AS type_icon,
        (SELECT COUNT(*) FROM equipment e WHERE e.model_id = m.id) AS equipment_count
      FROM equipment_models m
      LEFT JOIN equipment_categories c ON c.id = m.category_id
      LEFT JOIN equipment_types      t ON t.id = m.type_id
      ${whereSql}
      ORDER BY m.name ASC, m.corporate_id ASC
      ${limitSql}
    `;
    
    const items = await all(itemsSql, params);
    
    if (!include_total) {
      return items;
    }
    
    // Считаем total по тем же фильтрам
    const countParams = params.filter((_, i) => {
      // params содержит фильтры + limit/offset в конце; для COUNT нужны только фильтры
      return i < params.length - (limit !== null && limit !== undefined ? (offset !== null && offset !== undefined ? 2 : 1) : 0);
    });
    
    const countSql = `
      SELECT COUNT(*) AS total
      FROM equipment_models m
      ${whereSql}
    `;
    const countRow = await get(countSql, countParams);
    
    return {
      items,
      total: countRow ? countRow.total : 0,
      limit,
      offset,
    };
  },
  
  /**
   * Модель по id (с категорией/типом и счётчиком экземпляров)
   */
  async getModelById(id) {
    const row = await get(`
      SELECT
        m.*,
        c.name  AS category_name,
        c.icon  AS category_icon,
        t.name  AS type_name,
        t.icon  AS type_icon,
        (SELECT COUNT(*) FROM equipment e WHERE e.model_id = m.id) AS equipment_count
      FROM equipment_models m
      LEFT JOIN equipment_categories c ON c.id = m.category_id
      LEFT JOIN equipment_types      t ON t.id = m.type_id
      WHERE m.id = ?
    `, [id]);
    return row || null;
  },
  
  /**
   * Модель по corporate_id
   */
  async getModelByCorporateId(corporateId) {
    const row = await get(`
      SELECT * FROM equipment_models WHERE corporate_id = ?
    `, [corporateId]);
    return row || null;
  },
  
  /**
   * Все модели с счётчиками (для страницы /admin/models и селектов)
   */
  async getModelsWithCounts() {
    return this.getAllModels({});
  },

    /**
   * Экземпляры модели — с полным адресом хранения
   * (склад/зона/стеллаж/ячейка ИЛИ офис/кабинет/место).
   */
  async getModelInstances(modelId) {
    return all(`
      SELECT
        e.id,
        e.inventory_number,
        e.serial_number,
        e.status,
        e.cell_id,
        e.workplace_id,
        -- Склад
        w.name   AS warehouse_name,
        z.name   AS zone_name,
        r.name   AS rack_name,
        c.name   AS cell_name,
        c.code   AS cell_code,
        -- Рабочее место
        o.name   AS office_name,
        rm.name  AS room_name,
        wp.name  AS workplace_name,
        wp.code  AS workplace_code
      FROM equipment e
      LEFT JOIN cells      c  ON c.id  = e.cell_id
      LEFT JOIN racks      r  ON r.id  = c.rack_id
      LEFT JOIN zones      z  ON z.id  = r.zone_id
      LEFT JOIN warehouses w  ON w.id  = z.warehouse_id
      LEFT JOIN workplaces wp ON wp.id = e.workplace_id
      LEFT JOIN rooms      rm ON rm.id = wp.room_id
      LEFT JOIN offices    o  ON o.id  = rm.office_id
      WHERE e.model_id = ?
      ORDER BY e.inventory_number ASC, e.id ASC
    `, [modelId]);
  },
  
  // ============================================================
  // ПРОВЕРКИ
  // ============================================================
  
  /**
   * Проверка уникальности corporate_id
   * @param {string} corporateId
   * @param {number|null} excludeId — исключить модель с этим id (для update)
   * @returns {Promise<boolean>} true — свободен
   */
  async isCorporateIdFree(corporateId, excludeId = null) {
    const params = [corporateId];
    let sql = `SELECT id FROM equipment_models WHERE corporate_id = ?`;
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    const row = await get(sql, params);
    return !row;
  },
  
  /**
   * Поиск модели-дубликата по (name, manufacturer) — предупреждение, не блокирует
   * @returns {Promise<Object|null>}
   */
  async findSimilarModel({ name, manufacturer, excludeId = null }) {
    const params = [name];
    let sql = `SELECT id, corporate_id, name, manufacturer
               FROM equipment_models
               WHERE name = ?`;
    if (manufacturer) {
      sql += ` AND (manufacturer = ? OR manufacturer IS NULL)`;
      params.push(manufacturer);
    }
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    sql += ` LIMIT 1`;
    const row = await get(sql, params);
    return row || null;
  },
  
  // ============================================================
  // СОЗДАНИЕ / ОБНОВЛЕНИЕ / УДАЛЕНИЕ
  // ============================================================
  
  /**
   * Создать модель
   *
   * @param {Object} data
   * @param {string} data.corporate_id  — обязателен, уникален
   * @param {string} data.name          — обязателен
   * @param {string} data.manufacturer
   * @param {number} data.category_id   — обязателен
   * @param {number} data.type_id       — обязателен
   * @param {string} data.description
   */
  async createModel(data) {
    const {
      corporate_id,
      name,
      manufacturer = null,
      category_id,
      type_id,
      description = null,
    } = data;
    
    const result = await run(`
      INSERT INTO equipment_models
        (corporate_id, name, manufacturer, category_id, type_id, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [corporate_id, name, manufacturer, category_id, type_id, description]);
    
    return { id: result.lastID, ...data };
  },
  
  /**
   * Обновить модель
   */
  async updateModel(id, data) {
    const {
      corporate_id,
      name,
      manufacturer = null,
      category_id,
      type_id,
      description = null,
    } = data;
    
    const result = await run(`
      UPDATE equipment_models
      SET corporate_id = ?,
          name         = ?,
          manufacturer = ?,
          category_id  = ?,
          type_id      = ?,
          description  = ?,
          updated_at   = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [corporate_id, name, manufacturer, category_id, type_id, description, id]);
    
    if (result.changes === 0) {
      throw new Error('Модель не найдена');
    }
    return { id, ...data };
  },
  
  /**
   * Удалить модель.
   * Нельзя удалить, если есть экземпляры.
   */
  async deleteModel(id) {
    const row = await get(
      `SELECT COUNT(*) AS cnt FROM equipment WHERE model_id = ?`,
      [id]
    );
    if (row.cnt > 0) {
      throw new Error(
        `Нельзя удалить модель: к ней привязано ${row.cnt} экземпляров техники.`
      );
    }
    
    const result = await run(`DELETE FROM equipment_models WHERE id = ?`, [id]);
    if (result.changes === 0) {
      throw new Error('Модель не найдена');
    }
    return { deleted: result.changes };
  },
});