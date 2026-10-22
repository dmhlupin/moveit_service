// routes/manage/index.js
// Собирает все роуты /manage/* в один объект для server.js.

const pages = require('./pages');
const equipment = require('./equipment');
const users = require('./users');
const logs = require('./logs');

module.exports = {
  // Страницы
  renderManage: pages.renderManage,
  renderAddEquipment: pages.renderAddEquipment,
  renderEditEquipment: pages.renderEditEquipment,

  // Пользователи (страницы + API)
  renderAdminUsers: users.renderAdminUsers,
  renderAddUser: users.renderAddUser,
  renderEditUser: users.renderEditUser,
  getUsersAPI: users.getUsersAPI,
  getUserByIdAPI: users.getUserByIdAPI,
  getUserDetailsAPI: users.getUserDetailsAPI,
  addUserAPI: users.addUserAPI,
  updateUserAPI: users.updateUserAPI,
  deleteUserAPI: users.deleteUserAPI,
  resetUserPasswordAPI: users.resetUserPasswordAPI,
  blockUserAPI: users.blockUserAPI,
  unblockUserAPI: users.unblockUserAPI,

  // Техника (API)
  getEquipmentAPI: equipment.getEquipmentAPI,
  getEquipmentByIdAPI: equipment.getEquipmentByIdAPI,
  getEquipmentDetailsAPI: equipment.getEquipmentDetailsAPI,
  addEquipmentAPI: equipment.addEquipmentAPI,
  updateEquipmentAPI: equipment.updateEquipmentAPI,
  deleteEquipmentAPI: equipment.deleteEquipmentAPI,
  moveEquipmentAPI: equipment.moveEquipmentAPI,
  getEquipmentMovesAPI: equipment.getEquipmentMovesAPI,

  // Логи (страница + API)
  renderLogs: logs.renderLogs,
  getLogsAPI: logs.getLogsAPI,
  getLogsStatsAPI: logs.getLogsStatsAPI,
  cleanLogsAPI: logs.cleanLogsAPI,
};