// server.js
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const { db, closeDatabase } = require('./database/db');

// Роуты

const renderUsers = require('./routes/users');
const renderDashboard = require('./routes/dashboard');
const { renderPdfList, renderPdfFile } = require('./routes/pdf');
const renderEquipmentDashboard = require('./routes/equipment');
const {
  renderAdmin,
  renderLogs,              
  getEquipmentAPI,
  getEquipmentByIdAPI,
  getEquipmentDetailsAPI, 
  addEquipmentAPI,
  updateEquipmentAPI,
  deleteEquipmentAPI,
  renderAddEquipment,
  renderEditEquipment,
  getUsersAPI,
  getUserByIdAPI,
  addUserAPI,
  updateUserAPI,
  deleteUserAPI,
  resetUserPasswordAPI,
  blockUserAPI,
  unblockUserAPI,
  getUserDetailsAPI,
  renderAddUser,
  renderEditUser,
  // Логи                
  getLogsAPI,
  getLogsStatsAPI,
  cleanLogsAPI,
  // Перемещение      // ← НОВОЕ
  moveEquipmentAPI,
  getEquipmentMovesAPI,
} = require('./routes/admin');

// Роуты каталога
const {
  renderCatalog,
  getCategoriesAPI,
  getCategoryAPI,
  createCategoryAPI,
  updateCategoryAPI,
  deleteCategoryAPI,
  reorderCategoriesAPI,
  getTypesAPI,
  getTypeAPI,
  createTypeAPI,
  updateTypeAPI,
  deleteTypeAPI,
  reorderTypesAPI,
  getFilteredEquipmentAPI,   // 🆕
  getEquipmentCountsAPI,     // 🆕
} = require('./routes/catalog');

// Роуты складов

const {
  // Страницы
  renderWarehouses,
  renderWarehouseDetails,
  // API складов
  getWarehousesAPI,
  getWarehouseAPI,
  createWarehouseAPI,
  updateWarehouseAPI,
  deleteWarehouseAPI,
  setDefaultWarehouseAPI,
  // Дерево и статистика
  getWarehouseTreeAPI,
  getFullTreeAPI,
  getWarehouseStatsAPI,
  // API зон
  getZonesAPI,
  createZoneAPI,
  updateZoneAPI,
  deleteZoneAPI,
  // API стеллажей
  getRacksAPI,
  createRackAPI,
  updateRackAPI,
  deleteRackAPI,
  // API ячеек
  getCellsAPI,
  getCellAPI,
  getCellEquipmentAPI,
  createCellAPI,
  updateCellAPI,
  deleteCellAPI,
  // 🆕 Инвентаризация
  renderInventory,
  getInventorySummaryAPI,
  getInventoryTotalsAPI,
  getSpecialStatusSummaryAPI,  // 🆕 2.11.14
  getWarehouseInventoryAPI,
  getCellOccupancyAPI,
  exportInventoryCSV,
} = require('./routes/warehouses');


// Роуты рабочих мест
const {
  // Страницы
  renderWorkplaces,
  renderWorkplaceDetails,
  // API офисов
  getOfficesAPI,
  getOfficeAPI,
  createOfficeAPI,
  updateOfficeAPI,
  deleteOfficeAPI,
  setDefaultOfficeAPI,
  // API дерева и статистики
  getFullWorkplaceTreeAPI,
  getOfficeTreeAPI,
  getWorkplaceStatsAPI,
  getWorkplaceSummaryAPI,
  // API кабинетов
  getRoomsAPI,
  createRoomAPI,
  updateRoomAPI,
  deleteRoomAPI,
  // API рабочих мест
  getWorkplacesAPI,
  getWorkplaceAPI,
  createWorkplaceAPI,
  updateWorkplaceAPI,
  deleteWorkplaceAPI,
  // API техники
  getWorkplaceEquipmentAPI,
  moveEquipmentToWorkplaceAPI,
  // Сводка и экспорт
  getOfficeEquipmentAPI,
  getWorkplaceOccupancyAPI,
  exportOfficeInventoryCSV,
} = require('./routes/workplaces');

// 🆕 Роуты номенклатуры (модели ТМЦ)  ← ВСТАВИТЬ СЮДА
const {
  renderModels,
  getModelsAPI,
  getModelAPI,
  createModelAPI,
  updateModelAPI,
  deleteModelAPI,
  checkDuplicateAPI,
} = require('./routes/equipment-models');

