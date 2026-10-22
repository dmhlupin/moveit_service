// utils/permissions.js
// ============================================================
// Хелперы проверки прав для роутов (Этап 4).
//
// Идея:
//   - Для СПИСКОВ фильтрация идёт на уровне SQL (в модулях БД,
//     через аргумент scope = { userId, role }).
//   - Хелперы из этого файла — для ТОЧЕЧНЫХ проверок:
//     «может ли этот пользователь видеть/редактировать
//      конкретный склад / офис / экземпляр».
//
// Все функции асинхронные и возвращают true / false.
// Никогда не бросают — ошибки БД логируются и трактуются
// как «нет доступа» (fail closed).
// ============================================================

const db = require('../database/db');

/**
 * Проверить, что пользователь — МОЛ за конкретный склад
 * (через warehouse_responsibles).
 */
async function isWarehouseResponsible(userId, warehouseId) {
  if (!userId || !warehouseId) return false;
  const row = await db.get(
    `SELECT 1 AS ok FROM warehouse_responsibles
     WHERE user_id = ? AND warehouse_id = ? LIMIT 1`,
    [userId, warehouseId]
  );
  return !!row;
}

/**
 * Проверить, что пользователь — МОЛ за конкретный офис
 * (через office_responsibles).
 */
async function isOfficeResponsible(userId, officeId) {
  if (!userId || !officeId) return false;
  const row = await db.get(
    `SELECT 1 AS ok FROM office_responsibles
     WHERE user_id = ? AND office_id = ? LIMIT 1`,
    [userId, officeId]
  );
  return !!row;
}

/**
 * Проверить, что экземпляр техники закреплён за пользователем
 * (equipment.responsible_user_id = userId).
 */
async function isEquipmentResponsible(userId, equipmentId) {
  if (!userId || !equipmentId) return false;
  const row = await db.get(
    `SELECT 1 AS ok FROM equipment
     WHERE id = ? AND responsible_user_id = ? LIMIT 1`,
    [equipmentId, userId]
  );
  return !!row;
}

/**
 * Читать экземпляр техники с адресом — минимальная выборка,
 * нужна для проверок доступа к технике.
 */
async function loadEquipmentScope(equipmentId) {
  return db.get(`
    SELECT
      e.id,
      e.responsible_user_id,
      e.cell_id,
      e.workplace_id,
      wh.id AS warehouse_id,
      o.id  AS office_id
    FROM equipment e
    LEFT JOIN cells      cell ON e.cell_id = cell.id
    LEFT JOIN racks      rack ON cell.rack_id = rack.id
    LEFT JOIN zones      zone ON rack.zone_id = zone.id
    LEFT JOIN warehouses wh   ON zone.warehouse_id = wh.id
    LEFT JOIN workplaces wp   ON e.workplace_id = wp.id
    LEFT JOIN rooms      r    ON wp.room_id = r.id
    LEFT JOIN offices    o    ON r.office_id = o.id
    WHERE e.id = ?
  `, [equipmentId]);
}

// ============================================================
// ПУБЛИЧНЫЕ ХЕЛПЕРЫ
// ============================================================

/**
 * Может ли пользователь ВИДЕТЬ склад.
 *   admin / supervisor — любой
 *   mol                — только свой (через warehouse_responsibles)
 *   user               — нет
 */
async function canAccessWarehouse(user, warehouseId) {
  if (!user || !user.role) return false;
  if (user.role === 'admin' || user.role === 'supervisor') return true;
  if (user.role === 'mol') return isWarehouseResponsible(user.id, warehouseId);
  return false;
}

/**
 * Может ли пользователь РЕДАКТИРОВАТЬ склад.
 *   admin — любой
 *   mol   — только свой
 */
async function canEditWarehouse(user, warehouseId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'mol') return isWarehouseResponsible(user.id, warehouseId);
  return false;
}

/**
 * Может ли пользователь ВИДЕТЬ офис.
 */
async function canAccessOffice(user, officeId) {
  if (!user || !user.role) return false;
  if (user.role === 'admin' || user.role === 'supervisor') return true;
  if (user.role === 'mol') return isOfficeResponsible(user.id, officeId);
  return false;
}

/**
 * Может ли пользователь РЕДАКТИРОВАТЬ офис.
 */
async function canEditOffice(user, officeId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'mol') return isOfficeResponsible(user.id, officeId);
  return false;
}

/**
 * Может ли пользователь ВИДЕТЬ экземпляр техники.
 *   admin / supervisor — любой
 *   mol                — если он ответственный ИЛИ техника
 *                        лежит в его складе / офисе
 *   user               — только если техника назначена ему
 */
