// database/modules/equipment/helpers.js
// ============================================================
// Общие хелперы модуля equipment:
//   - EQUIPMENT_SELECT_BASE — базовый SELECT (equipment + model + fixed_assets)
//   - checkCellAvailability — обёртка над ./cells
//   - checkUniqueSerialAndInventory — уникальность инв./серийного
//   - isFixedAsset / upsertFixedAsset — основные средства (5.15.1)
// ============================================================

const { checkCellAvailability } = require('../cells');

/**
 * Базовый SELECT для «полного» экземпляра:
 * equipment + model + fixed_assets (LEFT).
 * Добавляет поля: is_fixed_asset (0/1), commissioning_date,
 * initial_cost, useful_life_months.
 *
 * Сейчас не используется (задел на 5.15.2). Экспортируется
 * наружу — пригодится в отладке/тестах и в read.js.
 */
const EQUIPMENT_SELECT_BASE = `
  SELECT e.*,
         m.name         AS model_name,
         m.corporate_id AS model_corporate_id,
         m.manufacturer AS model_manufacturer,
         m.category_id  AS category_id,
         m.type_id      AS type_id,
         CASE WHEN fa.equipment_id IS NOT NULL THEN 1 ELSE 0 END AS is_fixed_asset,
         fa.commissioning_date,
         fa.initial_cost,
         fa.useful_life_months
    FROM equipment e
    JOIN equipment_models m ON m.id = e.model_id
    LEFT JOIN fixed_assets fa ON fa.equipment_id = e.id
`;

module.exports = ({ db, run, get, all }) => {

  /**
   * Проверяет уникальность inventory_number и serial_number.
   * NULL разрешён и не считается коллизией.
   */
  async function checkUniqueSerialAndInventory(inventoryNumber, serialNumber, excludeId = null) {
    const inv = inventoryNumber ? String(inventoryNumber).trim() : null;
    const sn  = serialNumber    ? String(serialNumber).trim()    : null;

    if (inv) {
      const params = [inv];
      let sql = `SELECT id FROM equipment WHERE inventory_number = ?`;
      if (excludeId) { sql += ` AND id != ?`; params.push(excludeId); }
      const row = await get(sql, params);
      if (row) {
        return { ok: false, reason: 'duplicate_inventory_number', field: 'inventory_number', conflict_id: row.id };
      }
    }

    if (sn) {
      const params = [sn];
      let sql = `SELECT id FROM equipment WHERE serial_number = ?`;
      if (excludeId) { sql += ` AND id != ?`; params.push(excludeId); }
      const row = await get(sql, params);
      if (row) {
        return { ok: false, reason: 'duplicate_serial_number', field: 'serial_number', conflict_id: row.id };
      }
    }

    return { ok: true };
  }

  /**
   * 5.15.1: Является ли экземпляр основным средством.
   */
  async function isFixedAsset(equipmentId) {
    const row = await get(
      'SELECT 1 FROM fixed_assets WHERE equipment_id = ?',
      [equipmentId]
    );
    return !!row;
  }

  /**
   * 5.15.1: Создать/обновить/удалить ОС-запись.
   *   data.is_fixed_asset = true  → INSERT ... ON CONFLICT UPDATE
   *   data.is_fixed_asset = false → DELETE (если была)
   *
   * Инварианты:
   *   - commissioning_date обязательна для ОС;
   *   - ОС ⇒ is_quantity_accounted = 1 (принудительно; триггер тоже страхует).
   *
   * Транзакцию НЕ открывает — вызывающий код (addEquipment /
   * updateEquipment в 5.15.2) оборачивает всё в BEGIN/COMMIT.
   * Так избегаем вложенных транзакций (SQLite их не любит).
   */
  async function upsertFixedAsset(equipmentId, data) {
    if (!data || typeof data.is_fixed_asset === 'undefined') {
      return; // не трогаем ОС-запись
    }

    if (!data.is_fixed_asset) {
      await run('DELETE FROM fixed_assets WHERE equipment_id = ?', [equipmentId]);
      return;
    }

    if (!data.commissioning_date) {
      throw new Error('Дата ввода в эксплуатацию обязательна для основного средства');
    }

    await run(`
      INSERT INTO fixed_assets
        (equipment_id, commissioning_date, initial_cost, useful_life_months)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(equipment_id) DO UPDATE SET
        commissioning_date = excluded.commissioning_date,
        initial_cost       = excluded.initial_cost,
        useful_life_months = excluded.useful_life_months,
        updated_at         = datetime('now')
    `, [
      equipmentId,
      data.commissioning_date,
      data.initial_cost ?? null,
      data.useful_life_months ?? null,
    ]);

    // Страховка (триггер тоже сработает, но явно — надёжнее)
    await run(
      'UPDATE equipment SET is_quantity_accounted = 1 WHERE id = ? AND is_quantity_accounted = 0',
      [equipmentId]
    );
  }

  return {
    EQUIPMENT_SELECT_BASE,
    checkCellAvailability(cellId, excludeEquipmentId = null) {
      return checkCellAvailability(db, cellId, excludeEquipmentId);
    },
    checkUniqueSerialAndInventory,
    isFixedAsset,
    upsertFixedAsset,
  };
};