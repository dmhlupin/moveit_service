// routes/manage/users/index.js
// Сборка роутов пользователей (после 5.10.6).

const pages = require('./pages');
const api = require('./api');

module.exports = {
  ...pages,
  ...api,
};