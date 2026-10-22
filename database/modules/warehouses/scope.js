// database/modules/warehouses/scope.js
// SQL-фрагмент scope для роли mol.

function buildWarehouseScope(scope = {}) {
  const { userId, role } = scope;
  if (!userId || !role) return { clause: '', params: [] };
  if (role === 'admin' || role === 'supervisor') return { clause: '', params: [] };
  if (role === 'mol') {
    return {
      clause: `w.id IN (SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ?)`,
      params: [userId],
    };
  }
  return { clause: '1=0', params: [] };
}

module.exports = { buildWarehouseScope };