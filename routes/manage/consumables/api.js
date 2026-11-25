// routes/manage/consumables/api.js
// ============================================================
// JSON API для /manage/consumables (5.16.2b).
//
// Номенклатура (item_models):
//   POST   /manage/consumables/api/item-models
//   PUT    /manage/consumables/api/item-models/:id
//   DELETE /manage/consumables/api/item-models/:id
//
// Остатки (items):
//   POST   /manage/consumables/api/items
//   PUT    /manage/consumables/api/items/:id
//   DELETE /manage/consumables/api/items/:id
//
// Движения (приход/расход) — 5.16.2c.
// Логирование — utils/logger.js → logAction({ req, action, entityType, entityId, details }).
// Доступ МОЛ — canAccessItemWarehouse (database/modules/items/scope.js).
// ============================================================

const {
  createItemModel,
  updateItemModel,
  deleteItemModel,
  getItemModelById,
  getItemModels,          // 🆕 для GET /api/item-models
  createItem,
  updateItem,
  deleteItem,
  getItemById,
  canAccessItemWarehouse,
} = require('../../../database/db');

const { logAction } = require('../../../utils/logger');

// ============================================================
// Хелперы
// ============================================================

function sendOk(res, data = {}) {
  res.json({ ok: true, ...data });
}

function sendErr(res, code, error, details) {
  const body = { ok: false, error };
  if (details) body.details = details;
  res.status(code).json(body);
}

function parseIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function isAdmin(role) { return role === 'admin'; }
function canEdit(role) { return role === 'admin' || role === 'mol'; }

// ============================================================
// НОМЕНКЛАТУРА (item_models)
// ============================================================

async function createItemModelAPI(req, res) {
  try {
    const role = req.session.role;
    if (!canEdit(role)) return sendErr(res, 403, 'forbidden');

    const b = req.body || {};
    const data = {
      corporate_id: trimOrNull(b.corporate_id),
      name:         trimOrNull(b.name),
      unit:         trimOrNull(b.unit) || 'шт',
      kind:         trimOrNull(b.kind) || 'consumable',
      category_id:  parseIntOrNull(b.category_id),
      type_id:      parseIntOrNull(b.type_id),
      description:  trimOrNull(b.description),
    };

    if (!data.corporate_id) return sendErr(res, 400, 'corporate_id_required');
    if (!data.name)         return sendErr(res, 400, 'name_required');
    if (!data.category_id)  return sendErr(res, 400, 'category_id_required');
    if (!data.type_id)      return sendErr(res, 400, 'type_id_required');

    const result = await createItemModel(data);

    logAction({
      req,
      action: 'item_model_create',
      entityType: 'item_model',
      entityId: result.id,
      details: JSON.stringify({ name: data.name, corporate_id: data.corporate_id }),
    }).catch(err => console.error('❌ logAction(item_model_create):', err.message));

    sendOk(res, { id: result.id });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return sendErr(res, 409, 'duplicate_corporate_id');
    }
    console.error('❌ createItemModelAPI:', error);
    sendErr(res, 500, 'internal_error');
  }
}

async function updateItemModelAPI(req, res) {
  try {
    const role = req.session.role;
    if (!canEdit(role)) return sendErr(res, 403, 'forbidden');

    const id = parseIntOrNull(req.params.id);
    if (!id) return sendErr(res, 400, 'invalid_id');

    const existing = await getItemModelById(id);
    if (!existing) return sendErr(res, 404, 'not_found');

    const b = req.body || {};
    const data = {
      corporate_id: trimOrNull(b.corporate_id) || existing.corporate_id,
      name:         trimOrNull(b.name)         || existing.name,
      unit:         trimOrNull(b.unit)         || existing.unit,
      category_id:  parseIntOrNull(b.category_id) || existing.category_id,
      type_id:      parseIntOrNull(b.type_id)     || existing.type_id,
      description:  b.description !== undefined ? trimOrNull(b.description) : existing.description,
    };

    const result = await updateItemModel(id, data);

    logAction({
      req,
      action: 'item_model_update',
      entityType: 'item_model',
      entityId: id,
      details: JSON.stringify({ name: data.name, corporate_id: data.corporate_id }),
    }).catch(err => console.error('❌ logAction(item_model_update):', err.message));

    sendOk(res, { changes: result.changes });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return sendErr(res, 409, 'duplicate_corporate_id');
    }
    console.error('❌ updateItemModelAPI:', error);
    sendErr(res, 500, 'internal_error');
  }
}

async function deleteItemModelAPI(req, res) {
  try {
    const role = req.session.role;
    if (!isAdmin(role)) return sendErr(res, 403, 'forbidden');

    const id = parseIntOrNull(req.params.id);
    if (!id) return sendErr(res, 400, 'invalid_id');

    await deleteItemModel(id);

    logAction({
      req,
      action: 'item_model_delete',
      entityType: 'item_model',
      entityId: id,
    }).catch(err => console.error('❌ logAction(item_model_delete):', err.message));

    sendOk(res);
  } catch (error) {
    if (String(error.message) === 'model_has_stock') {
      return sendErr(res, 409, 'model_has_stock');
    }
    console.error('❌ deleteItemModelAPI:', error);
    sendErr(res, 500, 'internal_error');
  }
}

// ============================================================
// ОСТАТКИ (items)
// ============================================================

