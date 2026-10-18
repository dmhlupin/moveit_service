## [4.1.2] - 2026-10-16

## [4.1.0] - 2026-10-18

**🎉 Этап 4.1 завершён: модернизация UI, ревизия роутов, scope для агрегатов**

Закрыт этап 4.1 — доведение UI и структуры роутов до консистентного
состояния под ролевую модель admin / supervisor / mol / user.

### Подшаги 4.1.x

- **4.1.1** — мелкие фиксы supervisor / mol:
  * пункт «Учёт ТМЦ» в sidebar для supervisor;
  * скрытие ✏️/🗑️/🔄 для supervisor на `/admin`;
  * баг с модалкой перемещения;
  * дашборд по ролям (убраны карточки и ссылки для supervisor/mol);
  * ответственный МОЛ в модалке просмотра техники;
  * читаемость бейджей статусов в шапке модалки;
  * убраны лишние ссылки в шапке `/admin` для mol;
  * `renderPage` → `renderPageFor` в `renderAddUser`, `renderLogs`;
  * `getEquipmentDetailsAPI` — scope + `canAccessEquipment` вместо `canEditEquipment`.

- **4.1.2** — клик по строке техники, колонка «Ответственный МОЛ»,
  фиксы редактирования, размер страницы:
  * клик по строке техники на `/admin` → открыть карточку;
  * селект размера страницы на `/equipment` (10/20/50/100);
  * колонка «Ответственный МОЛ» на `/admin` для admin/supervisor;
  * **баг:** смена МОЛ в форме `/admin/edit/:id` не сохранялась;
  * скрытие ✏️/🔄/🗑️ для mol на «чужих» экземплярах.

- **4.1.3** — модернизация дашборда + scope для агрегатов дашборда:
  * `getDashboardStats(scope)`, `getRecentActivity(limit, scope)`,
    `getEquipmentNeedingAttention(scope)`, `getTopUsers(limit, scope)`,
    `getCategoryStats(scope)`, `getStats(scope)`;
  * для mol — только его экземпляры, действия, категории;
  * для admin / supervisor — глобальные данные;
  * карточки по ролям (уже частично в 4.1.1, доработано);
  * кнопка «Добавить технику» → `/manage/add`.

- **4.1.4** — scope для агрегатов складов и инвентаризации:
  * `getWarehouseStats(scope)`, `getInventoryTotals(scope)`,
    `getSpecialStatusSummary(scope)`;
  * `getInventorySummary(scope)` — уже был, теперь передаётся из роутов;
  * для mol — только его склады (`warehouse_responsibles`)
    и его экземпляры (`responsible_user_id`);
  * для admin / supervisor — глобальные данные.

- **4.1.5** — ревизия роута `/admin` → `/manage`:
  * `routes/admin.js` → `routes/manage.js` (`renderAdmin` → `renderManage`);
  * `views/admin.html` → `views/manage.html`;
  * `public/js/admin.js` → `public/js/manage.js`;
  * `public/css/admin.css` → `public/css/manage.css`;
  * `server.js`: роуты `/manage`, `/manage/add`, `/manage/edit/:id`,
    `/api/manage/equipment/*`;
  * `views/partials/sidebar.html`: ссылка «Учёт ТМЦ» → `/manage`;
  * `public/js/layout.js`: подсветка активного пункта → `manage`;
  * `public/js/manage.js`: AJAX-запросы → `/api/manage/equipment/*`,
    редирект на `/manage/edit/:id`;
  * `public/js/admin-edit.js`: редиректы на `/manage`,
    `loadCurrentLocation` → `/api/manage/equipment/:id/details`;
  * **баг:** `assigned → available` с ячейкой — техника не попадала
    в ячейку (явный возврат перед `updateEquipment`).

### Итог этапа

- **`/admin`** — только системное администрирование (пользователи, логи,
  справочники, склады, рабочие места, инвентаризация).
- **`/manage`** — «Учёт ТМЦ» (admin, supervisor, mol).
- **Дашборд** — разные данные под роли, mol видит только свои цифры.
- **Агрегаты складов и инвентаризации** — scope для mol.
- **Sidebar** — подсветка `/manage`, ссылка «Учёт ТМЦ» для supervisor.
- **Формы техники** — работают под `/manage/add`, `/manage/edit/:id`,
  редиректы на `/manage`.

### Технический долг (перенесён в 4.2.x / 5.x)

- Серверный фильтр на `/manage` (сейчас клиентский) → 4.1.6 (отложено).
- Множественные перемещения → 4.1.6 (отложено).
- Импорт CSV / Excel, экспорт XLSX, печать карточек → 5.x.
- «Корневая переработка подхода к редактированию техники» (mol не может
  редактировать «чужой» экземпляр из своего склада) → 5.x.

### Теги этапа

- v4.1.1 — мелкие фиксы supervisor / mol + UI-полировка
- v4.1.2 — клик по строке, ответственный МОЛ, размер страницы
- v4.1.3 — модернизация дашборда + scope для агрегатов
- v4.1.4 — scope для агрегатов складов / инвентаризации
- v4.1.5 — ревизия роута /admin → /manage
- **v4.1.0 — этап 4.1 завершён (этот)**

**🎛️ Этап 4.1.2: клик по строке, колонка ответственного МОЛ, фиксы редактирования, размер страницы**

Закрыт второй подшаг этапа 4.1. Сделаны UX-улучшения таблицы
`/admin` (клик по строке, колонка «Ответственный МОЛ»), исправлен
баг со сменой ответственного МОЛа в форме редактирования, скрыты
кнопки редактирования для «чужих» экземпляров у МОЛа, добавлен
селект размера страницы на `/equipment`.

### Added

- **Клик по строке техники на `/admin`** — клик по любой ячейке
  строки (кроме кнопок действий) открывает карточку просмотра.
  На кнопках — `event.stopPropagation()`, чтобы клик по ним
  не открывал карточку.
  * CSS: `.equipment-row-clickable` с `cursor: pointer` +
    усиленный hover
- **Колонка «Ответственный МОЛ» на `/admin`** — для ролей
  `admin` и `supervisor`. Отображается аватар (инициалы,
  фиолетово-синий градиент) + ФИО. Для `mol` колонка
  **не показывается** (лишний шум — он видит только своё).
  * Плейсхолдер `{{responsible_th}}` в шапке таблицы
  * Ячейка формируется только для admin / supervisor
- **Селект «Показывать по» на `/equipment`** — значения
  `10 / 20 / 50 / 100`, по умолчанию `10`.
  * Валидация `limit` на сервере (`ALLOWED_PAGE_SIZES`)
  * Сохранение в URL (`?limit=50`)
  * Сохраняется при смене фильтров, переходе между страницами,
    клике «Сбросить» и переходе на «Не размещено»
  * Сбрасывается только `page` при смене `limit`

### Changed

- **`routes/admin.js` → `renderAdmin`**:
  * кнопки действий формируются в одну переменную
    `actionButtons` с `event.stopPropagation()` на каждой
  * новая логика `canEditThis`: `admin` — всегда, `mol` — только
    если `responsible_user_id` совпадает с `req.session.userId`
  * для `mol` кнопки ✏️ / 🔄 / 🗑️ **скрыты** на экземплярах,
    которые лежат в его складе / офисе, но не закреплены за ним
    (только 👁️)
  * добавлена ячейка `responsibleCell` с ответственным МОЛом
  * в шапку таблицы добавлен плейсхолдер `{{responsible_th}}`
- **`routes/admin.js` → `updateEquipmentAPI`**:
  * принимает `responsible_user_id` из `req.body`
  * **исправлен баг**: раньше `responsible_user_id` не пробрасывался
    в `updateEquipment`, из-за чего смена МОЛа в форме
    редактирования не сохранялась
  * для `admin` — из формы (может быть `null`, чтобы снять
    ответственного); для `mol` — всегда `req.session.userId`
  * в логирование `equipment_update` добавлено
    `responsible_changed: oldResponsibleId !== finalResponsibleId`
- **`routes/equipment.js`**:
  * `PAGE_SIZE = 10` заменён на `ALLOWED_PAGE_SIZES = [10, 20, 50, 100]`
    и `DEFAULT_PAGE_SIZE = 10`
  * `limit` читается из `req.query` с валидацией
  * `renderPagination` сохраняет `limit` в URL (через копирование
    `query`, кроме `page`)
  * добавлен плейсхолдер `{{page_size_options}}`
- **`views/admin.html`**:
  * в `<thead>` добавлен `{{responsible_th}}` между
    «Назначена» и «Действия»
- **`views/equipment.html`**:
  * в панели фильтров добавлен блок `.filter-group--narrow`
    с селектом `#filterPageSize` и `onchange="applyPageSize()"`
- **`public/css/admin.css`**:
  * добавлены `.equipment-row-clickable` и
    `.equipment-row-clickable:hover td`
- **`public/css/equipment.css`**:
  * добавлены `.filter-group--narrow` и
    `.filter-group--narrow select` (узкий селект)
- **`public/js/equipment-filter.js`**:
  * добавлена функция `applyPageSize()` — меняет `limit` в URL,
    сбрасывает `page`
  * `applyFilters()` — сохраняет текущий `limit` в URL
  * `resetFilters()` — сохраняет `limit`, сбрасывает только фильтры
  * `filterUnplaced()` — сохраняет `limit` при переходе
    на «Не размещено»

### Fixed

- **Баг: смена ответственного МОЛа в форме `/admin/edit/:id`
  не сохранялась.** В логи падало `status_changed: false`, тоста
  и ошибок не было. Причина — `updateEquipmentAPI` не пробрасывал
  `responsible_user_id` в модуль `updateEquipment`, где
  `responsible_user_id === undefined` означает «не трогать поле».
  Исправлено.
- **Баг: кнопки ✏️ / 🔄 / 🗑️ у МОЛа на «чужих» экземплярах.**
  Раньше МОЛ видел кнопки редактирования для экземпляров,
  которые лежат в его складах / офисах, но закреплены за другим
  МОЛом. Сервер всё равно возвращал 404 при попытке сохранения.
  Теперь кнопки скрыты в UI — консистентно с правами.
- **Логи `equipment_update` не отражали смену МОЛа.** Добавлено
  поле `responsible_changed`.

### Файлы

**Изменены:**
- `routes/admin.js`
- `routes/equipment.js`
- `views/admin.html`
- `views/equipment.html`
- `public/js/equipment-filter.js`
- `public/css/admin.css`
- `public/css/equipment.css`

**Не тронуты:**
- `public/js/admin.js`
- `database/modules/equipment.js`
- `utils/permissions.js`

### Проверено

- `node scripts/check-css.js` — зелёный
- `node scripts/check-roles.js` — зелёный
- Ручная проверка:
  * **admin** — клик по строке открывает карточку; колонка
    «Ответственный МОЛ» есть; смена МОЛа в форме сохраняется;
    селект размера страницы работает
  * **supervisor** — клик по строке открывает карточку;
    колонка «Ответственный МОЛ» есть; кнопок ✏️🔄🗑️ нет
  * **mol** — колонки «Ответственный МОЛ» нет; на своих
    экземплярах ✏️🔄🗑️ есть, на «чужих в своих складах» —
    только 👁️
  * `/equipment` — селект «Показывать по» работает, размер
    сохраняется при фильтрации, пагинации, сбросе

### Технический долг (перенесён в 4.1.x)

- Scope для агрегатов: `getWarehouseStats`, `getInventorySummary`,
  `getInventoryTotals`, `getSpecialStatusSummary` → 4.1.4
- Модернизация дашборда (разные данные под роли) → 4.1.3
- Ревизия роута `/admin` → `/manage` → 4.1.5
- Серверный фильтр на `/admin` (сейчас клиентский) → 4.1.6
- `getAllTypes` без фильтра по категории → 4.1.4
- Множественные перемещения → 4.1.6

### Теги

- v4.1.1 — мелкие фиксы supervisor / mol + UI-полировка
- **v4.1.2 — клик по строке, ответственный МОЛ, размер страницы (этот)**

## [4.1.1] - 2026-10-16

**🔧 Этап 4.1.1: мелкие фиксы supervisor / mol + UI-полировка**

Закрыт первый подшаг этапа 4.1: быстрые фиксы ролевой модели
(пункт «Учёт ТМЦ» в sidebar для supervisor, скрытие кнопок
редактирования, разграничение доступа к карточке техники),
убраны лишние ссылки с дашборда для supervisor/mol, в карточку
просмотра техники добавлен ответственный МОЛ, поправлена
читаемость бейджей статусов в шапке модалки.

### Added

- **`/admin` (Учёт ТМЦ) в sidebar для supervisor** —
  в блоке «Управление» у supervisor добавлен пункт
  «🧾 Учёт ТМЦ» (раньше был доступен по прямой ссылке,
  но в меню отсутствовал)
- **Ответственный МОЛ в карточке техники** — в модалке
  просмотра (👁️) в блоке «📋 Информация о технике»
  добавлено поле «Ответственный МОЛ» (занимает обе колонки),
  подсвечено акцентным цветом
- **`{{current_role}}` в `views/admin.html`** — скрытый input
  `#currentRole` для клиентского JS (`getCurrentRole()`)
- **`renderPageFor` в `routes/dashboard.js`** — перенесён
  импорт наверх файла для единообразия

### Changed

- **`routes/admin.js` → `renderAdmin`**:
  * кнопки в колонке «Действия» рендерятся с учётом роли:
    - 👁️ — для всех (admin / supervisor / mol)
    - ✏️ — только для admin / mol
    - 🔄 — только для admin / mol (и только если не `assigned`)
    - 🗑️ — только для admin / mol (и только если `available`)
  * ссылки в шапке (`.page-actions`) собираются по ролям:
    - **admin** — Справочник / Склады / Инвентаризация / Логи
    - **supervisor** — Справочник / Склады / Инвентаризация
    - **mol** — пусто (всё есть в sidebar)
- **`routes/admin.js` → `getEquipmentDetailsAPI`**:
  * `getEquipmentById(id)` → `getEquipmentById(id, scope)` —
    для роли mol сразу отсекает чужие экземпляры (404)
  * `canEditEquipment` → `canAccessEquipment` —
    правильная проверка для **просмотра** (supervisor read-only,
    но карточку открывать должен; mol видит экземпляры в своих
    складах / офисах, даже если `responsible_user_id` не его)
- **`routes/admin.js` → `renderAddUser`, `renderLogs`**:
  `renderPage` → `renderPageFor(req, res, options)` —
  единообразие, sidebar рендерится по роли из сессии
- **`routes/dashboard.js` → `renderDashboard`**:
  * карточка «👥 Пользователей» — только для admin / supervisor
  * карточка «📈 Действий за 24ч» — только для admin
  * кнопка «➕ Добавить технику» — только для admin / mol
  * ссылка «Все логи →» — только для admin
  * плейсхолдеры `{{action_add_equipment}}`, `{{card_users}}`,
    `{{card_actions_today}}`, `{{link_all_logs}}`
- **`public/js/admin.js` → `viewEquipment`**:
  * добавлена `getCurrentRole()` (читает `#currentRole`)
  * `canMove = equipment.status !== 'assigned' && currentRole !== 'supervisor'` —
    кнопка «🔄 Переместить» скрыта для supervisor
  * добавлен блок «Ответственный МОЛ» в detail-grid
- **`public/js/admin.js` → `moveFromCard`**:
  убран `setTimeout(200)` — модалка перемещения открывается
  синхронно после закрытия карточки просмотра
- **`public/css/admin.css`**:
  * `.empty-equipment` — `color: var(--text-secondary)`
    (было `var(--text-muted)`), `.empty-icon` без лишней
    прозрачности, `<p>` явно `var(--text-secondary)`
  * `.current-user-card` — явный `color: var(--text-primary)`
  * `.current-user-date` — `font-weight: 500`
  * `.current-user-status` — крупнее padding, `font-weight: 700`,
    тень для отрыва от фона
  * **`.equipment-header-badges .status-badge.status-*`** —
    принудительно белый фон + тёмный текст + `font-weight: 700`
    (специфичность 0,3,0 — перебивает `.status-badge.status-*`
    из `components.css` независимо от порядка подключения)
  * **`.user-header-badges .status-badge.status-*`** +
    `.role-badge.role-*` — то же (на будущее)

### Fixed

- **Баг с модалкой перемещения** — при клике 🔄 «Переместить»
  в карточке просмотра (👁️) модалка открывалась и сразу
  закрывалась. Причина — гонка событий из-за `setTimeout(200)`
  в `moveFromCard`. Убрано.
- **Supervisor: 404 при открытии карточки техники (👁️)** —
  `getEquipmentDetailsAPI` проверял `canEditEquipment`, который
  для supervisor возвращает `false`. Заменено на `canAccessEquipment`.
- **Плохая читаемость бейджа статуса в шапке модалки** —
  текст `<span class="status-badge status-assigned">👤 Назначена</span>`
  почти не читался (тёмный текст на тёмном фоне). Исправлено
  принудительным белым фоном + тёмным текстом.

### Файлы

**Изменены:**
- `routes/admin.js`
- `routes/dashboard.js`
- `public/js/admin.js`
- `public/css/admin.css`
- `views/admin.html`
- `views/dashboard.html`
- `views/partials/sidebar.html`

**Не тронуты:**
- `database/modules/equipment.js` (уже отдаёт `responsible_user_name`)
- `utils/permissions.js` (используется `canAccessEquipment`)
- `utils/layout.js` (`renderPageFor` уже есть)

### Проверено

- `node scripts/check-css.js` — зелёный
- `node scripts/check-roles.js` — зелёный
- Ручная проверка под 4 ролями:
  * **admin** — `/admin`, кнопки ✏️🔄🗑️👁️ на месте; `/` — 7 карточек, обе кнопки, «Все логи →»
  * **supervisor** — `/admin`, только 👁️; карточка техники **открывается**; `/` — 6 карточек, только «Инвентаризация», «Все логи →» отсутствует
  * **mol** — `/admin`, кнопки на месте, видит только свою технику; `/` — 5 карточек, обе кнопки; «Все логи →» отсутствует
  * **user** — дашборд недоступен (как и раньше)
- Консоль браузера — без ошибок

### Технический долг (перенесён в 4.1.x)

- `getWarehouseStats` / `getInventorySummary` / `getInventoryTotals` /
  `getSpecialStatusSummary` — глобальные, без scope (для МОЛа
  показывают цифры всей системы) → 4.1.4
- Селект размера страницы на `/equipment` → 4.1.2
- Клик по строке техники на `/admin` → открыть карточку → 4.1.2
- Серверный фильтр на `/admin` (сейчас клиентский) → 4.1.6
- `getAllTypes` на `/equipment` без фильтра по категории → 4.1.4
- Множественные перемещения (`/admin/moves`) → 4.1.6

### Теги

- **v4.1.1 — мелкие фиксы supervisor / mol + UI-полировка (этот)**

## [4.0.0] - 2026-10-15

**🎉 Этап 4 завершён: ролевая модель admin / supervisor / mol / user**

Ролевая модель расширена с двух ролей до четырёх. Появилось понятие
**МОЛ — материально ответственное лицо**: пользователь, отвечающий
за конкретные склады, офисы и экземпляры техники.

Вся фильтрация данных для роли МОЛ — **на уровне SQL**, а не в JS.
Хелперы из `utils/permissions.js` — только для точечных проверок
«можно ли редактировать этот экземпляр / склад / офис».

### Роли и права

| Возможность | admin | supervisor | mol | user |
|---|:---:|:---:|:---:|:---:|
| Дашборд `/` | ✅ | ✅ | ✅ (свои) | ❌ |
| `/equipment` | ✅ | ✅ | ✅ (свои) | ❌ |
| `/admin` (Учёт ТМЦ) | ✅ | ✅ read-only | ✅ (свои) | ❌ |
| `/users` | ✅ | ✅ | ❌ | ❌ |
| `/admin/users` (управление доступом) | ✅ | ❌ | ❌ | ❌ |
| `/admin/logs` | ✅ | ❌ | ❌ | ❌ |
| `/admin/catalog` | ✅ | ✅ read-only | ✅ | ❌ |
| `/admin/models` | ✅ | ✅ read-only | ✅ (без удаления) | ❌ |
| `/admin/warehouses` | ✅ | ✅ read-only | ✅ (свои) | ❌ |
| `/admin/workplaces` | ✅ | ✅ read-only | ✅ (свои) | ❌ |
| `/admin/inventory` | ✅ | ✅ | ✅ (свои) | ❌ |
| `/profile`, `/pdf` | ✅ | ✅ | ✅ | ✅ |
| Управление МОЛ (склады / офисы / экземпляры) | ✅ | ❌ | ❌ | ❌ |
| Удаление моделей / категорий / типов | ✅ | ❌ | ❌ | ❌ |
| Set-default складов / офисов | ✅ | ❌ | ❌ | ❌ |

### Подшаги 4.0.1 – 4.0.7

- **4.0.1** — модель данных для ролевой модели МОЛ:
  таблицы `warehouse_responsibles` / `office_responsibles`,
  поле `equipment.responsible_user_id`, индексы,
  скрипт `scripts/check-roles.js`
- **4.0.2** — middleware `requireSupervisor` / `requireMol` /
  `requireRole`, модуль `utils/permissions.js`, сквозной
  SQL-scope в функциях чтения
- **4.0.3** — API-роуты под 4 роли, `routes/admin-responsibles.js`,
  `addEquipment` / `updateEquipment` принимают `responsible_user_id`
- **4.0.4** — роле-зависимый sidebar, разнос `/admin`
  и `/admin/users`, перевод роутов на `renderPageFor`
- **4.0.5** — селект «Ответственный МОЛ» в формах,
  отображение ответственного в карточке, скрытие кнопок для
  ролей МОЛ и supervisor на `/admin/models`, фильтрация
  списка складов по scope
- **4.0.6** — управление МОЛ админом: чекбоксы складов и офисов
  в форме пользователя, блоки «Ответственные МОЛ» на страницах
  склада и офиса
- **4.0.7** — seed с МОЛами и supervisor, распределение
  `responsible_user_id` между экземплярами, привязки МОЛ
  к складам и офисам

### Итог этапа

- **4 роли** с чётко разделёнными правами.
- **2 точки ответственности МОЛ**: склады/офисы (many-to-many)
  и экземпляры техники (`responsible_user_id`).
- **Фильтрация на уровне SQL**: если МОЛ запросит чужой экземпляр —
  роут вернёт 404 (не палим существование).
- **Разнос `/admin` и `/admin/users`** — управление пользователями
  вынесено из «Учёта ТМЦ» в отдельную страницу.
- **Фильтрация sidebar по 4 ролям** через 8 маркеров
  в `buildSidebar`.
- **Seed** создаёт: 2 админа, 1 supervisor, 3 МОЛа, 13 обычных
  пользователей, ~40 экземпляров с ответственным МОЛ.

### Технический долг (перенесён в следующий чат)

- Sidebar supervisor: пункт `/admin` не показан, хотя доступен
- Supervisor: в `/admin` колонка «Действия» показывает все кнопки
  (должна быть только 👁️); кнопка 🔄 «Переместить» открывает
  и сразу закрывает модалку
- Дашборд supervisor: видна ссылка «Все логи» — убрать;
  общая модернизация дашборда под 4 роли
- `/admin` в шапке у МОЛа — лишние ссылки на «Справочник»,
  «Склады», «Инвентаризацию», «Логи» (рудименты)
- Роут `/admin` стал общим для admin / supervisor / mol —
  терминология и структура требуют пересмотра
  (возможные имена: `/manage`, `/equipment/manage`, `routes/manage.js`)
- `renderPage` без `user` — fallback на admin в `renderAddUser`,
  `renderEditUser`, `renderLogs`
- `getWarehouseStats` / `getInventorySummary` / `getInventoryTotals` /
  `getSpecialStatusSummary` — глобальные, без scope; для МОЛа
  показывают цифры всей системы
- Селект размера страницы на `/equipment`
- Серверный фильтр на `/admin` (сейчас клиентский)
- `getAllTypes` на `/equipment` без фильтра по категории
- Множественные перемещения (`/admin/moves` — заглушка)
- Импорт CSV / Excel, экспорт XLSX, печать карточек техники

