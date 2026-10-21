// server.js
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const { db, closeDatabase } = require('./database/db');

// ============================================
// ИМПОРТ РОУТОВ
// ============================================

const renderUsers = require('./routes/users');
const renderDashboard = require('./routes/dashboard');
const { renderPdfList, renderPdfFile } = require('./routes/pdf');
const renderEquipmentDashboard = require('./routes/equipment');

const {
  renderManage, // переименовываем функцию для ясности
  renderAdminUsers,
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
  getLogsAPI,
  getLogsStatsAPI,
  cleanLogsAPI,
  moveEquipmentAPI,
  getEquipmentMovesAPI,
} = require('./routes/manage');

const {
  changeEquipmentStatusAPI,
  assignEquipmentAPI,
  returnEquipmentAPI,
  moveToWorkplaceFromCardAPI,
} = require('./routes/manage-equipment-actions');

// Роуты импорта данных

const {
    renderImportPage,
    importCSVAPI,
    downloadTemplate,
    cancelLastImportAPI,
    getImportHistoryAPI,
    previewImportAPI,
} = require('./routes/manage-import');

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
  getFilteredEquipmentAPI,
  getEquipmentCountsAPI,
} = require('./routes/catalog');

// Роуты складов
const {
  renderWarehouses,
  renderWarehouseDetails,
  getWarehousesAPI,
  getWarehouseAPI,
  createWarehouseAPI,
  updateWarehouseAPI,
  deleteWarehouseAPI,
  setDefaultWarehouseAPI,
  getWarehouseTreeAPI,
  getFullTreeAPI,
  getWarehouseStatsAPI,
  getZonesAPI,
  createZoneAPI,
  updateZoneAPI,
  deleteZoneAPI,
  getRacksAPI,
  createRackAPI,
  updateRackAPI,
  deleteRackAPI,
  getCellsAPI,
  getCellAPI,
  getCellEquipmentAPI,
  createCellAPI,
  getNextCellNumberAPI,
  updateCellAPI,
  deleteCellAPI,
  renderInventory,
  getInventorySummaryAPI,
  getInventoryTotalsAPI,
  getSpecialStatusSummaryAPI,
  getWarehouseInventoryAPI,
  getCellOccupancyAPI,
  exportInventoryCSV,
} = require('./routes/warehouses');

// Роуты рабочих мест
const {
  renderWorkplaces,
  renderWorkplaceDetails,
  getOfficesAPI,
  getOfficeAPI,
  createOfficeAPI,
  updateOfficeAPI,
  deleteOfficeAPI,
  setDefaultOfficeAPI,
  getFullWorkplaceTreeAPI,
  getOfficeTreeAPI,
  getWorkplaceStatsAPI,
  getWorkplaceSummaryAPI,
  getRoomsAPI,
  createRoomAPI,
  updateRoomAPI,
  deleteRoomAPI,
  getWorkplacesAPI,
  getWorkplaceAPI,
  createWorkplaceAPI,
  updateWorkplaceAPI,
  deleteWorkplaceAPI,
  getWorkplaceEquipmentAPI,
  moveEquipmentToWorkplaceAPI,
  getOfficeEquipmentAPI,
  getWorkplaceOccupancyAPI,
  exportOfficeInventoryCSV,
  getNextWorkplaceNumberAPI,
} = require('./routes/workplaces');

// Роуты номенклатуры (модели ТМЦ)
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
  getCurrentUserAPI,
} = require('./routes/auth');

// Роут профиля
const {
  renderProfile,
  updateProfileAPI,
} = require('./routes/profile');

// 🆕 Роуты управления МОЛ (Этап 4)
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

// ============================================
// MIDDLEWARE
// ============================================

const {
  requireAuth,
  requireAdmin,
  requireSupervisor,
  requireMol,
  requireRole,
  requireGuest,
  loadUser,
  checkPasswordChange,
  syncSession,
} = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== БАЗОВЫЕ MIDDLEWARE =====
app.use(express.json({ limit: '10mb' }))
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
app.use(syncSession);