async function createItemAPI(req, res) {
  try {
    const user = { id: req.session.userId, role: req.session.role };
    if (!canEdit(user.role)) return sendErr(res, 403, 'forbidden');

    const b = req.body || {};
    const data = {
      model_id:     parseIntOrNull(b.model_id),
      warehouse_id: parseIntOrNull(b.warehouse_id),
      quantity:     parseFloatOrNull(b.quantity) ?? 0,
      min_quantity: parseFloatOrNull(b.min_quantity) ?? 0,
      is_active:    b.is_active === undefined ? true : !!b.is_active,
    };

    if (!data.model_id)     return sendErr(res, 400, 'model_id_required');
    if (!data.warehouse_id) return sendErr(res, 400, 'warehouse_id_required');

    const allowed = await canAccessItemWarehouse(user, data.warehouse_id);
    if (!allowed) return sendErr(res, 404, 'not_found'); // правило: МОЛ — 404

    const result = await createItem(data);

    logAction({
      req,
      action: 'item_create',
      entityType: 'item',
      entityId: result.id,
      details: JSON.stringify({
        model_id: data.model_id,
        warehouse_id: data.warehouse_id,
        quantity: data.quantity,
      }),
    }).catch(err => console.error('❌ logAction(item_create):', err.message));

    sendOk(res, { id: result.id });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return sendErr(res, 409, 'duplicate_item');
    }
    console.error('❌ createItemAPI:', error);
    sendErr(res, 500, 'internal_error');
  }
}

async function updateItemAPI(req, res) {
  try {
    const user = { id: req.session.userId, role: req.session.role };
    if (!canEdit(user.role)) return sendErr(res, 403, 'forbidden');

    const id = parseIntOrNull(req.params.id);
    if (!id) return sendErr(res, 400, 'invalid_id');

    const existing = await getItemById(id);
    if (!existing) return sendErr(res, 404, 'not_found');

    const allowed = await canAccessItemWarehouse(user, existing.warehouse_id);
    if (!allowed) return sendErr(res, 404, 'not_found');

    const b = req.body || {};
    const data = {
      quantity:     b.quantity     !== undefined ? (parseFloatOrNull(b.quantity) ?? 0)     : existing.quantity,
      min_quantity: b.min_quantity !== undefined ? (parseFloatOrNull(b.min_quantity) ?? 0) : existing.min_quantity,
      is_active:    b.is_active    !== undefined ? !!b.is_active                          : !!existing.is_active,
    };

    const result = await updateItem(id, data);

    logAction({
      req,
      action: 'item_update',
      entityType: 'item',
      entityId: id,
      details: JSON.stringify({ quantity: data.quantity, min_quantity: data.min_quantity }),
    }).catch(err => console.error('❌ logAction(item_update):', err.message));

    sendOk(res, { changes: result.changes });
  } catch (error) {
    console.error('❌ updateItemAPI:', error);
    sendErr(res, 500, 'internal_error');
  }
}

async function deleteItemAPI(req, res) {
  try {
    const role = req.session.role;
    if (!isAdmin(role)) return sendErr(res, 403, 'forbidden');

    const id = parseIntOrNull(req.params.id);
    if (!id) return sendErr(res, 400, 'invalid_id');

    const existing = await getItemById(id);
    if (!existing) return sendErr(res, 404, 'not_found');

    await deleteItem(id);

    logAction({
      req,
      action: 'item_delete',
      entityType: 'item',
      entityId: id,
      details: JSON.stringify({
        model_id: existing.model_id,
        warehouse_id: existing.warehouse_id,
      }),
    }).catch(err => console.error('❌ logAction(item_delete):', err.message));

    sendOk(res);
  } catch (error) {
    console.error('❌ deleteItemAPI:', error);
    sendErr(res, 500, 'internal_error');
  }
}

// ============================================================
// GET-эндпоинты для модалки (5.16.2b, по запросу — «много номенклатуры»)
// ============================================================

// GET /manage/consumables/api/item-models?search=&category_id=&type_id=
// Список номенклатуры для селекта в модалке. Только consumable.
async function listItemModelsAPI(req, res) {
  try {
    const role = req.session.role;
    if (!canEdit(role) && role !== 'supervisor') {
      return sendErr(res, 403, 'forbidden');
    }

    const q = req.query || {};
    const filters = {
      kind: 'consumable',
      is_active: 1,
      search:      trimOrNull(q.search),
      category_id: parseIntOrNull(q.category_id),
      type_id:     parseIntOrNull(q.type_id),
    };

    const rows = await getItemModels(filters);

    // Компактный формат для селекта
    const items = rows.map(m => ({
      id: m.id,
      name: m.name,
      corporate_id: m.corporate_id,
      unit: m.unit,
      category_name: m.category_name,
      type_name: m.type_name,
    }));

    sendOk(res, { items });
  } catch (error) {
    console.error('❌ listItemModelsAPI:', error);
    sendErr(res, 500, 'internal_error');
  }
}

// GET /manage/consumables/api/items/:id
// Данные остатка для редактирования (модалка).
async function getItemAPI(req, res) {
  try {
    const user = { id: req.session.userId, role: req.session.role };
    if (!canEdit(user.role) && user.role !== 'supervisor') {
      return sendErr(res, 403, 'forbidden');
    }

    const id = parseIntOrNull(req.params.id);
    if (!id) return sendErr(res, 400, 'invalid_id');

    const item = await getItemById(id);
    if (!item) return sendErr(res, 404, 'not_found');

    if (user.role === 'mol') {
      const allowed = await canAccessItemWarehouse(user, item.warehouse_id);
      if (!allowed) return sendErr(res, 404, 'not_found');
    }

    sendOk(res, { item });
  } catch (error) {
    console.error('❌ getItemAPI:', error);
    sendErr(res, 500, 'internal_error');
  }
}


module.exports = {
  createItemModelAPI,
  updateItemModelAPI,
  deleteItemModelAPI,
  createItemAPI,
  updateItemAPI,
  deleteItemAPI,
  listItemModelsAPI,      // 🆕 GET /api/item-models
  getItemAPI,             // 🆕 GET /api/items/:id
};