// routes/manage-import.js
// Импорт номенклатуры и экземпляров из CSV.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { renderPageFor } = require('../utils/layout');
const { logAction } = require('../utils/logger');

const {
    getAllUsers,
    // import module
    transaction,
    createImportHistory,
    markImportCanceled,
    getImportHistory,
    getImportById,
    cancelImportById,
    checkImportPreview,
    findCategoryByName,
    findTypeByName,
    findEquipmentDuplicateByModelAndDescription,
    // catalog
    createCategory,
    createType,
    // models
    createModel,
    getModelByCorporateId,
    // equipment
    addEquipment,
} = require('../database/db');

// ============================================================
// СТРАНИЦА
// ============================================================

async function renderImportPage(req, res) {
    try {
        const htmlPath = path.join(__dirname, '..', 'views', 'manage-import.html');
        let content = fs.readFileSync(htmlPath, 'utf8');

        const users = await getAllUsers();
        const mols = users.filter(u => u.role === 'mol' && u.is_active === 1);

        let molOptions = '';
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

/**
 * Парсинг CSV с поддержкой кавычек (RFC 4180) и выбором разделителя.
/** @param {string} text
/** @param {string} delimiter — ';' | ',' | '\t'
 */

function parseCSV(text, delimiter = ';') {
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }

    // Пошаговый парсер (поддерживает кавычки)
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"') {
                if (next === '"') {
                    currentField += '"';
                    i += 2;
                    continue;
                } else {
                    inQuotes = false;
                    i++;
                    continue;
                }
            } else {
                currentField += ch;
                i++;
                continue;
            }
        }

        if (ch === '"') {
            inQuotes = true;
            i++;
            continue;
        }

        if (ch === delimiter) {
            currentLine.push(currentField);
            currentField = '';
            i++;
            continue;
        }

        if (ch === '\r' && next === '\n') {
            currentLine.push(currentField);
            lines.push(currentLine);
            currentLine = [];
            currentField = '';
            i += 2;
            continue;
        }

        if (ch === '\n') {
            currentLine.push(currentField);
            lines.push(currentLine);
            currentLine = [];
            currentField = '';
            i++;
            continue;
        }

        currentField += ch;
        i++;
    }

    if (currentField !== '' || currentLine.length > 0) {
        currentLine.push(currentField);
        lines.push(currentLine);
    }

    const nonEmptyLines = lines.filter(l => l.some(f => f.trim() !== ''));
    if (nonEmptyLines.length === 0) return [];

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

    const firstLineRaw = nonEmptyLines[0].map(h => h.trim());
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
    for (let li = startIndex; li < nonEmptyLines.length; li++) {
        const values = nonEmptyLines[li];
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = (values[idx] || '').trim();
        });
        row._line = li + 1;
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
        const { csvText, molId, skipDuplicates, delimiter = ';' } = req.body;

        if (!csvText) return res.status(400).json({ error: 'Файл не загружен', report });
        if (!molId) return res.status(400).json({ error: 'Выберите МОЛа', report });

        const molIdInt = parseInt(molId, 10);
        const users = await getAllUsers();
        const mol = users.find(u => u.id === molIdInt && u.role === 'mol' && u.is_active === 1);
        if (!mol) return res.status(400).json({ error: 'МОЛ не найден или неактивен', report });

        const rows = parseCSV(csvText, delimiter);
        if (rows.length === 0) return res.status(400).json({ error: 'Файл пуст', report });

        // ===== ВАЛИДАЦИЯ =====
        for (const row of rows) {
            const line = row._line;
            const corporateId = (row['Корпоративный ИД'] || '').trim();
            const modelName = (row['Наименование'] || '').trim();
            const categoryName = (row['Группа'] || '').trim();
            const typeName = (row['Вид'] || '').trim();
            const inventoryNumber = (row['Инвентарный номер'] || '').trim();
            const quantityStr = (row['Конечный остаток'] || '').trim();
            const quantity = parseInt(quantityStr, 10);

            if (!corporateId) {
                report.errors.push({ line, message: 'Пустой «Корпоративный ИД»' });
                continue;
            }
            if (!modelName) {
                report.errors.push({ line, message: 'Пустое «Наименование»' });
                continue;
            }
            if (!categoryName) {
                report.errors.push({ line, message: 'Пустая «Группа»' });
                continue;
            }
            if (!typeName) {
                report.errors.push({ line, message: 'Пустой «Вид»' });
                continue;
            }

            if (isNaN(quantity) || quantity < 1) {
                report.errors.push({
                    line,
                    message: `Неверное «Конечный остаток»: "${quantityStr}"`,
                });
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
        await transaction(async () => {
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
                    const existing = await findCategoryByName(categoryName);
                    if (existing) {
                        categoryId = existing.id;
                    } else {
                        const result = await createCategory({
                            name: categoryName,
                            icon: '📁',
                            import_id: importId,
                        });
                        categoryId = result.id;
                        report.categories_created++;
                    }
                    categoriesCache[categoryName] = categoryId;
                }

                // 2. Тип
                const typeKey = `${categoryId}::${typeName}`;
                let typeId = typesCache[typeKey];
                if (!typeId) {
                    const existing = await findTypeByName(categoryId, typeName);
                    if (existing) {
                        typeId = existing.id;
                    } else {
                        const result = await createType({
                            category_id: categoryId,
                            name: typeName,
                            icon: '📦',
                            import_id: importId,
                        });
                        typeId = result.id;
                        report.types_created++;
                    }
                    typesCache[typeKey] = typeId;
                }

                // 3. Модель
                let modelId = modelsCache[corporateId];
                if (!modelId) {
                    const existing = await getModelByCorporateId(corporateId);
                    if (existing) {
                        modelId = existing.id;
                        report.models_found++;
                    } else {
                        const result = await createModel({
                            corporate_id: corporateId,
                            name: modelName,
                            manufacturer,
                            category_id: categoryId,
                            type_id: typeId,
                            import_id: importId,
                        });
                        modelId = result.id;
                        report.models_created++;
                    }
                    modelsCache[corporateId] = modelId;
                }

                // 4. Экземпляры
                // Если quantity = 1 и нет номера — проверяем дубликат
                // (только один раз, до создания)
                if (quantity === 1 && !inventoryNumber && skipDuplicates) {
                    const dup = await findEquipmentDuplicateByModelAndDescription(modelId, description);
                    if (dup) {
                        report.skipped_duplicates++;
                        continue;   // пропускаем всю строку
                    }
                }

                // Создаём quantity экземпляров
                for (let i = 0; i < quantity; i++) {
                    const invNum = (quantity === 1) ? inventoryNumber : null;

                    await addEquipment({
                        model_id: modelId,
                        inventory_number: invNum,
                        serial_number: null,
                        status: 'available',
                        description,
                        responsible_user_id: molIdInt,
                        import_id: importId,
                    });
                    report.equipment_created++;
                }
            }
        });

        // 🆕 История
        await createImportHistory({
            importId,
            userId: req.session.userId,
            equipmentCount: report.equipment_created,
            modelsCount: report.models_created,
            categoriesCount: report.categories_created,
            typesCount: report.types_created,
        });

        await logAction({
            req,
            action: 'equipment_import',
            entityType: 'equipment',
            details: JSON.stringify({ importId, ...report }),
        });

        res.json({
            success: true,
            message: `Импорт завершён: создано ${report.equipment_created} экземпляров`,
            report,
            importId,
        });
    } catch (error) {
        console.error('❌ Ошибка импорта:', error);
        res.status(500).json({ error: error.message, report });
    }
}

