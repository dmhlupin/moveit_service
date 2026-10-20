// routes/manage-import.js
// Импорт номенклатуры и экземпляров из CSV (формат 1С).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { renderPageFor } = require('../utils/layout');
const { logAction } = require('../utils/logger');
const { db } = require('../database/db');

// ============================================================
// СТРАНИЦА
// ============================================================

async function renderImportPage(req, res) {
    try {
        const htmlPath = path.join(__dirname, '..', 'views', 'manage-import.html');
        let content = fs.readFileSync(htmlPath, 'utf8');

        const mols = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, full_name, username FROM users
                 WHERE role = 'mol' AND is_active = 1
                 ORDER BY full_name`,
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        let molOptions = '<option value="">— Выберите МОЛа —</option>';
        mols.forEach(m => {
            molOptions += `<option value="${m.id}">${escapeHtml(m.full_name || m.username)}</option>`;
        });
        content = content.replace('{{mol_options}}', molOptions);

        renderPageFor(req, res, {
            title: 'Импорт из CSV – MoveIT service',
            content,
            pageCss: '/css/manage-import.css',
            pageJs: '/js/manage-import.js',
        });
    } catch (error) {
        console.error('❌ Ошибка загрузки страницы импорта:', error);
        res.status(500).send('Ошибка загрузки страницы');
    }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return [];

    const STANDARD_HEADERS = [
        'Корпоративный ИД', 'Наименование', 'Производитель',
        'Группа', 'Вид', 'Инвентарный номер', 'Конечный остаток', 'Описание'
    ];

    const HEADER_ALIASES = {
        'корпоративный ид': 'Корпоративный ИД',
        'корпоративный id': 'Корпоративный ИД',
        'корп. ид': 'Корпоративный ИД',
        'corporate_id': 'Корпоративный ИД',
        'model_corporate_id': 'Корпоративный ИД',
        'артикул': 'Корпоративный ИД',
        'арт': 'Корпоративный ИД',
        'article': 'Корпоративный ИД',
        'sku': 'Корпоративный ИД',
        'наименование': 'Наименование',
        'название': 'Наименование',
        'name': 'Наименование',
        'model_name': 'Наименование',
        'модель': 'Наименование',
        'производитель': 'Производитель',
        'manufacturer': 'Производитель',
        'model_manufacturer': 'Производитель',
        'бренд': 'Производитель',
        'группа': 'Группа',
        'категория': 'Группа',
        'category': 'Группа',
        'category_name': 'Группа',
        'group': 'Группа',
        'вид': 'Вид',
        'тип': 'Вид',
        'type': 'Вид',
        'type_name': 'Вид',
        'инвентарный номер': 'Инвентарный номер',
        'инв. номер': 'Инвентарный номер',
        'inventory_number': 'Инвентарный номер',
        'inventory': 'Инвентарный номер',
        'inv': 'Инвентарный номер',
        'конечный остаток': 'Конечный остаток',
        'количество': 'Конечный остаток',
        'кол-во': 'Конечный остаток',
        'quantity': 'Конечный остаток',
        'qty': 'Конечный остаток',
        'count': 'Конечный остаток',
        'описание': 'Описание',
        'description': 'Описание',
        'примечание': 'Описание',
    };

    const firstLineRaw = lines[0].split(';').map(h => h.trim());
    const firstLineNorm = firstLineRaw.map(h => h.toLowerCase());
    const knownCount = firstLineNorm.filter(h => HEADER_ALIASES[h]).length;
    const hasHeaders = knownCount >= 3;

    let headers;
    let startIndex;

    if (hasHeaders) {
        headers = firstLineRaw.map(h => HEADER_ALIASES[h.toLowerCase()] || h);
        startIndex = 1;
    } else {
        headers = STANDARD_HEADERS;
        startIndex = 0;
    }

    const rows = [];
    for (let i = startIndex; i < lines.length; i++) {
        const values = lines[i].split(';').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        row._line = i + 1;
        rows.push(row);
    }
    return rows;
}

// ============================================================
// ИМПОРТ
// ============================================================

async function importCSVAPI(req, res) {
    const importId = crypto.randomUUID();
    const report = {
        categories_created: 0,
        types_created: 0,
        models_created: 0,
        models_found: 0,
        equipment_created: 0,
        skipped_duplicates: 0,
        errors: [],
    };

    try {
        const { csvText, molId, skipDuplicates } = req.body;

        if (!csvText) {
            return res.status(400).json({ error: 'Файл не загружен', report });
        }
        if (!molId) {
            return res.status(400).json({ error: 'Выберите МОЛа', report });
        }

        const molIdInt = parseInt(molId, 10);
        const mol = await dbGet(
            `SELECT id FROM users WHERE id = ? AND role = 'mol' AND is_active = 1`,
            [molIdInt]
        );
        if (!mol) {
            return res.status(400).json({ error: 'МОЛ не найден или неактивен', report });
        }

        const rows = parseCSV(csvText);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Файл пуст', report });
        }

        // ===== ВАЛИДАЦИЯ =====
        for (const row of rows) {
            const line = row._line;
            const corporateId = row['Корпоративный ИД'] || '';
            const modelName = row['Наименование'] || '';
            const categoryName = row['Группа'] || '';
            const typeName = row['Вид'] || '';
            const inventoryNumber = row['Инвентарный номер'] || '';
            const quantityStr = row['Конечный остаток'] || '';

            if (!corporateId) { report.errors.push({ line, message: 'Пустой «Корпоративный ИД»' }); continue; }
            if (!modelName) { report.errors.push({ line, message: 'Пустое «Наименование»' }); continue; }
            if (!categoryName) { report.errors.push({ line, message: 'Пустая «Группа»' }); continue; }
            if (!typeName) { report.errors.push({ line, message: 'Пустой «Вид»' }); continue; }

            const quantity = parseInt(quantityStr, 10);
            if (isNaN(quantity) || quantity < 1) {
                report.errors.push({ line, message: `Неверное «Конечный остаток»: "${quantityStr}"` });
                continue;
            }

            if (quantity > 1 && inventoryNumber) {
                report.errors.push({
                    line,
                    message: `Инвентарный номер "${inventoryNumber}" не может быть у ${quantity} экземпляров`,
                });
            }
        }

        if (report.errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Найдено ошибок: ${report.errors.length}. Импорт откачен.`,
                report,
            });
        }

        // ===== ТРАНЗАКЦИЯ =====
        await dbRun('BEGIN TRANSACTION');

        try {
            const categoriesCache = {};
            const typesCache = {};
            const modelsCache = {};

            for (const row of rows) {
                const corporateId = row['Корпоративный ИД'].trim();
                const modelName = row['Наименование'].trim();
                const manufacturer = row['Производитель'] ? row['Производитель'].trim() : null;
                const categoryName = row['Группа'].trim();
                const typeName = row['Вид'].trim();
                const inventoryNumber = row['Инвентарный номер'] ? row['Инвентарный номер'].trim() : null;
                const quantity = parseInt(row['Конечный остаток'], 10);
                const description = row['Описание'] ? row['Описание'].trim() : null;

                // 1. Категория
                let categoryId = categoriesCache[categoryName];
                if (!categoryId) {
                    const existing = await dbGet(
                        `SELECT id FROM equipment_categories WHERE name = ?`,
                        [categoryName]
                    );
                    if (existing) {
                        categoryId = existing.id;
                    } else {
                        const result = await dbRun(
                            `INSERT INTO equipment_categories (name, icon, is_active, import_id)
                             VALUES (?, '📁', 1, ?)`,
                            [categoryName, importId]
                        );
                        categoryId = result.lastID;
                        report.categories_created++;
                    }
                    categoriesCache[categoryName] = categoryId;
                }

                // 2. Тип
                const typeKey = `${categoryId}::${typeName}`;
                let typeId = typesCache[typeKey];
                if (!typeId) {
                    const existing = await dbGet(
                        `SELECT id FROM equipment_types WHERE category_id = ? AND name = ?`,
                        [categoryId, typeName]
                    );
                    if (existing) {
                        typeId = existing.id;
                    } else {
                        const result = await dbRun(
                            `INSERT INTO equipment_types (category_id, name, icon, is_active, import_id)
                             VALUES (?, ?, '📦', 1, ?)`,
                            [categoryId, typeName, importId]
                        );
                        typeId = result.lastID;
                        report.types_created++;
                    }
                    typesCache[typeKey] = typeId;
                }

                // 3. Модель
                let modelId = modelsCache[corporateId];
                if (!modelId) {
                    const existing = await dbGet(
                        `SELECT id FROM equipment_models WHERE corporate_id = ?`,
                        [corporateId]
                    );
                    if (existing) {
                        modelId = existing.id;
                        report.models_found++;
                    } else {
                        const result = await dbRun(
                            `INSERT INTO equipment_models
                                (corporate_id, name, manufacturer, category_id, type_id, import_id)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [corporateId, modelName, manufacturer, categoryId, typeId, importId]
                        );
                        modelId = result.lastID;
                        report.models_created++;
                    }
                    modelsCache[corporateId] = modelId;
                }

                // 4. Экземпляры
                for (let i = 0; i < quantity; i++) {
                    const invNum = (quantity === 1) ? inventoryNumber : null;

                    if (!invNum && skipDuplicates) {
                        const dup = await dbGet(
                            `SELECT id FROM equipment
                             WHERE model_id = ? AND inventory_number IS NULL
                               AND description IS ?`,
                            [modelId, description]
                        );
                        if (dup) {
                            report.skipped_duplicates++;
                            continue;
                        }
                    }

                    await dbRun(
                        `INSERT INTO equipment
                            (model_id, inventory_number, serial_number, status,
                             cell_id, workplace_id, description,
                             responsible_user_id, import_id)
                         VALUES (?, ?, NULL, 'available', NULL, NULL, ?, ?, ?)`,
                        [modelId, invNum, description, molIdInt, importId]
                    );
                    report.equipment_created++;
                }
            }

            await dbRun('COMMIT');

            await logAction({
                req,
                action: 'equipment_import',
                entityType: 'equipment',
                details: JSON.stringify({
                    importId,
                    rows: rows.length,
                    equipment_created: report.equipment_created,
                    models_created: report.models_created,
                }),
            });

            res.json({
                success: true,
                message: `Импорт завершён: создано ${report.equipment_created} экземпляров`,
                report,
                importId,
            });
        } catch (err) {
            await dbRun('ROLLBACK');
            throw err;
        }
    } catch (error) {
        console.error('❌ Ошибка импорта:', error);
        try { await dbRun('ROLLBACK'); } catch (e) { /* ignore */ }
        res.status(500).json({ error: error.message, report });
    }
}

// ============================================================
// ОТМЕНА ИМПОРТА
// ============================================================

async function cancelLastImportAPI(req, res) {
    try {
        const { importId } = req.body;
        if (!importId) {
            return res.status(400).json({ error: 'Не указан importId' });
        }

        // Проверяем, есть ли записи с таким importId
        const check = await dbGet(
            `SELECT COUNT(*) AS cnt FROM equipment WHERE import_id = ?`,
            [importId]
        );
        if (!check || check.cnt === 0) {
            return res.status(404).json({ error: 'Импорт с таким ID не найден или уже отменён' });
        }

        await dbRun('BEGIN TRANSACTION');

        try {
            // Порядок: сначала экземпляры, потом модели, типы, категории
            const eqResult = await dbRun(
                `DELETE FROM equipment WHERE import_id = ?`,
                [importId]
            );
            const modelResult = await dbRun(
                `DELETE FROM equipment_models WHERE import_id = ?`,
                [importId]
            );
            const typeResult = await dbRun(
                `DELETE FROM equipment_types WHERE import_id = ?`,
                [importId]
            );
            const catResult = await dbRun(
                `DELETE FROM equipment_categories WHERE import_id = ?`,
                [importId]
            );

            await dbRun('COMMIT');

            await logAction({
                req,
                action: 'equipment_import_cancel',
                entityType: 'equipment',
                details: JSON.stringify({
                    importId,
                    deleted_equipment: eqResult.changes,
                    deleted_models: modelResult.changes,
                    deleted_types: typeResult.changes,
                    deleted_categories: catResult.changes,
                }),
            });

            res.json({
                success: true,
                message: `Импорт отменён. Удалено: экземпляров — ${eqResult.changes}, моделей — ${modelResult.changes}, категорий — ${catResult.changes}, типов — ${typeResult.changes}.`,
                deleted: {
                    equipment: eqResult.changes,
                    models: modelResult.changes,
                    categories: catResult.changes,
                    types: typeResult.changes,
                },
            });
        } catch (err) {
            await dbRun('ROLLBACK');
            throw err;
        }
    } catch (error) {
        console.error('❌ Ошибка отмены импорта:', error);
        res.status(500).json({ error: error.message });
    }
}

// ============================================================
// ШАБЛОН
// ============================================================

function downloadTemplate(req, res) {
    const headers = [
        'Корпоративный ИД',
        'Наименование',
        'Производитель',
        'Группа',
        'Вид',
        'Инвентарный номер',
        'Конечный остаток',
        'Описание',
    ];
    const csv = '\uFEFF' + headers.join(';') + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="import-template.csv"');
    res.send(csv);
}

module.exports = {
    renderImportPage,
    importCSVAPI,
    downloadTemplate,
    cancelLastImportAPI,   // 🆕
};