// Роуты авторизации
const {
  renderLogin,
  renderChangePassword,
  logoutRedirect,
  loginAPI,
  logoutAPI,
  changePasswordAPI,
  getCurrentUserAPI
} = require('./routes/auth');

// Роут профиля
const {
  renderProfile,
  updateProfileAPI
} = require('./routes/profile');

// Middleware
const {
  requireAuth,
  requireAdmin,
  requireSupervisor,   // 🆕 admin | supervisor
  requireMol,          // 🆕 admin | mol
  requireRole,         // 🆕 гибкий
  requireGuest,
  loadUser,
  checkPasswordChange,
  syncSession
} = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== БАЗОВЫЕ MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== НАСТРОЙКА СЕССИЙ =====
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, 'data')
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  },
  name: 'equipment.sid'
}));

// ===== СТАТИЧЕСКИЕ ФАЙЛЫ =====
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// ===== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ В RES.LOCALS =====
app.use(loadUser);

// ===== СИНХРОНИЗАЦИЯ СЕССИИ С БД =====
// На каждый запрос проверяем, что пользователь ещё существует,
// активен и не был изменён
app.use(syncSession);

// ===== ПРОВЕРКА НЕОБХОДИМОСТИ СМЕНЫ ПАРОЛЯ =====
app.use(checkPasswordChange);

// ===== ИНИЦИАЛИЗАЦИЯ БД =====
// ===== БД уже инициализирована через npm run migrate =====
// Проверка подключения

db.get('SELECT 1 as ok', (err) => {
  if (err) {
    console.error('❌ Не удалось подключиться к БД:', err.message);
    console.error('   Запустите: npm run migrate');
    process.exit(1);
  }
  console.log('✅ База данных подключена');
});

// ============================================
// РОУТЫ АВТОРИЗАЦИИ (публичные)
// ============================================
app.get('/login', requireGuest, renderLogin);
app.get('/logout', logoutRedirect);
app.get('/change-password', requireAuth, renderChangePassword);
// ============================================
// API: Информация о версии (публичный)
// ============================================
app.get('/api/version', (req, res) => {
  const pkg = require('./package.json');
  res.json({
    version: pkg.version,
    name: pkg.name,
    description: pkg.description
  });
});

app.post('/api/auth/login', requireGuest, loginAPI);
app.post('/api/auth/logout', logoutAPI);
app.post('/api/auth/change-password', requireAuth, changePasswordAPI);
app.get('/api/auth/me', requireAuth, getCurrentUserAPI);

// ============================================
// ПРОФИЛЬ (только авторизованные)
// ============================================
app.get('/profile', requireAuth, renderProfile);
app.post('/api/profile/update', requireAuth, updateProfileAPI);

// ============================================
// ОСНОВНЫЕ РОУТЫ (только авторизованные)
// ============================================
// Дашборд, ТМЦ, пользователи — read-only, доступны
// admin + supervisor. Редактирование — только admin/mol (см. ниже).
app.get('/',           requireSupervisor, renderDashboard);
app.get('/users',      requireSupervisor, renderUsers);
app.get('/equipment',  requireSupervisor, renderEquipmentDashboard);
app.get('/pdf',        requireAuth,       renderPdfList);
app.get('/pdf/:filename', requireAuth,    renderPdfFile);

// ============================================
// УЧЁТ ТМЦ (/admin)
// ============================================
// Просмотр — admin + supervisor.
// Формы add/edit — admin + mol (МОЛ редактирует свои экземпляры;
// конкретные ограничения проверяет updateEquipmentAPI).
app.get('/admin',          requireSupervisor, renderAdmin);
app.get('/admin/add',      requireMol,        renderAddEquipment);
app.get('/admin/edit/:id', requireMol,        renderEditEquipment);

// Управление пользователями — только admin.
app.get('/admin/user/add',       requireAdmin, renderAddUser);
app.get('/admin/user/edit/:id',  requireAdmin, renderEditUser);

// ============================================
// API ДЛЯ ТЕХНИКИ
// ============================================
// Чтение — admin + supervisor + mol (МОЛ видит только свои
// через SQL-scope; конкретная проверка — в роуте через permissions.js).
// Запись — admin + mol (mol — только свои; см. permissions.js внутри).

