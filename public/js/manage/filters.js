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
    if (pageSize) params.set('limit', pageSize);

    const url = new URL(window.location.href);
    const sort = url.searchParams.get('sort');
    const order = url.searchParams.get('order');
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);

    window.location.href = '/manage?' + params.toString();
}

function resetFilters() {
    window.location.href = '/manage';
}

function applyPageSize() {
    applyFilters();
}