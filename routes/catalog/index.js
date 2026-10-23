// routes/catalog/index.js
// Сборка роутов справочника (после 5.10.4).

const pages = require('./pages');
const categories = require('./categories');
const types = require('./types');
const equipment = require('./equipment');

module.exports = {
  ...pages,
  ...categories,
  ...types,
  ...equipment,
};