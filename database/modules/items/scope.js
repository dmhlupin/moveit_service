// database/modules/items/scope.js
// Scope для МОЛ: только свои склады (через warehouse_responsibles).
// Возвращает { sql, params } для подстановки в getItems.
// + canAccessItemWarehouse(user, warehouseId) — точечная проверка доступа
//   (для api.js: приход/расход/правка остатка на чужом складе → 404).

module.exports = function(ctx) {
  const { get } = ctx;

  function buildItemScope(user) {
    if (!user) {
      return { sql: '1=0', params: [] };
    }
    if (user.role === 'admin' || user.role === 'supervisor') {
      return { sql: null, params: [] };
    }
    if (user.role === 'mol') {
      return {
        sql: `s.warehouse_id IN (
                SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ?
              )`,
        params: [user.id],
      };
    }
    return { sql: '1=0', params: [] };
  }

  /**
   * Проверка: может ли пользователь работать с остатком на складе warehouseId.
   * admin / supervisor — всегда true.
   * mol — только если склад в warehouse_responsibles.
   * user — false.
   * @returns {Promise<boolean>}
   */
  async function canAccessItemWarehouse(user, warehouseId) {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'supervisor') return true;
    if (user.role !== 'mol') return false;

    const row = await get(
      'SELECT 1 AS ok FROM warehouse_responsibles WHERE user_id = ? AND warehouse_id = ? LIMIT 1',
      [user.id, warehouseId]
    );
    return !!row;
  }

  return { buildItemScope, canAccessItemWarehouse };
};