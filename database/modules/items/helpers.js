// database/modules/items/helpers.js
// Валидация kind и нормализация (по образцу equipment/helpers.js: EQUIPMENT_KINDS).
// Экспорт через module.exports.<fn> (для read.js / роутов) и через фабрику.

const ITEM_KINDS = ['consumable', 'spare_part'];

const ITEM_KIND_META = {
  consumable: {
    label: 'Расходник',
    icon: '🧴',
    basePath: '/manage/consumables',
  },
  spare_part: {
    label: 'Запчасть',
    icon: '🔧',
    basePath: '/manage/spare-parts', // 5.17
  },
};

function isValidItemKind(kind) {
  return ITEM_KINDS.includes(kind);
}

function normalizeItemKind(kind) {
  return isValidItemKind(kind) ? kind : 'consumable';
}

function getItemKindMeta(kind) {
  return ITEM_KIND_META[normalizeItemKind(kind)];
}

function getItemKindFromRow(row) {
  if (!row) return 'consumable';
  return normalizeItemKind(row.kind);
}

module.exports = {
  ITEM_KINDS,
  ITEM_KIND_META,
  isValidItemKind,
  normalizeItemKind,
  getItemKindMeta,
  getItemKindFromRow,
};