app.get('/api/admin/equipment',          requireSupervisor, getEquipmentAPI);
app.get('/api/admin/equipment/filtered', requireSupervisor, getFilteredEquipmentAPI);
app.get('/api/admin/equipment/counts',   requireSupervisor, getEquipmentCountsAPI);

app.get('/api/admin/equipment/:id/details', requireSupervisor, getEquipmentDetailsAPI);
app.get('/api/admin/equipment/:id/moves',   requireSupervisor, getEquipmentMovesAPI);
app.get('/api/admin/equipment/:id',         requireSupervisor, getEquipmentByIdAPI);

app.post('/api/admin/equipment/:id/move', requireMol, moveEquipmentAPI);
app.post('/api/admin/equipment',          requireMol, addEquipmentAPI);
app.put('/api/admin/equipment/:id',       requireMol, updateEquipmentAPI);
app.delete('/api/admin/equipment/:id',    requireMol, deleteEquipmentAPI);



// ============================================
// ЛОГИ (только администраторы!)
// ============================================
app.get('/admin/logs', requireAdmin, renderLogs);
app.get('/api/admin/logs', requireAdmin, getLogsAPI);
app.get('/api/admin/logs/stats', requireAdmin, getLogsStatsAPI);
app.post('/api/admin/logs/clean', requireAdmin, cleanLogsAPI);

// ============================================
// СПРАВОЧНИК (только администраторы!)
// ============================================

// Страница
app.get('/admin/catalog', requireAdmin, renderCatalog);

// API категорий
app.get('/api/admin/categories', requireAdmin, getCategoriesAPI);
app.post('/api/admin/categories', requireAdmin, createCategoryAPI);
app.post('/api/admin/categories/reorder', requireAdmin, reorderCategoriesAPI); // ← ПЕРЕД :id
app.get('/api/admin/categories/:id', requireAdmin, getCategoryAPI);
app.put('/api/admin/categories/:id', requireAdmin, updateCategoryAPI);
app.delete('/api/admin/categories/:id', requireAdmin, deleteCategoryAPI);

// API типов
app.get('/api/admin/types', requireAdmin, getTypesAPI);
app.post('/api/admin/types', requireAdmin, createTypeAPI);
app.post('/api/admin/types/reorder', requireAdmin, reorderTypesAPI); // ← ПЕРЕД :id
app.get('/api/admin/types/:id', requireAdmin, getTypeAPI);
app.put('/api/admin/types/:id', requireAdmin, updateTypeAPI);
app.delete('/api/admin/types/:id', requireAdmin, deleteTypeAPI);

// ============================================
// НОМЕНКЛАТУРА — модели ТМЦ (только администраторы!)
// ============================================

// Страница
app.get('/admin/models', requireAdmin, renderModels);

// API моделей
app.get('/api/admin/models', requireAdmin, getModelsAPI);
app.get('/api/admin/models/check-duplicate', requireAdmin, checkDuplicateAPI); // ← ПЕРЕД :id
app.get('/api/admin/models/:id', requireAdmin, getModelAPI);
app.post('/api/admin/models', requireAdmin, createModelAPI);
app.put('/api/admin/models/:id', requireAdmin, updateModelAPI);
app.delete('/api/admin/models/:id', requireAdmin, deleteModelAPI);

// ============================================
// СКЛАДЫ
// ============================================
// Просмотр — admin + supervisor + mol (mol видит только свои).
// Редактирование — admin + mol (mol — только свои).

// Страницы
app.get('/admin/warehouses',      requireSupervisor, renderWarehouses);
app.get('/admin/warehouses/:id',  requireSupervisor, renderWarehouseDetails);

// API складов — чтение
app.get('/api/admin/warehouses',         requireSupervisor, getWarehousesAPI);
app.get('/api/admin/warehouses/tree',    requireSupervisor, getFullTreeAPI);
app.get('/api/admin/warehouses/stats',   requireSupervisor, getWarehouseStatsAPI);
app.get('/api/admin/warehouses/:id/tree',   requireSupervisor, getWarehouseTreeAPI);
app.get('/api/admin/warehouses/:id/zones',  requireSupervisor, getZonesAPI);
app.get('/api/admin/warehouses/:id',        requireSupervisor, getWarehouseAPI);

