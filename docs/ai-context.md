# MoveIT service — контекст для облачной модели
<!-- Актуализировано: 2026-11-18, версия 5.15.0 -->
<!-- Файл: docs/ai-context.md. Обновлять после каждого этапа (разделы 3, 4, 8, 10). -->

## 1. Стек и ограничения

Node.js 18+ / Express 4.18 / SQLite3 / Vanilla JS (ES6+).
Без ORM, TypeScript, React, сборщиков. Шаблонизатор самодельный (`utils/layout.js`),
плейсхолдеры `{{...}}` в `views/*.html` заменяются в роутах.

## 2. Архитектура (слои)

- `database/modules/*` — только SQL, экспорт функций. Без Express.
- `routes/<domain>/` — `index.js` (сборка), `pages.js` (рендер), `api.js` (JSON).
- `public/js/*`, `public/css/*` — по доменам.
- `views/*.html` — плейсхолдеры `{{...}}`, замена в роутах.
- `middleware/auth.js` — requireAuth / requireAdmin / requireSupervisor / requireMol.
- `utils/permissions.js` — canAccess* / canEdit*.

## 3. Где что лежит (актуально на 5.15.0)

### Техника
- БД: `database/modules/equipment/` — index, scope, helpers, read, write, assignments, movements.
- Роуты: `routes/manage/equipment.js`, `routes/manage-equipment-actions.js`.
- UI: `views/manage.html`, `admin-add.html`, `admin-edit.html`.
- JS: `public/js/manage/` (helpers, columns, bulk-actions, filters, init), `public/js/equipment-card/`.

### Разделы учёта (5.16.1)
- Роуты: `routes/manage/equipment-kinds/` (index, helpers, pages).
- UI: `views/manage-kind.html`, `public/js/manage-kind/filters.js`.
- Kind-хелперы: `database/modules/equipment/helpers.js` —
  `getKindWhere` / `getKindMeta` / `normalizeKindToFlags` /
  `getKindFromFlags` / `getKindFromRow`.
- Роуты (HTML): `/manage/fixed-assets`, `/manage/tangible`,
  `/manage/low-value`, `/manage/consumables`

  ### Номенклатура: расходники (5.16.2)
- БД: `database/modules/items/` — index, helpers, models, crud, scope.
- Роуты: `routes/manage/consumables/` — index, pages, api, helpers.
- UI: `views/manage-consumables.html`, `public/js/manage-consumables/`
  (filters, init).
- API: `/manage/consumables/api/{item-models,items}` (8 эндпоинтов).
- `item_categories` → `item_types` → `item_models` → `items` (остатки).
- `kind` на `item_models`: `'consumable'` (5.16.2) | `'spare_part'` (5.17).

### Склады
- БД: `database/modules/warehouses/` — index, scope, crud, tree, stats, inventory, batch, equipment-in-cell.
- Роуты: `routes/warehouses/` — index, pages, helpers, warehouses, zones, racks, cells, inventory.

### Рабочие места
- БД: `database/modules/workplaces.js`.
- Роуты: `routes/workplaces/` — index, pages, helpers, offices, rooms, workplaces, summary.

### Справочник / модели
- БД: `database/modules/catalog.js`, `equipment-models.js`.
- Роуты: `routes/catalog/` (index, pages, helpers, categories, types, equipment), `routes/equipment-models/`.

### Пользователи / роли
- БД: `database/modules/users.js`, `auth.js`, `profile.js`.
- Роуты: `routes/manage/users/` (index, pages, api), `routes/admin-responsibles.js`, `routes/auth.js`, `routes/profile.js`.

### Инвентаризация
- БД: `database/modules/warehouses/inventory.js`, `workplaces.js`, `users.js`.
- Роуты: `routes/warehouses/inventory.js`.
- UI: `views/admin-inventory.html`, `public/js/inventory.js`.

### Дашборд
- БД: `database/modules/dashboard.js`, `stats.js`.
- Роуты: `routes/dashboard/` (index, pages, helpers).

### Импорт / настройки / лендинг
- Импорт: `database/modules/import.js`, `routes/manage-import.js`.
- Настройки: `routes/settings/` (index, pages, api).
- Лендинг: `public/landing/` (index.html, styles.css, script.js).

## 4. Модель данных (ключевые таблицы)

- users(id, login, password_hash, full_name, role, is_active, email, department)
- equipment_models(id, name, manufacturer, corporate_id, category_id, type_id, description)
- equipment(id, model_id, inventory_number, serial_number, status, cell_id, workplace_id, responsible_user_id, is_quantity_accounted, assigned_by_user_id)
- fixed_assets(equipment_id PK, commissioning_date, initial_cost, useful_life_months)
- «kind» — вычисляемый (не колонка): EXISTS fixed_assets → fixed_asset;
  is_quantity_accounted = 1 → tangible; = 0 → low_value (5.16.1).

- item_categories(id, name, description, icon, sort_order, is_active)
- item_types(id, category_id, name, description, icon, sort_order, is_active)
- item_models(id, corporate_id, name, unit, kind, category_id, type_id,
  description, is_active)
  — kind: 'consumable' | 'spare_part' (валидация в helpers.js, без CHECK)
- items(id, model_id, warehouse_id, quantity, min_quantity, is_active)
  — UNIQUE(model_id, warehouse_id), quantity/min_quantity REAL
