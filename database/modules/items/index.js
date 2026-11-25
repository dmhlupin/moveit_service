// database/modules/items/index.js
// Номенклатура: расходники (5.16.2) + запчасти (5.17).
// Слои: helpers (kind), models (номенклатура), crud (остатки), scope (МОЛ).

const helpers = require('./helpers');
const models = require('./models');
const crud = require('./crud');
const scope = require('./scope');

module.exports = function(ctx) {
  return {
    // kind-хелперы (чистые функции, без db)
    ...helpers,
    // номенклатура (item_models)
    ...models(ctx),
    // остатки (items)
    ...crud(ctx),
    // scope для МОЛ
    ...scope(ctx),
  };
};