### Теги этапа

- v3.1.1 — модель данных МОЛ
- v3.1.2 — middleware + permissions + SQL-scope
- v3.1.3 — API-роуты под 4 роли + управление МОЛ
- v3.1.4 — роле-зависимый sidebar + разнос /admin и /admin/users
- v3.1.5 — ответственный МОЛ в формах и карточках
- v3.1.6 — управление МОЛ админом
- v3.1.7 — seed с МОЛами и supervisor
- **v4.0.0 — этап 4 завершён (этот)**

## [3.1.6] - 2026-10-15

**👔 Этап 4.0.6 завершён: управление МОЛ админом**

Админ может назначать МОЛов на склады и офисы двумя способами:
через форму редактирования пользователя (чекбоксы) и через
страницы деталей склада / офиса (список + селект добавления).

### Added

- **Блок «Ответственность МОЛ»** в `/admin/user/edit/:id`:
  чекбоксы всех активных складов и офисов; появляется только
  при выборе роли `mol`
- **Блок «Ответственные МОЛ»** на `/admin/warehouses/:id`
  и `/admin/workplaces/:id` — список текущих МОЛов с кнопкой
  «✕ Убрать» и селектом «➕ Добавить»
- **`renderEditUser`** пробрасывает `warehouse_checkboxes`
  и `office_checkboxes` с текущими галочками
- **`updateUserAPI`** обрабатывает `warehouse_ids[]` /
  `office_ids[]` при роли `mol`; снимает все привязки
  при смене роли с `mol` на другую
- **`renderWarehouseDetails` / `renderWorkplaceDetails`**
  пробрасывают `current_role` в шаблон
- **CSS**: `.mol-checkbox-list` / `.mol-checkbox-item` (чекбоксы
  в форме), `.mol-responsibles-list` / `.mol-responsible-item` /
  `.mol-add-row` / `.mol-add-select` / `.mol-empty`

### Changed

- **Селект роли** в `/admin/user/add` и `/admin/user/edit/:id`
  расширен до 4 вариантов с пояснениями
- **После создания МОЛа** кнопка в модалке пароля ведёт
  не в `/admin`, а в `/admin/user/edit/:id` — для привязки
  складов и офисов
- **После сохранения пользователя** редирект идёт
  в `/admin/users`, а не `/admin`
- **`updateUserAPI`** и **`addUserAPI`** — список допустимых
  ролей расширен с `['admin', 'user']` до
  `['admin', 'supervisor', 'mol', 'user']` (фикс: `mol`
  и `supervisor` сваливались в `user`)

### Теги

- v3.1.1 — модель данных МОЛ
- v3.1.2 — middleware + permissions + SQL-scope
- v3.1.3 — API-роуты под 4 роли + управление МОЛ
- v3.1.4 — роле-зависимый sidebar + разнос /admin и /admin/users
- v3.1.5 — ответственный МОЛ в формах и карточках
- **v3.1.6 — управление МОЛ админом (этот)**

## [3.1.5] - 2026-10-14

**👔 Этап 4.0.5 завершён: ответственный МОЛ в формах и карточках**

Финальный подшаг «UI-карточки и формы»: селект ответственного МОЛ
в формах техники, отображение ответственного в правой колонке,
скрытие кнопок «Удалить»/«Редактировать» для ролей МОЛ и supervisor
на странице «Номенклатура», скрытие кнопки «Добавить модель» для
supervisor. Плюс — фильтрация по scope в API складов, чтобы МОЛ
видел только свои склады.

### Подшаги 4.0.1 – 4.0.5

- **4.0.1** — модель данных для ролевой модели МОЛ:
  таблицы `warehouse_responsibles` / `office_responsibles`,
  поле `equipment.responsible_user_id`, индексы,
  скрипт `scripts/check-roles.js`
- **4.0.2** — middleware `requireSupervisor` / `requireMol` /
  `requireRole`, модуль `utils/permissions.js`, сквозной
  SQL-scope в функциях чтения
- **4.0.3** — API-роуты под 4 роли, `routes/admin-responsibles.js`
  (привязка МОЛ к складам / офисам / экземплярам),
  `addEquipment` / `updateEquipment` принимают `responsible_user_id`
- **4.0.4** — роле-зависимый sidebar под 4 роли, разнос `/admin`
  и `/admin/users`, `views/admin-users.html` и
  `public/js/admin-users.js`, перевод роутов на `renderPageFor`
- **4.0.5** — селект «Ответственный МОЛ» в формах
  `/admin/add` и `/admin/edit/:id`, строка «Ответственный»
  в правой колонке карточки, скрытие кнопок для МОЛ и supervisor
  на `/admin/models`, фильтрация списка складов по scope
  для роли mol

### Added

- **`views/admin-users.html`** — страница «Управление доступом»
  (CRUD пользователей, только admin)
- **`public/js/admin-users.js`** — вся user-логика, вынесенная
  из `admin.js`
- **`routes/admin-responsibles.js`** — API управления МОЛ:
  `POST/DELETE /api/admin/warehouses/:id/responsibles`,
  `POST/DELETE /api/admin/offices/:id/responsibles`,
  `GET/POST /api/admin/equipment/:id/responsible`
- **`utils/permissions.js`** — `canAccessWarehouse` /
  `canEditWarehouse` / `canAccessOffice` / `canEditOffice` /
  `canAccessEquipment` / `canEditEquipment` +
  низкоуровневые `isWarehouseResponsible` /
  `isOfficeResponsible` / `isEquipmentResponsible`
- **`scripts/check-roles.js`** — проверка структуры БД
  для ролевой модели, сводка по ролям и связкам МОЛ
- **Middleware** `requireSupervisor`, `requireMol`,
  `requireRole([...])` в `middleware/auth.js`
- **SQL-scope** в `getAllEquipment` / `getEquipmentById` /
  `getEquipmentWithLocation` (equipment),
  `getAllWarehouses` / `getWarehouseById` / `getWarehouseTree` /
  `getWarehouseInventory` / `getCellOccupancy` (warehouses),
  `getAllOffices` / `getOfficeById` / `getOfficeTree` /
  `getWorkplaceSummary` / `getOfficeEquipment` /
  `getWorkplaceOccupancy` (workplaces)
- **`buildSidebar`** — 8 маркеров под 4 роли:
  `admin` / `supervisor` / `mol` / `user` /
  `admin_or_supervisor` / `admin_or_mol` /
  `admin_or_supervisor_or_mol` / `all_roles`
- **Селект «Ответственный МОЛ»** в `/admin/add` и
  `/admin/edit/:id` (для admin — список МОЛов, для mol — hidden)
- **Строка «Ответственный»** в правой колонке карточки
  редактирования

### Changed

- **`users.role`** расширен до 4 значений:
  `'admin' | 'supervisor' | 'mol' | 'user'` (валидация в коде)
- **`server.js`** — права расставлены через
  `requireRole` / `requireSupervisor` / `requireMol` /
  `requireAdmin`:
  * read-only роуты (дашборд, `/equipment`, `/admin`,
    склады/офисы на просмотр, инвентаризация, каталог,
    модели) — `admin + supervisor + mol`
  * формы и API записи (склады, офисы, зоны, стеллажи,
    ячейки, кабинеты, рабочие места, техника, категории,
    типы, модели) — `admin + mol`
  * управление пользователями, логи, удаление моделей /
    категорий / типов, set-default, управление МОЛ — только admin
- **`renderPage`** на ключевых страницах заменён на
  **`renderPageFor(req, res, ...)`** — sidebar рендерится
  по роли пользователя из сессии, а не fallback-ом на админа
  (затронуты `dashboard.js`, `equipment.js`, `users.js`,
  `catalog.js`, `equipment-models.js`, `warehouses.js`,
  `workplaces.js`)
- **`routes/users.js`** — `isAdmin` читается из
  `req.session.role` (было `req.session.user.role` — всегда false)
- **`routes/equipment-models.js → renderModels`** —
  прокидывает `{{current_role}}` в шаблон
- **`database/modules/equipment.js`** —
  `addEquipment` / `updateEquipment` принимают
  `responsible_user_id`; `getEquipmentById` отдаёт
  `responsible_user_name` через LEFT JOIN users ru
- **`public/js/admin-models.js`** — `getCurrentRole()` из
  скрытого поля `#currentRole`; кнопка «Удалить» не рендерится
  для mol; кнопка «Редактировать» не рендерится для supervisor;
  кнопка «Добавить модель» скрывается для supervisor
- **`public/js/admin-add.js` / `admin-edit.js`** —
  `submitForm` отправляет `responsible_user_id` с учётом роли
- **`views/partials/sidebar.html`** — новая разметка под 4 роли
  без вложенных маркеров; шапка файла без маркеров внутри
  HTML-комментария

### Fixed

- **`views/partials/sidebar.html`** — маркеры `{{#if ...}}` внутри
  HTML-комментария разбирались `buildSidebar` как реальные
  условные блоки и вырезали куски разметки (`<aside>` пропадал
  целиком). Убраны из комментария.
- **`routes/users.js`** — остаточная строка `res.send(fullHtml)`
  после перевода на `renderPageFor` давала `ReferenceError:
  fullHtml is not defined` и `ERR_HTTP_HEADERS_SENT`
- **`routes/admin.js`** — добавлен импорт `renderPageFor`
  (без него `ReferenceError` в `renderEditEquipment`)
- **`/api/admin/warehouses` / `/api/admin/warehouses/:id` /
  `/api/admin/warehouses/tree` / `/api/admin/warehouses/:id/tree` /
  `/api/admin/warehouses/:id/zones`** — прокидывают scope,
  чтобы МОЛ не видел чужие склады

### Технический долг (перенесён)

- `renderPage` без `user` — fallback на admin (техдолг с v2.13.0);
  закрыт для ключевых страниц, но `renderAddUser`, `renderEditUser`,
  `renderLogs` в `routes/admin.js` пока на старом `renderPage`
- Селект размера страницы на `/equipment` (`PAGE_SIZE=10` хардкод)
- Серверный фильтр на `/admin` (сейчас клиентский)
- `getAllTypes` на `/equipment` без фильтра по категории грузит
  все типы
- Множественные перемещения (`/admin/moves` — заглушка)
- `getWarehouseStats` / `getInventorySummary` / `getInventoryTotals`
  — глобальные, без scope (для МОЛа показывают цифры всей системы)

### Теги

- v3.1.1 — модель данных МОЛ (таблицы + поле + индексы)
- v3.1.2 — middleware + permissions + SQL-scope
- v3.1.3 — API-роуты под 4 роли + управление МОЛ
- v3.1.4 — роле-зависимый sidebar + разнос /admin и /admin/users
- **v3.1.5 — ответственный МОЛ в формах и карточках (этот)**


## [3.1.0] - 2026-10-13

**🎉 Этап 3.3 завершён: разделение «модель ТМЦ» / «экземпляр ТМЦ»**

Мажорный минорный релиз, закрывающий крупную переработку модели
данных. Введена таблица `equipment_models` — обобщённое описание
устройства (название, производитель, категория, тип). Таблица
`equipment` стала «экземпляром», ссылается на модель через
`model_id` и хранит только атрибуты конкретной единицы
(`inventory_number`, `serial_number`, `status`, место хранения,
даты, описание).

Подшаги 3.0.1 – 3.3.5 (теги v3.0.1 – v3.0.8).

### Итог этапа

- **Все модули БД** читают данные техники через `JOIN equipment_models`:
  `equipment.js`, `stats.js`, `dashboard.js`, `warehouses.js`,
  `workplaces.js`, `profile.js`, `users.js`, `catalog.js`.
- **Все роуты** работают с новой схемой: `admin.js`, `equipment.js`,
  `dashboard.js`, `profile.js`, `users.js`, `catalog.js`.
- **Формы** `/admin/add` и `/admin/edit/:id` — селект модели ТМЦ
  + кнопка «Создать модель» + живой предпросмотр.
- **UI**: таблицы `/admin`, `/equipment`, `/admin/catalog`, `/profile`,
  `/users` — колонки «Модель | Corporate ID».
- **Карточки**: техники (admin, catalog, equipment), пользователя
  (admin), профиля — все поля из модели.
- **Страница `/admin/models`** — полноценный CRUD моделей
  с карточкой экземпляров.
- **Программная уникальность** `inventory_number` / `serial_number`
  (`checkUniqueSerialAndInventory`) — с понятными ошибками.
- **Seed** создаёт модели + экземпляры; `description` — на модели.
- **Migrate** идемпотентна.

### Ключевые соглашения

- `model_id NOT NULL` на `equipment` → `JOIN equipment_models m`
  везде INNER.
- `category_id` и `type_id` живут **на модели**, а не на экземпляре.
- `inventory_number` и `serial_number` — `UNIQUE`, но `NULL` разрешён
  (экземпляр может быть без номера).
- `description` экземпляра — состояние/заметки конкретной единицы.
  Обобщённое описание — у модели.
- `corporate_id` модели — ручной ввод, может содержать `*`, UNIQUE.
- Проверка дубликата модели по `(name, manufacturer)` —
  не блокирующая (предупреждение).

### Технический долг (перенесён)

- `renderPage` без `user` — fallback на admin (техдолг с v2.13.0).
- Селект размера страницы на `/equipment` (`PAGE_SIZE=10` хардкод).
- Серверный фильтр на `/admin` (сейчас клиентский).
- `getAllTypes` на `/equipment` без фильтра по категории грузит все типы.
- Множественные перемещения (`/admin/moves` — заглушка).

### Теги

- v3.0.1 — модель данных: `equipment_models` + пересоздание `equipment`
- v3.0.2 — API номенклатуры
- v3.0.3 — UI «Номенклатура» + карточка модели
- v3.0.4 — переход техники на `model_id` (модуль + роуты + формы)
- v3.0.5 — таблицы `/admin` и `/equipment` под `model_name`
- v3.0.6 — дашборд + агрегаты через JOIN
- v3.0.8 — seed моделей + идемпотентность migrate + профиль
- **v3.1.0 — этап 3.3 завершён (этот)**

## [3.0.8] - 2026-10-13

**🌱 Seed моделей ТМЦ + идемпотентность migrate + профиль**

Подшаг 3.3.5. Seed приведён к новой модели данных: создаются
модели ТМЦ и экземпляры, `description` переехало на модель.
Миграция стала идемпотентной — повторный запуск не падает
на уже пересозданной `equipment`. Карточка профиля дочищена —
активная техника и история работают через `model_name`.

### Изменено (`scripts/seed.js`)

- **`createEquipmentModels()`** (новая) — создаёт модели из
  уникальных комбинаций `(тип + название + производитель)` в
  `EQUIPMENT_DATA`. `corporate_id` = `MOD-0001`…`MOD-NNNN`.
- **`buildModelsFromEquipmentData()`** (новая) — собирает
  уникальные модели, ищет `type_id` / `category_id` в справочнике
  по `name` (это тип ТМЦ, а не название).
- **`createEquipment()`** — переписана: создаёт экземпляры с
  `model_id`, без `name` / `model` / `manufacturer` /
  `category_id` / `type_id`.
- **`description`** — на модели (`DESCRIPTIONS[type_name]`),
  у экземпляров `NULL`.
- **`checkStructure()`** — добавлена проверка `equipment_models`.
- **`clearDemoData()`** — очистка `equipment_models` + сброс
  счётчика.
- Итоговый вывод: строки «Модели ТМЦ» и «Экземпляры».

### Изменено (`scripts/migrate.js`)

- **`mapExistingEquipment()`** — ранний выход, если `equipment`
  уже в новой схеме (нет полей `name` / `type_id`). Раньше
  падала с `no such column: name` при повторном запуске
  на пересозданной таблице.
- **`migrateEquipmentPlacedStatus()`** — пропуск, если `equipment`
  уже пересоздана (есть `model_id`).

### Изменено (`routes/profile.js`)

- Активная техника и история использования — поля из модели:
  `model_name`, `model_corporate_id`, `model_manufacturer`;
  fallback `—` для пустых полей.

### Изменено (`views/profile.html`)

- Заголовки колонок таблиц «Моя техника» и «История получений» —
  под новую модель: «Модель | Corporate ID | Производитель»
  и «Модель | Corporate ID».

### Проверено

- `npm run reset` с нуля: миграция + seed зелёные.
- Итог: ~20 моделей, 40 экземпляров, ~24 активных назначения,
  ~15 возвращённых, 150 логов.
- Повторный `npm run migrate` на пересозданной БД — без ошибок.
- `/profile` — активная техника и история заполнены.
- `/users` — список техники через `model_name`.
- `node scripts/check-css.js` — зелёный.

### Теги

- v3.0.4 — переход на `model_id`
- v3.0.5 — таблицы `/admin` и `/equipment`
- v3.0.6 — дашборд + агрегаты через JOIN
- **v3.0.8 — seed + идемпотентность migrate + профиль (этот)**

## [3.0.6] - 2026-10-13

**🔧 Дашборд и агрегаты: JOIN с `equipment_models` во всех модулях**

Подшаг 3.3.4. Завершён перевод всех модулей и роутов, работающих
с техникой, на новую модель данных. Дашборд, инвентаризация
складов, рабочие места, профиль и карточка пользователя больше
не обращаются к несуществующим полям `equipment.name`,
`equipment.model`, `equipment.manufacturer`, `equipment.category_id`,
`equipment.type_id`.

### Изменено (модули БД)

- **`database/modules/dashboard.js`**:
  * `getEquipmentNeedingAttention` — все 4 запроса
    (ремонт / истекающая гарантия / просроченная гарантия /
    без владельца > 6 мес.) переведены на `JOIN equipment_models m`;
    поля `name` / `model` заменены на `model_name` / `model_corporate_id`;
  * `getCategoryStats` — счётчик техники по категории теперь через
    `JOIN equipment_models` (`m.category_id` вместо `e.category_id`).
- **`database/modules/warehouses.js`**:
  * `getEquipmentInCell` — `JOIN equipment_models`, алиасы
    `model_name`, `model_corporate_id`, `model_manufacturer`;
  * `getWarehouseInventory` — то же, для страницы инвентаризации.
- **`database/modules/workplaces.js`**:
  * `getWorkplaceEquipment` — JOIN с моделью;
  * `getOfficeEquipment` — JOIN с моделью;
  * `moveEquipmentToWorkplace` — `SELECT` берёт `m.name AS model_name`,
    возвращает `model_name` вместо `equipment_name`.
- **`database/modules/profile.js`**:
  * `getUserActiveEquipment` — JOIN с моделью, алиасы `model_name` /
    `model_corporate_id` / `model_manufacturer`;
  * `getUserEquipmentHistory` — то же.
- **`database/modules/users.js`**:
  * `getUsersWithEquipment` — `GROUP_CONCAT` по `m.name` вместо `e.name`.

### Удалено (модули БД)

- **`database/modules/dashboard.js` → `getEquipmentWithoutCategory()`** —
  в новой модели `category_id NOT NULL` на `equipment_models`,
  сценарий «техника без категории» невозможен.

### Изменено (роуты)

- **`routes/dashboard.js`**:
  * в блоке «Требует внимания» — `${eq.name}` → `${escapeHtml(eq.model_name || '—')}`
    во всех 4 подблоках (ремонт, истекающая гарантия, просроченная
    гарантия, без владельца);
  * добавлен локальный `escapeHtml`.

### Изменено (клиентский JS)

- **`public/js/admin.js`**:
  * `viewEquipment` — шапка карточки (`<h2>` = `model_name`,
    `model_corporate_id · inventory_number`), блок «Информация
    о технике» — `model_name` / `model_corporate_id` /
    `model_manufacturer`;
  * `openMoveEquipmentModal` — заголовок модалки перемещения
    через `model_name`;
  * `viewUser` — карточка пользователя: активная техника и
    история получений через `model_name` / `model_corporate_id` /
    `model_manufacturer`.
- **`public/js/catalog.js`**:
  * `renderEquipmentTable` — колонки «Название» и «Модель»
    через `model_name` и `model_corporate_id`;
  * `viewEquipment` — карточка техники в справочнике
    (шапка + «Информация о технике»).

### Проверено

- Дашборд `/` — все блоки, включая «Требует внимания» и
  «Техника по категориям».
- Инвентаризация `/admin/inventory` — сводка складов, модалка
  деталей, вкладки «Техника» и «Заполненность».
- Рабочие места `/admin/workplaces` и `/admin/workplaces/:id` —
  карточки офисов, дерево, модалка просмотра места.
- Профиль `/profile` — своя техника и история.
- Карточка пользователя в `/admin` — активная техника и история.
- Карточка техники в `/admin` и `/admin/catalog`.
- Поиск по модулям и роутам (`Select-String` по `e.name` /
  `e.model` / `e.manufacturer` / `e.category_id` / `e.type_id`) —
  совпадений по технике **нет** (остались только `zone.name`,
  `warehouse.name`, `office.name` и т.п. — это места хранения,
  не экземпляры).

### Технический долг

- **`scripts/seed.js`** — ещё создаёт технику со старыми полями
  (`name` / `model` / `manufacturer` / `category_id` / `type_id`),
  падает. Чинится в 3.3.5 — создание моделей + экземпляров.
- **`README.md`** — раздел «Номенклатура» требует актуализации.

### Теги

- v3.0.1 — модель данных
- v3.0.2 — API номенклатуры
- v3.0.3 — UI «Номенклатура»
- v3.0.4 — переход техники на `model_id` (модуль + роуты + формы)
- v3.0.5 — таблицы `/admin` и `/equipment` под `model_name`
- **v3.0.6 — дашборд + агрегаты через JOIN (этот)**

## [3.0.4] - 2026-10-13

**🧩 Переход техники на `model_id` — модуль БД, роуты, формы**

Подшаги 3.3.1 – 3.3.2. Единый переход экземпляров ТМЦ на новую модель
данных «модель ТМЦ / экземпляр ТМЦ». Роуты и формы больше не работают
со старыми полями `equipment` (`name`, `model`, `manufacturer`,
`category_id`, `type_id`) — эти данные живут в `equipment_models`
и читаются через JOIN.

### Изменено (модуль БД, 3.3.1)

- **`database/modules/equipment.js`** — полностью переписан:
  * все `SELECT` — `JOIN equipment_models m ON m.id = e.model_id`
    (INNER, так как `model_id NOT NULL`);
  * честные имена полей: `model_name`, `model_corporate_id`,
    `model_manufacturer`, `category_id` / `type_id` (из модели);
  * `addEquipment` / `updateEquipment` — принимают `model_id`,
    без `name` / `model` / `manufacturer` / `category_id` / `type_id`;
  * `updateEquipment` — при `assigned → available` закрывает активное
    назначение и обнуляет `cell_id` и `workplace_id`;
  * `assignEquipment` / `returnEquipmentByEquipmentId` — обнуляют
    оба поля места (`cell_id` и `workplace_id`);
  * `getEquipmentCountsByCategory` / `getEquipmentCountsByType` —
    считают через JOIN с моделью;
  * `moveEquipmentToCellDetailed` — отдаёт `model_name`
    (было `eq.name` из `equipment`);
  * `getEquipmentWithLocation` — фильтр `search` ищет по `m.name`,
    `m.corporate_id`, `m.manufacturer`, `u.full_name`, `cell.code`,
    `wp.name`, `wp.code`;
  * `getAvailableEquipment` — с данными модели;
  * `getEquipmentWithUsers` — по-прежнему возвращает массив
    (совместимо с `routes/catalog.js`).

### Добавлено (модуль БД, 3.3.1)

- **`checkUniqueSerialAndInventory(inventoryNumber, serialNumber, excludeId)`** —
  программная проверка уникальности `inventory_number` / `serial_number`
  с понятными ошибками. `NULL` разрешён и не считается коллизией.
  Экспортируется наружу для предвалидации в роутах.

### Изменено (роуты, 3.3.2)

