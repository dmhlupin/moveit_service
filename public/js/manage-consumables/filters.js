// public/js/manage-consumables/filters.js
// Фильтры на странице /manage/consumables (5.16.2b).
// basePath берётся из #basePath (серверный рендер).

function applyConsumableFilters() {
    const params = new URLSearchParams();
    const basePath = document.getElementById('basePath')?.value || '/manage/consumables';

    const search       = document.getElementById('filterSearch')?.value.trim();
    const warehouseId  = document.getElementById('filterWarehouse')?.value;
    const categoryId   = document.getElementById('filterCategory')?.value;
    const typeId       = document.getElementById('filterType')?.value;
    const pageSize     = document.getElementById('filterPageSize')?.value;
    const lowStock     = document.getElementById('filterLowStock')?.checked;
    const showInactive = document.getElementById('filterShowInactive')?.checked;

    if (search)       params.set('search', search);
    if (warehouseId)  params.set('warehouse_id', warehouseId);
    if (categoryId)   params.set('category_id', categoryId);
    if (typeId)       params.set('type_id', typeId);
    if (lowStock)     params.set('low_stock', '1');
    if (showInactive) params.set('show_inactive', '1');
    if (pageSize)     params.set('limit', pageSize);

    // Сохраняем сортировку из URL
    const url = new URL(window.location.href);
    const sort = url.searchParams.get('sort');
    const order = url.searchParams.get('order');
    if (sort)  params.set('sort', sort);
    if (order) params.set('order', order);

    window.location.href = basePath + (params.toString() ? '?' + params.toString() : '');
}

function resetConsumableFilters() {
    const basePath = document.getElementById('basePath')?.value || '/manage/consumables';
    window.location.href = basePath;
}