// ===== ПРОВЕРКА НЕОБХОДИМОСТИ СМЕНЫ ПАРОЛЯ =====
app.use(checkPasswordChange);

// ===== ПРОВЕРКА ПОДКЛЮЧЕНИЯ К БД =====
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
// ОСНОВНЫЕ РОУТЫ
// ============================================
// Дашборд, ТМЦ — read-only для admin + supervisor + mol.
// /users — read-only только для admin + supervisor (у МОЛ нет
//          прав на список пользователей).
app.get('/',          requireRole(['admin', 'supervisor', 'mol']), renderDashboard);
app.get('/equipment', requireRole(['admin', 'supervisor', 'mol']), renderEquipmentDashboard);
app.get('/users',     requireSupervisor, renderUsers);
app.get('/pdf',        requireAuth, renderPdfList);
app.get('/pdf/:filename', requireAuth, renderPdfFile);

// ============================================
// УЧЁТ ТМЦ (/manage)
// ============================================
// Просмотр — admin + supervisor + mol.
// Формы add/edit — admin + mol.
app.get('/manage',          requireRole(['admin', 'supervisor', 'mol']), renderManage);
app.get('/manage/add',      requireMol, renderAddEquipment);
app.get('/manage/edit/:id', requireMol, renderEditEquipment)

// ============================================
// УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
// ============================================
// Страница «Управление доступом» и CRUD пользователей — только admin.
app.get('/admin/users',          requireAdmin, renderAdminUsers);
app.get('/admin/user/add',       requireAdmin, renderAddUser);
app.get('/admin/user/edit/:id',  requireAdmin, renderEditUser);

// ============================================
// API — ТЕХНИКА
// ============================================
// Чтение — admin + supervisor + mol (mol видит только свои через scope).
// Запись — admin + mol (mol — только свои через permissions.js).

app.get('/api/manage/equipment',          requireRole(['admin', 'supervisor', 'mol']), getEquipmentAPI);
app.get('/api/manage/equipment/filtered', requireRole(['admin', 'supervisor', 'mol']), getFilteredEquipmentAPI);
app.get('/api/manage/equipment/counts',   requireRole(['admin', 'supervisor', 'mol']), getEquipmentCountsAPI);

app.get('/api/manage/equipment/:id/details', requireRole(['admin', 'supervisor', 'mol']), getEquipmentDetailsAPI);
app.get('/api/manage/equipment/:id/moves',   requireRole(['admin', 'supervisor', 'mol']), getEquipmentMovesAPI);
app.get('/api/manage/equipment/:id',         requireRole(['admin', 'supervisor', 'mol']), getEquipmentByIdAPI);

app.post('/api/manage/equipment/:id/move', requireMol, moveEquipmentAPI);

// 🆕 Действия с техникой из карточки
app.post('/api/manage/equipment/:id/status',            requireMol, changeEquipmentStatusAPI);
app.post('/api/manage/equipment/:id/assign',            requireMol, assignEquipmentAPI);
app.post('/api/manage/equipment/:id/return',            requireMol, returnEquipmentAPI);
app.post('/api/manage/equipment/:id/move-to-workplace', requireMol, moveToWorkplaceFromCardAPI);

app.post('/api/manage/equipment',          requireMol, addEquipmentAPI);
app.put('/api/manage/equipment/:id',       requireMol, updateEquipmentAPI);
app.delete('/api/manage/equipment/:id',    requireMol, deleteEquipmentAPI);

// Импорт CSV (только admin)
app.get('/manage/import',              requireAdmin, renderImportPage);
app.post('/api/manage/import',         requireAdmin, importCSVAPI);
app.post('/api/manage/import/cancel',  requireAdmin, cancelLastImportAPI);
app.post('/api/manage/import/preview', requireAdmin, previewImportAPI);
app.get('/api/manage/import/history',  requireAdmin, getImportHistoryAPI);
app.get('/api/manage/import/template', requireAdmin, downloadTemplate);