- **`routes/admin.js`**:
  * `renderAdmin` — таблица техники: колонки «Модель» (`model_name`)
    и «Corporate ID» (`model_corporate_id`) вместо старых
    `name` / `model`;
  * `addEquipmentAPI` / `updateEquipmentAPI` — принимают `model_id`,
    без `name` / `model` / `manufacturer` / `category_id` / `type_id`;
    ловят ошибки уникальности и «Модель не найдена» отдельно;
  * `renderAddEquipment` / `renderEditEquipment` — стали `async`,
    подгружают `{{model_options}}`, `{{selected_model_id}}`,
    `info_*` из модели;
  * `moveEquipmentAPI` — логирует `model_name` вместо `equipment_name`;
  * `actionNames` — добавлены `model_create` / `model_update` /
    `model_delete` (для страницы логов).

### Изменено (формы, 3.3.2)

- **`views/admin-add.html`**, **`views/admin-edit.html`**:
  * вместо полей `name` / `model` / `manufacturer` / `category_id` /
    `type_id` — один селект «Модель ТМЦ» (`#model_id`) + кнопка
    «➕ Создать модель» (открывает `/admin/models` в новой вкладке);
  * правая колонка (edit): инфо о выбранной модели — название,
    `corporate_id`, производитель, категория, тип — обновляется
    на лету при смене селекта.
- **`public/js/admin-add.js`**, **`public/js/admin-edit.js`**:
  * убраны `loadCategories` / `loadTypesForCategory` /
    `onCategoryChange`;
  * добавлен `bindModelPreview()` — живой предпросмотр модели
    в правой колонке (`info_model_name`, `info_corporate_id`,
    `info_manufacturer`, `info_category`, `info_type`);
  * в `submitForm` отправляется `model_id` вместо старых полей.

### Добавлено (стили)

- **`public/css/components.css`** — `.model-select-row` (flex-контейнер
  для селекта модели и кнопки «Создать модель»).

### Изменено (инфраструктура)

- **`scripts/check-css.js`** — обновлены ожидаемые плейсхолдеры для
  `admin-add.html` и `admin-edit.html`:
  * добавлены `id="model_id"`, `{{model_options}}`,
    `{{selected_model_id}}`, `{{info_model_name}}`,
    `{{info_corporate_id}}`, `{{info_manufacturer}}`,
    `id="currentModelId"`;
  * убраны `id="category_id"`, `id="type_id"`, `id="name"`,
    `id="currentCategoryId"`, `id="currentTypeId"`.

### Технический долг (передаётся в 3.3.3)

- `/admin` (таблица) и `/equipment` (таблица + фильтры) — заголовки
  колонок и рендер строк ещё не подкручены под `model_name` /
  `model_corporate_id`. Чинятся в 3.3.3.
- Дашборд (`/`), `stats.js`, `warehouses.js`, `workplaces.js` —
  всё ещё используют старые поля в SQL. Чинятся в 3.3.4.

### Теги

- v3.0.1 — модель данных: `equipment_models` + пересоздание `equipment`
- v3.0.2 — API номенклатуры
- v3.0.3 — UI «Номенклатура» + карточка модели
- **v3.0.4 — переход техники на `model_id` (этот)**

## [3.0.3] - 2026-10-13

**🧩 Номенклатура: UI страницы моделей ТМЦ + карточка с экземплярами**

Завершён подшаг 3.2: страница `/admin/models` — полноценный CRUD
моделей с таблицей, фильтрами, поиском, пагинацией и карточкой,
показывающей экземпляры модели с расположением.

Подшаги 3.2.1 – 3.2.2.

### Added

- **`views/admin-models.html`** — страница «Номенклатура»:
  * page-header «🧩 Номенклатура» / «Модели ТМЦ — обобщённые описания устройств»;
  * stats-grid: «Всего моделей / С категорией и типом / С экземплярами»;
  * тулбар: поиск (Corporate ID / название / производитель),
    фильтр категории, фильтр типа, сброс, «➕ Добавить модель»;
  * таблица моделей: `corporate_id | название | производитель |
    категория | тип | экземпляров | действия`;
  * пагинация `PAGE_SIZE = 20`;
  * модалки: `#modelModal` (форма), `#deleteModal`, `#viewModelModal`
    (карточка модели, `.modal-body`).
- **`public/js/admin-models.js`** — логика страницы:
  * загрузка categories + types один раз;
  * каскад category → type в форме;
  * CRUD через fetch, дебаунс поиска 300 мс, Enter / Escape;
  * проверка дубликата по `(name, manufacturer)` (дебаунс 500 мс) —
    не блокирующая, только предупреждение;
  * карточка модели: поля + таблица экземпляров с адресом и статусом;
  * формат места: `🪑 офис / кабинет / место` ИЛИ
    `📦 склад / ячейка (code)`.
- **`public/css/admin-models.css`** — стили страницы: тулбар,
  таблица, пагинация, бейджи категории/типа, `.model-instances-*`,
  `.model-header-card`, адаптивность.
- **`routes/equipment-models.js`** (3.2.1) — рендер + 6 API:
  `getModelsAPI`, `getModelAPI` (+ `instances`), `createModelAPI`,
  `updateModelAPI`, `deleteModelAPI`, `checkDuplicateAPI`.
  Логирование `model_create/update/delete` (`entityType: 'model'`).
- **`database/modules/equipment-models.js`** — `getModelInstances(modelId)`:
  экземпляры с JOIN на `cells/racks/zones/warehouses` и
  `workplaces/rooms/offices`.
- **Пункт «🧩 Номенклатура»** в sidebar (`data-page="models"`)
  в секции «Управление» после «Классификации».
- **Общие стили `components.css`**: `.filter-group`, `.filter-actions`,
  `.search-wrapper` (с `.search-icon`) — вынесены из `equipment.css`,
  используются на `/equipment` и `/admin/models`.

### Changed

- **`public/js/layout.js`** — подсветка активного пункта для `/admin/models`.
- **`database/modules/catalog.js`** — счётчики `equipment_count` /
  `models_count` считаются через `equipment_models` (JOIN на `equipment`).
  Удаление категории/типа проверяет модели (`equipment_models`),
  а не технику.
- **`public/css/equipment.css`** — удалены дубли `.filter-group`,
  `.filter-actions`, `.search-wrapper` (переехали в `components.css`).
- **`scripts/check-css.js`** — добавлены `admin-models.html`,
  `admin-models.css`.

### Fixed

- **`.search-wrapper input[type="text"]`** — стили поиска работают
  не только с `type="search"`, но и с `type="text"` (нужно для
  `/admin/models`, где `#filterSearch` — текстовый).
- **Отступы в карточке модели** — `#viewModelBody` получил
  класс `modal-body` (padding `--space-xl`).

### Технический долг (передаётся в 3.3)

- Модуль `equipment.js` и роуты `/admin/add`, `/admin/edit/:id`,
  `/equipment`, `/api/admin/equipment/*`, дашборд — пока работают
  со старыми полями и **падают** (`no such column: name`).
  Чинятся в подшагах 3.3.1 – 3.3.5.

### Теги

- v3.0.1 — модель данных: `equipment_models` + пересоздание `equipment`
- v3.0.2 — API номенклатуры (`routes/equipment-models.js`)
- **v3.0.3 — UI «Номенклатура» + карточка модели (этот)**


## [3.0.2] - 2026-10-13

**🔌 API номенклатуры — модели ТМЦ**

Подшаг 3.2.1: бэкенд-роуты для управления моделями.

### Added

- **`routes/equipment-models.js`** — рендер страницы `/admin/models`
  и API:
  * `GET /api/admin/models` — список с фильтрами (`category_id`,
    `type_id`, `search`) и пагинацией `PAGE_SIZE = 20`;
  * `GET /api/admin/models/:id` — модель + `instances` (экземпляры
    с адресом);
  * `POST /api/admin/models` — создание с проверкой уникальности
    `corporate_id`;
  * `PUT /api/admin/models/:id` — обновление (уникальность
    `corporate_id` с исключением текущей);
  * `DELETE /api/admin/models/:id` — удаление (запрет при экземплярах);
  * `GET /api/admin/models/check-duplicate` — проверка дубликата
    по `(name, manufacturer)`, не блокирующая.
- **Логирование** через `logAction` с `entityType: 'model'`:
  `model_create`, `model_update`, `model_delete`.

### Changed

- **`server.js`** — блок «НОМЕНКЛАТУРА — модели ТМЦ» после
  «СПРАВОЧНИК», все роуты под `requireAdmin`. Порядок:
  `check-duplicate` перед `/:id`.

### Теги

- v3.0.1 — модель данных
- **v3.0.2 — API номенклатуры (этот)**
- v3.0.3 — UI «Номенклатура»


## [3.0.1] - 2026-10-13

**🧩 Модель данных: разделение «модель ТМЦ» / «экземпляр ТМЦ»**

Подшаг 3.1: новая таблица `equipment_models`, пересоздание `equipment`
под экземпляры. **BREAKING CHANGE** — старые данные не мигрируются,
`equipment` создаётся пустой.

### Added

- **`database/modules/equipment-models.js`** — модуль CRUD моделей:
  * `getAllModels(opts)` — фильтры + пагинация + `include_total`;
  * `getModelById(id)`, `getModelByCorporateId(corporate_id)`,
    `getModelsWithCounts()`;
  * `getModelInstances(modelId)` — экземпляры с полным адресом;
  * `isCorporateIdFree(corporateId, excludeId)`;
  * `findSimilarModel({ name, manufacturer, excludeId })`;
  * `createModel`, `updateModel`, `deleteModel`.
- **`scripts/check-models.js`** — проверка структуры БД (поля,
  FK, индексы, UNIQUE на `corporate_id`, сводка).

### Changed

- **Таблица `equipment_models`** (новая): `id, corporate_id (UNIQUE),
  name, manufacturer, category_id (FK RESTRICT), type_id (FK RESTRICT),
  description, created_at, updated_at`.
- **Таблица `equipment` пересоздана**:
  * оставлены: `id, inventory_number (UNIQUE, NULL), serial_number
    (UNIQUE, NULL), status, cell_id, workplace_id, purchase_date,
    warranty_until, description, created_at, updated_at`;
  * добавлено: `model_id NOT NULL` (FK → `equipment_models` RESTRICT);
  * удалены: `name, model, manufacturer, category_id, type_id`.
- **Таблица `user_equipment` пересоздана** с FK на новую `equipment`.
  Данные очищены (приложение в разработке).
- **`database/db.js`** — подключён `equipment-models`.
- **`scripts/migrate.js`**:
  * `createEquipmentModelsTable()`;
  * `migrateEquipmentToInstances()` — идемпотентно (по `model_id`);
  * `createEquipmentModelsIndexes()` — 5 индексов на моделях,
    6 на экземплярах.
- **`package.json`** — скрипт `check-models`.

### Технический долг (на момент 3.0.1)

- Модуль `equipment.js`, роуты техники, дашборд — **падают** с
  `no such column: name/category_id`. Чинятся в 3.3.
- `routes/catalog.js` и `public/js/catalog.js` — на момент 3.0.1
  ещё работают со старым `equipment`; исправлено в 3.0.3
  (`database/modules/catalog.js`).

### Теги

- **v3.0.1 — модель данных (этот)**
- v3.0.2 — API номенклатуры
- v3.0.3 — UI «Номенклатура»


## [2.13.0] - 2026-10-09

**🧭 Переработка sidebar + роле-зависимая навигация**

Крупная переработка бокового меню: новая смысловая структура
(Обзор / Инвентаризация / Управление / Система), переименования
пунктов, а также **роле-зависимый sidebar** — пользователь видит
только доступные ему разделы.

Подшаги 2.12.1 – 2.12.5.

### Added

- **`utils/layout.js` → `buildSidebar(html, isAdmin)`** — простейший
  шаблонизатор условных блоков `{{#if admin}}...{{/if}}` и
  `{{#if user}}...{{/if}}`.
- **`utils/layout.js` → `renderPageFor(req, res, options)`** —
  рекомендованный способ рендера страниц. Роль берётся из
  `req.session.role` — забыть пробросить пользователя невозможно.
- **Роле-зависимый sidebar** — структура определяется ролью:
  * **админ**: Обзор системы / ТМЦ / Инвентаризация / Учёт ТМЦ /
    Склады / Рабочие места / Классификация / Пользователи / Логи /
    PDF инструкции;
  * **пользователь**: Личный кабинет / PDF инструкции.

### Changed

- **`views/partials/sidebar.html`** — полная переработка структуры:
  * **ОБЗОР**: «Обзор системы» (`/`), «ТМЦ» (`/equipment`);
  * **ИНВЕНТАРИЗАЦИЯ**: отдельный раздел с «Инвентаризацией»
    (`/admin/inventory`) — как обзорная страница для супервизора
    (в перспективе);
  * **УПРАВЛЕНИЕ**: «Учёт ТМЦ» (`/admin`), «Склады»,
    «Рабочие места», «Классификация» (бывший «Справочник»);
  * **СИСТЕМА**: «Пользователи», «Логи», «PDF инструкции» —
    для админа; «PDF инструкции» — для пользователя;
  * **ЛИЧНЫЙ КАБИНЕТ**: «Личный кабинет» (`/profile`) — только
    для пользователя.
- **Переименования в sidebar**:
  * «Дашборд» → **«Обзор системы»**;
  * «Техника» → **«ТМЦ»**;
  * «Хранение» → **«Инвентаризация»**;
  * «Админ-панель» → **«Учёт ТМЦ»**;
  * «Справочник» → **«Классификация»**.
- **Логотип в sidebar**: для админа ведёт на `/`, для пользователя —
  на `/profile`.
- **`server.js`**: `/users` и `/equipment` требуют роль `admin`
  (`requireAdmin` вместо `requireAuth`).
- **`routes/profile.js`, `routes/pdf.js`**: рендер через
  `renderPageFor(req, res, options)` — sidebar фильтруется по роли.
- **`public/js/layout.js` → `highlightActiveSection`**:
  * убран путь `/admin/moves` (пункт удалён из sidebar);
  * добавлен `/profile` → `data-page="profile"`.
- **`middleware/auth.js`**: на странице 403 «Доступ запрещён»
  кнопка «← На главную» (`/`) заменена на «← В личный кабинет»
  (`/profile`) — чтобы пользователь не упирался в ту же 403.
- **`views/partials/header.html`**: из дропдауна пользователя
  удалён пункт «На главную» (вёл на админский `/`).
- **`views/pdf.html`**: удалена ссылка «На главную» (вела
  на админский `/`).

### Removed

- **Пункт `/admin/moves`** («Перемещения») — убран из sidebar,
  как заглушка. Вернём, когда реализуем множественные перемещения
  (см. Roadmap).

### Fixed

- **`renderPage` без параметра `user`**: fallback на роль `admin` —
  для обратной совместимости при постепенном переводе роутов.
  Помечен `@deprecated` — рекомендован `renderPageFor`.

### Технический долг

- **Перевести все роуты на `renderPageFor(req, res, options)`** —
  сейчас старые роуты используют `renderPage(options)` с fallback
  на админский sidebar. После полного перевода старый `renderPage`
  можно удалить.

### Теги

- v2.12.1 — `utils/layout.js`: `buildSidebar` + `renderPageFor`
- v2.12.2 — `sidebar.html`: новая структура и маркеры
- v2.12.3 — `server.js`: `/users`, `/equipment` → `requireAdmin`
- v2.12.4 — `routes/profile.js`, `routes/pdf.js`: `renderPageFor`
- v2.12.5 — `public/js/layout.js` + фиксы ссылок в header/pdf/auth
- **v2.13.0 — финал: переработка sidebar + роли**


## [2.12.0] - 2026-10-08

**🔧 Виртуальные склады: maintenance / retired**

Статусы `maintenance` (в ремонте) и `retired` (списано) теперь
оформлены как «виртуальные склады» — техника в этих статусах
может физически лежать в ячейках обычных складов, но не может
быть на рабочем месте. Добавлена сводка по ним в инвентаризации
и карточки на дашборде.

Подшаги 2.11.13 – 2.11.16 (каждый со своим тегом).

### Added

- **`database/modules/warehouses.js` → `getSpecialStatusSummary()`** —
  сводка по статусам `maintenance` и `retired`: общее количество,
  сколько с ячейкой / без, разбивка по складам.
- **API `GET /api/admin/inventory/special`** — отдаёт сводку
  по виртуальным складам (JSON).
- **Блок «🛠️ Виртуальные склады»** на `/admin/inventory`:
  две карточки — «🔧 В ремонте» и «📦 Списано» — с количеством,
  разбивкой «на складах / без ячейки» и ссылками по складам.
  Клик по числу или по складу → `/equipment?status=maintenance`
  (или `retired`) с опциональным `warehouse_id`.
- **Карточки на дашборде `/`** — «🔧 В ремонте» и «📦 Списано»,
  с переходом на отфильтрованный список `/equipment`.
- **Ссылки с `?status=...` на всех карточках техники дашборда** —
  «Всего», «Доступно», «Назначено», «В ремонте», «Списано»
  теперь ведут на отфильтрованный `/equipment`.

### Changed

- **`routes/admin.js` → `updateEquipmentAPI`**: при статусах
  `maintenance` и `retired` принудительно обнуляется
  `workplace_id` (техника не может быть на рабочем месте).
  `cell_id` сохраняется — техника может лежать на складе.
- **`public/js/admin-edit.js`**: `submitForm()` не отправляет
  `workplace_id` для статусов `maintenance` / `retired`;
  подсказки `onStatusChange()` уточнены.
- **`routes/dashboard.js`**: плейсхолдер
  `{{stats.maintenance_equipment}}` теперь реально подставляется
  (был баг — карточка «В ремонте» показывала плейсхолдер текстом);
  добавлен `{{stats.retired_equipment}}`.
- **`views/dashboard.html`**: карточки техники кликабельны
  и ведут на `/equipment?status=...`.

### Removed

- **Блок «🏷️ Техника без категории» с дашборда** — все категории
  обязательны, такого сценария больше нет.
- **`getEquipmentWithoutCategory()`** — больше не вызывается
  в `routes/dashboard.js` (функция осталась в модуле БД,
  но не используется).

### Fixed

- **Дашборд, карточка «В ремонте»**: не было `.replace` для
  `{{stats.maintenance_equipment}}` — карточка отображала
  плейсхолдер как текст.

### Теги

- v2.11.13 — валидация maintenance/retired ↔ workplace_id
- v2.11.14 — API getSpecialStatusSummary + /api/admin/inventory/special
- v2.11.15 — UI-блок «Виртуальные склады» в инвентаризации
- v2.11.16 — карточки на дашборде + удалён блок «без категории»
- **v2.12.0 — финал: виртуальные склады maintenance / retired**


## [2.11.12] - 2026-10-07

**Фиксы и улучшения после v2.11.3: компактные формы, серверный
фильтр, поиск, единый хелпер проверки ячеек**

Крупный релиз-обёртка, вобравший серию подшагов 2.11.4 – 2.11.12.
Отдельные теги выпускались по ходу работы; этот раздел — сводка
по всем изменениям. `package.json` и `README.md` в этом релизе
не трогались — синхронизация документации запланирована на
следующий чат.

Основные направления:
- убрано поле `capacity` у рабочих мест (наследие ранних версий);
- удалён мёртвый код перемещения техники;
- общий хелпер `checkCellAvailability` вместо трёх дублей проверки;
- полностью переработаны формы `/admin/edit/:id` и `/admin/add`
  (компактный двухколоночный layout + живой предпросмотр);
- логика статуса `placed` доведена до консистентной модели
  (статус ↔ место);
- фильтр и поиск на `/equipment` переведены на серверные
  (URL-query + пагинация);
- `check-css.js` расширен: ловит необработанные плейсхолдеры.

### Added

- **`database/modules/cells.js`** — новый модуль с чистой функцией
  `checkCellAvailability(db, cellId, excludeEquipmentId)`. Единая
  проверка «можно ли положить технику в ячейку»: учитывает
  ручной флаг `is_full` и числовой лимит `capacity`.
- **`checkCellAvailability`** экспортируется через `database/db.js`
  (метод-обёртка без `db`, `db` — в замыкании). Используется
  в `moveEquipmentToCellDetailed` и `updateEquipmentAPI`.
- **Пагинация `/equipment`** — `PAGE_SIZE=10`, `renderPagination()`
  в `routes/equipment.js`. Кнопки «← Назад» / «Вперёд →»,
  сохранение фильтров в URL.
- **Поиск на `/equipment`** — поле `#filterSearch` в панели
  фильтров: инв. №, название, модель, серийный номер, ФИО
  пользователя, код ячейки, название рабочего места. Дебаунс
  300 мс, Enter — мгновенно, автофокус при `?search=`.
- **Селект типов на `/equipment`** — подгружается по выбранной
  категории (серверная фильтрация). `{{type_options}}`
  в шаблоне, `selected` по текущему фильтру.
- **Селект статусов на `/equipment`** — `{{status_options}}`
  с сервера, включая синтетический `unplaced` («Не размещено»).
- **`{{pagination}}`** в `views/equipment.html` — блок под таблицей.
- **`{{search_value}}`** в `views/equipment.html` — сохранение
  значения поиска после редиректа.
- **`check-css.js`**: автопроверка всех `views/*.html` —
  каждый плейсхолдер `{{...}}` должен иметь `.replace` в
  `routes/*.js` или `utils/*.js`. Ловит класс багов
  «плейсхолдер в HTML есть, но роут его не заменяет»
  (актуально после фикса `{{user_options}}`).
- **Компактный двухколоночный layout** в формах
  `/admin/edit/:id` и `/admin/add`: `.edit-layout` (grid
  720px + 340px), sticky-панель `.edit-info-col` справа.
- **Живой предпросмотр** в правой колонке форм: `.info-card`
  обновляется по мере ввода (`bindLivePreview`,
  `bindInput`, `bindSelect`). Подсветка изменённых полей —
  `.info-list dd.changed`.
- **`.form-grid-2`** — двухколоночная сетка полей внутри формы.
- **`.location-preview` / `.location-type-switch` / `.info-card` /
  `.info-list`** — вынесены в `components.css` (были дубли
  в `admin-add.css` / `admin-edit.css`).
- **`autoSelectLocationType(status)`** в `admin-edit.js` —
  агрессивное переключение radio при выборе статуса:
  `placed` → workplace, `available` → warehouse.

### Changed

- **`database/modules/equipment.js` → `getEquipmentWithLocation`**:
  новые фильтры `workplace_id` и `unplaced`
  (`status='available' AND cell_id IS NULL AND workplace_id IS NULL`).
  Работает в паре с `include_total` и пагинацией.
- **`routes/equipment.js` → `renderEquipmentDashboard`** — читает
  `req.query` (`category_id`, `type_id`, `warehouse_id`,
  `workplace_id`, `status`, `search`, `page`). `PAGE_SIZE=10`.
  Селект типов фильтруется по выбранной категории. Все селекты
  рендерят `selected` по текущему фильтру.
- **`routes/admin.js` → `renderEditEquipment`**:
  - `{{user_options}}` **заполняется** (был пропущен вызов
    `getAllUsers()` — select назначения был пуст);
  - все статусы равноправны в `<select id="status">`
    (`placed` больше не `disabled`);
  - `{{info_*}}` плейсхолдеры правой колонки.
- **`routes/admin.js` → `updateEquipmentAPI`**: встроенная проверка
  `is_full`/`capacity` заменена на `checkCellAvailability`.
- **`database/modules/warehouses.js` → `moveEquipmentToCell`**:
  встроенная проверка заменена на `checkCellAvailability`.
- **`database/modules/equipment.js` → `moveEquipmentToCellDetailed`**:
  встроенная проверка заменена на `checkCellAvailability`.
- **Логика статусов в `admin-edit.js`**:
  - `assignSection` показывается при **любом** выбранном
    `assigned` (а не только при переходе);
  - `locationCard` скрывается при `assigned`;
  - `submitForm()` не отправляет `cell_id`/`workplace_id`
    при `assigned`; обнуляет место при переходе
    `placed → available`/`maintenance`/`retired`;
  - валидация «`placed` требует `workplace_id`»,
    «`available` несовместим с `workplace_id`».
- **`workplaces.capacity`** — **удалена**. Миграция
  `migrateWorkplacesDropCapacity` в `scripts/migrate.js`
  (DROP COLUMN на SQLite 3.35+, fallback — NULL). Seed
  `seedOffices` больше не пишет `capacity`. `getWorkplaceSummary` /
  `getWorkplaceOccupancy` считают заполненность по числу
  рабочих мест, а не по сумме capacity.
