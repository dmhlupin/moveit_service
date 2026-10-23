// routes/warehouses/index.js
// Сборка роутов складов (после 5.10.3).

const pages = require('./pages');
const warehouses = require('./warehouses');
const zones = require('./zones');
const racks = require('./racks');
const cells = require('./cells');
const inventory = require('./inventory');

module.exports = {
  ...pages,
  ...warehouses,
  ...zones,
  ...racks,
  ...cells,
  ...inventory,
};