// ============================================
// ЛОГИ (только admin)
// ============================================
app.get('/admin/logs', requireAdmin, renderLogs);
app.get('/api/admin/logs', requireAdmin, getLogsAPI);
app.get('/api/admin/logs/stats', requireAdmin, getLogsStatsAPI);
app.post('/api/admin/logs/clean', requireAdmin, cleanLogsAPI);

// ============================================
// СПРАВОЧНИК (просмотр — admin + supervisor + mol; правка — admin + mol)
// ============================================
app.get('/admin/catalog', requireRole(['admin', 'supervisor', 'mol']), renderCatalog);

app.get('/api/admin/categories', requireRole(['admin', 'supervisor', 'mol']), getCategoriesAPI);
app.post('/api/admin/categories', requireMol, createCategoryAPI);
app.post('/api/admin/categories/reorder', requireMol, reorderCategoriesAPI);
app.get('/api/admin/categories/:id', requireRole(['admin', 'supervisor', 'mol']), getCategoryAPI);
app.put('/api/admin/categories/:id', requireMol, updateCategoryAPI);
app.delete('/api/admin/categories/:id', requireAdmin, deleteCategoryAPI);   // удаление категорий — только админ

app.get('/api/admin/types', requireRole(['admin', 'supervisor', 'mol']), getTypesAPI);
app.post('/api/admin/types', requireMol, createTypeAPI);
app.post('/api/admin/types/reorder', requireMol, reorderTypesAPI);
app.get('/api/admin/types/:id', requireRole(['admin', 'supervisor', 'mol']), getTypeAPI);
app.put('/api/admin/types/:id', requireMol, updateTypeAPI);
app.delete('/api/admin/types/:id', requireAdmin, deleteTypeAPI);   // удаление типов — только админ

// ============================================
// НОМЕНКЛАТУРА — модели ТМЦ
// ============================================
// Просмотр — admin + supervisor + mol.
// Создание и редактирование — admin + mol (модели общие, их можно добавлять).
// Удаление — только admin (иначе порвётся история в activity_log).
app.get('/admin/models', requireRole(['admin', 'supervisor', 'mol']), renderModels);

app.get('/api/admin/models', requireRole(['admin', 'supervisor', 'mol']), getModelsAPI);
app.get('/api/admin/models/check-duplicate', requireRole(['admin', 'supervisor', 'mol']), checkDuplicateAPI);
app.get('/api/admin/models/:id', requireRole(['admin', 'supervisor', 'mol']), getModelAPI);
app.post('/api/admin/models', requireMol, createModelAPI);
app.put('/api/admin/models/:id', requireMol, updateModelAPI);
app.delete('/api/admin/models/:id', requireAdmin, deleteModelAPI);   // удаление модели — только админ

// ============================================
// СКЛАДЫ
// ============================================
// Просмотр — admin + supervisor + mol (mol видит только свои через scope).
// Редактирование — admin + mol.
// set-default — только admin.

app.get('/admin/warehouses',     requireRole(['admin', 'supervisor', 'mol']), renderWarehouses);
app.get('/admin/warehouses/:id', requireRole(['admin', 'supervisor', 'mol']), renderWarehouseDetails);

app.get('/api/admin/warehouses',           requireRole(['admin', 'supervisor', 'mol']), getWarehousesAPI);
app.get('/api/admin/warehouses/tree',      requireRole(['admin', 'supervisor', 'mol']), getFullTreeAPI);
app.get('/api/admin/warehouses/stats',     requireRole(['admin', 'supervisor', 'mol']), getWarehouseStatsAPI);
app.get('/api/admin/warehouses/:id/tree',  requireRole(['admin', 'supervisor', 'mol']), getWarehouseTreeAPI);
app.get('/api/admin/warehouses/:id/zones', requireRole(['admin', 'supervisor', 'mol']), getZonesAPI);
app.get('/api/admin/warehouses/:id',       requireRole(['admin', 'supervisor', 'mol']), getWarehouseAPI);