- **`check-css.js`** — расширен: список `expected` для
  `equipment.html` обновлён под новую структуру (убран
  `{{{types_json}}}`, `onchange="onCategoryFilterChange()"`,
  добавлены `{{type_options}}`, `{{status_options}}`,
  `{{pagination}}`, `{{search_value}}`).
- **`.search-wrapper`** — стилизован: иконка 🔍 слева,
  focus-within подсвечивает иконку, padding и фон
  согласованы с `.filter-group select` (вровень по высоте).
- **UI селектов `filterCategory` / `filterType` / `filterStatus`** —
  все `onchange="applyFilters()"` (клиентская фильтрация
  удалена).

### Fixed

- **`{{user_options}}` в `/admin/edit/:id`** — не заполнялся
  в `renderEditEquipment`, select назначения был пуст.
- **Валидация статусов и места** — при `available` + `workplace_id`
  сервер молча конвертировал в `placed`; теперь на клиенте
  выдаётся ошибка «Техника на рабочем месте не может быть
  Доступна». Аналогично — `placed` без `workplace_id`.
- **Поиск `#filterSearch`** — обработчики `input` / `keydown` /
  `search` были привязаны **вне** `DOMContentLoaded`
  (`searchInput is not defined`). Исправлено в
  `2.11.12-fix1`.
- **Автофокус поиска** — после редиректа фокус терялся;
  добавлен автофокус + курсор в конец значения, если в URL
  есть `?search=`.

### Removed

- **`moveEquipmentToCell`** из `database/modules/warehouses.js` —
  мёртвый код, никем не вызывался с момента перехода на
  `moveEquipmentToCellDetailed`. Убран вместе с неиспользуемым
  импортом `checkCellAvailability` из `./cells`.
- **Клиентская фильтрация** на `/equipment` (`applyFilters`,
  `showEmptyStateIfNeeded`, работа с `row.style.display`) —
  заменена на редирект с URL-query.
- **`data-types`** из `views/equipment.html` — типы теперь
  приходят через `{{type_options}}`.
- **`data-*` атрибуты** из строк таблицы `/equipment` —
  не нужны при серверной фильтрации.

### Технический долг (отложено)

- **`package.json`** — версия пока `2.11.3`; синхронизация
  запланирована вместе с `README.md` в следующем чате.
- **`README.md`** — не обновлялся в 2.11.4 – 2.11.12.
- **Селект размера страницы** на `/equipment` (сейчас
  `PAGE_SIZE=10` хардкод в `routes/equipment.js`).
- **Статус `maintenance`** — «виртуальный склад ремонта».
- **Статус `retired`** — «склад списания».
- **Фильтр на `/admin`** — сейчас клиентский; возможно,
  перевести на серверный по аналогии с `/equipment`.
- **`getAllTypes`** на `/equipment` — при отсутствии фильтра
  по категории подгружаются все типы (для больших объёмов
  не оптимально).

### Теги

- v2.11.4 — перенос `checkCellAvailability` — идея (в итоге
  реализовано в 2.11.9)
- v2.11.5 — обсуждение правки формы `/admin/edit/:id` (в итоге 2.11.8)
- v2.11.6 — `is_full` у ячеек (уже в 2.11.6-fix2, до этой секции)
- v2.11.7 — `capacity` убрана у рабочих мест
- v2.11.8 — компактные формы + live preview + логика статусов
- v2.11.9 — вынос `checkCellAvailability` в `cells.js`
- v2.11.10 — удалён мёртвый `moveEquipmentToCell`
- v2.11.11 — серверный фильтр на `/equipment`
- **v2.11.12 — поиск на `/equipment` (этот финал)**

## [2.11.3] - 2026-10-05

**Фиксы после Этапа 2: статус `placed`, локализация, ссылки на рабочие места**

Небольшой фикс-этап: закрыты недочёты, выявленные при работе
с рабочими местами. Отдельный релиз — т.к. `v2.10.0` уже выпущен.

### Added

- **Карточка «На местах»** в шапке `/equipment` (5-я): количество
  техники со статусом `placed`. В `getStats()` добавлено поле
  `placed_equipment`, в шаблоне — `.number.purple`.
- **Фильтр статуса** на `/equipment`: опция «🪑 На рабочем месте».
- **Ссылка на дерево офиса** из колонки «Место хранения» на
  `/equipment` и `/admin` — `/admin/workplaces/:office_id?highlightWorkplace=:id`.
- **Подсветка рабочего места** в дереве офиса при переходе по ссылке
  из колонки «Место хранения» (pulse-анимация, автоскролл,
  раскрытие родительского кабинета).
- **CSS**: `.stat-card .number.purple`, `.status-badge.status-placed`,
  `.tree-workplace.highlight` + `@keyframes workplacePulse`.

### Changed

- **Статус `placed`** для техники на рабочих местах. Раньше техника
  на рабочем месте имела статус `available`, что путало учёт
  «доступной» техники. Теперь:
  - `available` — на складе или без адреса;
  - `placed` — на рабочем месте;
  - `assigned` / `maintenance` / `retired` — без изменений.
- **`database/modules/equipment.js`**:
  - `getEquipmentWithLocation` отдаёт `workplace_name`,
    `workplace_code`, `room_name`, `office_name`, `office_id`
    (JOIN workplaces/rooms/offices); поиск расширен на `wp.name`
    и `wp.code`.
  - `moveEquipmentToCellDetailed` — CASE-логика статуса в обоих
    UPDATE (убрать из ячейки / переместить в ячейку); при
    перемещении в ячейку дополнительно обнуляется `workplace_id`.
- **`database/modules/stats.js`**: `getStats()` возвращает
  `placed_equipment`.
- **`database/modules/workplaces.js`**: `moveEquipmentToWorkplace` —
  CASE-логика статуса (`available`/`placed` → `placed`).
- **`database/modules/warehouses.js`**: `moveEquipmentToCell` —
  CASE-логика (`available`/`placed` → `available`).
- **`routes/equipment.js`**:
  - в колонке «Место хранения» для техники на рабочем месте —
    человеческая иерархия (офис / кабинет / место [код]) и ссылка
    на дерево офиса;
  - статус в бейдже локализован;
  - пробрасывается `{{placed_equipment}}` в шаблон.
- **`routes/admin.js`**:
  - `renderAdmin`: статус в таблице техники локализован; колонка
    «Место хранения» показывает рабочее место ссылкой;
  - `renderEditEquipment`: в `status_options` добавлена опция
    `placed` (`disabled`, `selected` при `equipment.status === 'placed'`);
  - `updateEquipmentAPI`: `finalStatus` согласуется с расположением —
    `placed` без `workplace_id` становится `available`,
    `available` с `workplace_id` становится `placed`.
- **`public/js/admin-edit.js`**: защита в `submitForm` — если
  `<select>` вернул пустое значение, но `currentStatus === 'placed'`,
  подставляем `placed`.
- **`public/js/workplace-details.js`**: в `renderWorkplace` добавлен
  `data-workplace-id`; `DOMContentLoaded` читает
  `?highlightWorkplace=:id`; новая функция `highlightWorkplace`.
- **`scripts/migrate.js`**: миграция `migrateEquipmentPlacedStatus`
  (идемпотентная) — `UPDATE equipment SET status = 'placed' WHERE
  workplace_id IS NOT NULL AND status = 'available'`. В итоговую
  статистику добавлено «Из них на местах».
- **`scripts/check-css.js`**: в проверку `equipment.html` добавлен
  `{{placed_equipment}}`.

### Fixed

- **`/equipment`**: плейсхолдер `{{placed_equipment}}` теперь
  подставляется. При первом прогоне 2.11.2 карточка была добавлена
  в шаблон, но `html.replace` в роуте забыли — на странице
  отображался сам плейсхолдер.

### Технический долг (отложено)

- **Форма `/admin/edit/:id`** — переработка UX:
  - убрать или переосмыслить `<select id="status">` в связке
    с `placed` (сейчас `disabled selected` на опции не мешает
    смене на другие статусы);
  - сократить вертикальную длину формы (табы / 2 колонки /
    аккордеон);
  - синхронизировать с `/admin/add`;
  - продумать логику заполнения и подсказок.
- **Фильтр на `/equipment`** — перевести с клиентского на серверный
  (после того, как `getEquipmentWithLocation` получит `workplace_id`
  и `status` в `filters`).
- **`check-css.js`** — добавить проверку, что все плейсхолдеры
  из шаблонов реально используются в роутах (ловить баги типа
  `{{placed_equipment}}` без `replace`).

### Теги

- v2.11.1 — имя рабочего места в таблице + подсветка из /equipment
- v2.11.2 — статус `placed` + 5-я карточка + фильтр
- v2.11.2 (fix) — плейсхолдер `{{placed_equipment}}` + локализация
  в `/admin` + `finalStatus` в `updateEquipmentAPI`
- **v2.11.3 — фиксы после Этапа 2 (этот)**

## [2.10.0] - 2026-10-05

**🎉🎉 Этап 2 завершён: Рабочие места (офис → кабинет → место → техника)**

Появилась новая иерархия хранения: офисы → кабинеты → рабочие
места, к которым привязывается техника. Альтернатива складам:
техника находится **или** на складе (`cell_id`), **или** на
рабочем месте (`workplace_id`), не оба одновременно.

Две новые страницы — `/admin/workplaces` (список офисов) и
`/admin/workplaces/:id` (дерево офиса) — на новом layout.
Интеграция: фильтр «Рабочее место» на `/equipment` и
переключатель расположения (склад/место) в форме
`/admin/edit/:id`. Sidebar-пункт «🏛️ Рабочие места».

Этап 2 закрыт полностью.

### Итоги Этапа 2

**БД (2.1, v2.1.0):**
- Новые таблицы: `offices` (id, name UNIQUE, address, description,
  is_default, is_active), `rooms` (id, office_id FK CASCADE, name,
  description, sort_order, is_active, UNIQUE(office_id, name)),
  `workplaces` (id, room_id FK CASCADE, name, code, capacity,
  description, sort_order, is_active, UNIQUE(room_id, name))
- `equipment.workplace_id` FK `SET NULL` → `workplaces(id)`
- 7 индексов
- Seed: 2 офиса × 2 кабинета × 2 места = 8 мест

**Модуль `database/modules/workplaces.js` (2.2, v2.2.0):**
- 25 функций: офисы (7), кабинеты (5), рабочие места (5),
  дерево/техника (4), статистика (4)

**Подключение (2.3, v2.3.0):**
- `database/db.js`: `const workplaces = require('./modules/workplaces')(ctx)`,
  `...workplaces` в `module.exports`

**Роуты `routes/workplaces.js` (2.4, v2.4.0):**
- 26 функций: страницы (2), API офисов (6), дерево/статистика (4),
  кабинеты (4), рабочие места (5), техника (2), сводка/экспорт (3)

**Регистрация в `server.js` (2.5, v2.5.0):**
- 2 страницы + 24 API-роута под `requireAdmin`

**Страница `/admin/workplaces` (2.6, v2.6.0):**
- `views/admin-workplaces.html` — page-header, 5 карточек статистики,
  card со списком офисов, 2 модалки (create/edit, delete)
- `public/css/workplaces.css` — сетка `.offices-grid`, карточки
  `.office-card` (+ `is-default`/`is-inactive`), 3 счётчика
  (кабинеты/места/техника)
- `public/js/workplaces.js` — загрузка `/api/admin/offices`,
  CRUD, set-default, delete с предупреждениями

**Страница `/admin/workplaces/:id` (2.7, v2.7.0):**
- `views/admin-workplace-details.html` — page-header, info-panel
  офиса, tree-section (кабинеты → рабочие места), 4 модалки
  (room/workplace/workplaceView/delete)
- `public/css/workplace-details.css` — панель офиса, дерево
  на 2 уровня (`.tree-room` → `.tree-workplace`), кнопки `.tree-btn`,
  модалка просмотра места
- `public/js/workplace-details.js` — дерево через
  `/api/admin/offices/:id/tree`, CRUD кабинетов и мест,
  просмотр места с техникой, expand/collapse

**Sidebar (2.8, v2.8.0):**
- `views/partials/sidebar.html` — пункт «🏛️ Рабочие места»
  в секции «Техника» (между «Склады» и «Хранение»)
- `public/js/layout.js` — ветка `activePage = 'workplaces'`
  для `/admin/workplaces` и `/admin/workplaces/:id`

**Интеграция (2.9, v2.9.0):**
- `/equipment`: 5-й фильтр «Рабочее место» (optgroup офис/кабинет,
  `__none__` — без места), `data-workplace-id` в строках таблицы,
  колонка «Место хранения» показывает склад ИЛИ место
- `/admin/edit/:id`: секция «📍 Расположение» с radio-переключателем
  (не указано / склад / рабочее место), `cell_id` и `workplace_id`
  взаимоисключающие

### Изменения в существующем коде

- **`database/modules/warehouses.js`**: `moveEquipmentToCell` теперь
  обнуляет `workplace_id` (симметрично `moveEquipmentToWorkplace`,
  которая обнуляет `cell_id`)
- **`database/modules/equipment.js`**:
  - `getEquipmentWithLocation` — в SELECT добавлено `e.workplace_id`
  - `getEquipmentById` — JOIN на `workplaces/rooms/offices`,
    отдаёт `workplace_id`, `workplace_name`, `workplace_code`,
    `room_name`, `office_name`
  - `updateEquipment` — принимает `workplace_id`; при возврате
    техники обнуляет и `cell_id`, и `workplace_id`
- **`routes/admin.js`**:
  - `updateEquipmentAPI` — принимает `workplace_id`; взаимоисключение
    с `cell_id`; при `status = 'assigned'` обнуляются оба
  - `renderEditEquipment` — пробрасывает `{{workplace_id}}`
- **`routes/equipment.js`**: собирает `workplace_options`
  (optgroup по офис/кабинет) через `getAllOffices` /
  `getRoomsByOffice` / `getWorkplacesByRoom`
- **`scripts/check-css.js`**: добавлены `workplaces.css`,
  `workplace-details.css`; проверки плейсхолдеров
  `admin-workplaces.html`, `admin-workplace-details.html`,
  `equipment.html`, дополнены `admin-edit.html`
- **`public/css/components.css`**: добавлен `.stat-card .number.info`

### Фиксы в процессе Этапа 2

- **v2.7.4** — в `#workplaceViewBody` и `#cellViewBody` добавлен
  класс `.modal-body`: раньше градиентные шапки прижимались
  к краям модалок без внутренних отступов
- **v2.7.2-fix** — `scripts/check-css.js`: `'class="view-user-modal"'`
  → `'view-user-modal'` (класс идёт в составе
  `class="modal view-user-modal"`, точная подстрока с `class=`
  не находилась)

### Файлы, затронутые в Этапе 2

**Новые:**
- `database/modules/workplaces.js`
- `routes/workplaces.js`
- `views/admin-workplaces.html`
- `views/admin-workplace-details.html`
- `public/css/workplaces.css`
- `public/css/workplace-details.css`
- `public/js/workplaces.js`
- `public/js/workplace-details.js`
- `scripts/migrate.js` (дополнен) / `scripts/seed.js` (дополнен)

**Изменены:**
- `database/db.js`
- `database/modules/equipment.js`
- `database/modules/warehouses.js`
- `routes/admin.js`
- `routes/equipment.js`
- `server.js`
- `views/partials/sidebar.html`
- `views/equipment.html`
- `views/admin-edit.html`
- `public/js/layout.js`
- `public/js/equipment-filter.js`
- `public/js/admin-edit.js`
- `public/css/components.css`
- `public/css/admin-edit.css`
- `scripts/check-css.js`
- `package.json`, `CHANGELOG.md`

**Не тронуты:**
- Auth-страницы (`login.html`, `change-password.html`)
- `utils/layout.js`
- API-функции инвентаризации (`routes/warehouses.js`)

### Проверено

- `/admin/workplaces` открывается через `renderPage`, партиалы
  подгружаются, тёмная тема применяется
- 5 карточек статистики (офисы / кабинеты / места / техника
  на местах / без места) — реальные числа из
  `/api/admin/workplaces/stats`
- Карточки офисов с счётчиками и бейджами (⭐ default, ✅ active,
  🚫 inactive), CRUD, set-default, delete с предупреждениями —
  работают
- `/admin/workplaces/:id` открывается через `renderPage`
- Дерево офиса (кабинеты → рабочие места) рендерится,
  разворачивание / сворачивание работает
- CRUD кабинетов и рабочих мест, просмотр места с техникой
  (модалка `.workplace-view-*` с `.modal-body`) — работают
- Sidebar подсвечивает «🏛️ Рабочие места» на обеих страницах
- `/equipment`: фильтр «Рабочее место» (optgroup по офис/кабинет),
  `__none__` — техника без места, сброс работает
- `/admin/edit/:id`: переключатель «📍 Расположение»
  (не указано / склад / рабочее место), превью адреса,
  сохранение через `PUT /api/admin/equipment/:id`;
  `cell_id` и `workplace_id` взаимоисключающие
- При статусе `assigned` оба поля пустые
- В консоли браузера ошибок нет
- `node scripts/check-css.js` — все проверки зелёные

### Теги

- v2.1.0 — миграция БД (offices, rooms, workplaces)
- v2.2.0 — модуль `database/modules/workplaces.js` (25 функций)
- v2.3.0 — подключение в `database/db.js`
- v2.4.0 — `routes/workplaces.js` (26 функций)
- v2.5.0 — регистрация в `server.js`
- v2.6.1 — admin-workplaces.html → контент-шаблон
- v2.6.2 — workplaces.css → тёмная тема + чистка
- v2.6.3 — workplaces.js → унификация классов
- v2.6.0 — финал Шага 2.6
- v2.7.1 — admin-workplace-details.html → контент-шаблон
- v2.7.2 — workplace-details.css → тёмная тема + чистка
- v2.7.3 — workplace-details.js → унификация классов
- v2.7.4 — .modal-body в модалках просмотра места/ячейки (фикс)
- v2.7.0 — финал Шага 2.7
- v2.8.0 — sidebar + layout.js
- v2.9.1 — фильтр на /equipment
- v2.9.2 — форма выбора места в /admin/edit/:id
- **v2.10.0 — Этап 2 завершён (этот)**

### Что дальше — Этап 3

План уточняется в следующей передаточной записке. Возможные
направления: интеграция с `/admin/inventory` (отображение техники
на рабочих местах в сводке), отчётность, расширение фильтров,
экспорт.

## [1.23.0] - 2026-10-02

**🎉🎉 Этап 1 завершён: все страницы на новом layout**

Все страницы приложения переведены на новый дизайн
(тёмная тема, sidebar + header + footer через партиалы).
Этап 1 закрыт полностью. Впереди — Этап 2: расширение БД
(«рабочие места»: офис → кабинет → место).

### Итоги Этапа 1

**Каркас (1.1–1.4):**
- `utils/layout.js` — `renderPage({ title, content, pageCss, pageJs, bodyClass })`
- `views/partials/` — `header.html`, `sidebar.html`, `footer.html`
- `public/css/theme.css` — 66 переменных тёмной темы (Nginx UI)
- `public/css/layout.css` — каркас (`.app-layout`, `.app-sidebar`, `.app-header`, `.app-main`, `.app-footer`, `.page-header`, `.page-title`, `.page-subtitle`, `.page-actions`)
- `public/css/components.css` — 86 общих классов
- Миграция `/` и `/equipment`

**Страницы (1.5–1.12):**

| Шаг | Страница | Версия | Статус |
|-----|----------|--------|--------|
| 1.5 | `/admin` | v1.17.0 | ✅ |
| 1.6 | `/admin/add` + `/admin/edit/:id` | v1.17.5 | ✅ |
| 1.7 | `/admin/user/add` + `/admin/user/edit/:id` | v1.18.0 | ✅ |
| 1.8 | `/admin/catalog` | v1.19.0 | ✅ |
| 1.9 | `/admin/logs` | v1.20.0 | ✅ |
| 1.10 | `/admin/warehouses` + `/admin/warehouse-details` | v1.21.0 | ✅ |
| 1.11 | `/admin/inventory` | v1.22.0 | ✅ |
| 1.12 | `/pdf` (+ пункт в sidebar) | v1.22.3 | ✅ |

**Финальная проверка (1.13) + фиксы (1.13-fix):**
- Все страницы открываются через `renderPage`
- Sidebar / header / footer подгружаются на каждой
- Тёмная тема применяется
- Активный пункт в sidebar подсвечивается (включая `/pdf`)
- Навигация: все ссылки ведут на существующие роуты
- Адаптивность: sidebar сворачивается, статистика перестраивается, таблицы скроллятся, модалки full-screen
- Клавиатурные сокращения: Ctrl+K (поиск), Ctrl+B (sidebar), Escape (модалки)
- Toast-уведомления работают
- `node scripts/check-css.js` — все проверки зелёные
- В консоли браузера ошибок нет ни на одной странице

**Финальные фиксы (v1.22.4):**
- `public/js/catalog.js` + `views/admin-catalog.html` — `.catalog-loading` → `.loading-block` (3 места, пропущены в 1.8)
- `views/page.html` — удалён (мёртвый файл-рудимент, 0 использований)

### Архитектура layout (итог)

**`utils/layout.js` → `renderPage({ title, content, pageCss, pageJs, bodyClass })`:**
- Загружает 3 партиала (`header.html`, `sidebar.html`, `footer.html`)
- Подключает общие CSS: `theme.css`, `layout.css`, `components.css`, `help.css`
- Подключает общие JS: `main.js`, `help.js`, `layout.js`
- Вставляет `pageCss` / `pageJs`
- Оборачивает `content` в `<main class="app-main">` внутри `<div class="app-layout">`

**Эталонный паттерн роута** (файл `utils/layout.js` + любой роут):

1. Импорт: `const { renderPage } = require('../utils/layout');`
2. Чтение шаблона: `fs.readFileSync(htmlPath, 'utf8')` в переменную `content`
3. Подстановки: скалярные — через `content.replace(/\{\{name\}\}/g, escapeHtml(value))`, многострочные — **без** `/g`
4. Вызов: `const fullHtml = renderPage({ title, content, pageCss, pageJs });`
5. Отправка: `res.send(fullHtml);`
6. Ошибки: `try/catch` + `console.error('❌ ...', error)` + `res.status(500).send('Ошибка загрузки страницы')`

**Критические правила (закреплены):**
- Плейсхолдеры — через `String.replace()`
- Скалярные — с флагом `/g`
- Многострочные — **без** `/g` (иначе `$` в данных сломает замену)
- Экранирование — через локальный `escapeHtml()`
- Переменная `content` (не `html`) — для единообразия
- `require('fs')` / `require('path')` — только там, где реально нужны

### Вне Этапа 1

Auth-страницы (`views/login.html`, `views/change-password.html`)
**остаются на отдельной теме** (`style.css` + `auth.css`):

- Без sidebar / header / footer (изолированный слой авторизации)
- Своя вёрстка (`.auth-page`), свои CSS/JS
- `renderPage` не используется

Это **намеренно** — приложение не должно показывать навигацию
до аутентификации / при смене пароля.

### Файлы, затронутые в Этапе 1

**Новые:**
- `utils/layout.js`
- `views/partials/header.html`, `views/partials/sidebar.html`, `views/partials/footer.html`
- `public/css/theme.css`, `public/css/layout.css`, `public/css/components.css`
- `public/css/pdf.css`
- `public/js/layout.js`
- `scripts/check-css.js`

**Изменены:**
- 14 HTML-шаблонов в `views/` (без auth-страниц)
- 8 page-CSS в `public/css/`
- 8 page-JS в `public/js/`
- 6 файлов роутов в `routes/`
- `package.json`, `CHANGELOG.md`

**Удалены:**
- `views/page.html` (мёртвый файл-рудимент)

**Не тронуты:**
- `database/modules/*` — вся работа с БД без изменений
- `public/css/help.css` — общий слой
- `public/js/main.js`, `public/js/help.js` — общие
- API-эндпоинты — только адаптированы вызовы
- Auth-страницы (`login.html`, `change-password.html`) — вне layout

### Что дальше — Этап 2: Рабочие места

