// public/js/layout.js
// Логика основного layout: sidebar, header, dropdown

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let currentUser = null;

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎨 Layout: инициализация...');
    
    // 1. Восстанавливаем состояние sidebar из localStorage
    restoreSidebarState();
    
    // 2. Загружаем данные пользователя
    await loadCurrentUser();
    
    // 3. Подсвечиваем активный раздел
    highlightActiveSection();
    
    // 4. Загружаем счётчики для бейджей
    await loadCounters();

    // 4.1. Загружаем версию приложения
    await loadAppVersion();
    
    // 5. Обработчики событий
    setupEventListeners();
    
    console.log('✅ Layout готов');
});

// ============================================================
// ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================

/**
 * Загрузить текущего пользователя
 */
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/auth/me');
        
        if (!response.ok) {
            console.warn('⚠️ Не удалось загрузить пользователя:', response.status);
            return;
        }
        
        currentUser = await response.json();
        console.log('👤 Пользователь:', currentUser.username);
        
        // Обновляем UI
        updateUserUI(currentUser);
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователя:', error);
    }
}

/**
 * Обновить UI с данными пользователя
 */
function updateUserUI(user) {
    const fullName = user.fullName || user.username;
    const initials = getInitials(fullName);
    const roleText = user.role === 'admin' ? 'Администратор' : 'Пользователь';
    
    // Аватар
    const avatar = document.getElementById('userAvatar');
    if (avatar) avatar.textContent = initials;
    
    // Имя в шапке
    const userName = document.getElementById('userName');
    if (userName) userName.textContent = fullName;
    
    // Роль в шапке
    const userRole = document.getElementById('userRole');
    if (userRole) userRole.textContent = roleText;
    
    // Dropdown
    const dropdownName = document.getElementById('dropdownUserName');
    if (dropdownName) dropdownName.textContent = fullName;
    
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    if (dropdownEmail) dropdownEmail.textContent = user.email || '—';
    
    const dropdownRole = document.getElementById('dropdownUserRole');
    if (dropdownRole) {
        dropdownRole.textContent = (user.role === 'admin' ? '👑 ' : '👤 ') + roleText;
    }
}

/**
 * Получить инициалы
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(p => p);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ============================================================
// ПОДСВЕТКА АКТИВНОГО РАЗДЕЛА
// ============================================================

/**
 * Определить текущий раздел по URL и подсветить в sidebar
 */