app.post('/api/admin/warehouses',   requireMol, createWarehouseAPI);
app.put('/api/admin/warehouses/:id', requireMol, updateWarehouseAPI);
app.delete('/api/admin/warehouses/:id', requireMol, deleteWarehouseAPI);
app.post('/api/admin/warehouses/:id/set-default', requireAdmin, setDefaultWarehouseAPI);

// API зон
app.post('/api/admin/zones',       requireMol, createZoneAPI);
app.put('/api/admin/zones/:id',    requireMol, updateZoneAPI);
app.delete('/api/admin/zones/:id', requireMol, deleteZoneAPI);

// API стеллажей
app.get('/api/admin/zones/:id/racks', requireRole(['admin', 'supervisor', 'mol']), getRacksAPI);
app.post('/api/admin/racks',          requireMol, createRackAPI);
app.put('/api/admin/racks/:id',       requireMol, updateRackAPI);
app.delete('/api/admin/racks/:id',    requireMol, deleteRackAPI);

// API ячеек
app.get('/api/admin/racks/:id/cells',     requireRole(['admin', 'supervisor', 'mol']), getCellsAPI);
app.get('/api/admin/racks/:id/next-cell', requireRole(['admin', 'supervisor', 'mol']), getNextCellNumberAPI);
app.get('/api/admin/cells/:id/equipment', requireRole(['admin', 'supervisor', 'mol']), getCellEquipmentAPI);
app.get('/api/admin/cells/:id',           requireRole(['admin', 'supervisor', 'mol']), getCellAPI);
app.post('/api/admin/cells',              requireMol, createCellAPI);
app.put('/api/admin/cells/:id',           requireMol, updateCellAPI);
app.delete('/api/admin/cells/:id',        requireMol, deleteCellAPI);

// ============================================
// ИНВЕНТАРИЗАЦИЯ
// ============================================
app.get('/admin/inventory', requireRole(['admin', 'supervisor', 'mol']), renderInventory);

app.get('/api/admin/inventory/summary', requireRole(['admin', 'supervisor', 'mol']), getInventorySummaryAPI);
app.get('/api/admin/inventory/totals',  requireRole(['admin', 'supervisor', 'mol']), getInventoryTotalsAPI);
app.get('/api/admin/inventory/special', requireRole(['admin', 'supervisor', 'mol']), getSpecialStatusSummaryAPI);

app.get('/api/admin/warehouses/:id/inventory/export', requireRole(['admin', 'supervisor', 'mol']), exportInventoryCSV);
app.get('/api/admin/warehouses/:id/inventory',        requireRole(['admin', 'supervisor', 'mol']), getWarehouseInventoryAPI);
app.get('/api/admin/warehouses/:id/occupancy',        requireRole(['admin', 'supervisor', 'mol']), getCellOccupancyAPI);

// ============================================
// РАБОЧИЕ МЕСТА
// ============================================
// Просмотр — admin + supervisor + mol.
// Редактирование — admin + mol.
// set-default — только admin.

app.get('/admin/workplaces',     requireRole(['admin', 'supervisor', 'mol']), renderWorkplaces);
app.get('/admin/workplaces/:id', requireRole(['admin', 'supervisor', 'mol']), renderWorkplaceDetails);