Расширение БД: «рабочие места» (офис → кабинет → место),
к которым может быть привязана техника.

**План (предварительный):**
- Миграция БД: таблицы `offices`, `rooms`, `workplaces`
- Привязка `equipment.workplace_id`
- UI: страница `/admin/workplaces` (дерево офис → кабинет → место)
- Интеграция с `/equipment` (фильтр по рабочему месту)
- Интеграция с `/admin/inventory` (техника на рабочих местах)
- Перевод страницы на новый layout (по аналогии с Этапом 1)

Точный план — в следующей передаточной записке.

### Теги

- v1.22.1 — sidebar + пункт PDF инструкции + подсветка
- v1.22.2 — pdf.html → контент-шаблон
- v1.22.3 — renderPdfList → renderPage
- v1.22.4 — финальные фиксы (catalog-loading + удаление page.html)
- **v1.23.0 — Этап 1 завершён (этот)**

## [1.22.0] - 2026-10-02

**🎉 Шаг 1.11 завершён: /admin/inventory на новом layout**

Страница инвентаризации переведена на новый layout через `renderPage()`:
sidebar + header + footer через партиалы, тёмная тема, общие
компоненты из `components.css`. Шаг разбит на 4 подшага — от
подготовки шаблона до финальной проверки.

Страница крупная: 6 карточек общих итогов, warning-блок о технике
без ячейки, сводка по складам с прогресс-барами, модалка деталей
склада с 2 вкладками (🔧 Техника / 📍 Заполненность), экспорт в CSV.
5 API-эндпоинтов инвентаризации не тронуты.

### Итоги Шага 1.11

**1.11.1 — views/admin-inventory.html → контент-шаблон**

- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`,
  `<link>` ×4 (style.css, admin.css, inventory.css, help.css),
  `<script>` ×4 (main.js, help.js, footer.js, inventory.js),
  `.container`, `#footer-container`, `.toast-container`
- `.header` + `.header-actions` (4 кнопки) → `.page-header` +
  `.page-actions` (1 кнопка «← Админ-панель»)
- Кнопка «Обновить»: `.btn-back` → `.btn-ghost`
- Карточки итогов: `.number.green/orange/pink/blue` →
  `.number.success/warning/accent/info`
- Loading: `.catalog-loading` → `.loading-block`
- Сохранены: `id`, `onclick`, `{{totals.*}}` (6 плейсхолдеров),
  `.inventory-warning` (локальная специфика), `.inventory-section`,
  `.section-header`, `.detail-tab*` (локальные — структура
  отличается от общих `.tabs`), `.inventory-table`,
  `.occupancy-*`, `#warehouseDetailModal` (`.modal.view-user-modal`)

**1.11.2 — public/css/inventory.css → тёмная тема + чистка**

Убраны дубли с `components.css`:
- `.stats-grid`, `.stat-card` (+ `:hover`, `.icon`, `.number`,
  `.label`) — теперь только в `components.css`
- `.stat-card .number.green/orange/pink/blue` →
  `.number.accent/success/warning/danger` (в `components.css`)
- `.inventory-empty` + `.emoji` → `.empty-state` (в `components.css`)
- `@media (max-width: 768px) .stats-grid` и
  `@media (max-width: 480px) .stats-grid` — уже есть в `components.css`

Все цвета переведены на `var(--*)` из `theme.css`:
`--bg-primary/secondary/tertiary/hover`, `--border`,
`--border-light`, `--accent-border`, `--text-primary/secondary/muted`,
`--accent`, `--success`, `--warning`, `--danger`, `--info`,
`--purple`, `--*-bg`, `--radius-*`, `--space-*`, `--text-*`,
`--shadow-*`, `--transition-*`, `--font-mono`.

Специфика сохранена:
- `.stat-card.highlight` — локальный (в `components.css` нет),
  теперь `var(--info-bg)` + `var(--accent-border)`
- `.inventory-warning` + `.warning-icon` + `strong` + `p`
- `.inventory-section` + `.section-header` + `.section-actions`
- `.warehouse-summary` + `.warehouse-summary-card` (+ `:hover`,
  `.is-default`) + `.ws-*` (header/title/name/address/badge/
  progress/progress-label/progress-bar/progress-fill + low/
  medium/high/full, stats/stat/stat-value + zones/racks/cells/
  equipment, stat-label, actions, btn-icon-only)
- `.wh-detail-header` + `.wh-detail-icon` + `.wh-detail-info` +
  `.wh-detail-address` — градиент `var(--accent)` → `var(--purple)`
- `.detail-tabs` / `.detail-tab` (+ `.active`) / `.detail-tab-content`
  (+ `.active`) — локальные, JS работает с ними
- `.inventory-table` + `th` / `td` / `tr:hover`
- `.occupancy-item/cell/code/name/bar/bar-fill/count`

Было: ~534 строки. Стало: ~370 строк.
Убрано дублей: ~70 строк.

`inventory.css` уже был в списке проверяемых `scripts/check-css.js` —
35 переменных объявлены, все проверки зелёные.

**1.11.3 — public/js/inventory.js → унификация классов**

- `.catalog-loading` → `.loading-block` (4 места)
- `.inventory-empty` → `.empty-state` (6 мест) + внутренние `<div>`
  заменены на `<h3>` / `<p>` (вариант A, соответствует структуре
  `.empty-state` в `components.css`)
- `.btn-back` → `.btn-ghost` (1 место — `<a>` на дерево склада)
- Hex-цвета в `.occupancy-bar-fill` (`#cbd5e0`, `#fc8181`,
  `#ed8936`, `#48bb78`, `#68d391`) → `var(--border-light)`,
  `var(--danger)`, `var(--warning)`, `var(--success)`
- Убраны `console.log` (3 места: DOMContentLoaded, loadSummary,
  loadTotals)
- `console.error` уточнены (более информативные сообщения)
- XSS-защита (`escapeHtml`) уже была — сохранена
- Логика не тронута: `loadSummary`, `loadTotals`, `updateTotals`,
  `updateWarning`, `renderSummary`, `renderWarehouseCard`,
  `openWarehouseDetail`, `renderWarehouseDetail`,
  `closeWarehouseDetailModal`, `switchDetailTab`, `exportInventory`

**1.11.4 — routes/warehouses.js → renderInventory на renderPage**

- `fs.readFileSync` + `res.send` → `renderPage({ title, content,
  pageCss, pageJs })`
- `pageCss: '/css/inventory.css'`, `pageJs: '/js/inventory.js'`
- `title: 'Инвентаризация – MoveIT service'`
- Переменная `html` → `content` (единообразие с 1.10.7)
- Убран неиспользуемый `const summary` (сводка грузится через
  API из JS, в шаблоне её нет)
- Убраны 2 лишних replace: `{{totals.available_without_cell}}` и
  `{{totals.total_capacity}}` — их нет в `views/admin-inventory.html`
- `require('fs')` / `require('path')` оставлены — нужны
  `renderWarehouses` и `renderWarehouseDetails`
- 5 API-функций (`getInventorySummaryAPI`, `getInventoryTotalsAPI`,
  `getWarehouseInventoryAPI`, `getCellOccupancyAPI`,
  `exportInventoryCSV`) — не тронуты
- `database/modules/warehouses.js` (4 функции инвентаризации:
  `getInventorySummary`, `getWarehouseInventory`, `getCellOccupancy`,
  `getInventoryTotals`) — не тронут

### Файлы, затронутые в Шаге 1.11

**Изменены:**
- `views/admin-inventory.html` (полностью переписан)
- `public/css/inventory.css` (534 → ~370 строк)
- `public/js/inventory.js` (унификация классов + var(--*))
- `routes/warehouses.js` (renderInventory → renderPage)
- `package.json` (версия 1.22.0)
- `CHANGELOG.md`

**Не тронуты:**
- `database/modules/warehouses.js`
- `scripts/check-css.js` (inventory.css уже был в списке)
- `utils/layout.js`
- 5 API-функций в `routes/warehouses.js`

### Проверено

- `/admin/inventory` открывается через `renderPage`, партиалы
  (sidebar + header + footer) подгружаются, тёмная тема применяется
- 6 карточек общих итогов — реальные числа из `/api/admin/inventory/totals`
- Warning-блок о технике без ячейки — показывается / скрывается
  по флагу `available_without_cell`
- Сводка по складам: карточки с прогресс-барами и мини-статистикой
  (зоны / стеллажи / ячейки / техника)
- Модалка деталей склада: 2 вкладки (🔧 Техника / 📍 Заполненность)
  — переключение работает, данные грузятся
- Кнопки «🏢 Дерево склада» и «📥 Экспорт в CSV» — работают
- Кнопка «🔄 Обновить» — перезагружает сводку
- Sidebar подсвечивает «Хранение», Ctrl+K / Ctrl+B работают
- В консоли браузера ошибок нет
- `node scripts/check-css.js` — все проверки зелёные
  (`inventory.css` — 35 переменных объявлены)

### Теги

- v1.21.1 — admin-inventory.html → контент-шаблон
- v1.21.2 — inventory.css → тёмная тема + чистка
- v1.21.3 — inventory.js → унификация классов
- v1.21.4 — routes/warehouses.js → renderInventory на renderPage
- **v1.22.0 — финал Шага 1.11 (этот)**

### Что дальше

- 1.12 — `pdf.html` (1 HTML + routes/pdf.js, сложность низкая)
- 1.13 — финальная проверка Этапа 1 (навигация, адаптивность,
  все ссылки) + тег **v1.22.1** или сразу **v1.23.0**

## [1.21.0] - 2026-10-02

**🎉 Шаг 1.10 завершён: /admin/warehouses + /admin/warehouse-details
на новом layout**

Две страницы переведены на новый layout через `renderPage()`:
sidebar + header + footer через партиалы, тёмная тема, общие
компоненты из `components.css`. Шаг разбит на 8 подшагов —
от подготовки `components.css` до финальной проверки.

### Итоги Шага 1.10

**1.10.0 — components.css: общие компоненты для модалок и карточек**

Вынесены из `admin.css` / `catalog.css`:
- `.delete-warning` + `.warning-icon` (warning-вариант;
  в `admin.css` переопределение на danger)
- `.modal-body` (базовый padding)
- `.view-user-modal` (sticky header, max-width 800px)
- `.detail-grid` / `.detail-item` / `.value`
- `.equipment-cards` / `.equipment-card` + 8 модификаторов
- `.status-badge` + 4 модификатора через `.status-badge.status-*`

Дополнена адаптивность `@media (max-width: 768px)`.

**1.10.1 — views/admin-warehouses.html → контент-шаблон**

- `.header` + `.header-actions` → `.page-header` + `.page-actions`
- `.stats` → `.stats-grid`
- `.actions-panel` → `.card` + `.card-header` + `.card-title`
- `.btn-back` → `.btn-ghost`
- `.catalog-loading` → `.loading-block`
- Убраны html/head/body/link/script, `#footer-container`,
  `.toast-container`

**1.10.2 — views/admin-warehouse-details.html → контент-шаблон**

- `#pageData` с `data-warehouse-id/name` — сохранён (критичен)
- `.warehouse-info-panel`, `.tree-section` — оставлены локальными
- `.btn-back` → `.btn-ghost` (header + дерево + 5 модалок)
- `#cellViewModal`: `.modal-body` убран, оставлен `id="cellViewBody"`

**1.10.3 — public/js/warehouses.js — унификация классов**

- `.catalog-empty` → `.empty-state`
- `.badge-default/active/inactive` → `.badge-warning/success/danger`
- `.btn-back` → `.btn-ghost` (setDefaultBtn)
- Убраны `console.log`

**1.10.4 — public/js/warehouse-details.js — унификация классов**

- `.catalog-loading` → `.loading-block`
- Внешние `.tree-empty` → `.empty-state`
- **XSS-фикс:** escapeHtml к warehouse_name / zone_name / rack_name
  в `viewCell`
- Убрана пустая `updateSubtitle()`, `console.log` → `console.error`

**1.10.5 — public/css/warehouses.css → тёмная тема + чистка**

- Убраны дубли с `components.css` (badge-*, catalog-*, delete-warning,
  checkbox-label, actions-panel)
- Все цвета → `var(--*)` из `theme.css`
- `.warehouse-stat-value.cells`: `#ed64a6` → `var(--purple)`
- 384 → 190 строк

**1.10.6 — public/css/warehouse-details.css → тёмная тема + чистка**

- Все цвета → `var(--*)`
- Специфика дерева сохранена (tree-zone / tree-rack / tree-cell,
  tree-btn, tree-empty + 3 состояния счётчика)
- `.cell-view-*` — модалка просмотра ячейки
- 609 → 430 строк

**1.10.7 — routes/warehouses.js → renderPage**

- `renderWarehouses` — убран лишний `getAllWarehouses()`,
  `pageCss: /css/warehouses.css`, `pageJs: /js/warehouses.js`
- `renderWarehouseDetails` — **XSS-фикс** (`escapeHtml` на name
  и description), убраны неиспользуемые replace (`address`,
  `is_default`, `zones_count`), `pageCss`/`pageJs` подключены
- Добавлен локальный `escapeHtml`
- 23 API-функции — не тронуты

**1.10.8 — финал**

- В `admin-warehouses.html` `.warehouses-grid` обёрнут
  в `.card-body` внутри `.card` (карточки складов визуально
  внутри общей карточки «Список складов»)
- В `warehouses.css` убран `margin-bottom` у `.warehouses-grid`
- Обновлён `scripts/check-css.js`: `warehouses.css`,
  `warehouse-details.css`, `admin-warehouses.html`,
  `admin-warehouse-details.html` в списке проверяемых

### Файлы, затронутые в Шаге 1.10

**Изменены:**
- `public/css/components.css` (+~180 строк)
- `public/css/warehouses.css` (384 → 190 строк)
- `public/css/warehouse-details.css` (609 → 430 строк)
- `views/admin-warehouses.html` (полностью переписан)
- `views/admin-warehouse-details.html` (полностью переписан)
- `public/js/warehouses.js` (унификация классов)
- `public/js/warehouse-details.js` (унификация классов + XSS-фикс)
- `routes/warehouses.js` (2 функции → renderPage + XSS-фикс)
- `scripts/check-css.js` (добавлены 2 CSS + 2 HTML)
- `package.json` (версия 1.21.0)
- `CHANGELOG.md`

### Проверено

- `/admin/warehouses` открывается через `renderPage`, партиалы
  подгружаются, тёмная тема применяется
- Статистика (5 карточек) — реальные числа
- Карточки складов внутри общей карточки «Список складов»
- CRUD складов: добавление / редактирование / удаление /
  установка по умолчанию — работают, тосты показываются
- `/admin/warehouses/:id` открывается через `renderPage`
- Панель информации о складе — имя, описание, бейджи
- Дерево Зоны → Стеллажи → Ячейки — рендерится, разворачивание
  / сворачивание работает
- CRUD зон / стеллажей / ячеек работает
- Просмотр ячейки — модалка с техникой (.equipment-card)
- Sidebar подсвечивает активный пункт, Ctrl+K / Ctrl+B работают
- В консоли браузера ошибок нет
- `node scripts/check-css.js` — все проверки зелёные

### Теги

- v1.20.1 — components.css
- v1.20.2 — admin-warehouses.html
- v1.20.3 — admin-warehouse-details.html
- v1.20.4 — warehouses.js
- v1.20.5 — warehouse-details.js
- v1.20.6 — warehouses.css + CHANGELOG (частичный)
- v1.20.7 — warehouse-details.css
- v1.20.8 — routes/warehouses.js
- **v1.21.0 — финал Шага 1.10 (этот)**

### Что дальше

- 1.11 — `/admin/inventory` (3 подшага: шаблон → CSS → роут+JS)
- 1.12 — `pdf.html` (2 подшага)
- 1.13 — финальная проверка Этапа 1 + тег v1.22.0

## [1.20.6] - 2026-10-02

**Шаг 1.10.5: /admin/warehouses на новом layout — CSS**

`public/css/warehouses.css` переписан под тёмную тему, убраны
дубли с `components.css`. Страница `/admin/warehouses` уже
работает на новом layout (шаблон — v1.20.2, JS — v1.20.4),
осталось только привести CSS в порядок.

**⚠️ Важно:** это только подшаг 1.10.5. Полный Шаг 1.10 ещё
не закрыт — остался `warehouse-details.css` (1.10.6), роут
на `renderPage` (1.10.7) и финальная проверка (1.10.8).
Тег `v1.20.6` — промежуточный.

### Сделано в этой сессии (1.10.0 – 1.10.5)

**1.10.0 — components.css пополнен общими компонентами**

В `components.css` вынесены общие классы, дублировавшиеся
в `admin.css` и `catalog.css`:
- `.delete-warning` + `.warning-icon` (warning-вариант;
  в `admin.css` остаётся переопределение на danger —
  специфика `/admin`)
- `.modal-body` (базовый padding)
- `.view-user-modal` + `.view-user-modal .modal-header / .modal-body`
  (sticky header, max-width 800px — из `admin.css`)
- `.detail-grid` / `.detail-item` / `.detail-item label` / `.value`
  (из `admin.css` — насыщенный вариант с фоном и рамкой)
- `.equipment-cards` / `.equipment-card` + 8 модификаторов
  (из `admin.css` — header/body/name/model/manufacturer/inv/date/footer)
- `.status-badge` + 4 модификатора через `.status-badge.status-*`
  (из `admin.css`, на переменных `theme.css`)

Дополнена адаптивность `@media (max-width: 768px)`:
- `.detail-grid` → 1 колонка
- `.equipment-cards` → 1 колонка
- `.view-user-modal` → full-screen

**1.10.1 — views/admin-warehouses.html → контент-шаблон**

- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<link>`,
  `<script>`, `.container`, `#footer-container`, `.toast-container`
- `.header` + `.header-actions` → `.page-header` + `.page-actions`
  (одна кнопка «← Админ-панель» вместо 4)
- `.stats` → `.stats-grid`, модификаторы цвета приведены
  к `components.css` (`.green` → `.success`, `.orange` → `.warning`,
  `.pink` → `.accent`, `.blue` → `.info`)
- `.actions-panel` → `.card` + `.card-header` + `.card-title`
- `.catalog-loading` → `.loading-block` (placeholder)
- `.btn-back` → `.btn-ghost` (форма склада, удаление)
- `.delete-warning` + `.warning-icon` — оставлены (класс переехал
  в `components.css` в 1.10.0)
- Все `id`, `onclick` / `onsubmit`, `{{...}}` плейсхолдеры сохранены

**1.10.2 — views/admin-warehouse-details.html → контент-шаблон**

- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<link>`,
  `<script>`, `.container`, `#footer-container`, `.toast-container`
- `#pageData` с `data-warehouse-id/name` — сохранён (критичен
  для `public/js/warehouse-details.js`)
- `.header` + `.header-actions` → `.page-header` + `.page-actions`
  (одна кнопка «← К складам»)
- `.warehouse-info-panel` — оставлена локальной (специфика)
- `.tree-section` — оставлена локальной, `.btn-back` → `.btn-ghost`
  у 3 кнопок (Развернуть / Свернуть / Обновить)
- `.catalog-loading` → `.loading-block` (placeholder)
- Модалки (5: zone/rack/cell/cellView/delete) — `.btn-back` →
  `.btn-ghost` во всех «Отменах»
- `#cellViewModal`: `.modal-body` убран, оставлен `id="cellViewBody"`
- Все `id`, `onclick` / `onsubmit`, `{{...}}` плейсхолдеры сохранены

**1.10.3 — public/js/warehouses.js → унификация классов**

- `.catalog-empty` + вложенные → `.empty-state` + `.emoji/h3/p`
  (ошибка загрузки + пустой список)
- `.badge-default` → `.badge-warning` (⭐ По умолчанию)
- `.badge-active` → `.badge-success` (✅ Активен)
- `.badge-inactive` → `.badge-danger` (🚫 Неактивен)
- `setDefaultBtn`: `.btn-back` → `.btn-ghost` + `.btn-sm`
- Убраны `console.log` (успешные сценарии)
- Логика CRUD не менялась

**1.10.4 — public/js/warehouse-details.js → унификация классов**

- `.catalog-loading` → `.loading-block` (2 места)
- Внешние `.tree-empty` → `.empty-state` с `.emoji/h3/p`
- Вложенные `.tree-empty` — оставлены локально,
  `background: white` → `var(--bg-tertiary)`
- `viewCell`: добавлен `escapeHtml` к `warehouse_name` /
  `zone_name` / `rack_name` — устранена потенциальная XSS
- Убрана пустая функция `updateSubtitle()`
- Убраны `console.log`, уточнены `console.error`
- Классы `.detail-*` / `.equipment-card*` / `.status-badge.*` —
  оставлены без изменений (они теперь в `components.css`)

**1.10.5 — public/css/warehouses.css → тёмная тема + чистка**

Убраны дубли с `components.css`:
- `.stat-card .number.blue` → `.number.info`
- `.actions-panel` + `h2` → `.card` + `.card-header`
- `.badge` + `.badge-default/active/inactive` → `.badge-warning
  /success/danger`
- `.catalog-loading` + `@keyframes pulse` → `.loading-block`
- `.catalog-empty` + вложенные → `.empty-state`
- `.delete-warning` + `.warning-icon` → `components.css`
- `.checkbox-label` → `components.css`
- `.warehouse-actions a.btn` → `.btn` уже без underline

Все цвета переведены на `var(--*)` из `theme.css`:
`--bg-tertiary` / `--bg-secondary`, `--border` / `--accent-border`,
`--text-primary` / `--text-secondary` / `--text-muted`,
`--accent` / `--success` / `--warning` / `--purple` / `--info`,
`--warning-bg`, `--radius-*`, `--space-*`, `--text-*`,
`--shadow-*`, `--transition-fast`.

Специфика сохранена: `.warehouses-grid`, `.warehouse-card`
(+ `is-default` / `is-inactive`), `.warehouse-icon` (градиент),
`.warehouse-stats` (+ 4 модификатора), `.warehouse-actions`,
адаптивность.

Было: ~384 строки. Стало: ~190 строк.

**scripts/check-css.js — добавлен `warehouses.css`**

`warehouses.css` добавлен в список `cssFilesToCheck`.
Проверка проходит: 25 переменных объявлены.

### Файлы

**Изменены:**
- `public/css/components.css` (1.10.0)
- `views/admin-warehouses.html` (1.10.1)
- `views/admin-warehouse-details.html` (1.10.2)
- `public/js/warehouses.js` (1.10.3)
- `public/js/warehouse-details.js` (1.10.4)
- `public/css/warehouses.css` (1.10.5)
- `scripts/check-css.js` (добавлен `warehouses.css` в список)
- `CHANGELOG.md`

**Не тронуты:**
- `package.json` — версия поднимется сразу до 1.21.0 в 1.10.8
- `routes/warehouses.js` — следующий (1.10.7)
- `public/css/warehouse-details.css` — следующий (1.10.6)

### Проверено

- `node scripts/check-css.js` — все проверки пройдены
  (`warehouses.css` — 25 переменных объявлены)
- `views/admin-warehouses.html` и `views/admin-warehouse-details.html`
  открываются через `renderPage` (визуальная проверка — в 1.10.8,
  после подключения `renderPage` в роуте)

### Связанные теги

- v1.20.1 — components.css (общие компоненты)
- v1.20.2 — admin-warehouses.html → контент-шаблон
- v1.20.3 — admin-warehouse-details.html → контент-шаблон
- v1.20.4 — warehouses.js — унификация классов
- v1.20.5 — warehouse-details.js — унификация классов
- v1.20.6 — warehouses.css — тёмная тема (этот)
- 1.10.6 — warehouse-details.css (следующий)
- 1.10.7 — routes/warehouses.js → renderPage
- 1.10.8 — финал Шага 1.10 + тег v1.21.0

### Статистика сессии

- Подшагов: 6 (1.10.0 – 1.10.5)
- Тегов: 6 (v1.20.1 – v1.20.6)
- Файлов изменено: 7 (components.css, 2 HTML, 2 JS, warehouses.css,
  check-css.js)
- CSS-строк убрано (дубли): ~200
- CSS-строк добавлено (components.css): ~180
- CSS-строк в warehouses.css: 384 → 190