- warehouses / zones / racks / cells; offices / rooms / workplaces
- warehouse_responsibles, office_responsibles (many-to-many МОЛ)
- categories / types; logs

## 5. Статусы и роли

Статусы: `available | placed | assigned | maintenance | retired`.
Роли: `admin` (всё), `supervisor` (read-only, кроме логов), `mol` (только свои склады/офисы/экземпляры), `user` (только /profile и /pdf).

## 6. Правила, которые нельзя нарушать

- SQL только параметризованный. Multi-table — BEGIN/COMMIT/ROLLBACK.
- Вывод в HTML — через escapeHtml. Плейсхолдеры `{{...}}` — контракт, не заменять на реальный HTML.
- Действия логируются через `utils/logger.js`.
- Для МОЛа — 404 на чужой объект (не 403).
- Никаких прямых `db.all` / `db.get` в роутах — только через `database/modules/*`.
- Не добавлять npm-зависимости без запроса.

## 7. Ключевые хелперы

- `utils/permissions.js` — canAccessWarehouse / canEditWarehouse / canAccessOffice / canEditOffice / canAccessEquipment / canEditEquipment.
- `database/modules/equipment/scope.js` — buildEquipmentScope.
- `database/modules/warehouses/scope.js` — buildWarehouseScope.
- `database/modules/cells.js` — checkCellAvailability.
- `database/modules/equipment/helpers.js` — isFixedAsset / upsertFixedAsset.
- database/modules/equipment/helpers.js — kind-хелперы (5.16.1):
  EQUIPMENT_KINDS / EQUIPMENT_KIND_META / getKindWhere /
  getKindMeta / getKindFromRow / normalizeKindToFlags /
  getKindFromFlags. Экспорт: через `module.exports.<fn>` (для read.js
  и роутов) и через фабрику (для write.js / index.js).
- `utils/layout.js` — renderPage / renderPageFor / buildSidebar.

## 8. Что менялось недавно (5.12–5.15)

- 5.12: удалена `/users` → `/admin/inventory#users`.
- 5.13: удалён `/equipment` → `/manage`.
- 5.14: редизайн, темы, дашборд-модули, `/admin/catalog` серверный рендеринг.
- 5.15: количественный учёт + fixed_assets, `equipment.js` → папка `equipment/`.
- 5.16.1: разделы учёта — `/manage/fixed-assets`, `/manage/tangible`,
  `/manage/low-value`; kind-хелперы; sidebar с 4 пунктами; `?kind=`
  в форме add, read-only в edit; API принимает `kind`.
- 5.16.2: расходные материалы — `item_*` таблицы, `/manage/consumables`
  (список + CRUD + seed), API `item-models` / `items`, `kind` на модели
  (задел на 5.17 — запчасти).

## 9. Границы применимости моделей

- **Облачная (я):** задачи, затрагивающие 2+ слоя, архитектура, разбор багов,
  планирование этапов, длинный контекст (3–5 файлов).
- **Qwen 14B (локально):** автокомплит (Tab) и Edit (Ctrl+I) на одном файле
  до ~300 строк. Не использовать для «пойми проект и сделай».
- **Сам:** если точно знаешь файл и функцию — быстрее сделать руками.

## 10. Как со мной работать

### 10.1. Формат задачи
- Задача + 1–3 релевантных файла (не весь проект).
- Если задача затрагивает 3+ слоя — я даю план и патчи по файлам.
- Если файл > 1000 строк — давай фрагмент (функцию), не файл целиком.
- После правок — `npm run check-css` / `check-db` / `check-roles`.

### 10.2. Коммиты после каждого шага (правило 1)
После завершения каждой задачи я формирую **готовую многострочную команду PowerShell**:
```powershell
git add <изменённые файлы>
$msg = @"
<тип>: <краткое описание>

<детали: что изменено, зачем>
"@
git commit -m $msg
git tag -a vX.Y.Z -m "<описание тега>"   если этап завершён
git push origin main --tags
```

### 10.3. Слежение за контекстом (правило 2)

Я предупреждаю **заранее**, когда контекст чата приближается к пределу:

- «Осталось ~20% контекста — предлагаю завершить текущую задачу и начать новый чат».
- «Контекст заполнен на 80% — дальнейшие правки могут потерять детали ранних сообщений».
- При завершении — предлагаю **резюме** (что сделано, что осталось) для переноса в новый чат.

### 10.4. Документация при завершении чата (правило 3)

При завершении чата я формирую:

- **Патчи для `README.md`** — если изменилась структура, возможности, roadmap.
- **Запись для `CHANGELOG.md`** — в формате твоего changelog (раздел `[X.Y.Z]`, подшаги, теги).
- **Обновление `docs/ai-context.md`** — разделы 3 (где что лежит), 4 (модель данных), 8 (что менялось).

Я даю **готовые блоки для вставки**, а не «общие слова». Ты применяешь и коммитишь.

### 10.5. Техдолг (правило 4)

- В начале задачи — проверяю `techdebt.md`: есть ли там пункт, который закрывается этой задачей.
- При завершении — предлагаю **закрыть** соответствующие пункты (с формулировкой «закрыто в vX.Y.Z») и **добавить** новые, если в ходе работы всплыли проблемы.
- Формат: `## [открыт]` / `## [закрыт vX.Y.Z]` + краткое описание + ссылка на файл/функцию.