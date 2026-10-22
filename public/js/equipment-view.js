// public/js/equipment-view.js
// Карточка техники открывается на /manage.
// На страницах /admin/warehouses, /admin/workplaces, /admin/users
// достаточно ссылки с onclick="viewEquipmentFromExternal(id)".

function viewEquipmentFromExternal(id) {
    window.location.href = `/manage?open_equipment=${id}`;
}