## [1.20.0] - 2026-10-02

**Шаг 1.9: /admin/logs на новом layout**

Страница логов активности переведена на новый layout через
`renderPage()`: sidebar + header + footer через партиалы, тёмная
тема, общие компоненты из `components.css`. Шаблон, CSS и роут
обновлены. JS почти не тронут — только проверка на отсутствие
регрессий.

### Шаг 1.9.1 — views/admin-logs.html → контент-шаблон

**views/admin-logs.html:**
- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`
- Убраны `<link>` на `style.css`, `admin.css`, `logs.css`, `help.css`
- Убраны `<script>` на `main.js`, `logs.js`, `help.js`, `footer.js`
- Убран `#footer-container` (футер в партиале)
- Убран `.toast-container` (в layout)
- `.header` с 4 кнопками (Дашборд / Админ-панель / Профиль / Выйти)
  → `.page-header` + `.page-actions` с одной кнопкой «← Админ-панель»
- `.stats` → `.stats-grid` (общий компонент из `components.css`)
- `.number green` → `.number success`,
  `.number red` → `.number danger`,
  `.number orange` → `.number warning`,
  `.number pink` → `.number accent` (модификаторы `components.css`)
- `.filters-card` → `.card` + `.card-header` + `.card-body`
- Inline-стили на `<th>` (6 колонок) — убраны (ширины через
  `nth-child(N)` в `logs.css`)
- `.btn-back` → `.btn-ghost` (кнопки «Сбросить» / «Обновить»)
- `.filters-form`, `name="..."` всех полей, все `{{...}}` плейсхолдеры
  сохранены — `public/js/logs.js` работает без правок

### Шаг 1.9.2 — public/css/logs.css → тёмная тема + чистка

**public/css/logs.css:**
- Полностью переписан под тёмную тему (переменные `theme.css`)
- Убраны дубли с `components.css`:
  - `.stats` / `.stat-card` / `.number` / `.label` / `.icon`
  - `.number.green` / `.red` / `.orange` / `.pink`
- Все цвета переведены на `var(--*)`:
  - `--bg-primary` / `--bg-secondary` / `--bg-tertiary`
  - `--border` / `--border-light`
  - `--text-primary` / `--text-secondary` / `--text-muted`
  - `--accent` / `--success` / `--warning` / `--danger` / `--purple`
  - `--font-sans` / `--font-mono`
  - `--space-*` / `--radius-*` / `--transition-fast`
- Оставлена специфика:
  - `.filters-form` / `.filter-row` / `.filter-group` /
    `.filter-group-wide` / `.filter-actions`
  - `.logs-table` + ширины колонок через `th:nth-child(N)`
  - `.log-date` (добавлен — в шаблоне используется)
  - `.log-user` / `.log-avatar` / `.log-user-name` / `.log-user-dept`
  - `.log-action` + 8 модификаторов (`-default`, `-login`, `-failed`,
    `-create`, `-update`, `-delete`, `-block`, `-move`)
  - `.log-entity` / `.log-entity-type` / `.log-entity-id`
  - `.log-details` / `.log-detail-key` / `.log-detail-value`
  - `.log-ip`
  - `.pagination` / `.pagination-info` / `.pagination-buttons` /
    `.pagination-btn` (в `components.css` их нет — оставлены локально)
- Адаптивность сохранена: ≤992px скрывает IP, ≤768px — объект и
  детали, `.filter-row` в одну колонку

### Шаг 1.9.3 — routes/admin.js → renderPage

**routes/admin.js:**
- `renderLogs`:
  - `fs.readFile` + `res.send` заменены на `renderPage`
  - переменная `html` переименована в `content`
  - `pageCss: '/css/logs.css'`
  - `pageJs: '/js/logs.js'`
  - `title: 'Логи активности – MoveIT service'`
  - Автоматически подключаются партиалы header/sidebar/footer
    и общие CSS/JS
  - Логика фильтров, `actionNames` (35+ записей), рендер строк,
    пагинация — без изменений
  - **Дополнительно добавлено `escapeHtml`** в 5 местах:
    - `userOptions` (ФИО / username пользователя)
    - `filter.search` (пользовательский ввод)
    - `detailsHtml` (ключи и значения JSON-деталей)
    - `userName` (ФИО пользователя)
    - `log.user_department` (отдел)
    - `log.entity_type` (тип сущности)
    Это закрывает потенциальную XSS через пользовательские данные
    в логах (раньше не экранировалось)
- API-функции (`getLogsAPI`, `cleanLogsAPI` и т.д.) — без изменений

**public/js/logs.js:**
- Не тронут — работает как есть
- `cleanLogs` (prompt + confirm + POST), авто-сабмит `select`
  в `.filters-form` — без изменений

### Проверено

- `/admin/logs` открывается через `renderPage`, партиалы
  (sidebar + header + footer) подгружаются, тёмная тема применяется
- Статистика (7 карточек) на `.stats-grid` с модификаторами
  `accent` / `success` / `danger` / `warning`
- Фильтры: карточка на `.card`, авто-сабмит при смене
  пользователя / действия, поле поиска, даты, «Записей на странице»
- Таблица логов: 6 колонок, аватары, цветные бейджи действий,
  детали через `key: value`, IP
- Пагинация: переход между страницами сохраняет фильтры в URL
- Кнопка «🧹 Очистить старые» — `prompt` + `confirm` + POST
- Пустое состояние: «📭 Логи не найдены»
- Адаптивность: ≤992px — IP скрыт, ≤768px — объект и детали
  скрыты, фильтры в одну колонку
- Sidebar подсвечивает «Логи», Ctrl+K / Ctrl+B работают
- В консоли браузера ошибок нет
- `node scripts/check-css.js` — все переменные `logs.css` объявлены
  в `theme.css`

### Файлы

**Изменены:**
- `views/admin-logs.html`
- `public/css/logs.css`
- `routes/admin.js`
- `package.json`
- `CHANGELOG.md`

**Не тронуты:**
- `public/js/logs.js`
- API-функции в `routes/admin.js`
- `utils/layout.js`

## [1.19.1] - 2026-10-02

**Fix: /api/admin/equipment/filtered возвращал undefined в items/total**

Фикс регрессии, из-за которой на /admin/catalog падала загрузка
техники в секции «🔧 Техника в выбранной категории».

### Причина

- `getEquipmentWithUsers` (`database/modules/equipment.js`) —
  старая версия без поддержки фильтров и пагинации, всегда
  возвращает массив
- `routes/catalog.js` → `getFilteredEquipmentAPI` вызывал её
  с опциями `{ category_id, type_id, search, limit, offset,
  include_total: true }` и ждал объект `{ items, total }`
- Так как функция возвращала массив, `result.items` и `result.total`
  были `undefined` → в JSON они отбрасывались → фронт падал
  на `data.items.length`
- Ошибка в консоли:
  `TypeError: Cannot read properties of undefined (reading 'length')`
  в `catalog.js:604` (`renderEquipmentTable`)

### Решение

- `routes/catalog.js`: `getEquipmentWithUsers` заменён на
  `getEquipmentWithLocation` (функция уже есть в
  `database/modules/equipment.js`, поддерживает фильтры
  `category_id` / `type_id` / `search` / `status` / `warehouse_id`,
  пагинацию `limit` / `offset` и `include_total: true` →
  возвращает `{ items, total, limit, offset }`)
- Добавлена защита в ответе:
  `items: result.items || []`,
  `total: result.total || 0`
- `getEquipmentWithUsers` не трогали — используется в других местах

### Файлы

**Изменены:**
- `routes/catalog.js`

**Не тронуты:**
- `database/modules/equipment.js`
- `public/js/catalog.js`
- `views/admin-catalog.html`

### Проверено

- `/api/admin/equipment/filtered?page=1&limit=20` возвращает
  корректный JSON с `items` и `total`
- `/admin/catalog`: секция техники загружается, фильтр по
  категории / типу работает, поиск работает, пагинация работает
- Остальные страницы (`/equipment`, `/admin`) не сломаны —
  `getEquipmentWithUsers` и `getEquipmentWithLocation` в них
  используются как раньше
- В консоли браузера ошибок нет

### Связанные теги

- v1.19.0 — Шаг 1.8: /admin/catalog на новом layout
- v1.19.1 — фикс регрессии с filtered API

## [1.19.0] - 2026-10-02

**Шаг 1.8: /admin/catalog на новом layout**

Справочник техники переведён на новый layout через `renderPage()`:
sidebar + header + footer через партиалы, тёмная тема, общие
компоненты из `components.css`. Страница собрана из трёх
подшагов — шаблон, CSS, роут. JS не трогали — логика работает
без изменений.

### Шаг 1.8.1 — views/admin-catalog.html → контент-шаблон

**views/admin-catalog.html:**
- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`
- Убраны `<link>` на `style.css`, `admin.css`, `catalog.css`, `help.css`
- Убраны `<script>` на `main.js`, `help.js`, `footer.js`, `catalog.js`
- Убран `#footer-container` (футер в партиале)
- Убран `.toast-container` (в layout)
- `.header` с 4 кнопками (Админ-панель / Дашборд / Профиль / Выйти) →
  `.page-header` + `.page-actions` с одной кнопкой «← Админ-панель»
  (остальные ссылки уже есть в sidebar + header)
- `.stats` → `.stats-grid` (общий компонент из `components.css`)
- `.number green` → `.number success`,
  `.number orange` → `.number warning` (модификаторы из `components.css`)
- Inline `style="font-size: 20px; text-align: center;"` на инпутах
  иконок → класс `.input-emoji`
- `.btn-back` → `.btn-ghost` (во всех кнопках «Отмена»)
- `.modal-body` в `#viewEquipmentModal` — убран (класс не стилизован),
  `id` сохранён для JS
- Все `id` и inline-обработчики (`onclick`, `onsubmit`, `onchange`)
  сохранены — `public/js/catalog.js` работает без правок

### Шаг 1.8.2 — public/css/catalog.css → тёмная тема + чистка дублей

**public/css/catalog.css:**
- Полностью переписан под тёмную тему (переменные `theme.css`)
- Убраны дубли, которые уже есть в `components.css`:
  - `.modal-overlay` / `.modal` / `.modal-header` / `.modal-close`
    / `.modal-actions` / `.modal-body`
  - `.form-group` / `.form-row` / `.form-actions`
  - `.btn-back` (заменён на `.btn-ghost` в шаблоне)
  - `.stats` / `.stat-card` / `.icon` / `.number` / `.label`
    (шаблон теперь на `.stats-grid`)
  - `.badge` / `.badge-*`
- Убраны светлые цвета: `background: white`, `#2d3748`, `#667eea`,
  `#e2e8f0`, `#f7fafc`, `#a0aec0`, `#48bb78` и т.д.
- Все цвета переведены на `var(--*)` из `theme.css`:
  - `--bg-primary` / `--bg-secondary` / `--bg-tertiary` / `--bg-hover`
  - `--border` / `--border-light`
  - `--text-primary` / `--text-secondary` / `--text-muted`
  - `--accent` / `--success` / `--warning` / `--danger` / `--info` / `--purple`
- Оставлена специфика страницы:
  - `.catalog-layout` (2-колоночная сетка)
  - `.catalog-panel` / `.panel-header`
  - `.types-filter`
  - `.catalog-list` + скроллбар
  - `.category-item` / `.type-item` (+ `:hover`, `.selected`)
  - `.btn-action` (локальный 32×32, `.btn-edit` / `.btn-delete`)
  - `.equipment-section` / `.equipment-table` / `.eq-*`
  - `.equipment-pagination` / `.equipment-pagination-btn`
  - `.catalog-empty` / `.catalog-loading` / `.catalog-empty .empty-*`
  - `.category-filter-badge`
- Оставлены классы карточки техники (используются в `public/js/catalog.js`):
  - `.view-user-modal`
  - `.equipment-header-card` / `.equipment-header-icon` / `.equipment-header-info`
    / `.equipment-header-inv` / `.equipment-header-badges`
  - `.user-stats` / `.user-stat` / `.user-stat-number` (+ `.active`,
    `.total`, `.returned`) / `.user-stat-label`
  - `.user-detail-section` / `.detail-grid` / `.detail-item`
  - `.current-user-card` / `.current-user-avatar` / `.current-user-info`
    / `.current-user-name` / `.current-user-dept` / `.current-user-date`
    / `.current-user-status`
  - `.empty-equipment`
  - `.history-table` / `.history-user` / `.history-user-avatar`
  - `.status-badge` + модификаторы `.status-available` / `.status-assigned`
    / `.status-maintenance` / `.status-retired`
- Добавлен `.input-emoji` (был inline-стиль в шаблоне)
- Адаптивность сохранена и адаптирована под тёмную тему

### Шаг 1.8.3 — routes/catalog.js → renderPage

**routes/catalog.js:**
- Импортирован `renderPage` из `utils/layout.js`
- `renderCatalog`:
  - `fs.readFile` + `res.send` заменены на `renderPage`
  - `pageCss: '/css/catalog.css'`
  - `pageJs: '/js/catalog.js'`
  - `title: 'Справочник техники – MoveIT service'`
  - Автоматически подключаются партиалы header/sidebar/footer
    и общие CSS/JS (`theme.css`, `layout.css`, `components.css`,
    `help.css`, `main.js`, `help.js`, `layout.js`)
  - Подстановка `{{total_categories}}` / `{{total_types}}` /
    `{{total_equipment}}` сохранена
- API-функции (14 штук: категории, типы, техника) — без изменений
- `public/js/catalog.js` — без изменений

### Проверено

- `/admin/catalog` открывается через `renderPage`, партиалы
  (sidebar + header + footer) подгружаются, тёмная тема применяется
- Статистика (3 карточки: категории / типы / техника) на `.stats-grid`
- Панели категорий и типов загружаются (8 / 35 записей из seed)
- CRUD категорий и типов работает: модалки, тосты, обновление списка
- Фильтр типов по категории, подсветка `.selected`
- Секция техники: таблица, статус-бейджи, аватары владельцев, пагинация
- Поиск техники: Enter / кнопка / Escape / сброс
- Карточка техники (просмотр): шапка, статистика, детали, владелец,
  история
- Все модалки: закрытие по ✕ / Escape / клику на overlay
- Sidebar подсвечивает активный пункт, Ctrl+K / Ctrl+B работают
- Адаптивность сохранена
- В консоли браузера ошибок нет
- `node scripts/check-css.js` — все переменные `catalog.css` объявлены
  в `theme.css`

### Файлы

**Изменены:**
- `views/admin-catalog.html`
- `public/css/catalog.css`
- `routes/catalog.js`
- `package.json`
- `CHANGELOG.md`

**Не тронуты:**
- `public/js/catalog.js` (логика работает как есть)
- `utils/layout.js`
- API-функции в `routes/catalog.js`

## [1.18.0] - 2026-10-02

**Шаг 1.7: /admin/user/add + /admin/user/edit/:id на новом layout**

Завершён перевод форм пользователя. Страницы `/admin/user/add`
и `/admin/user/edit/:id` собраны через `renderPage()`
(sidebar + header + footer через партиалы), тёмная тема,
общие компоненты из `components.css`. У страниц нет собственного
CSS-файла — только общие слои (`theme.css`, `layout.css`,
`components.css`, `help.css`).

### Шаг 1.7.1 — views/admin-user-add.html → контент-шаблон

**public/css/components.css:**
- Добавлен `.info-box` + `.info-box-icon` + `.info-box p` +
  `.info-box strong` (общий информационный блок для форм)
- Добавлен `.password-warning` (+ `strong`, `p`) — предупреждение
  в модалке временного пароля
- Добавлен `.password-display` (+ `code`) — крупный показ пароля
- Добавлен `.password-username` (+ `strong`, `span`) — логин в модалке
- Все цвета — на переменных `theme.css` (`--info`, `--warning`,
  `--success`, `--bg-*`, `--text-*`, `--font-mono`, `--text-2xl`)

**views/admin-user-add.html:**
- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`
- Убраны `<link rel="stylesheet" href="/css/style.css">` и inline `<style>`
- Убран `<script src="/js/main.js">` и inline `<script>`
- Убран `<div class="toast-container">` (он в layout)
- `.header` + `.back-link` → `.page-header` + `.page-actions`
  с `.btn.btn-ghost.btn-sm`
- `.info-box` — общий из `components.css` (inline-стили убраны)
- Форма обёрнута в `.card` с `.card-header` / `.card-body`
- Кнопка «Отмена» → `.btn.btn-ghost`
- Модалка пароля переведена на `.modal-overlay` + `.modal` +
  `.modal-header` (с `<h3>`) + `.modal-actions`
- Inline-стили модалки (`style="..."`) полностью убраны
- Открытие модалки через `.classList.add('active')`
  (в `components.css` управление через `.modal-overlay.active`)
- Все `id` сохранены: `addUserForm`, `username`, `email`,
  `full_name`, `department`, `phone`, `role`, `submitBtn`,
  `passwordModal`, `tempPasswordValue`, `passwordUsername`

**public/js/admin-user-add.js (новый):**
- Вынесена inline-логика из `<script>` шаблона
- `submitForm(event)` — POST `/api/admin/users`
- `finishCreate()` — редирект на `/admin`
- При успехе — заполняет `#tempPasswordValue` и `#passwordUsername`,
  открывает `#passwordModal` через `.classList.add('active')`
- `console.error` для диагностики ошибок
- Подключается через `pageJs` в `renderPage`

### Шаг 1.7.2 — views/admin-user-edit.html → контент-шаблон

**views/admin-user-edit.html:**
- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`
- Убраны `<link rel="stylesheet" href="/css/style.css">` и inline `<style>`
- Убран `<script src="/js/main.js">` и inline `<script>`
- Убран `<div class="toast-container">` (он в layout)
- `.header` + `.back-link` → `.page-header` + `.page-actions`
- `.id-badge` → `.page-subtitle` «ID: N»
- `.info-box` — общий из `components.css`
- Форма обёрнута в `.card` с `.card-header` / `.card-body`
- Кнопка «Отмена» → `.btn.btn-ghost`
- Роль передаётся через `<input type="hidden" id="currentRole" value="{{role}}">`
  (вместо `{{role}}` внутри `<option selected>`)
- `#userId` — hidden-input, как раньше
- Все `id` сохранены: `editUserForm`, `userId`, `currentRole`,
  `username`, `email`, `full_name`, `department`, `phone`,
  `role`, `submitBtn`
- Плейсхолдеры сохранены: `{{id}}`, `{{role}}`, `{{username}}`,
  `{{email}}`, `{{full_name}}`, `{{department}}`, `{{phone}}`

**public/js/admin-user-edit.js (новый):**
- Вынесена inline-логика
- `userId` и `currentRole` читаются из hidden-inputs
- `roleSelect.value = currentRole` при загрузке
- `submitForm(event)` — PUT `/api/admin/users/:id`
- Валидация: если `userId` нет — тост с ошибкой
- `showToast` на успех / ошибку, редирект на `/admin`
  через 1 секунду после успеха
- Подключается через `pageJs` в `renderPage`

### Шаг 1.7.3 — routes/admin.js → renderPage

**routes/admin.js:**
- `renderAddUser`:
  - `fs.readFile` + `res.send` заменены на `renderPage`
  - `pageJs: '/js/admin-user-add.js'`
  - `pageCss` не передаётся (своего CSS у страницы нет)
  - `title: 'Добавить пользователя – MoveIT service'`
- `renderEditUser`:
  - Подстановка плейсхолдеров сохранена
  - Скаляры экранированы через локальный `escapeHtml`
  - `pageJs: '/js/admin-user-edit.js'`
  - `pageCss` не передаётся
  - `title: 'Редактировать пользователя – MoveIT service'`
  - Убран `{{is_active}}` (в шаблоне не используется)
- API-функции (`addUserAPI`, `updateUserAPI` и т.д.) без изменений

### Проверено

- `/admin/user/add` открывается через `renderPage`, партиалы
  (sidebar + header + footer) подгружаются, тёмная тема применяется
- Форма добавления: все поля работают, сабмит → тост → модалка
  с паролем, кнопка «Понятно, перейти к списку» → редирект на `/admin`
- `/admin/user/edit/:id` открывается через `renderPage`
- Все поля заполнены, роль подставляется в `<select>` из
  `#currentRole`, сабмит → тост → редирект на `/admin`
- Обе страницы: sidebar подсвечивает «Админ-панель», Ctrl+K / Ctrl+B
  работают, dropdown профиля работает, версия в футере — v1.18.0
- Адаптивность сохранена
- В консоли браузера ошибок нет
- `node scripts/check-css.js` — все проверки зелёные
  (объявленные переменные, классы, плейсхолдеры)

### Файлы

**Изменены:**
- `public/css/components.css`
- `routes/admin.js`
- `package.json`
- `CHANGELOG.md`

**Новые:**
- `views/admin-user-add.html` (был отдельный HTML — стал контент-шаблон)
- `views/admin-user-edit.html` (то же)
- `public/js/admin-user-add.js`
- `public/js/admin-user-edit.js`

**Не тронуты:**
- `utils/layout.js` — проверили, `pageCss: null` обрабатывается корректно
- API-функции в `routes/admin.js`

## [1.17.5] - 2026-10-02

**Шаг 1.6: /admin/add + /admin/edit/:id переведены на новый layout**

Этап 1.5 (/admin) закрыт в v1.17.0. Шаг 1.6 завершает перевод
форм техники. Страницы `/admin/add` и `/admin/edit/:id` собраны
через `renderPage()` (sidebar + header + footer через партиалы),
CSS переведён на переменные `theme.css`.

### Шаг 1.6.1 — views/admin-add.html → контент-шаблон

**views/admin-add.html:**
- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`
- Убраны подключения `style.css`, `admin-add.css`, `help.css`,
  `main.js`, `help.js`, `footer.js`, `admin-add.js`
  (всё это подключает `utils/layout.js` через `renderPage`)
- Убран `#footer-container` (футер теперь в партиале)
- Убран `.toast-container` (в layout)
- `.header` + `.back-link` заменены на `.page-header` + `.page-actions`
- Форма обёрнута в `.card` с `.card-header` / `.card-body`
- Секция «Место хранения» — отдельный `.card`
- Кнопки формы — в `.form-actions`
- Убран inline-style у `.help-text` (класс переехал в `components.css`)
- Все `id` элементов сохранены — `admin-add.js` их ждёт
- Функционал не менялся

### Шаг 1.6.2 — views/admin-edit.html → контент-шаблон

**views/admin-edit.html:**
- Убраны `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`
- Убраны подключения `style.css`, `admin-edit.css`, `help.css`,
  `main.js`, `help.js`, `footer.js`, `admin-edit.js`
- Убран `#footer-container` и `.toast-container`
- Вынесен inline `<style>` (`status-warning`, `status-info`,
  `assign-section`, `id-badge`, `location-section`, `location-title`,
  `location-preview`, `location-preview-icon`, `help-text`) —
  стили переехали в `admin-edit.css`
- `.header` + `.back-link` заменены на `.page-header` + `.page-actions`
- `.id-badge` заменён на `.page-subtitle` «ID: N»
- Форма обёрнута в `.card`
- Секция «Место хранения» — отдельный `.card`
- Контекстные блоки (`status-warning`, `status-info`, `assign-section`)
  оставлены внутри основного `.card`
- Скрытые поля (`equipmentId`, `currentStatus`, `currentCategoryId`,
  `currentTypeId`, `currentCellId`) сохранены — `admin-edit.js` их ждёт
- Плейсхолдеры `{{...}}` сохранены (`{{status_options}}`, `{{user_options}}`)
- Функционал не менялся

### Шаг 1.6.3 — CSS: тёмная тема + components.css

**public/css/components.css:**
- Добавлен `.required` (красная звёздочка, `var(--danger)`)
- Добавлен `.help-text` (`var(--text-xs)`, `var(--text-muted)`)
- Понадобятся в 1.7 (`/admin/user/add`, `/admin/user/edit`)

**public/css/admin-add.css:**
- Полностью переписан: убраны `body`, `.container`, `.back-link`
  (светлая тема)
- Оставлена только специфика: `.location-preview`,
  `.location-preview-icon`
