// database/modules/equipment/write.js
// ============================================================
// CRUD экземпляров: addEquipment, updateEquipment, deleteEquipment.
//
// 5.15.2:
//   - addEquipment / updateEquipment обёрнуты в BEGIN/COMMIT/ROLLBACK
//     (upsertFixedAsset должен быть в одной транзакции с equipment);
//   - принимают is_quantity_accounted, is_fixed_asset,
//     commissioning_date, initial_cost, useful_life_months;
//   - валидация инвариантов ОС (инв.№ + серийный + дата, is_quantity=1);
//   - upsertFixedAsset вызывается ТОЛЬКО если is_fixed_asset !== undefined
//     (обратная совместимость со старыми вызовами).
// ============================================================

module.exports = ({ db, run, get, all }, helpers) => {
  const {
    checkUniqueSerialAndInventory,
    upsertFixedAsset,
    validateFixedAssetInput,
  } = helpers;

  return {

    /**
     * Добавить экземпляр техники.
     *
     * 5.15.2 — новые поля (все опциональны, кроме инвариантов ОС):
     *   is_quantity_accounted — 1/0 (по умолчанию 1)
     *   is_fixed_asset        — bool; если true → ОС
     *   commissioning_date    — YYYY-MM-DD (обязательно при is_fixed_asset)
     *   initial_cost          — REAL (опционально)
     *   useful_life_months    — INTEGER (опционально)
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

        // 🆕 5.15.2
        is_quantity_accounted = 1,
        is_fixed_asset        = undefined,
        commissioning_date    = null,
        initial_cost          = null,
        useful_life_months    = null,
      } = eqData;

      if (!model_id) throw new Error('Не указана модель техники (model_id)');

      // Валидация инвариантов ОС (до транзакции — быстро падаем)
      validateFixedAssetInput({
        is_fixed_asset,
        inventory_number,
        serial_number,
        commissioning_date,
      });

      // Для ОС принудительно is_quantity_accounted = 1
      const finalQuantity = (is_fixed_asset === true) ? 1 : (is_quantity_accounted ? 1 : 0);

      await run('BEGIN');
      try {
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
             responsible_user_id, import_id,
             is_quantity_accounted)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          model_id, inv, sn, status || 'available',
          cell_id || null, workplace_id || null,
          purchase_date || null, warranty_until || null, description || null,
          responsible_user_id || null, import_id,
          finalQuantity,
        ]);

        const newId = result.lastID;

        // ОС-запись — только если явно передали is_fixed_asset
        if (is_fixed_asset !== undefined) {
          await upsertFixedAsset(newId, {
            is_fixed_asset,
            commissioning_date,
            initial_cost,
            useful_life_months,
          });
        }

        await run('COMMIT');
        return { id: newId, ...eqData };
      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
    },

    /**
     * Обновить экземпляр техники.
     *
     * 5.15.2:
     *  - обёрнуто в BEGIN/COMMIT/ROLLBACK;
     *  - is_quantity_accounted — если undefined, не трогаем
     *    (обратная совместимость со старыми вызовами);
     *  - is_fixed_asset — если undefined, ОС-запись не трогаем;
     *  - смена статуса assigned → available (автовозврат) — как раньше.
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

        // 🆕 5.15.2
        is_quantity_accounted = undefined,
        is_fixed_asset        = undefined,
        commissioning_date    = null,
        initial_cost          = null,
        useful_life_months    = null,
      } = eqData;

      if (!model_id) throw new Error('Не указана модель техники (model_id)');

      // Валидация инвариантов ОС (до транзакции)
      validateFixedAssetInput({
        is_fixed_asset,
        inventory_number,
        serial_number,
        commissioning_date,
      });

      // Итоговый is_quantity_accounted:
      //   - ОС → всегда 1;
      //   - иначе — как передали, либо «не трогать» (undefined)
      let finalQuantity = is_quantity_accounted;
      if (is_fixed_asset === true) finalQuantity = 1;

      await run('BEGIN');
      try {
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

        // Собираем SET-фрагменты динамически
        const setParts = [
          'model_id = ?',
          'inventory_number = ?',
          'serial_number = ?',
          'status = ?',
          'description = ?',
          'purchase_date = ?',
          'warranty_until = ?',
          'updated_at = CURRENT_TIMESTAMP',
        ];
        const params = [
          model_id, inv, sn, status, description,
          purchase_date || null, warranty_until || null,
        ];

        if (finalQuantity !== undefined) {
          setParts.push('is_quantity_accounted = ?');
          params.push(finalQuantity ? 1 : 0);
        }

        if (responsible_user_id !== undefined) {
          setParts.push('responsible_user_id = ?');
          params.push(responsible_user_id);
        }

        // Автовозврат: assigned → available
        const isAutoReturn = (oldStatus === 'assigned' && status === 'available');
        if (isAutoReturn) {
          setParts.push('cell_id = NULL', 'workplace_id = NULL');
        } else {
          setParts.push('cell_id = ?', 'workplace_id = ?');
          params.push(cell_id || null, workplace_id || null);
        }

        const upd = await run(
          `UPDATE equipment SET ${setParts.join(', ')} WHERE id = ?`,
          [...params, idNum]
        );
        if (upd.changes === 0) throw new Error('Техника не найдена');

        if (isAutoReturn) {
          const assignment = await get(
            `SELECT id FROM user_equipment
             WHERE equipment_id = ? AND returned_date IS NULL`,
            [idNum]
          );
          if (assignment) {
            await run(`
              UPDATE user_equipment
              SET returned_date = CURRENT_TIMESTAMP,
                  condition_on_return = ?
              WHERE id = ?
            `, ['Возвращена при изменении статуса', assignment.id]);
          }
        }

        // ОС-запись — только если явно передали is_fixed_asset
        if (is_fixed_asset !== undefined) {
          await upsertFixedAsset(idNum, {
            is_fixed_asset,
            commissioning_date,
            initial_cost,
            useful_life_months,
          });
        }

        await run('COMMIT');
        return {
          id: idNum,
          ...eqData,
          returned: isAutoReturn,
        };
      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
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