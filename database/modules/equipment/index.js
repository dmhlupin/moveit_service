// database/modules/equipment/index.js
// ============================================================
// Сборка модуля equipment из подфайлов.
// Контракт (экспортируемые функции) — 1:1 с прежним
// database/modules/equipment.js (до 5.15.1a).
// ============================================================

module.exports = (ctx) => {
  const helpers     = require('./helpers')(ctx);
  const scope       = require('./scope');
  const read        = require('./read')(ctx);
  const write       = require('./write')(ctx, helpers);
  const assignments = require('./assignments')(ctx);
  const movements   = require('./movements')(ctx, helpers);

  return {
    ...helpers,       // checkCellAvailability, checkUniqueSerialAndInventory,
                      // isFixedAsset, upsertFixedAsset, EQUIPMENT_SELECT_BASE
    ...read,
    ...write,
    ...assignments,
    ...movements,
  };
};