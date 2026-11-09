// database/modules/equipment/write.js
// ============================================================
// CRUD экземпляров: addEquipment, updateEquipment, deleteEquipment.
// 1:1 по поведению с database/modules/equipment.js (до 5.15.1a).
// ОС-логика (upsertFixedAsset) подключается в 5.15.2 — сейчас
// addEquipment / updateEquipment её НЕ вызывают.
// ============================================================

module.exports = ({ db, run, get, all }, helpers) => {
  const { checkUniqueSerialAndInventory } = helpers;

  return {

    /**
     * Добавить экземпляр техники.
     */
    async addEquipment(eqData) {
      const {
        model_id,
        inventory_number = null,
        serial_number    = null,
        status           = 'available',
        cell_id          = null,
        workplace_id     = null,
        purchase_date    = null,
        warranty_until   = null,
        description      = null,
        responsible_user_id = null,
        import_id           = null,
      } = eqData;

      if (!model_id) {
        throw new Error('Не указана модель техники (model_id)');
      }

      const model = await get('SELECT id FROM equipment_models WHERE id = ?', [model_id]);
      if (!model) throw new Error('Модель не найдена');

      const uniq = await checkUniqueSerialAndInventory(
        inventory_number, serial_number, null
      );
      if (!uniq.ok) {
        if (uniq.reason === 'duplicate_inventory_number') {
          throw new Error(`Инвентарный номер "${inventory_number}" уже используется`);
        }
        if (uniq.reason === 'duplicate_serial_number') {
          throw new Error(`Серийный номер "${serial_number}" уже используется`);
        }
        throw new Error('Нарушение уникальности');
      }

      const inv = inventory_number ? String(inventory_number).trim() : null;
      const sn  = serial_number    ? String(serial_number).trim()    : null;

      const result = await run(`
        INSERT INTO equipment
          (model_id, inventory_number, serial_number, status,
           cell_id, workplace_id,
           purchase_date, warranty_until, description,
           responsible_user_id, import_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        model_id, inv, sn, status || 'available',
        cell_id || null, workplace_id || null,
        purchase_date || null, warranty_until || null, description || null,
        responsible_user_id || null, import_id,
      ]);

      return { id: result.lastID, ...eqData };
    },

    /**
     * Обновить экземпляр техники.
     */
    async updateEquipment(id, eqData) {
      if (!id || isNaN(id)) throw new Error('Неверный ID техники');
      const idNum = parseInt(id, 10);

      const {
        model_id,
        inventory_number = null,
        serial_number    = null,
        status           = 'available',
        cell_id          = null,
        workplace_id     = null,
        purchase_date    = null,
        warranty_until   = null,
        description      = null,
        responsible_user_id = undefined,
      } = eqData;

      if (!model_id) throw new Error('Не указана модель техники (model_id)');

      const equipment = await get('SELECT id, status FROM equipment WHERE id = ?', [idNum]);
      if (!equipment) throw new Error('Техника не найдена');

      const model = await get('SELECT id FROM equipment_models WHERE id = ?', [model_id]);
      if (!model) throw new Error('Модель не найдена');

      const uniq = await checkUniqueSerialAndInventory(
        inventory_number, serial_number, idNum
      );
      if (!uniq.ok) {
        if (uniq.reason === 'duplicate_inventory_number') {
          throw new Error(`Инвентарный номер "${inventory_number}" уже используется`);
        }
        if (uniq.reason === 'duplicate_serial_number') {
          throw new Error(`Серийный номер "${serial_number}" уже используется`);
        }
        throw new Error('Нарушение уникальности');
      }

      const inv = inventory_number ? String(inventory_number).trim() : null;
      const sn  = serial_number    ? String(serial_number).trim()    : null;

      const oldStatus = equipment.status;

      // assigned → available — автовозврат
      if (oldStatus === 'assigned' && status === 'available') {
        const assignment = await get(
          `SELECT id FROM user_equipment
           WHERE equipment_id = ? AND returned_date IS NULL`,
          [idNum]
        );

        const setRespSql = (responsible_user_id !== undefined) ? ', responsible_user_id = ?' : '';
        const paramsResp = (responsible_user_id !== undefined) ? [responsible_user_id] : [];

        const upd = await run(`
          UPDATE equipment
          SET model_id = ?, inventory_number = ?, serial_number = ?,
              status = ?, description = ?,
              purchase_date = ?, warranty_until = ?,
              cell_id = NULL, workplace_id = NULL
              ${setRespSql},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          model_id, inv, sn, status, description,
          purchase_date || null, warranty_until || null,
          ...paramsResp,
          idNum
        ]);

        if (upd.changes === 0) throw new Error('Техника не найдена');

        if (assignment) {
          await run(`
            UPDATE user_equipment
            SET returned_date = CURRENT_TIMESTAMP,
                condition_on_return = ?
            WHERE id = ?
          `, ['Возвращена при изменении статуса', assignment.id]);
        }

        return { id: idNum, ...eqData, returned: !!assignment };
      }

      // Обычное обновление
      const setRespSql = (responsible_user_id !== undefined) ? ', responsible_user_id = ?' : '';
      const paramsResp = (responsible_user_id !== undefined) ? [responsible_user_id] : [];

      const upd = await run(`
        UPDATE equipment
        SET model_id = ?, inventory_number = ?, serial_number = ?,
            status = ?, description = ?,
            purchase_date = ?, warranty_until = ?,
            cell_id = ?, workplace_id = ?
            ${setRespSql},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        model_id, inv, sn, status, description,
        purchase_date || null, warranty_until || null,
        cell_id || null, workplace_id || null,
        ...paramsResp,
        idNum
      ]);

      if (upd.changes === 0) throw new Error('Техника не найдена');

      return { id: idNum, ...eqData, returned: false };
    },

    /**
     * Удалить экземпляр.
     * Запрещено, если есть активное назначение или статус assigned.
     */
    async deleteEquipment(id) {
      const row = await get(
        `SELECT id FROM user_equipment
         WHERE equipment_id = ? AND returned_date IS NULL`,
        [id]
      );
      if (row) throw new Error('Невозможно удалить технику, она назначена пользователю');

      const result = await run('DELETE FROM equipment WHERE id = ?', [id]);
      return { deleted: result.changes };
    },

  };
};