// API складов — запись (admin + mol, mol — свои)
app.post('/api/admin/warehouses',   requireMol, createWarehouseAPI);
app.put('/api/admin/warehouses/:id', requireMol, updateWarehouseAPI);
app.delete('/api/admin/warehouses/:id', requireMol, deleteWarehouseAPI);
app.post('/api/admin/warehouses/:id/set-default', requireAdmin, setDefaultWarehouseAPI);

// API зон — запись (admin + mol, mol — свои)
app.post('/api/admin/zones',       requireMol, createZoneAPI);
app.put('/api/admin/zones/:id',    requireMol, updateZoneAPI);
app.delete('/api/admin/zones/:id', requireMol, deleteZoneAPI);

// API стеллажей
app.get('/api/admin/zones/:id/racks', requireSupervisor, getRacksAPI);
app.post('/api/admin/racks',          requireMol,        createRackAPI);
app.put('/api/admin/racks/:id',       requireMol,        updateRackAPI);
app.delete('/api/admin/racks/:id',    requireMol,        deleteRackAPI);

// API ячеек
app.get('/api/admin/racks/:id/cells',    requireSupervisor, getCellsAPI);
app.get('/api/admin/cells/:id/equipment', requireSupervisor, getCellEquipmentAPI);
app.get('/api/admin/cells/:id',          requireSupervisor, getCellAPI);
app.post('/api/admin/cells',             requireMol,        createCellAPI);
app.put('/api/admin/cells/:id',          requireMol,        updateCellAPI);
app.delete('/api/admin/cells/:id',       requireMol,        deleteCellAPI);

// ============================================
// ИНВЕНТАРИЗАЦИЯ (read-only для admin + supervisor + mol)
// ============================================
// МОЛ видит только свои склады — фильтр в SQL через scope.

// Страница
app.get('/admin/inventory', requireSupervisor, renderInventory);

// API
app.get('/api/admin/inventory/summary', requireSupervisor, getInventorySummaryAPI);
app.get('/api/admin/inventory/totals',  requireSupervisor, getInventoryTotalsAPI);
app.get('/api/admin/inventory/special', requireSupervisor, getSpecialStatusSummaryAPI);

// Сначала более конкретные
app.get('/api/admin/warehouses/:id/inventory/export', requireSupervisor, exportInventoryCSV);
app.get('/api/admin/warehouses/:id/inventory',        requireSupervisor, getWarehouseInventoryAPI);
app.get('/api/admin/warehouses/:id/occupancy',        requireSupervisor, getCellOccupancyAPI);


// ============================================
// РАБОЧИЕ МЕСТА
// ============================================
// Просмотр — admin + supervisor + mol (mol видит только свои).
// Редактирование — admin + mol (mol — только свои).

// Страницы
app.get('/admin/workplaces',      requireSupervisor, renderWorkplaces);
app.get('/admin/workplaces/:id',  requireSupervisor, renderWorkplaceDetails);

// API офисов — чтение
app.get('/api/admin/offices',         requireSupervisor, getOfficesAPI);
app.get('/api/admin/offices/tree',    requireSupervisor, getFullWorkplaceTreeAPI);
app.get('/api/admin/offices/:id/tree',      requireSupervisor, getOfficeTreeAPI);
app.get('/api/admin/offices/:id/rooms',     requireSupervisor, getRoomsAPI);
app.get('/api/admin/offices/:id/equipment/export', requireSupervisor, exportOfficeInventoryCSV);
app.get('/api/admin/offices/:id/equipment', requireSupervisor, getOfficeEquipmentAPI);
app.get('/api/admin/offices/:id/occupancy', requireSupervisor, getWorkplaceOccupancyAPI);
app.get('/api/admin/offices/:id',           requireSupervisor, getOfficeAPI);

// API офисов — запись
app.post('/api/admin/offices',   requireMol,   createOfficeAPI);
app.put('/api/admin/offices/:id', requireMol,  updateOfficeAPI);
app.delete('/api/admin/offices/:id', requireMol, deleteOfficeAPI);
app.post('/api/admin/offices/:id/set-default', requireAdmin, setDefaultOfficeAPI);

// API статистики и сводки
app.get('/api/admin/workplaces/stats',   requireSupervisor, getWorkplaceStatsAPI);
app.get('/api/admin/workplaces/summary', requireSupervisor, getWorkplaceSummaryAPI);

// API кабинетов — запись
app.post('/api/admin/rooms',       requireMol, createRoomAPI);
app.put('/api/admin/rooms/:id',    requireMol, updateRoomAPI);
app.delete('/api/admin/rooms/:id', requireMol, deleteRoomAPI);
app.get('/api/admin/rooms/:id/workplaces', requireSupervisor, getWorkplacesAPI);

