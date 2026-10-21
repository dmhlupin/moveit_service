// scripts/clean-test-data.js
// Очистка БД от тестовых данных:
//   - все экземпляры техники
//   - все модели
//   - все типы
//   - все категории
//   - все пользователи, кроме админов
//   - все назначения, привязки МОЛов
//   - опционально: логи, история импортов
//
// Использование:
//   node scripts/clean-test-data.js            (спросит подтверждение)
//   node scripts/clean-test-data.js --force    (без подтверждения)
//   node scripts/clean-test-data.js --with-logs (удалить логи и историю импортов)

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'data', 'database.db');
const BACKUP_PATH = path.join(__dirname, '..', 'data', `database.backup-${Date.now()}.db`);

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const WITH_LOGS = args.includes('--with-logs');

// ============================================================
// ПОДТВЕРЖДЕНИЕ
// ============================================================

function askConfirmation(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

// ============================================================
// ОСНОВНАЯ ЛОГИКА
// ============================================================

async function main() {
    console.log('');
    console.log('🧹 ============================================');
    console.log('🧹  Очистка БД от тестовых данных');
    console.log('🧹 ============================================');
    console.log('');

    if (!fs.existsSync(DB_PATH)) {
        console.error(`❌ База данных не найдена: ${DB_PATH}`);
        console.error('   Запустите: npm run migrate');
        process.exit(1);
    }

    // Список того, что будет удалено
    console.log('📋 Будет удалено:');
    console.log('   • Все экземпляры техники (equipment)');
    console.log('   • Все модели (equipment_models)');
    console.log('   • Все типы (equipment_types)');
    console.log('   • Все категории (equipment_categories)');
    console.log('   • Все назначения (user_equipment)');
    console.log('   • Все привязки МОЛов к складам / офисам');
    console.log('   • Все пользователи, кроме админов (users)');
    if (WITH_LOGS) {
        console.log('   • Все логи (activity_log)');
        console.log('   • Вся история импортов (import_history)');
    }
    console.log('');
    console.log('📋 НЕ будет удалено:');
    console.log('   • Склады, зоны, стеллажи, ячейки');
    console.log('   • Офисы, кабинеты, рабочие места');
    console.log('   • app_meta (версия БД)');
    if (!WITH_LOGS) {
        console.log('   • Логи (activity_log)');
        console.log('   • История импортов (import_history)');
    }
    console.log('');

    if (!FORCE) {
        const answer = await askConfirmation(
            '⚠️  Вы уверены? Введите "yes" для продолжения: '
        );
        if (answer !== 'yes') {
            console.log('❌ Отменено.');
            process.exit(0);
        }
    }

    // Бэкап
    console.log('');
    console.log(`💾 Создаю бэкап: ${BACKUP_PATH}`);
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log('✅ Бэкап создан');

    // Подключение к БД
    const db = new sqlite3.Database(DB_PATH);

    const run = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });

    const get = (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    try {
        // Считаем, что удалим
        const counts = {
            equipment: (await get(`SELECT COUNT(*) AS cnt FROM equipment`)).cnt,
            models: (await get(`SELECT COUNT(*) AS cnt FROM equipment_models`)).cnt,
            types: (await get(`SELECT COUNT(*) AS cnt FROM equipment_types`)).cnt,
            categories: (await get(`SELECT COUNT(*) AS cnt FROM equipment_categories`)).cnt,
            users: (await get(`SELECT COUNT(*) AS cnt FROM users WHERE role != 'admin'`)).cnt,
            assignments: (await get(`SELECT COUNT(*) AS cnt FROM user_equipment`)).cnt,
        };

        console.log('');
        console.log('📊 Текущее состояние:');
        console.log(`   • Экземпляров:  ${counts.equipment}`);
        console.log(`   • Моделей:      ${counts.models}`);
        console.log(`   • Типов:        ${counts.types}`);
        console.log(`   • Категорий:    ${counts.categories}`);
        console.log(`   • Назначений:   ${counts.assignments}`);
        console.log(`   • Пользователей (не админ): ${counts.users}`);
        console.log('');

        // Начинаем транзакцию
        await run('BEGIN TRANSACTION');

        console.log('🧹 Удаляю данные...');

        // 1. user_equipment (FK на equipment / users)
        const r1 = await run(`DELETE FROM user_equipment`);
        console.log(`   ✅ user_equipment: ${r1.changes}`);

        // 2. equipment
        const r2 = await run(`DELETE FROM equipment`);
        console.log(`   ✅ equipment: ${r2.changes}`);

        // 3. equipment_models
        const r3 = await run(`DELETE FROM equipment_models`);
        console.log(`   ✅ equipment_models: ${r3.changes}`);

        // 4. equipment_types
        const r4 = await run(`DELETE FROM equipment_types`);
        console.log(`   ✅ equipment_types: ${r4.changes}`);

        // 5. equipment_categories
        const r5 = await run(`DELETE FROM equipment_categories`);
        console.log(`   ✅ equipment_categories: ${r5.changes}`);

        // 6. warehouse_responsibles
        const r6 = await run(`DELETE FROM warehouse_responsibles`);
        console.log(`   ✅ warehouse_responsibles: ${r6.changes}`);

        // 7. office_responsibles
        const r7 = await run(`DELETE FROM office_responsibles`);
        console.log(`   ✅ office_responsibles: ${r7.changes}`);

        // 8. users (кроме admin)
        const r8 = await run(`DELETE FROM users WHERE role != 'admin'`);
        console.log(`   ✅ users (кроме admin): ${r8.changes}`);

        // 9. Опционально: логи
        if (WITH_LOGS) {
            const r9 = await run(`DELETE FROM activity_log`);
            console.log(`   ✅ activity_log: ${r9.changes}`);

            const r10 = await run(`DELETE FROM import_history`);
            console.log(`   ✅ import_history: ${r10.changes}`);
        }

        // Сброс AUTOINCREMENT (чтобы ID начинались с 1)
        console.log('');
        console.log('🔄 Сбрасываю AUTOINCREMENT...');

        const tables = ['equipment', 'equipment_models', 'equipment_types', 'equipment_categories'];
        for (const t of tables) {
            await run(`DELETE FROM sqlite_sequence WHERE name = ?`, [t]);
        }
        console.log('   ✅ Сброшено для: equipment, equipment_models, equipment_types, equipment_categories');

        await run('COMMIT');
        console.log('');
        console.log('🎉 ============================================');
        console.log('🎉  Очистка завершена');
        console.log('🎉 ============================================');
        console.log('');
        console.log(`💾 Бэкап сохранён: ${BACKUP_PATH}`);
        console.log('');
    } catch (error) {
        try {
            await run('ROLLBACK');
        } catch (e) {
            // ignore
        }
        console.error('❌ Ошибка очистки:', error.message);
        console.error('');
        console.error(`💾 Бэкап (до изменений): ${BACKUP_PATH}`);
        console.error('   Восстановить: скопируйте бэкап обратно в data/database.db');
        process.exit(1);
    } finally {
        db.close();
    }
}

main();