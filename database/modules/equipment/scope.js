// database/modules/equipment/scope.js
// ============================================================
// SQL-scope для роли mol: «свои экземпляры».
// Возвращает { clause, params } — пустые для admin/supervisor/user.
// ============================================================

function buildEquipmentScope(scope = {}) {
  const { userId, role } = scope;
  if (!userId || !role) return { clause: '', params: [] };
  if (role !== 'mol') return { clause: '', params: [] };

  const clause = `(
    e.responsible_user_id = ?
    OR e.cell_id IN (
      SELECT c.id FROM cells c
      JOIN racks r ON r.id = c.rack_id
      JOIN zones z ON z.id = r.zone_id
      WHERE z.warehouse_id IN (
        SELECT warehouse_id FROM warehouse_responsibles WHERE user_id = ?
      )
    )
    OR e.workplace_id IN (
      SELECT wp.id FROM workplaces wp
      JOIN rooms r ON r.id = wp.room_id
      WHERE r.office_id IN (
        SELECT office_id FROM office_responsibles WHERE user_id = ?
      )
    )
  )`;
  return { clause, params: [userId, userId, userId] };
}

module.exports = { buildEquipmentScope };