// API рабочих мест — запись
app.get('/api/admin/workplaces/:id/equipment',      requireSupervisor, getWorkplaceEquipmentAPI);
app.post('/api/admin/workplaces/:id/move-equipment', requireMol,       moveEquipmentToWorkplaceAPI);
app.get('/api/admin/workplaces/:id',          requireSupervisor, getWorkplaceAPI);
app.post('/api/admin/workplaces',             requireMol,        createWorkplaceAPI);
app.put('/api/admin/workplaces/:id',          requireMol,        updateWorkplaceAPI);
app.delete('/api/admin/workplaces/:id',       requireMol,        deleteWorkplaceAPI);

// ============================================
// API ДЛЯ ПОЛЬЗОВАТЕЛЕЙ (только администраторы!)
// ============================================
app.get('/api/admin/users', requireAdmin, getUsersAPI);
app.get('/api/admin/users/:id', requireAdmin, getUserByIdAPI);
app.get('/api/admin/users/:id/details', requireAdmin, getUserDetailsAPI);
app.post('/api/admin/users', requireAdmin, addUserAPI);
app.put('/api/admin/users/:id', requireAdmin, updateUserAPI);
app.delete('/api/admin/users/:id', requireAdmin, deleteUserAPI);
app.post('/api/admin/users/:id/reset-password', requireAdmin, resetUserPasswordAPI);
app.post('/api/admin/users/:id/block', requireAdmin, blockUserAPI);
app.post('/api/admin/users/:id/unblock', requireAdmin, unblockUserAPI);

// ============================================
// УПРАВЛЕНИЕ МОЛ (только администратор!)
// ============================================
// Привязка/отвязка МОЛ к складам и офисам + назначение
// ответственного за конкретный экземпляр техники.
//
// Импорт функций — из routes/admin-responsibles.js (см. ниже).

const {
  addWarehouseResponsibleAPI,
  removeWarehouseResponsibleAPI,
  getWarehouseResponsiblesAPI,
  addOfficeResponsibleAPI,
  removeOfficeResponsibleAPI,
  getOfficeResponsiblesAPI,
  setEquipmentResponsibleAPI,
  getEquipmentResponsibleAPI,
} = require('./routes/admin-responsibles');

app.get('/api/admin/warehouses/:id/responsibles', requireAdmin, getWarehouseResponsiblesAPI);
app.post('/api/admin/warehouses/:id/responsibles', requireAdmin, addWarehouseResponsibleAPI);
app.delete('/api/admin/warehouses/:id/responsibles/:userId', requireAdmin, removeWarehouseResponsibleAPI);

app.get('/api/admin/offices/:id/responsibles', requireAdmin, getOfficeResponsiblesAPI);
app.post('/api/admin/offices/:id/responsibles', requireAdmin, addOfficeResponsibleAPI);
app.delete('/api/admin/offices/:id/responsibles/:userId', requireAdmin, removeOfficeResponsibleAPI);

app.get('/api/admin/equipment/:id/responsible', requireSupervisor, getEquipmentResponsibleAPI);
app.post('/api/admin/equipment/:id/responsible', requireAdmin, setEquipmentResponsibleAPI);

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================
const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ============================================');
  console.log(`🚀  Сервер запущен: http://localhost:${PORT}`);
  console.log('🚀 ============================================');
  console.log(`🔐  Вход:               http://localhost:${PORT}/login`);
  console.log(`👤  Профиль:            http://localhost:${PORT}/profile`);
  console.log(`📖  Главная:            http://localhost:${PORT}/`);
  console.log(`⚙️  Админ-панель:       http://localhost:${PORT}/admin`);
  console.log(`🏢  Склады:            http://localhost:${PORT}/admin/warehouses`);
  console.log(`🏛️  Рабочие места:      http://localhost:${PORT}/admin/workplaces`);
  console.log(`🧩  Номенклатура:       http://localhost:${PORT}/admin/models`);
  console.log(`📊  Инвентаризация:     http://localhost:${PORT}/admin/inventory`);
  console.log('🚀 ============================================');
  console.log('');
});

process.on('SIGINT', async () => {
  console.log('\n👋 Остановка сервера...');
  await closeDatabase();
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});

module.exports = app;