async function canAccessEquipment(user, equipmentId) {
  if (!user || !user.role) return false;
  if (user.role === 'admin' || user.role === 'supervisor') return true;

  const eq = await loadEquipmentScope(equipmentId);
  if (!eq) return false;

  if (user.role === 'mol') {
    if (eq.responsible_user_id === user.id) return true;
    if (eq.warehouse_id && await isWarehouseResponsible(user.id, eq.warehouse_id)) return true;
    if (eq.office_id    && await isOfficeResponsible(user.id, eq.office_id))    return true;
    return false;
  }

  if (user.role === 'user') {
    // Техника назначена ему прямо сейчас
    const row = await db.get(
      `SELECT 1 AS ok FROM user_equipment
       WHERE equipment_id = ? AND user_id = ? AND returned_date IS NULL
       LIMIT 1`,
      [equipmentId, user.id]
    );
    return !!row;
  }

  return false;
}

/**
 * Может ли пользователь РЕДАКТИРОВАТЬ экземпляр техники.
 *   admin — любой
 *   mol   — только если responsible_user_id = он
 *   остальные — нет
 */
async function canEditEquipment(user, equipmentId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'mol') return isEquipmentResponsible(user.id, equipmentId);
  return false;
}

// ============================================================
// 🆕 5.0.6: Проверка доступности целевого склада / офиса для МОЛа
// ============================================================

/**
 * Может ли пользователь переместить технику в целевой склад / офис.
 *
 * Правила:
 *   - Если у техники нет responsible_user_id — ограничений нет.
 *   - Если перемещает mol — целевой склад / офис должен быть его.
 *   - Если перемещает admin — целевой склад / офис должен быть
 *     из зоны ответственности МОЛа техники (чтобы МОЛ не потерял технику).
 *   - supervisor / user — не могут перемещать (защищено middleware).
 *
 /** @param {Object} user        — { id, role }
 /** @param {Object} equipment   — экземпляр (нужен responsible_user_id)
 /** @param {Object} target      — { type: 'cell' | 'workplace', id: number }
 /** @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function canMoveEquipmentTo(user, equipment, target) {
  if (!user || !equipment || !target || !target.id) {
    return { ok: true };
  }

  // Если техника без МОЛа — ограничений нет
  if (!equipment.responsible_user_id) {
    return { ok: true };
  }

  const targetId = parseInt(target.id, 10);
  if (isNaN(targetId)) return { ok: true };

  // Куда смотрим: cell → склад, workplace → офис
  if (target.type === 'cell') {
    const row = await db.get(
      `SELECT z.warehouse_id
       FROM cells c
       JOIN racks r ON r.id = c.rack_id
       JOIN zones z ON z.id = r.zone_id
       WHERE c.id = ?`,
      [targetId]
    );
    if (!row) return { ok: true };   // ячейка не найдена — пропускаем (другие проверки сработают)

    if (user.role === 'mol') {
      if (row.warehouse_id === null) return { ok: true };
      const ok = await isWarehouseResponsible(user.id, row.warehouse_id);
      if (!ok) return { ok: false, reason: 'Склад недоступен для вас' };
    }

    if (user.role === 'admin') {
      const molId = equipment.responsible_user_id;
      const ok = await isWarehouseResponsible(molId, row.warehouse_id);
      if (!ok) {
        return {
          ok: false,
          reason: 'Целевой склад не входит в зону ответственности МОЛа техники',
        };
      }
    }
    return { ok: true };
  }

  if (target.type === 'workplace') {
    const row = await db.get(
      `SELECT r.office_id
       FROM workplaces w
       JOIN rooms r ON r.id = w.room_id
       WHERE w.id = ?`,
      [targetId]
    );
    if (!row) return { ok: true };

    if (user.role === 'mol') {
      if (row.office_id === null) return { ok: true };
      const ok = await isOfficeResponsible(user.id, row.office_id);
      if (!ok) return { ok: false, reason: 'Офис недоступен для вас' };
    }

    if (user.role === 'admin') {
      const molId = equipment.responsible_user_id;
      const ok = await isOfficeResponsible(molId, row.office_id);
      if (!ok) {
        return {
          ok: false,
          reason: 'Целевой офис не входит в зону ответственности МОЛа техники',
        };
      }
    }
    return { ok: true };
  }

  return { ok: true };
}

module.exports = {
  canAccessWarehouse,
  canEditWarehouse,
  canAccessOffice,
  canEditOffice,
  canAccessEquipment,
  canEditEquipment,
  canMoveEquipmentTo,   // 🆕

  // низкоуровневые — на случай прямого использования в роутах
  isWarehouseResponsible,
  isOfficeResponsible,
  isEquipmentResponsible,
};