// API офисов — чтение
app.get('/api/admin/offices',        requireRole(['admin', 'supervisor', 'mol']), getOfficesAPI);
app.get('/api/admin/offices/tree',   requireRole(['admin', 'supervisor', 'mol']), getFullWorkplaceTreeAPI);
app.get('/api/admin/offices/:id/tree',       requireRole(['admin', 'supervisor', 'mol']), getOfficeTreeAPI);
app.get('/api/admin/offices/:id/rooms',      requireRole(['admin', 'supervisor', 'mol']), getRoomsAPI);
app.get('/api/admin/offices/:id/equipment/export', requireRole(['admin', 'supervisor', 'mol']), exportOfficeInventoryCSV);
app.get('/api/admin/offices/:id/equipment',  requireRole(['admin', 'supervisor', 'mol']), getOfficeEquipmentAPI);
app.get('/api/admin/offices/:id/occupancy',  requireRole(['admin', 'supervisor', 'mol']), getWorkplaceOccupancyAPI);
app.get('/api/admin/offices/:id',            requireRole(['admin', 'supervisor', 'mol']), getOfficeAPI);

// API офисов — запись
app.post('/api/admin/offices',   requireMol, createOfficeAPI);
app.put('/api/admin/offices/:id', requireMol, updateOfficeAPI);
app.delete('/api/admin/offices/:id', requireMol, deleteOfficeAPI);
app.post('/api/admin/offices/:id/set-default', requireAdmin, setDefaultOfficeAPI);

// ============================================================
// API СТАТИСТИКИ И СВОДКИ (специфичные — ДО :id)
// ============================================================
app.get('/api/admin/workplaces/stats',   requireRole(['admin', 'supervisor', 'mol']), getWorkplaceStatsAPI);
app.get('/api/admin/workplaces/summary', requireRole(['admin', 'supervisor', 'mol']), getWorkplaceSummaryAPI);

// ============================================================
// API КАБИНЕТОВ
// ============================================================
app.post('/api/admin/rooms',       requireMol, createRoomAPI);
app.put('/api/admin/rooms/:id',    requireMol, updateRoomAPI);
app.delete('/api/admin/rooms/:id', requireMol, deleteRoomAPI);

// 🆕 5.0.2.1: автозаполнение рабочего места — ДО /rooms/:id/workplaces
app.get('/api/admin/rooms/:id/next-workplace', requireRole(['admin', 'supervisor', 'mol']), getNextWorkplaceNumberAPI);

app.get('/api/admin/rooms/:id/workplaces', requireRole(['admin', 'supervisor', 'mol']), getWorkplacesAPI);

// ============================================================
// API РАБОЧИХ МЕСТ
// ============================================================
app.get('/api/admin/workplaces/:id/equipment',       requireRole(['admin', 'supervisor', 'mol']), getWorkplaceEquipmentAPI);
app.post('/api/admin/workplaces/:id/move-equipment', requireMol, moveEquipmentToWorkplaceAPI);
app.get('/api/admin/workplaces/:id',                 requireRole(['admin', 'supervisor', 'mol']), getWorkplaceAPI);
app.post('/api/admin/workplaces',                    requireMol, createWorkplaceAPI);
app.put('/api/admin/workplaces/:id',                 requireMol, updateWorkplaceAPI);
app.delete('/api/admin/workplaces/:id',              requireMol, deleteWorkplaceAPI);

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
// Ответственные за склады / офисы / экземпляры техники.
app.get('/api/admin/warehouses/:id/responsibles', requireAdmin, getWarehouseResponsiblesAPI);
app.post('/api/admin/warehouses/:id/responsibles', requireAdmin, addWarehouseResponsibleAPI);
app.delete('/api/admin/warehouses/:id/responsibles/:userId', requireAdmin, removeWarehouseResponsibleAPI);

app.get('/api/admin/offices/:id/responsibles', requireAdmin, getOfficeResponsiblesAPI);
app.post('/api/admin/offices/:id/responsibles', requireAdmin, addOfficeResponsibleAPI);
app.delete('/api/admin/offices/:id/responsibles/:userId', requireAdmin, removeOfficeResponsibleAPI);

app.get('/api/admin/equipment/:id/responsible', requireRole(['admin', 'supervisor', 'mol']), getEquipmentResponsibleAPI);
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
  console.log(`⚙️  Учёт ТМЦ:           http://localhost:${PORT}/admin`);
  console.log(`🔐  Управление доступом: http://localhost:${PORT}/admin/users`);
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