function highlightActiveSection() {
    const path = window.location.pathname;
    
    // Определяем активный раздел
    let activePage = null;
    
    // Точное совпадение
    if (path === '/') activePage = 'dashboard';
    else if (path === '/equipment' || path.startsWith('/equipment/')) activePage = 'equipment';
    else if (path === '/users' || path.startsWith('/users/')) activePage = 'users';
    else if (path === '/profile') activePage = 'profile';
    else if (path === '/admin/warehouses' || path.startsWith('/admin/warehouses/')) activePage = 'warehouses';
    else if (path === '/admin/workplaces' || path.startsWith('/admin/workplaces/')) activePage = 'workplaces';
    else if (path === '/admin/inventory') activePage = 'inventory';
    else if (path === '/admin/models') activePage = 'models';
    else if (path === '/admin/logs') activePage = 'logs';
    else if (path === '/admin/catalog') activePage = 'catalog';
    else if (path === '/pdf' || path.startsWith('/pdf/')) activePage = 'pdf';
    else if (path === '/admin' || path.startsWith('/admin/')) activePage = 'admin';
        
    // Снимаем подсветку со всех
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Подсвечиваем активный
    if (activePage) {
        const activeLink = document.querySelector(`.sidebar-link[data-page="${activePage}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
}

// ============================================================
// СВОРАЧИВАНИЕ SIDEBAR
// ============================================================

/**
 * Переключить состояние sidebar
 */
function toggleSidebar() {
    const layout = document.querySelector('.app-layout');
    if (!layout) return;
    
    layout.classList.toggle('sidebar-collapsed');
    
    const isCollapsed = layout.classList.contains('sidebar-collapsed');
    
    // Сохраняем в localStorage
    localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
    
    console.log(`📐 Sidebar ${isCollapsed ? 'свёрнут' : 'развёрнут'}`);
}

/**
 * Восстановить состояние sidebar из localStorage
 */
function restoreSidebarState() {
    const collapsed = localStorage.getItem('sidebarCollapsed') === '1';
    
    if (collapsed) {
        const layout = document.querySelector('.app-layout');
        if (layout) {
            layout.classList.add('sidebar-collapsed');
            console.log('📐 Sidebar восстановлен: свёрнут');
        }
    }
}

/**
 * Открыть/закрыть sidebar на мобильных
 */
function toggleMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
}

// ============================================================
// DROPDOWN ПРОФИЛЯ
// ============================================================

/**
 * Открыть/закрыть меню пользователя
 */
function toggleUserMenu(event) {
    if (event) event.stopPropagation();
    
    const menu = document.getElementById('userMenu');
    if (!menu) return;
    
    menu.classList.toggle('open');
}

/**
 * Закрыть меню пользователя
 */
function closeUserMenu() {
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.remove('open');
}

// ============================================================
// СЧЁТЧИКИ (бейджи)
// ============================================================

/**
 * Загрузить счётчики для бейджей
 */
async function loadCounters() {
    try {
        // Счётчик техники
        const response = await fetch('/api/admin/inventory/totals');
        
        if (response.ok) {
            const totals = await response.json();
            const totalEquipment = (totals.equipment_on_stock || 0) + 
                                    (totals.available_without_cell || 0) + 
                                    (totals.equipment_assigned || 0);
            
            updateEquipmentCounter(totalEquipment);
        }
    } catch (error) {
        // Тихо игнорируем ошибки — бейдж не критичен
        console.warn('⚠️ Не удалось загрузить счётчики');
    }
}

/**
 * Обновить бейдж с количеством техники
 */
function updateEquipmentCounter(count) {
    const badge = document.getElementById('equipmentCount');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 999 ? '999+' : count;
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Загрузить версию приложения
 */
async function loadAppVersion() {
    try {
        const response = await fetch('/api/version');
        if (!response.ok) return;
        
        const data = await response.json();
        const el = document.getElementById('appVersion');
        if (el) el.textContent = 'v' + data.version;
    } catch (error) {
        // Тихо игнорируем — версия не критична
        console.warn('⚠️ Не удалось загрузить версию');
    }
}

// ============================================================
// ГОРЯЧИЕ КЛАВИШИ
// ============================================================

/**
 * Обработчик горячих клавиш
 */
function handleHotkeys(event) {
    // Ctrl+K — фокус на поиск
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
    
    // Escape — закрыть dropdown
    if (event.key === 'Escape') {
        closeUserMenu();
    }
    
    // Ctrl+B — свернуть sidebar (опционально)
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
    }
}

// ============================================================
// ГЛОБАЛЬНЫЙ ПОИСК
// ============================================================

/**
 * Обработка глобального поиска
 */
async function handleGlobalSearch(query) {
    if (!query || query.length < 2) return;
    
    console.log('🔍 Поиск:', query);
    
    // TODO: Реализовать поиск в следующем подэтапе
    // Пока просто показываем уведомление
    if (typeof showToast === 'function') {
        showToast(`🔍 Поиск: "${query}" — в разработке`, 'info');
    }
}

// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================

function setupEventListeners() {
    // Закрытие dropdown при клике вне его
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('userMenu');
        if (menu && !menu.contains(e.target)) {
            closeUserMenu();
        }
    });
    
    // Горячие клавиши
    document.addEventListener('keydown', handleHotkeys);
    
    // Глобальный поиск (Enter)
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleGlobalSearch(this.value.trim());
            }
        });
    }
    
    // Кнопка мобильного меню (для будущего)
    const mobileToggle = document.getElementById('mobileMenuToggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggleMobileSidebar);
    }
}

// ============================================================
// ЭКСПОРТ (для использования в других скриптах)
// ============================================================

window.LayoutJS = {
    toggleSidebar,
    toggleUserMenu,
    closeUserMenu,
    currentUser: () => currentUser,
};