- Все цвета — на переменных `theme.css`

**public/css/admin-edit.css:**
- Полностью переписан: убраны `body`, `.container`, `.back-link`
- Оставлена специфика: `.status-warning`, `.status-info`,
  `.assign-section`, `.location-preview`, `.location-preview-icon`
- Уведомления переведены на `rgba`-фон + `var(--warning)` / `var(--info)`
- Секция назначения: `var(--bg-tertiary)` + `border-left var(--accent)`
- Все цвета — на переменных `theme.css`
- Inline `<style>` из `views/admin-edit.html` полностью переехал сюда
- Дубли с `components.css` (`.btn`, `.card`, `.form-group`, `.form-row`,
  `.form-actions`, `.help-text`, `.required`) не создавались

### Шаг 1.6.4 — routes/admin.js → renderPage

**routes/admin.js:**
- `renderAddEquipment`:
  - `fs.readFile` + `res.send` заменены на `renderPage`
  - `pageCss: /css/admin-add.css`, `pageJs: /js/admin-add.js`
  - `title: 'Добавить технику – MoveIT service'`
  - Автоматически подключаются партиалы header/sidebar/footer
    и общие CSS/JS (`theme.css`, `layout.css`, `components.css`,
    `help.css`, `main.js`, `help.js`, `layout.js`)
- `renderEditEquipment`:
  - Подстановка плейсхолдеров сохранена
  - Скалярные значения экранированы через локальный `escapeHtml`
  - Многострочные вставки (`{{status_options}}`, `{{user_options}}`)
    заменяются без флага `/g`
  - `status_options` переведены на русские подписи:
    `✅ Доступна` / `👤 Назначена` / `🔧 В ремонте` / `📦 Списана`
  - В `user_options` строка «— Выберите пользователя —» убрана
    (опция теперь в шаблоне `admin-edit.html`)
  - Финальная сборка через `renderPage`
  - `pageCss: /css/admin-edit.css`, `pageJs: /js/admin-edit.js`
  - `title: 'Редактировать технику – MoveIT service'`
- API-функции не затронуты

### Шаг 1.6.5 — public/js/admin-add.js → чистка

**public/js/admin-add.js:**
- Два обработчика `DOMContentLoaded` объединены в один
  (было: `loadCategories` + плейсхолдер в первом, `loadWarehouses`
  во втором; стало: категории → плейсхолдер → склады в одном)
- Убраны `console.log` (успешные сценарии)
- `console.error` / `console.warn` сохранены для реальных проблем
- Функционал не менялся: каскады склад→зона→стеллаж→ячейка,
  превью адреса, валидация формы, `submitForm` — без изменений
- `escapeHtml` и `generateInventoryNumber` оставлены локально
  (позже уедут в `utils/escape.js` вместе с другими роутами)

**public/js/admin-edit.js:**
- Не трогали — работает как есть

### Проверено

- `/admin/add` открывается через `renderPage`, партиалы
  (sidebar + header + footer) подгружаются, тёмная тема применяется
- Форма добавления: категории загружаются, типы подгружаются
  при выборе категории, каскады места хранения работают,
  превью адреса обновляется, сабмит → тост → редирект на `/admin`
- `/admin/edit/:id` открывается через `renderPage`, поля заполнены,
  место хранения предзаполнено, статус — русские подписи,
  контекстные блоки (`status-warning` / `status-info` /
  `assign-section`) показываются по сценарию
- Обе страницы: sidebar подсвечивает «Админ-панель», Ctrl+K / Ctrl+B
  работают, dropdown профиля в хедере работает, версия в футере — v1.17.5
- Адаптивность сохранена
- В консоли браузера ошибок нет

### Файлы

**Изменены:**
- `views/admin-add.html`
- `views/admin-edit.html`
- `public/css/components.css`
- `public/css/admin-add.css`
- `public/css/admin-edit.css`
- `routes/admin.js`
- `public/js/admin-add.js`

**Не тронуты:**
- `public/js/admin-edit.js`
- API-функции в `routes/admin.js`

### Связанные теги

- v1.17.0 — Этап 1.5: /admin на новом layout (закрыт ранее)
- v1.17.1 — 1.6.1: views/admin-add.html → контент-шаблон
- v1.17.2 — 1.6.2: views/admin-edit.html → контент-шаблон
- v1.17.3 — 1.6.3: CSS admin-add/admin-edit → тёмная тема
- v1.17.4 — 1.6.4: renderAddEquipment/renderEditEquipment → renderPage
- v1.17.5 — 1.6.5: admin-add.js — чистка

## [1.17.0] - 2026-10-02

**🎉 Этап 1.5 завершён: админ-панель (/admin) полностью переведена
на новый layout**

### Итоги:

**Что сделано:**
- Компонент табов (.tabs / .tab-btn / .tab-content) вынесен
  в components.css (v1.16.2)
- views/admin.html переписан в контент-шаблон:
  - Убраны html/head/body, подключения CSS/JS, header-навигация,
    footer-container
  - thead таблицы пользователей приведён к 9 колонкам
    (соответствие renderAdmin — раньше было 6)
  - .btn-back заменён на .btn-ghost
  - Inline-обработчики пока оставлены (рефакторинг на 1.5.6)
  (v1.16.3)
- public/css/admin.css переписан на переменные theme.css:
  - Убраны дубли (.stats, .stat-card, .table-container,
    .table-header, .badge, .modal-*, table/th/td)
  - Все цвета → var(--*)
  - .btn-icon переопределён в .action-buttons (28×28)
  - Цветные модификаторы .btn-icon сохранены
  - .badge-active/-inactive → .badge-count.has-items/.no-items
  (v1.16.4)
- В components.css добавлены стили .table-search (v1.16.4)
- routes/admin.js: renderAdmin переведён на renderPage:
  - Автоматически подключаются партиалы header/sidebar/footer
  - Общие CSS: theme.css, layout.css, components.css, help.css
  - Общие JS: main.js, help.js, layout.js
  - pageCss: /css/admin.css, pageJs: /js/admin.js
  (v1.16.5)
- Проверена совместимость admin.js с новым layout (v1.16.6)
  - Правок не потребовалось

**Файлы, затронутые в Этапе 1.5:**
- public/css/components.css (+ .tabs, + .table-search)
- public/css/admin.css (переписан на переменные)
- views/admin.html (контент-шаблон)
- routes/admin.js (renderAdmin → renderPage)
- public/js/admin.js (проверено, правок не потребовалось)
- CHANGELOG.md

**Что НЕ сделано (отложено на следующие шаги):**
- Inline-обработчики (onclick / onkeyup) → addEventListener
  (шаг 1.5.6)
- Дубли getInitials и formatDate → utils/escape.js и utils/format.js
  (отдельный шаг)
- /admin/add, /admin/edit/:id — на новом layout (шаг 1.6)
- /admin/user/add, /admin/user/edit/:id (шаг 1.7)
- /admin/catalog (шаг 1.8)
- /admin/logs (шаг 1.9)
- /admin/warehouses, /admin/warehouse-details (шаг 1.10)
- /admin/inventory (шаг 1.11)
- /pdf (шаг 1.12)
- Финальная навигация + адаптивность (шаг 1.13)

**Статистика Этапа 1.5:**
- Тегов: 5 (v1.16.2 — v1.16.6) + финальный v1.17.0
- Файлов изменено: 6 (components.css, admin.css, admin.html,
  admin.js routes, admin.js client, CHANGELOG.md)
- CSS-строк удалено (дубли): ~150
- CSS-строк добавлено (components + admin): ~200

Проверено: /admin полностью работает на новом layout,
все модалки, таблицы, поиск, табы, адаптивность — без ошибок.
/admin/add и /admin/edit/:id пока в старом дизайне — это ожидаемо,
они в шаге 1.6.

## [1.16.6] - 2026-10-02

**Админ-панель: проверка совместимости admin.js с новым layout**

### Изменения:

**public/js/admin.js:**
- Правок не потребовалось — файл полностью совместим с новым layout.

### Проверено на совместимость:

**Конфликты глобальных имён (main.js, layout.js vs admin.js):**
- showToast — из main.js, используется в admin.js (без переопределения) ✓
- getInitials — определён и в layout.js, и в admin.js (идентичные
  реализации, перезапись безопасна, дополнительной логики нет) ✓
- formatDate — определён и в main.js (длинный формат), и в admin.js
  (относительное время). На /admin подключается admin.js — побеждает
  его версия. Так как admin.js работает только на /admin,
  конфликта нет. Оставлено намеренно: на /admin нужно относительное
  время («5 мин назад»), а не длинная дата. ✓

**Глобальные обработчики событий:**
- Escape: и main.js, и admin.js вешают обработчик на keydown.
  Оба срабатывают — main.js снимает .active со всех модалок,
  admin.js дополнительно сбрасывает переменные (deleteId,
  currentTempPassword и т.д.). Дублирование безопасное, дополнительная
  логика admin.js полезна. ✓
- Клик на .modal-overlay: аналогично — main.js снимает .active,
  admin.js вызывает свои close-функции. ✓

**Inline-обработчики (onclick / onkeyup):**
- switchTab использует event.target — доступен, т.к. inline onclick
  сохраняет глобальный event. ✓
- searchTable — работает. ✓
- Все кнопки действий (viewEquipment, editEquipment, deleteUser и т.д.)
  — работают. ✓

**Модалки:**
- .modal-overlay.active — из components.css, совместимо. ✓

### Примечание:
- Микро-рефакторинг (вынос getInitials и formatDate в utils/escape.js
  и utils/format.js) отложен до отдельного шага.
- Удаление inline-обработчиков (onclick → addEventListener)
  запланировано на 1.5.6.

Проверено: /admin работает, все модалки открываются и закрываются,
toast-уведомления показываются, поиск в таблицах работает,
горячие клавиши Ctrl+K / Ctrl+B — работают.

## [1.16.5] - 2026-10-02

**Админ-панель: renderAdmin переведён на renderPage**

### Изменения:

**routes/admin.js:**
- Импортирован renderPage из utils/layout.js:
  `const { renderPage } = require('../utils/layout');`
- В renderAdmin финальный res.send(html) заменён на renderPage({...})
- Страница /admin теперь собирается через общий layout:
  - Автоматически подключаются партиалы header / sidebar / footer
  - Общие CSS: theme.css, layout.css, components.css, help.css
  - Общие JS: main.js, help.js, layout.js
  - pageCss: /css/admin.css
  - pageJs: /js/admin.js
- title: 'Админ-панель – MoveIT service'

**Не тронуто в этом шаге:**
- renderAddEquipment, renderEditEquipment — отдельные шаги (1.6)
- renderAddUser, renderEditUser — отдельные шаги (1.7)
- renderLogs — отдельный шаг (1.9)
- Локальные хелперы escapeHtml / escapeAttr / getInitials оставлены
  в routes/admin.js (позже уедут в utils/escape.js)
- API-функции (addEquipmentAPI, updateUserAPI и т.д.) без изменений

Проверено: /admin открывается, партиалы (sidebar + header + footer)
подгружаются, тёмная тема применяется, табы переключаются,
таблицы техники (10 колонок) и пользователей (9 колонок) отрисованы,
модалки (удаление, пароль, просмотр, перемещение) работают,
поиск в таблицах работает, адаптивность сохранена.

## [1.16.4] - 2026-10-02

**Админ-панель: перевод CSS на тёмную тему и общие компоненты**

### Изменения:

**public/css/admin.css:**
- Полностью переписан под тёмную тему (переменные theme.css)
- Убраны дубли, которые уже есть в components.css:
  - .stats / .stat-card / .number / .label / .icon
  - .tabs / .tab-btn / .tab-content (перенесены в components.css)
  - .table-container / .table-header / table / th / td
  - .badge / .badge-active / .badge-inactive
  - .modal-header / .modal-close
  - .table-search input (перенесено в components.css)
- Все цвета переведены на var(--*) из theme.css
- .btn-icon переопределён локально в .action-buttons (28×28) —
  глобальный .btn-icon в components.css остаётся 36×36
- Цветные модификаторы .btn-icon (.btn-info, .btn-edit, .btn-warning,
  .btn-success, .btn-delete, .btn-move) сохранены как специфика /admin
- .badge-active / .badge-inactive заменены на
  .badge-count.has-items / .badge-count.no-items
- Свои стили оставлены: .assigned-cell, .location-cell, .catalog-badge,
  .user-cell, .role-badge, .status-badge, .action-buttons,
  .password-modal, .view-user-modal, .user-header-card,
  .equipment-header-card, .user-stats, .detail-grid, .equipment-cards,
  .current-user-card, .empty-equipment, .history-table, .delete-warning,
  .move-modal, .move-equipment-info, .move-current-location,
  .move-preview, .location-detail-item, .btn-move-inline, .id-badge,
  .row-blocked
- Адаптивность сохранена и адаптирована под новые размеры

**public/css/components.css:**
- Добавлена секция "Поиск в таблицах" (.table-search и input):
  - Раньше стили были только в admin.css (светлые)
  - Теперь общие на переменных theme.css
  - Понадобится на /users, /admin/catalog и других страницах

**routes/admin.js:**
- В renderAdmin заменён класс счётчика ТМЦ:
  - было: .badge .badge-active / .badge-inactive
  - стало: .badge-count.has-items / .badge-count.no-items
- Причина: классы .badge-active / .badge-inactive удалены вместе с дублями,
  счётчик ТМЦ теперь использует новый компонент .badge-count

Связанные подшаги Этапа 1.5 (без отдельных тегов):
- v1.16.2 — .tabs / .tab-btn / .tab-content вынесены в components.css
- v1.16.3 — views/admin.html переведён в контент-шаблон
  (thead таблицы пользователей приведён к 9 колонкам,
  .btn-back заменён на .btn-ghost, убраны html/head/body
  и подключения CSS/JS)

Проверено: админ-панель открывается, табы переключаются,
таблицы техники и пользователей отображаются,
модалки (удаление, пароль, просмотр, перемещение) работают,
поиск в таблицах стилизован, адаптивность сохранена.

## [1.16.1] - 2026-10-02

**Личный кабинет полностью переведён на новый дизайн**

### Изменения: ###

**views/profile.html:**
- Превращён в контент-шаблон без `<html>/<head>/<body>`
- Убраны inline `<style>` и старые подключения CSS/JS
- Убраны кнопки 'Сменить пароль'/'Выйти' — теперь в хедере
- Убран блок #adminLinks — в новом layout админ-ссылки
  видны в sidebar
- Профиль, техника, история обёрнуты в .card из components.css
- Бейджи статусов через .badge-*

**routes/profile.js:**
- Использован renderPage() из utils/layout.js
- Локальные хелперы escapeHtml/formatDate/emptyRow
- Параллельная загрузка данных через Promise.all
- Логика updateProfileAPI не изменилась

**public/css/profile.css:**
- Полностью переписан под тёмную тему (переменные theme.css)
- Свои стили: только .profile-card, .profile-grid, .profile-item
- Всё остальное — из components.css
- Адаптивность для узких экранов

**public/js/profile.js:**
- Убран блок DOMContentLoaded с adminLinks (не нужен)
- Логика toggleEditProfile/saveProfile сохранена

Проверено: layout, редактирование профиля, сохранение,
таблицы, пустые состояния, адаптивность."

## [1.16.0] - 2026-10-02

### Изменения:
**Полностью переработана страница пользователей под новый дизайн**
- (sidebar + header + footer через utils/layout.js).

**views/users.html:**
- Превращён в контент-шаблон без `<html>/<head>/<body>`
- Убраны inline `<style>` и старые подключения CSS/JS
- Убраны кнопки навигации (Главная / Профиль / Выйти) — теперь
  они в хедере и sidebar
- Добавлен плейсхолдер {{admin_actions}} для кнопки
  'Добавить пользователя' (только для админов)
- Добавлено пустое состояние для случая, когда пользователей нет

**routes/users.js:**
- Использован renderPage() из utils/layout.js
- Добавлены локальные хелперы escapeHtml/escapeAttr/getInitials
- Условное отображение кнопки добавления по роли пользователя
- Атрибут data-search на строке — для быстрой клиентской фильтрации
- Обработка пустого списка пользователей

**public/css/users.css (новый):**
- Только специфичные для страницы стили (.user-cell,
  .user-avatar, .id-badge, .text-mono, .equipment-list-cell)
- Всё остальное берётся из theme.css и components.css
- Адаптивность: скрытие неважных колонок на узких экранах

**public/js/users.js (новый):**
- Поиск по таблице через data-search
- Автофокус на поле поиска при загрузке

Проверено: layout, sidebar-подсветка, поиск, адаптивность."

## [1.15.1] - 2026-10-01

### Добавлено

**Новые стили отображения**
- **Полностью переработан дизайн страниц**
  - В новом чтиле переработаны главная страница и страница техники
  - Добавлен layuot для отрисовки страниц
  - добавлены партиалы для футера, хедера и сайдбара
  - сборка страниц единоообразно


## [1.15.0] - 2026-10-01

**🎉 Финальный релиз: полная система учёта техники с адресным хранением**

### Добавлено

**Финальная документация (этап 8):**
- Полностью обновлён `README.md`:
  - Актуальное описание проекта "MoveIT service"
  - Раздел "Склады и адресное хранение" (7 подразделов)
  - Обновлённая структура проекта (10+ новых файлов)
  - API-раздел (35+ endpoints)
  - История версий (1.4.0 — 1.15.0)
  - Roadmap
- Обновлён `CHANGELOG.md`:
  - Полная история всех изменений
  - Категории "Добавлено", "Изменено", "Исправлено", "Удалено"
- Создан `VERSION.md`:
  - Полное описание версии 1.15.0
  - Итоги работы по складам
  - Список файлов и функций

### Итоги разработки

**Полностью реализовано:**

1. **Аутентификация и авторизация** (v1.4.0)
   - Вход/выход, смена пароля
   - Роли: админ/пользователь
   - Сессии в SQLite
   - Блокировка пользователей
   - Синхронизация сессии с БД

2. **Дашборд** (v1.5.0)
   - 6 карточек статистики
   - SVG-график активности
   - Последние действия
   - "Требует внимания"
   - Топ пользователей
   - Статистика по категориям

3. **Справочник техники** (v1.7.0 — v1.8.0)
   - 8 категорий, 35 типов
   - CRUD в админке
   - Фильтрация и поиск
   - Карточка техники с историей

4. **Склады и адресное хранение** (v1.10.0 — v1.14.0)
   - 4-уровневая иерархия: Склад → Зона → Стеллаж → Ячейка
   - CRUD всех уровней
   - Привязка техники к ячейкам
   - Логика "назначение обнуляет cell_id"
   - Инвентаризация по складам
   - Экспорт в CSV
   - Перемещение техники

5. **Логирование** (v1.4.0+)
   - 25+ типов действий
   - Фильтры, поиск, пагинация
   - Красивые бейджи
   - Статистика

### Статистика проекта

| Метрика | Значение |
|---------|----------|
| **Всего версий** | 21+ |
| **Файлов в проекте** | 80+ |
| **Строк кода** | 20000+ |
| **Таблиц в БД** | 11 |
| **API endpoints** | 60+ |
| **Функций БД** | 80+ |
| **Функций JS** | 100+ |
| **CSS-классов** | 500+ |

### Файлы

**Новые в v1.15.0:**
- `VERSION.md` — полное описание версии

**Обновлены:**
- `README.md` — полностью актуализирован
- `CHANGELOG.md` — добавлен раздел [1.15.0]
- `package.json` — версия 1.15.0, автор, keywords

### Проверено
- Все страницы работают
- Все API endpoints отвечают
- Все функции БД выполняются
- Документация соответствует реальности
- Версии синхронизированы

## [1.14.0] - 2026-10-01

### Добавлено

**Перемещение техники между ячейками (этап 7):**
- **Кнопка "🔄 Переместить"** в таблице `/admin` — для техники не в статусе `assigned`
- **Модальное окно перемещения**:
  - Информация о технике (название, инв. номер)
  - Текущее место хранения
  - 4 каскадных селекта: Склад → Зона → Стеллаж → Ячейка
  - Опция "Убрать из ячейки" (склад = пусто)
  - Превью нового адреса
  - Поле "Комментарий" (логируется)
  - Валидация: запрет перемещения назначенной техники
  - Валидация: проверка capacity ячейки
- **Кнопка "🔄 Переместить"** в карточке техники (модалка просмотра):
  - Если есть ячейка — "Переместить"
  - Если нет — "Разместить"
- **История перемещений** логируется в `activity_log`
- **Красивый бейдж "🔄 Перемещение техники"** в логах (фиолетовый)

### API (2 новых endpoints)
- `POST /api/admin/equipment/:id/move` — переместить технику
- `GET /api/admin/equipment/:id/moves` — история перемещений

### Функции БД (2 новых)
- `moveEquipmentToCellDetailed(equipmentId, cellId, userId, userName)` — перемещение с валидацией
- `getEquipmentMoves(equipmentId)` — история из activity_log

### Логика перемещения
- **Нельзя переместить** назначенную технику (`status === 'assigned'`)
- **Проверка capacity**: ячейка не должна быть переполнена
- **Не перемещает** в ту же ячейку (сообщение "уже в этой ячейке")
- **Логирует** с полной информацией:
  - `inventory_number`, `equipment_name`
  - `from_cell`, `to_cell`
  - `to_warehouse`, `to_zone`, `to_rack`
  - `notes`

### Файлы (изменено)
- `database/modules/equipment.js` — 2 новые функции
- `routes/admin.js` — 2 API + обновление `actionNames` + кнопка в таблице
- `server.js` — 2 роута
- `views/admin.html` — модалка `moveEquipmentModal`
- `public/js/admin.js` — 9 функций перемещения + кнопка в карточке
- `public/css/admin.css` — стили `.btn-move`, `.move-modal`, `.btn-move-inline`
- `public/css/logs.css` — `.log-action-move`
- `package.json`, `CHANGELOG.md`, `README.md`

### Проверено
- Перемещение через таблицу работает
- Перемещение через карточку работает
- Каскадные селекты работают
- Превью обновляется
- Валидация срабатывает
- Логирование корректное
- Назначенная техника не перемещается
- Никаких ошибок в консоли

## [1.13.0] - 2026-10-01

### Добавлено

**Инвентаризация по складам (этап 6):**
- **Страница `/admin/inventory`** — обзор всех складов:
  - 6 карточек общих итогов (складов, зон, стеллажей, ячеек, техники на складах, назначено)
  - Warning-блок если есть техника без ячейки
  - Сводка по складам: карточки с прогресс-барами заполненности
  - Мини-статистика по каждому складу (зоны, стеллажи, ячейки, техника)
  - Кнопки "📋 Открыть инвентаризацию" и "🏢 Дерево склада"
- **Модалка деталей склада**:
  - Заголовок с иконкой и адресом
  - 2 вкладки:
    - 🔧 **Техника** — таблица всех единиц на складе с полным адресом
    - 📍 **Заполненность** — список ячеек с процентами
  - Кнопки "🏢 Дерево склада" и "📥 Экспорт в CSV"

**Фильтр по складу на `/equipment`:**
- Новый селект "Склад" (4-й фильтр)
- Опции: "Все склады", "— Не на складе —", конкретные склады
- Комбинируется с другими фильтрами

**Экспорт в CSV:**
- `GET /api/admin/warehouses/:id/inventory/export`
- Формат CSV с BOM (UTF-8) для Excel
- Заголовки: Инв. номер, Название, Модель, Производитель, Категория, Тип, Место хранения, Статус
- Итоговая строка с количеством

### API (7 новых endpoints)
- `GET /api/admin/inventory/summary` — сводка по складам
- `GET /api/admin/inventory/totals` — общие итоги
- `GET /api/admin/warehouses/:id/inventory` — техника на складе
- `GET /api/admin/warehouses/:id/occupancy` — заполненность ячеек
- `GET /api/admin/warehouses/:id/inventory/export` — экспорт в CSV
- `GET /admin/inventory` — страница инвентаризации

### Функции БД (4 новых)
- `getInventorySummary()` — сводка по складам с процентами
- `getWarehouseInventory(warehouseId)` — техника на складе
- `getCellOccupancy(warehouseId)` — заполненность ячеек
- `getInventoryTotals()` — общие итоги

