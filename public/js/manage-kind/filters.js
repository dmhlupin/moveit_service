// public/js/manage-kind/filters.js
// Фильтры на страницах разделов (ОС / ТМЦ / малоценка).
// Отличия от /js/manage/filters.js:
//   - нет фильтров «Учёт» / «ОС» (они константа раздела);
//   - basePath передаётся аргументом (из #kindBasePath).

function applyKindFilters(basePath) {
    const params = new URLSearchParams();

    const search       = document.getElementById('filterSearch')?.value.trim();
    const corporateId  = document.getElementById('filterCorporateId')?.value.trim();
    const modelName    = document.getElementById('filterModelName')?.value.trim();
    const categoryId   = document.getElementById('filterCategory')?.value;
    const typeId       = document.getElementById('filterType')?.value;
    const molId        = document.getElementById('filterMol')?.value;
    const pageSize     = document.getElementById('filterPageSize')?.value;
    const onlyMine     = document.getElementById('filterOnlyMine')?.value;
    const unplaced     = document.getElementById('filterUnplaced')?.checked;
    const stale        = document.getElementById('filterStale')?.checked;

    if (search)      params.set('search', search);
    if (corporateId) params.set('corporate_id', corporateId);
    if (modelName)   params.set('model_name', modelName);
    if (categoryId)  params.set('category_id', categoryId);
    if (typeId)      params.set('type_id', typeId);
    if (molId)       params.set('mol_id', molId);
    if (onlyMine)    params.set('only_mine', onlyMine);
    if (unplaced)    params.set('unplaced', '1');
    if (stale)       params.set('stale', '1');
    if (pageSize)    params.set('limit', pageSize);

    const url = new URL(window.location.href);
    const sort = url.searchParams.get('sort');
    const order = url.searchParams.get('order');
    if (sort)  params.set('sort', sort);
    if (order) params.set('order', order);

    window.location.href = basePath + (params.toString() ? '?' + params.toString() : '');
}

function resetKindFilters(basePath) {
    window.location.href = basePath;
}