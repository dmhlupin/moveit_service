// database/modules/import.js
// Всё для импорта: история, прогноз, отмена, транзакции.

module.exports = ({ db, run, get, all }) => ({

    // ============================================================
    // ТРАНЗАКЦИИ
    // ============================================================

    /**
     * Выполнить функцию в транзакции.
     * При ошибке — ROLLBACK.
     */
    async transaction(fn) {
        return new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) return reject(err);

                Promise.resolve(fn())
                    .then((result) => {
                        db.run('COMMIT', (err) => {
                            if (err) return reject(err);
                            resolve(result);
                        });
                    })
                    .catch((err) => {
                        db.run('ROLLBACK', () => reject(err));
                    });
            });
        });
    },

    // ============================================================
    // ИСТОРИЯ ИМПОРТОВ
    // ============================================================

    createImportHistory(data) {
        const {
            importId,
            userId,
            equipmentCount = 0,
            modelsCount = 0,
            categoriesCount = 0,
            typesCount = 0,
        } = data;

        return run(
            `INSERT INTO import_history
                (import_id, user_id, equipment_count, models_count, categories_count, types_count)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [importId, userId, equipmentCount, modelsCount, categoriesCount, typesCount]
        );
    },

    markImportCanceled(importId, canceledBy) {
        return run(
            `UPDATE import_history
             SET canceled_at = CURRENT_TIMESTAMP, canceled_by = ?
             WHERE import_id = ?`,
            [canceledBy, importId]
        );
    },

    getImportHistory(limit = 20) {
        return all(
            `SELECT
                ih.id,
                ih.import_id,
                ih.equipment_count,
                ih.models_count,
                ih.categories_count,
                ih.types_count,
                ih.created_at,
                ih.canceled_at,
                u.full_name  AS user_name,
                u.username   AS user_username,
                cu.full_name AS canceled_by_name
             FROM import_history ih
             LEFT JOIN users u  ON u.id  = ih.user_id
             LEFT JOIN users cu ON cu.id = ih.canceled_by
             ORDER BY ih.id DESC
             LIMIT ?`,
            [limit]
        );
    },

    getImportById(importId) {
        return get(
            `SELECT * FROM import_history WHERE import_id = ?`,
            [importId]
        );
    },

    // ============================================================
    // ОТМЕНА ИМПОРТА
    // ============================================================

    /**
     * Удалить все записи, созданные импортом с указанным import_id.
     * Порядок: equipment → models → types → categories.
     */
    async cancelImportById(importId) {
        const eqResult = await run(
            `DELETE FROM equipment WHERE import_id = ?`, [importId]
        );
        const modelResult = await run(
            `DELETE FROM equipment_models WHERE import_id = ?`, [importId]
        );
        const typeResult = await run(
            `DELETE FROM equipment_types WHERE import_id = ?`, [importId]
        );
        const catResult = await run(
            `DELETE FROM equipment_categories WHERE import_id = ?`, [importId]
        );

        return {
            equipment: eqResult.changes,
            models: modelResult.changes,
            types: typeResult.changes,
            categories: catResult.changes,
        };
    },

    // ============================================================
    // ПРОГНОЗ (для предпросмотра)
    // ============================================================

    async checkImportPreview(rows) {
        const newCategories = new Set();
        const newTypes = new Set();
        const newModels = new Map();   // ← Map: corporate_id → name

        const catCache = {};
        const typeCache = {};
        const modelCache = {};

        for (const row of rows) {
            const corporateId = (row['Корпоративный ИД'] || '').trim();
            const modelName = (row['Наименование'] || '').trim();
            const categoryName = (row['Группа'] || '').trim();
            const typeName = (row['Вид'] || '').trim();

            if (!categoryName || !typeName) continue;

            // Категория
            let cat = catCache[categoryName];
            if (cat === undefined) {
                cat = await get(
                    `SELECT id FROM equipment_categories WHERE name = ?`,
                    [categoryName]
                );
                catCache[categoryName] = cat || null;
            }

            if (!cat) {
                // Категории нет — она новая. Все её типы тоже новые.
                newCategories.add(categoryName);
                newTypes.add(`${categoryName} → ${typeName}`);
            } else {
                // Категория есть — проверяем тип
                const typeKey = `${cat.id}::${typeName}`;
                let type = typeCache[typeKey];
                if (type === undefined) {
                    type = await get(
                        `SELECT id FROM equipment_types WHERE category_id = ? AND name = ?`,
                        [cat.id, typeName]
                    );
                    typeCache[typeKey] = type || null;
                }
                if (!type) {
                    newTypes.add(`${categoryName} → ${typeName}`);
                }
            }

            // Модель
            if (corporateId) {
                let model = modelCache[corporateId];
                if (model === undefined) {
                    model = await get(
                        `SELECT id FROM equipment_models WHERE corporate_id = ?`,
                        [corporateId]
                    );
                    modelCache[corporateId] = model || null;
                }
                if (!model) {
                    // 🆕 Map: corporate_id → name
                    if (!newModels.has(corporateId)) {
                        newModels.set(corporateId, modelName || '—');
                    }
                }
            }
        }

        return {
            new_categories: Array.from(newCategories),
            new_types: Array.from(newTypes),
            new_models: Array.from(newModels.entries()).map(([id, name]) => ({ id, name })),
        };
    },

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ (для импорта)
    // ============================================================

    /**
     * Найти категорию по имени.
     */
    findCategoryByName(name) {
        return get(
            `SELECT id FROM equipment_categories WHERE name = ?`,
            [name]
        );
    },

    /**
     * Найти тип по (category_id, name).
     */
    findTypeByName(categoryId, name) {
        return get(
            `SELECT id FROM equipment_types WHERE category_id = ? AND name = ?`,
            [categoryId, name]
        );
    },

    /**
     * Найти дубликат экземпляра без номера.
     */
    findEquipmentDuplicateByModelAndDescription(modelId, description) {
        return get(
            `SELECT id FROM equipment
             WHERE model_id = ? AND inventory_number IS NULL
               AND description IS ?`,
            [modelId, description]
        );
    },
});