### Файлы (новые)
- `views/admin-inventory.html` — страница инвентаризации
- `public/css/inventory.css` — стили (534 строки)
- `public/js/inventory.js` — логика (12 функций)

### Изменено
- `server.js` — 6 роутов инвентаризации
- `views/admin.html` — кнопка "📊 Инвентаризация"
- `views/dashboard.html` — quick-action
- `routes/equipment.js` — 4-й фильтр (склад)
- `views/equipment.html` — селект "Склад"
- `public/js/equipment-filter.js` — фильтр по складу
- `package.json`, `CHANGELOG.md`, `README.md`

### Проверено
- Страница инвентаризации работает
- 6 карточек итогов
- Warning-блок
- 2 карточки складов с прогресс-барами
- Модалка с 2 вкладками
- Экспорт в CSV работает
- Фильтр по складу работает
- Комбинация фильтров работает
- Никаких ошибок в консоли

## [1.12.0] - 2026-10-01

### Добавлено

**Привязка техники к ячейкам (этап 5):**
- **Форма создания/редактирования техники** — блок "📍 Место хранения":
  - 4 каскадных селекта: Склад → Зона → Стеллаж → Ячейка
  - Предзаполнение при редактировании
  - Превью адреса
- **Отображение места хранения**:
  - В таблице `/admin` — колонка "Место хранения"
  - В таблице `/equipment` — колонка "Место хранения"
  - В карточке техники (модалка) — блок "📍 Место хранения"
- **Логика "назначение обнуляет cell_id"**:
  - При назначении пользователю → `cell_id = NULL`
  - При возврате → `cell_id = NULL`
  - При смене статуса `assigned → available` → `cell_id = NULL`
- **API** `getEquipmentWithLocation`:
  - Полный адрес (склад, зона, стеллаж, ячейка)
  - Фильтры (category_id, type_id, status, warehouse_id, search)
  - Пагинация
  - Поиск по `cell.code`

### Изменено
- `database/modules/equipment.js`:
  - `getEquipmentById` — JOIN с cells/racks/zones/warehouses
  - `getEquipmentWithLocation` — новая функция
  - `addEquipment`, `updateEquipment` — принимают `cell_id`
  - `assignEquipment`, `returnEquipmentByEquipmentId` — обнуляют `cell_id`
  - `updateEquipment` — при `assigned → available` принудительно `cell_id = NULL`
- `routes/admin.js`:
  - `renderAdmin` — использует `getEquipmentWithLocation`
  - `addEquipmentAPI`, `updateEquipmentAPI` — принимают `cell_id`
  - `updateEquipmentAPI` — `finalCellId` для логики назначения
  - `renderEditEquipment` — передаёт `cell_id`
  - `getEquipmentDetailsAPI` — для карточки техники
- `routes/equipment.js` — использует `getEquipmentWithLocation`
- `public/js/admin-add.js`, `admin-edit.js` — каскадные селекты
- `public/js/admin.js` — место хранения в карточке
- `views/admin-add.html`, `admin-edit.html` — блок "Место хранения"
- `views/admin.html`, `equipment.html` — колонка "Место хранения"
- `public/css/admin.css`, `equipment.css` — стили `.location-cell`
- `public/js/equipment-filter.js` — `colspan="8"`

### Проверено
- Техника сохраняется с `cell_id`
- Место хранения отображается везде
- Назначение обнуляет `cell_id`
- Возврат обнуляет `cell_id`
- Прямое назначение через форму работает
- История использования показывает владельца
- Таблица админки корректно отображается

## [1.11.0] - 2026-10-01

### Добавлено

**Иерархия складов (этап 4):**
- **Страница деталей склада** `/admin/warehouses/:id`:
  - Информация о складе (название, адрес, описание, бейджи)
  - Кнопки "✏️ Редактировать" и "➕ Добавить зону"
  - **Дерево структуры**: Зоны → Стеллажи → Ячейки
  - Разворачивание / сворачивание (по клику или кнопкам "Развернуть всё" / "Свернуть всё")
  - Обновление структуры
- **CRUD для всех уровней иерархии**:
  - Зоны: создание, редактирование, удаление
  - Стеллажи: создание, редактирование, удаление
  - Ячейки: создание, редактирование, удаление
- **Просмотр ячейки** — модальное окно с:
  - Информацией о ячейке (вместимость, склад, зона, стеллаж)
  - Списком техники в ячейке
  - Цветными бейджами статусов
- **Кнопка "📦 Открыть"** в карточке склада — переход к деталям
- **Полный API** для иерархии (17 новых endpoints):
  - Зоны: `getZonesAPI`, `createZoneAPI`, `updateZoneAPI`, `deleteZoneAPI`
  - Стеллажи: `getRacksAPI`, `createRackAPI`, `updateRackAPI`, `deleteRackAPI`
  - Ячейки: `getCellsAPI`, `getCellAPI`, `getCellEquipmentAPI`, `createCellAPI`, `updateCellAPI`, `deleteCellAPI`

### Изменено
- `routes/warehouses.js`: расширен с 10 до **25 функций**
- `server.js`: добавлены 17 роутов для иерархии
- `public/js/warehouses.js`: кнопка "📦 Открыть" в карточке склада
- `views/admin-warehouse-details.html`: подключён новый CSS

### Файлы

**Новые:**
- `views/admin-warehouse-details.html` — страница деталей склада
- `public/css/warehouse-details.css` — стили дерева (609 строк)
- `public/js/warehouse-details.js` — логика дерева (30 функций)

**Изменённые:**
- `routes/warehouses.js`: +15 функций (зоны, стеллажи, ячейки, страница деталей)
- `server.js`: +17 роутов
- `public/js/warehouses.js`: кнопка "📦 Открыть"
- `public/css/warehouses.css`: стиль `<a>` в actions
- `package.json`: версия 1.11.0
- `CHANGELOG.md`: раздел [1.11.0]

### Проверено
- Страница деталей открывается
- Дерево отображается корректно
- Разворачивание / сворачивание работает
- CRUD для зон, стеллажей, ячеек работает
- Просмотр ячейки с техникой
- Никаких ошибок в консоли
- Все 30 функций JS на месте

## [1.10.0] - 2026-10-01

### Добавлено

**Склады и адресное хранение (этап 1):**
- **4 новые таблицы**:
  - `warehouses` — склады
  - `zones` — зоны внутри склада
  - `racks` — стеллажи внутри зоны
  - `cells` — ячейки внутри стеллажа
- **Поле `cell_id` в `equipment`** — ссылка на ячейку хранения
- **28 функций** в модуле `database/modules/warehouses.js`:
  - CRUD для всех 4 уровней иерархии
  - `getWarehouseTree` — дерево для UI
  - `moveEquipmentToCell` — перемещение с проверкой capacity
  - `getCellFullPath` — полный адрес
  - `getWarehouseStats` — статистика
- **Страница `/admin/warehouses`** — управление складами:
  - Карточки с иконкой, адресом, описанием
  - Счётчики: зоны, стеллажи, ячейки, техника
  - Бейджи: "⭐ По умолчанию", "✅ Активен" / "🚫 Неактивен"
  - CRUD через модальные окна
  - Установка склада по умолчанию (⭐)
  - Удаление с предупреждением о связанных данных
- **API** (10 endpoints):
  - `/api/admin/warehouses` — CRUD
  - `/api/admin/warehouses/:id/set-default`
  - `/api/admin/warehouses/tree`
  - `/api/admin/warehouses/stats`
- **Навигация**: кнопка "🏢 Склады" в админке и на дашборде

**Начальные данные (seed в migrate):**
- 2 склада: "Основной офис" (default) + "Удалённый офис"
- 3 зоны: A, B, Основная
- 4 стеллажа
- 17 ячеек с кодами (A-01-01, A-02-01, B-01-01, C-01-01...)

### Защита данных
- Нельзя удалить склад по умолчанию
- Нельзя удалить склад с зонами
- Нельзя удалить зону со стеллажами
- Нельзя удалить стеллаж с ячейками
- Нельзя удалить ячейку с техникой
- Проверка capacity при перемещении техники
- `ON DELETE CASCADE` для иерархии
- `ON DELETE SET NULL` для `equipment.cell_id`
- Транзакции при смене склада по умолчанию

### Файлы

**Новые:**
- `database/modules/warehouses.js` — 28 функций
- `routes/warehouses.js` — 10 функций
- `views/admin-warehouses.html` — страница
- `public/css/warehouses.css` — стили (384 строки)
- `public/js/warehouses.js` — логика (12 функций)

**Изменённые:**
- `database/db.js` — импорт модуля warehouses
- `scripts/migrate.js`:
  - +4 таблицы (warehouses, zones, racks, cells)
  - +поле cell_id в equipment
  - +9 индексов
  - функция `seedWarehouses` (полный seed)
  - обновлена итоговая статистика
- `server.js` — 10 роутов
- `views/admin.html` — кнопка "🏢 Склады"
- `views/dashboard.html` — quick-action
- `package.json` — версия 1.10.0

### Проверено
- Миграция проходит чисто
- Seed создаёт 2/3/4/17 элементов
- Все 28 функций модуля работают
- Страница открывается корректно
- CRUD работает
- Счётчики заполнены
- Всё через API


## [1.9.0] - 2026-09-22

### Добавлено
- **Интеграция справочника в формы техники**:
  - Форма создания `/admin/add`: селекты "Категория → Тип"
  - Форма редактирования `/admin/edit/:id`: те же селекты + предзаполнение
  - Динамическая загрузка типов при смене категории
  - Автосброс типа при смене категории
  - Валидация: категория и тип обязательны

- **Отображение категорий и типов в списках**:
  - `/equipment`: колонки "Категория" и "Тип" с бейджами
  - `/admin`: то же в таблице техники

- **Фильтры на странице `/equipment`** (для всех пользователей):
  - Фильтр по категории
  - Фильтр по типу (динамический)
  - Фильтр по статусу (через CSS-класс)
  - Кнопка "Сбросить"
  - Пустое состояние
  - Отдельные CSS/JS файлы

- **Статистика на дашборде**:
  - Блок "📚 Техника по категориям":
    - Список категорий с количеством и процентом
    - Цветные полосы-диаграммы
    - Клик → переход в справочник
  - Блок "🏷️ Техника без категории":
    - Список единиц без категории
    - Или "✅ Вся техника имеет категорию"

### Изменено
- `getAllEquipment` в `database/modules/equipment.js` — добавлены JOIN-ы для категорий и типов
- `addEquipmentAPI`, `updateEquipmentAPI` — принимают `category_id`, `type_id`
- `renderEditEquipment` — передаёт `category_id`, `type_id` в шаблон
- `routes/equipment.js` — рендер с фильтрами
- Дашборд-карточки: top-users выровнены через CSS Grid

### Добавлено в БД
- `getCategoryStats()` — статистика по категориям
- `getEquipmentWithoutCategory()` — техника без категории

### Файлы
- `public/css/equipment.css` — новый (стили страницы /equipment)
- `public/js/equipment-filter.js` — новый (логика фильтрации)
- `public/js/admin-add.js` — обновлён
- `public/js/admin-edit.js` — обновлён
- `views/admin-add.html`, `views/admin-edit.html` — обновлены
- `views/admin.html`, `views/equipment.html` — обновлены
- `views/dashboard.html` — новые блоки
- `public/css/dashboard.css` — стили статистики + grid-выравнивание

### Проверено
- Все формы работают со справочником
- Списки показывают категории и типы
- Фильтры на /equipment работают
- Дашборд показывает статистику по категориям
- seed корректно заполняет category_id и type_id

...

## [1.8.0] - 2026-09-22

### Добавлено
- **Справочник техники** — полная реализация:
  - Страница `/admin/catalog` с двумя панелями (категории + типы)
  - 8 категорий и 35 типов в начальных данных
  - CRUD категорий и типов через модальные окна
  - Защита от удаления: нельзя удалить категорию с типами,
    нельзя удалить тип с привязанной техникой
  - Фильтр типов по категории
  - Клик по категории/типу — фильтрация + подсветка

- **Таблица техники в справочнике**:
  - Автозагрузка при выборе категории или типа
  - Колонки: инв. номер, название, модель, статус, владелец, действия
  - **Поиск по 6 полям**: инв. номер, название, модель, серийный номер,
    ФИО владельца, логин владельца
  - Кнопка "🔍 Найти" + Enter для запуска поиска
  - Кнопка "✕" + Escape для сброса
  - Пагинация по 20 записей
  - Кнопки действий: 👁️ (карточка техники) и ✏️ (редактирование)
  - Счётчики техники по категориям и типам

- **Карточка техники** (модальное окно):
  - Полная информация (модель, производитель, S/N, гарантия)
  - Категория и тип
  - Текущий владелец с аватаром
  - История использования с пользователями

- **API** (15 endpoints):
  - CRUD категорий (6 endpoints)
  - CRUD типов (6 endpoints)
  - Фильтр техники `GET /api/admin/equipment/filtered`
  - Счётчики `GET /api/admin/equipment/counts`

### Изменено
- `getEquipmentWithUsers` в `database/modules/equipment.js`:
  - Поддержка фильтров `category_id`, `type_id`, `search`
  - Поддержка пагинации (`limit`, `offset`)
  - Опциональный `include_total` для счётчика
  - Поиск теперь ищет и по владельцу
  - Обратная совместимость: без аргументов — массив

- `views/admin.html`: добавлена кнопка "📚 Справочник" в шапке
- `views/dashboard.html`: добавлена quick-action "Справочник"
- `views/admin-catalog.html`: 
  - Убрана передача данных через `window.categoriesData`
  - Данные загружаются через API (fetch)
  - Добавлена секция таблицы техники

### Технические детали
- Поиск в таблице: debounce убран, вместо него — кнопка "Найти"
- Данные загружаются через `fetch` — меньше проблем с IDE
- Модалки закрываются по Escape и клику на оверлей
- Адаптивность на 992px и 640px
- Прогрессивная загрузка с индикатором

### Файлы
- `routes/catalog.js` — новый (15 функций)
- `views/admin-catalog.html` — новый
- `public/css/catalog.css` — новый (770 строк)
- `public/js/catalog.js` — новый (27 функций)
- `database/modules/equipment.js` — расширено
- `server.js` — подключены роуты
- `views/admin.html`, `views/dashboard.html` — ссылки


## [1.7.1] - 2026-09-22

### Изменено
- **Рефакторинг `database/db.js`** — разбит на 9 модулей:
  - `modules/users.js` — CRUD пользователей
  - `modules/equipment.js` — техника + назначения
  - `modules/catalog.js` — категории и типы
  - `modules/auth.js` — пароли, роли, сессии
  - `modules/profile.js` — личный кабинет
  - `modules/logs.js` — логи активности
  - `modules/dashboard.js` — дашборд
  - `modules/stats.js` — общая статистика
  - `modules/meta.js` — app_meta
- `db.js` теперь **~110 строк** вместо ~1500
- Все функции разбиты по доменам, легко найти нужную

### Удалено
- 14 функций мёртвого кода:
  - `initDatabase`, `insertTestData` (заменены на `migrate.js` и `seed.js`)
  - `getUserByUsername`, `addUser`, `updateUser`, `deleteUser`
  - `getUsersWithActiveEquipment`, `getEquipmentByInventory`
  - `returnEquipment`, `getUserEquipment`
  - `getUserByEmailWithPassword`, `getAvailableEquipment`
  - `setUserRole`, `checkDataIntegrity`

### Исправлено
- `server.js`: убран вызов `initDatabase()` (заменён на `migrate.js`)
- Добавлена проверка подключения к БД с понятным сообщением

### Добавлено
- `.gitignore`: правила для бэкапов (`*.backup`, `*.bak`, `*.old`)
- Единый стиль JSDoc во всех модулях

## [1.7.0] - 2026-09-22
...
## [1.6.0] - 2026-09-21

### Добавлено
- **Скрипт seed** для заполнения БД тестовыми данными:
  - 16 пользователей (2 админа + 14 обычных)
  - 40 единиц техники разных категорий
  - ~24 активных назначений + ~15 возвращённых
  - 150 записей логов активности
  - `npm run seed` — заполнить
  - `npm run seed -- --force` — перезаписать
  - `npm run setup` — миграция + заполнение
- **API `/api/version`** — публичный эндпоинт версии
- **Централизованная версия** — только в package.json
- **Футер на всех страницах** через `<div id="footer-container">`
- **Таблица `app_meta`** — служебные данные (версия БД)
- **Синхронизация сессий с БД** — `syncSession` middleware

### Безопасность
- Проверка существования пользователя на каждом запросе
- Проверка активности, роли, логина
- Проверка версии БД (защита от seed --force с активной сессией)
- Очистка файла `sessions.db` при seed --force

### Исправлено
- Дашборд: список просроченной гарантии (было только число)
- Профиль: кнопки "Дашборд" и "Админ-панель" для админа
- Страница смены пароля: карточка текущего пользователя

### Изменено
- `middleware/auth.js`: `syncSession` + `destroySession`
- `routes/auth.js`: сохранение `dbVersion` при логине
- `public/js/footer.js`: загрузка версии с сервера
- `views/profile.html`: `data-is-admin` + `adminLinks`

...

## [1.5.5] - 2026-09-21

### Добавлено
- **Скрипт seed** (`scripts/seed.js`) — заполняет БД тестовыми данными:
  - 16 пользователей (2 админа + 14 обычных)
  - 40 единиц техники (разные категории)
  - ~24 активных назначения
  - ~15 возвращённых (история)
  - 150 записей логов
- **npm run seed** — заполнить БД
- **npm run seed -- --force** — перезаписать данные
- **npm run setup** — миграция + заполнение одной командой

### Изменено
- package.json: добавлен скрипт `seed`, обновлён `setup`
- README.md: инструкция по быстрому старту

### Как использовать
bash
# Первый запуск (структура + данные)
npm run setup

# Только заполнить данными
npm run seed

# Перезаписать всё
npm run seed -- --force

...

## [1.5.4] - 2026-09-21

### Добавлено
- **Футер на дашборде** — теперь отображается на всех страницах проекта
- **API `/api/version`** — публичный эндпоинт для получения актуальной версии
- **Централизованное управление версией** — версия хранится только в `package.json`

### Изменено
- `footer.js` — загружает версию с сервера, кеширует
- Все HTML-шаблоны — используется `<div id="footer-container"></div>` вместо статичного `.help-footer`
- `views/dashboard.html` — добавлен футер + подключён `help.css`

### Как обновлять версию
1. Изменить поле `version` в `package.json`
2. Перезапустить сервер
3. Все страницы автоматически показывают новую версию

## [1.5.2] - 2026-09-21
...

## [1.5.2] - 2026-09-21

### Исправлено
- **Дашборд, раздел "Требует внимания"**: список техники с истёкшей
  гарантией теперь отображается (раньше было только число)
- **Профиль админа**: добавлены кнопки "Дашборд" и "Админ-панель"
  для быстрого возврата в административный раздел
- Роль передаётся через `data-is-admin` атрибут (без inline-скрипта) —
  устранено предупреждение IDE "property assignment detected"

### Изменено
- `getEquipmentNeedingAttention` возвращает массив `warrantyExpired`
  вместо числа `warrantyExpiredCount`
- `routes/dashboard.js` — рендер списка с днями просрочки
- `views/profile.html` — атрибут `data-is-admin` на контейнере
- `public/js/profile.js` — чтение роли из data-атрибута

## [1.5.1] - 2026-09-21
**Дашборд как главная для админов**
- Новая страница `/` — дашборд (только админы)
- Статистика, график активности, последние действия
- Раздел "Требует внимания"
- Топ-5 активных пользователей
- Удалена старая главная
...

## [1.4.5] - 2026-09-18

### Добавлено
- **Карточка просмотра техники** (кнопка 👁️ в таблице админ-панели):
  - Заголовок с иконкой, названием, инв. номером и статусом
  - Статистика: назначено / всего выдач / возвращено
  - Полная информация о технике
  - Текущий владелец с аватаром
  - История использования с пользователями
- **Колонка "Назначена"** в таблице техники — показывает пользователя
- **Улучшенная карточка пользователя**:
  - Красивый заголовок с аватаром и градиентом
  - Сетка контактов
  - Карточки активной техники
  - Таблица истории

### Исправлено
- `assignEquipment` не закрывал предыдущее назначение при переназначении
- `getInitials is not defined` — функция добавлена в клиентский JS
- `assignmentResult is not defined` — переменная объявлена в API
- История техники показывала `undefined` в поле "Пользователь"
- Сортировка истории техники работала некорректно при сбоях системного времени

### Изменено
- `getEquipmentHistory` — сортировка по `id DESC` (устойчива к сбоям часов)
- Маркер ⚠️ для аномальных дат (returned_date < assigned_date)
- Убрана колонка "Производитель" из таблицы техники (менее важна)

### Новые файлы
- `scripts/fix-double-assignments.js` — очистка дубликатов
- `scripts/normalize-dates.js` — нормализация форматов дат

## [1.4.2] - 2026-09-18

### Добавлено
- **Таблица техники**: колонка "Назначена" — показывает пользователя,
  которому выдана техника (аватар + ФИО + отдел)
- **Карточка пользователя**: красивое модальное окно с:
  - Заголовком с аватаром и градиентом
  - Статистикой (активная / всего / возвращено)
  - Контактной информацией в сетке
  - Карточками активной техники
  - Компактной таблицей истории

### Исправлено
- **ReferenceError: getInitials is not defined** — функция была
  определена только в `routes/admin.js` (сервер), но использовалась
  в `public/js/admin.js` (клиент). Добавлена в клиентский файл.

### Изменено
- Убрана колонка "Производитель" из таблицы техники (менее важна)
- Расширен API `/api/admin/users/:id/details` — добавлена статистика
- Улучшена адаптивность модальных окон

## [1.4.1] - 2026-09-18

### Исправлено
- **Двойное назначение техники**: при переназначении техники другому пользователю
  старое назначение не закрывалось, из-за чего техника отображалась у двух пользователей
  одновременно
- **`assignmentResult is not defined`**: переменная не была объявлена в updateEquipmentAPI

### Добавлено
- Автоматическое закрытие предыдущего назначения при переназначении
- Логирование операций назначения и возврата техники
- Скрипт `scripts/fix-double-assignments.js` для очистки существующих дубликатов
- npm-скрипт `npm run fix-assignments`

### Изменено
- `assignEquipment` в `database/db.js` — добавлена проверка активных назначений
- `updateEquipmentAPI` в `routes/admin.js` — полная переработка логики смены статусов

## [1.4.0] - 2026-09-18
...
# История изменений

## [1.3.1] - 2026-07-03

### Добавлено
- Универсальный футер с ссылками на инструкции и помощь на всех страницах
- Красивое модальное окно со справкой
- Отдельные CSS и JS файлы для главной страницы
- Анимации при открытии модального окна

### Изменено
- Реорганизована главная страница
- Справочные материалы вынесены в отдельный блок
- Улучшена визуальная иерархия
- Код разделен на логические компоненты

### Исправлено
- Унифицирован стиль кнопок на всех страницах
- Исправлены мелкие баги в адаптивности

## [1.3.0] - 2026-07-01

### Добавлено
- Возможность назначать технику пользователю при редактировании
- Автоматический возврат техники при смене статуса
- Выбор пользователя из списка при назначении
- Интерактивные подсказки при смене статуса
- Подробное логирование всех операций

### Исправлено
- Ошибка "Техника не найдена" при изменении статуса
- Проблема с передачей ID при редактировании
- Корректная обработка статусов техники

## [1.2.0] - 2026-07-01

### Добавлено
- Полноценная админ-панель
- Управление пользователями (CRUD)
- Вкладки для переключения между разделами
- Статистика на главной странице админки

### Изменено
- Рефакторинг структуры проекта
- Разделение CSS и JS на отдельные файлы

## [1.1.0] - 2026-07-01

### Добавлено
- Страница учета пользователей
- Отображение техники у пользователей
- Поиск по таблицам

## [1.0.0] - 2026-07-01

### Добавлено
- Базовая структура проекта
- SQLite база данных
- Управление техникой
- PDF инструкции
- Главная страница с навигацией