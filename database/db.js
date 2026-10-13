// database/db.js
// ============================================================
// Точка входа для работы с базой данных
// 
// Все функции разбиты на модули в database/modules/.
// Этот файл:
//   1. Подключается к SQLite
//   2. Передаёт контекст (db, run, get, all) в модули
//   3. Собирает все функции в единый объект для экспорта
//
// Использование:
//   const { getAllUsers, getEquipmentById } = require('../database/db');
// ============================================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ============================================================
// ПОДКЛЮЧЕНИЕ К БД
// ============================================================

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');
const db = new sqlite3.Database(dbPath);

// Включаем поддержку FOREIGN KEY
db.run('PRAGMA foreign_keys = ON');

// ============================================================
// ПРОМИС-ОБЁРТКИ ДЛЯ SQLITE
// ============================================================

/**
 * Обёртка для db.run (INSERT, UPDATE, DELETE)
 * Возвращает this (содержит lastID, changes)
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/**
 * Обёртка для db.get (SELECT одной строки)
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Обёртка для db.all (SELECT нескольких строк)
 */
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ============================================================
// КОНТЕКСТ ДЛЯ МОДУЛЕЙ
// ============================================================

const ctx = { db, run, get, all };

// ============================================================
// ЗАГРУЗКА МОДУЛЕЙ
// ============================================================

const users = require('./modules/users')(ctx);
const equipment = require('./modules/equipment')(ctx);
const catalog = require('./modules/catalog')(ctx);
const auth = require('./modules/auth')(ctx);
const profile = require('./modules/profile')(ctx);
const logs = require('./modules/logs')(ctx);
const dashboard = require('./modules/dashboard')(ctx);
const stats = require('./modules/stats')(ctx);
const meta = require('./modules/meta')(ctx);
const warehouses = require('./modules/warehouses')(ctx);
const workplaces = require('./modules/workplaces')(ctx);
const equipmentModels = require('./modules/equipment-models')(ctx);


// ============================================================
// ЗАКРЫТИЕ БД
// ============================================================

function closeDatabase() {
  return new Promise((resolve) => {
    db.close(() => resolve());
  });
}

// ============================================================
// ЭКСПОРТ
// ============================================================

module.exports = {
  // Подключение и обёртки (на случай прямого использования)
  db,
  run,
  get,
  all,
  
  // Модули
  ...users,
  ...equipment,
  ...catalog,
  ...auth,
  ...profile,
  ...logs,
  ...dashboard,
  ...stats,
  ...meta,
  ...warehouses, 
  ...workplaces,
  ...equipmentModels, 
                            

  // Управление БД
  closeDatabase
};