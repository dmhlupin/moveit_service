// database/modules/items/scope.js
// Scope для МОЛ: только свои склады (через warehouse_responsibles).
// Возвращает { sql, params } для подстановки в getItems.
// Чистая функция — db не нужна, но фабрика принимает ctx
// для единообразия с models.js / crud.js.

module.exports = function(ctx) {
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

  return { buildItemScope };
};