// ============================================================
// ОТМЕНА
// ============================================================

async function cancelLastImportAPI(req, res) {
    try {
        const { importId } = req.body;
        if (!importId) return res.status(400).json({ error: 'Не указан importId' });

        const importRecord = await getImportById(importId);
        if (!importRecord) return res.status(404).json({ error: 'Импорт с таким ID не найден' });
        if (importRecord.canceled_at) return res.status(400).json({ error: 'Этот импорт уже отменён' });

        const deleted = await cancelImportById(importId);

        await markImportCanceled(importId, req.session.userId);

        await logAction({
            req,
            action: 'equipment_import_cancel',
            entityType: 'equipment',
            details: JSON.stringify({ importId, ...deleted }),
        });

        res.json({
            success: true,
            message: `Импорт отменён. Удалено: экземпляров — ${deleted.equipment}, моделей — ${deleted.models}, категорий — ${deleted.categories}, типов — ${deleted.types}.`,
            deleted,
        });
    } catch (error) {
        console.error('❌ Ошибка отмены импорта:', error);
        res.status(500).json({ error: error.message });
    }
}

// ============================================================
// ИСТОРИЯ
// ============================================================

async function getImportHistoryAPI(req, res) {
    try {
        const history = await getImportHistory(20);
        res.json(history);
    } catch (error) {
        console.error('❌ Ошибка истории импортов:', error);
        res.status(500).json({ error: error.message });
    }
}

// ============================================================
// ПРОГНОЗ
// ============================================================

async function previewImportAPI(req, res) {
    try {
        const { csvText, delimiter = ';' } = req.body;
        if (!csvText) return res.status(400).json({ error: 'Файл не загружен' });

        const rows = parseCSV(csvText, delimiter);
        if (rows.length === 0) return res.status(400).json({ error: 'Файл пуст' });

        const forecast = await checkImportPreview(rows);
        res.json(forecast);
    } catch (error) {
        console.error('❌ Ошибка прогноза:', error);
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
    cancelLastImportAPI,
    getImportHistoryAPI,
    previewImportAPI,   // 🆕
};