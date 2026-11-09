// public/js/manage/filters.js
// Фильтры на /manage (5.0.4).

function applyFilters() {
    const params = new URLSearchParams();

    const search = document.getElementById('filterSearch')?.value.trim();
    const corporateId = document.getElementById('filterCorporateId')?.value.trim();
    const modelName = document.getElementById('filterModelName')?.value.trim();
    const categoryId = document.getElementById('filterCategory')?.value;
    const typeId = document.getElementById('filterType')?.value;
    const molId = document.getElementById('filterMol')?.value;
    const pageSize = document.getElementById('filterPageSize')?.value;

    if (search) params.set('search', search);
    if (corporateId) params.set('corporate_id', corporateId);
    if (modelName) params.set('model_name', modelName);
    if (categoryId) params.set('category_id', categoryId);
    if (typeId) params.set('type_id', typeId);
    if (molId) params.set('mol_id', molId);
        // 🆕 5.15.4: учёт / ОС
    const quantityMode   = document.getElementById('filterQuantity')?.value || '';
    const fixedAssetMode = document.getElementById('filterFixedAsset')?.value || '';
    if (quantityMode)   params.set('quantity_mode', quantityMode);
    if (fixedAssetMode) params.set('fixed_asset_mode', fixedAssetMode);
    
    const onlyMine = document.getElementById('filterOnlyMine')?.value;
    if (onlyMine) params.set('only_mine', onlyMine);

    const unplaced = document.getElementById('filterUnplaced')?.checked;
    if (unplaced) params.set('unplaced', '1');
    
    // 🆕 Фильтр «Без движения > 3 мес.»
    const stale = document.getElementById('filterStale')?.checked;
    if (stale) params.set('stale', '1');

    if (pageSize) params.set('limit', pageSize);

    const url = new URL(window.location.href);
    const sort = url.searchParams.get('sort');
    const order = url.searchParams.get('order');
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);

    window.location.href = '/manage?' + params.toString();
}

function resetFilters() {
    const unplaced = document.getElementById('filterUnplaced');
    if (unplaced) unplaced.checked = false;
    // 🆕 5.15.4
    const quantity = document.getElementById('filterQuantity');
    if (quantity) quantity.value = '';
    const fixedAsset = document.getElementById('filterFixedAsset');
    if (fixedAsset) fixedAsset.value = '';
    window.location.href = '/manage';
}

function applyPageSize() {
    applyFilters();
}