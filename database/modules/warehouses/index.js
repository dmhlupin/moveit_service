// database/modules/warehouses/index.js
// Собирает всё, что экспортирует модуль warehouses.
//
// database/db.js вызывает:
//   const warehouses = require('./modules/warehouses')(ctx);
//   module.exports = { ...warehouses };
//
// Node автоматически подхватывает index.js, когда есть папка.
// database/db.js менять НЕ нужно.

module.exports = (ctx) => {
  const crud      = require('./crud')(ctx);
  const tree      = require('./tree')(ctx);
  const stats     = require('./stats')(ctx);
  const inventory = require('./inventory')(ctx);
  const batch     = require('./batch')(ctx);
  const equipment = require('./equipment-in-cell')(ctx);

  return {
    ...crud,
    ...tree,
    ...stats,
    ...inventory,
    ...batch,
    ...equipment,
  };
};