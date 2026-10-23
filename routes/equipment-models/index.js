// routes/equipment-models/index.js
// Сборка роутов моделей ТМЦ (после 5.10.5).

const pages = require('./pages');
const api = require('./api');

module.exports = {
  ...pages,
  ...api,
};