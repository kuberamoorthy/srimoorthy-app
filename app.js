/* ==========================================
   SRI MOORTHY TRANSPORT - FLEET MANAGER APP
   JavaScript Application Logic
   ========================================== */

// ===== DATA STORE (Supabase Cloud Primary with Local Cache) =====
const STORAGE_KEYS = {
    vehicles: 'sm_vehicles',
    bills: 'sm_bills',
    fuel: 'sm_fuel',
    notifications: 'sm_notifications',
    billCounter: 'sm_bill_counter',
    dieselRate: 'sm_diesel_rate',
    supabaseUrl: 'sm_supabase_url',
    supabaseKey: 'sm_supabase_key',
    storageMethod: 'sm_storage_method'
};

// Preset Supabase Cloud Configuration (Client-Safe Publishable Key only)
const DEFAULT_SUPABASE_URL = 'https://gusrwwwoammurxzwywmy.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_hXTr_LSTHmmUcgVk3Y42tA_2VDN6WBU';
const SUPABASE_STORAGE_BUCKET = 'fleet_storage';

// Sanitize legacy stored keys if present in localStorage
(function sanitizeStoredKeys() {
    try {
        const stored = localStorage.getItem('sm_supabase_key');
        if (stored && !stored.includes('sb_publishable_')) {
            localStorage.setItem('sm_supabase_key', JSON.stringify(DEFAULT_SUPABASE_KEY));
        }
    } catch (_) {}
})();

// Supabase Global Client & Storage State
let supabaseClient = null;
let isSupabaseConnected = false;
let hasRelationalTables = false;
let currentStorageMethod = 'supabase';

// ===== DEFAULT VEHICLES =====
const DEFAULT_VEHICLES = [
    {
        id: 'v1',
        name: 'TATA ACE',
        number: 'TN68C6003',
        type: 'TATA ACE',
        status: 'active',
        color: '#EF5226'
    },
    {
        id: 'v2',
        name: 'TATA ACE',
        number: 'TN68W2419',
        type: 'TATA ACE',
        status: 'active',
        color: '#3b82f6'
    },
    {
        id: 'v3',
        name: 'DOST+',
        number: 'TN82K1945',
        type: 'DOST+',
        status: 'active',
        color: '#10b981'
    }
];

// ===== UTILITY FUNCTIONS =====
function getStore(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

function setStore(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('LocalStorage write failed:', e);
    }
}

function getVehicles() {
    let vehicles = getStore(STORAGE_KEYS.vehicles);
    if (!vehicles || vehicles.length === 0) {
        vehicles = DEFAULT_VEHICLES;
        setStore(STORAGE_KEYS.vehicles, vehicles);
    }
    return vehicles;
}

function getBills() {
    return getStore(STORAGE_KEYS.bills) || [];
}

function saveBills(bills) {
    setStore(STORAGE_KEYS.bills, bills);
}

function getFuelLogs() {
    return getStore(STORAGE_KEYS.fuel) || [];
}

function saveFuelLogs(logs) {
    setStore(STORAGE_KEYS.fuel, logs);
}

function getNotifications() {
    return getStore(STORAGE_KEYS.notifications) || [];
}

function saveNotifications(notifs) {
    setStore(STORAGE_KEYS.notifications, notifs);
}

function getNextBillNumber() {
    let counter = getStore(STORAGE_KEYS.billCounter) || 0;
    counter++;
    setStore(STORAGE_KEYS.billCounter, counter);
    return 'SM-' + String(counter).padStart(4, '0');
}

function isValidUUID(str) {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateId() {
    return generateUUID();
}

function formatCurrency(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function getVehicleById(id) {
    if (!id) return null;
    const vehicles = getVehicles();
    return vehicles.find(v => v.id === id || v.number === id || (v.uuid && v.uuid === id));
}

const LEGACY_VEHICLE_NUMBERS = {
    'v1': 'TN68C6003',
    'v2': 'TN68W2419',
    'v3': 'TN82K1945'
};

function getVehicleUUID(vehicleIdOrNumber) {
    if (!vehicleIdOrNumber) return null;
    if (isValidUUID(vehicleIdOrNumber)) return vehicleIdOrNumber;
    const targetNumber = LEGACY_VEHICLE_NUMBERS[vehicleIdOrNumber] || vehicleIdOrNumber;
    const vehicles = getVehicles();
    const v = vehicles.find(veh => veh.id === vehicleIdOrNumber || veh.number === targetNumber || veh.number === vehicleIdOrNumber);
    if (!v) return null;
    if (v.id && isValidUUID(v.id)) return v.id;
    if (v.uuid && isValidUUID(v.uuid)) return v.uuid;
    return null;
}

function getVehicleDisplay(v) {
    if (!v) return '-';
    return `<span style="font-weight:700;margin-right:6px;">${v.name}</span><span class="plate-hsrp sm"><span class="ind-tag">IND</span>${v.number}</span>`;
}

// ===== THEME MODE SYSTEM (Obsidian Dark / Titanium Light) =====
function initThemeMode() {
    const savedMode = localStorage.getItem('sm_theme_mode') || 'dark'; // Default to executive Obsidian Dark
    setThemeMode(savedMode, false);
}

function setThemeMode(mode, showToastMsg = true) {
    document.documentElement.setAttribute('data-mode', mode);
    document.body.classList.toggle('dark-mode', mode === 'dark');
    localStorage.setItem('sm_theme_mode', mode);

    const sunIcons = document.querySelectorAll('.mode-icon-sun');
    const moonIcons = document.querySelectorAll('.mode-icon-moon');
    const modeLabels = document.querySelectorAll('.mode-label-text');

    if (mode === 'dark') {
        sunIcons.forEach(i => i.style.display = 'inline-block');
        moonIcons.forEach(i => i.style.display = 'none');
        modeLabels.forEach(l => l.textContent = 'Obsidian Dark');
    } else {
        sunIcons.forEach(i => i.style.display = 'none');
        moonIcons.forEach(i => i.style.display = 'inline-block');
        modeLabels.forEach(l => l.textContent = 'Titanium Light');
    }

    if (showToastMsg && typeof showToast === 'function') {
        showToast(mode === 'dark' ? '🌙 Obsidian Fleet Mode Active' : '☀️ Titanium Studio Mode Active', 'info');
    }
}

function toggleThemeMode() {
    const currentMode = document.documentElement.getAttribute('data-mode') || 'dark';
    const newMode = currentMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode, true);
}

// ===== LIVE REALTIME CLOCK & STATUS =====
function startLiveClock() {
    function updateClock() {
        const now = new Date();
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
            dateEl.innerHTML = `<span class="live-clock-time">${timeStr}</span> <span style="opacity:0.35;">|</span> <span class="live-clock-date">${dateStr}</span>`;
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// ===== COMMAND PALETTE (Ctrl+K) =====
const COMMAND_ITEMS = [
    { id: 'nav-dash', title: 'Dashboard', desc: 'Overview of fleet KPIs & live telemetry', icon: '📊', category: 'Navigation', action: () => navigateTo('dashboard') },
    { id: 'nav-veh', title: 'Vehicles & Fleet Units', desc: 'Manage 3 registered trucks and live telematics', icon: '🚚', category: 'Navigation', action: () => navigateTo('vehicles') },
    { id: 'nav-bills', title: 'Billing & Invoices', desc: 'Create, search, filter and print trip invoices', icon: '📄', category: 'Navigation', action: () => navigateTo('billing') },
    { id: 'nav-fuel', title: 'Fuel Logs & Mileage', desc: 'Track diesel logs, expenses and kilometer rates', icon: '⛽', category: 'Navigation', action: () => navigateTo('fuel') },
    { id: 'nav-rep', title: 'Financial Analytics & Reports', desc: 'Profit & Loss, vehicle breakdown, revenue charts', icon: '📈', category: 'Navigation', action: () => navigateTo('reports') },
    { id: 'act-bill', title: 'Create New Bill', desc: 'Quick dispatch new customer invoice', icon: '➕', category: 'Quick Action', action: () => { navigateTo('billing'); setTimeout(openBillModal, 200); } },
    { id: 'act-fuel', title: 'Log Diesel Fuel', desc: 'Add fuel fill-up, liters, rate and odometer', icon: '⛽', category: 'Quick Action', action: () => { navigateTo('fuel'); setTimeout(openFuelModal, 200); } },
    { id: 'act-gps', title: 'Launch Fleet Live GPS', desc: 'Open Fleetocity satellite cockpit in new window', icon: '🛰️', category: 'Telemetry', action: () => window.open('https://app.fleetocity.co.in', '_blank') },
    { id: 'act-mode', title: 'Toggle Obsidian Dark / Titanium Light', desc: 'Switch executive theme appearance', icon: '🌓', category: 'Appearance', action: toggleThemeMode },
    { id: 'act-supa', title: 'Supabase Cloud Database Settings', desc: 'Manage cloud URL, anon key and database tables', icon: '☁️', category: 'System', action: openSupabaseModal },
    { id: 'act-apk', title: 'Install PWA or Export APK', desc: 'Install app to device home screen or build Android APK', icon: '📱', category: 'System', action: openInstallModal },
    { id: 'act-reset', title: 'Reset Database (Clear All Data)', desc: 'Permanently wipe bills & fuel logs to a clean fresh state', icon: '🗑️', category: 'Danger Zone', action: resetDatabase }
];

let selectedCommandIndex = 0;
let filteredCommands = [...COMMAND_ITEMS];

function openCommandPalette() {
    const overlay = document.getElementById('commandPaletteOverlay');
    const input = document.getElementById('commandPaletteInput');
    if (!overlay || !input) return;
    
    overlay.style.display = 'flex';
    input.value = '';
    selectedCommandIndex = 0;
    renderCommandList('');
    setTimeout(() => input.focus(), 50);
}

function closeCommandPalette() {
    const overlay = document.getElementById('commandPaletteOverlay');
    if (overlay) overlay.style.display = 'none';
}

function filterCommandPalette(query) {
    selectedCommandIndex = 0;
    renderCommandList(query);
}

function renderCommandList(query) {
    const list = document.getElementById('commandPaletteList');
    if (!list) return;
    
    const q = (query || '').toLowerCase().trim();
    filteredCommands = COMMAND_ITEMS.filter(item => 
        !q || item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );

    if (filteredCommands.length === 0) {
        list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">No commands matching "${q}"</div>`;
        return;
    }

    list.innerHTML = filteredCommands.map((item, idx) => `
        <div class="command-item ${idx === selectedCommandIndex ? 'selected' : ''}" onclick="executeCommand(${idx})">
            <span class="command-item-icon">${item.icon}</span>
            <div class="command-item-content">
                <span class="command-item-title">${item.title}</span>
                <span class="command-item-desc">${item.desc}</span>
            </div>
            <span class="command-item-badge">${item.category}</span>
        </div>
    `).join('');
}

function executeCommand(index) {
    if (index >= 0 && index < filteredCommands.length) {
        const cmd = filteredCommands[index];
        closeCommandPalette();
        if (cmd && typeof cmd.action === 'function') {
            cmd.action();
        }
    }
}

// Global Keyboard Shortcut Listener (Ctrl+K, Cmd+K, Escape, Shortcuts)
window.addEventListener('keydown', (e) => {
    // Check if input/textarea is focused for single-letter shortcuts
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    // Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const overlay = document.getElementById('commandPaletteOverlay');
        if (overlay && overlay.style.display !== 'none') {
            closeCommandPalette();
        } else {
            openCommandPalette();
        }
        return;
    }

    const overlay = document.getElementById('commandPaletteOverlay');
    if (overlay && overlay.style.display !== 'none') {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeCommandPalette();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filteredCommands.length > 0) {
                selectedCommandIndex = (selectedCommandIndex + 1) % filteredCommands.length;
                renderCommandList(document.getElementById('commandPaletteInput')?.value || '');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filteredCommands.length > 0) {
                selectedCommandIndex = (selectedCommandIndex - 1 + filteredCommands.length) % filteredCommands.length;
                renderCommandList(document.getElementById('commandPaletteInput')?.value || '');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executeCommand(selectedCommandIndex);
        }
    }
});

// ===== THEME ACCENT COLOR SYSTEM =====
const THEME_NAMES = {
    orange: 'Transport Orange',
    blue: 'Electric Blue',
    green: 'Emerald Green',
    purple: 'Royal Purple',
    red: 'Crimson Red'
};

function initThemeColor() {
    const savedTheme = localStorage.getItem('sm_theme_color') || 'orange';
    applyThemeColor(savedTheme);
}

function setAppThemeColor(color) {
    localStorage.setItem('sm_theme_color', color);
    applyThemeColor(color);
    showToast(`Accent theme updated to ${THEME_NAMES[color] || color}`, 'info');
    const popover = document.getElementById('themePickerPopover');
    if (popover) popover.classList.remove('show');
}

function applyThemeColor(color) {
    document.documentElement.setAttribute('data-theme', color);
    
    // Update active label in popover and sidebar
    const activeLabel = document.getElementById('activeThemeName');
    if (activeLabel) activeLabel.textContent = THEME_NAMES[color] || color;
    const sidebarLabel = document.getElementById('sidebarActiveTheme');
    if (sidebarLabel) sidebarLabel.textContent = THEME_NAMES[color] || color;

    // Update active swatch buttons
    document.querySelectorAll('.theme-swatch-btn').forEach(btn => {
        if (btn.dataset.color === color) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function toggleThemePicker() {
    const popover = document.getElementById('themePickerPopover');
    if (!popover) return;
    const isOpen = popover.classList.contains('show');
    
    const notifPanel = document.getElementById('notifPanel');
    if (notifPanel) notifPanel.classList.remove('show');

    if (isOpen) {
        popover.classList.remove('show');
    } else {
        popover.classList.add('show');
    }
}

// ===== SPLASH SCREEN =====
let splashDismissed = false;

function dismissSplash() {
    if (splashDismissed) return;
    splashDismissed = true;

    const splash = document.getElementById('splashScreen');
    const appEl = document.getElementById('app');

    if (appEl) {
        appEl.style.display = 'flex';
    }

    if (splash) {
        splash.classList.add('hide');
        setTimeout(() => {
            splash.style.display = 'none';
        }, 450);
    }

    try {
        initApp();
    } catch (err) {
        console.error('Error during app initialization:', err);
    }
}

// Immediate tap / click listener on splash screen so user can tap to skip instantly
(function attachSplashDismissListeners() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.addEventListener('click', dismissSplash);
        splash.addEventListener('touchstart', dismissSplash, { passive: true });
    }
})();

// Fast, reliable splash dismissal that doesn't hang on slow external CDN assets
if (document.readyState === 'complete') {
    setTimeout(dismissSplash, 500);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(dismissSplash, 650);
    });
    // Safety timeout: dismiss after max 1.1s even if external resources are slow
    setTimeout(dismissSplash, 1100);
    // Also trigger if window load completes early
    window.addEventListener('load', () => {
        setTimeout(dismissSplash, 300);
    });
}

// ===== DIESEL BENCHMARK RATE SYNC =====
function updateDieselRatesToBenchmark() {
    let logs = getFuelLogs();
    let updated = false;
    logs = logs.map(f => {
        if ((f.fuelType || 'diesel') === 'diesel' && parseFloat(f.rate) < 100) {
            f.rate = 100.22;
            f.totalAmount = parseFloat((parseFloat(f.litres || 0) * 100.22).toFixed(2));
            updated = true;
        }
        return f;
    });
    if (updated) {
        saveFuelLogs(logs);
        if (typeof persistFleetToSupabase === 'function') {
            persistFleetToSupabase();
        }
    }
}

// ===== APP INITIALIZATION =====
function initApp() {
    // Initialize Theme Mode (Obsidian Dark / Titanium Light) & Accent Color
    initThemeMode();
    initThemeColor();

    // Start Live Clock
    startLiveClock();

    // Initialize diesel benchmark rate
    localStorage.setItem('sm_diesel_rate', '100.22');
    updateDieselRatesToBenchmark();

    // Initialize vehicles
    getVehicles();

    // Populate vehicle dropdowns
    populateVehicleDropdowns();

    // Populate month filter
    populateMonthFilter();

    // Render all pages
    renderDashboard();
    renderVehicles();
    renderBills();
    renderFuelLogs();
    renderReports();

    // Check notifications
    updateNotifications();

    // Initialize Supabase Cloud sync if configured
    initSupabase();

    // Add welcome notification if first visit
    if (!getStore('sm_visited')) {
        addNotification('Welcome to Sri Moorthy Fleet Manager! 🚛', 'info');
        setStore('sm_visited', true);
    }

    // Dismiss popovers on outside click
    document.addEventListener('click', (e) => {
        const themePopover = document.getElementById('themePickerPopover');
        const themeBtn = document.getElementById('themeBtn');
        if (themePopover && themePopover.classList.contains('show')) {
            if (!themePopover.contains(e.target) && !themeBtn.contains(e.target)) {
                themePopover.classList.remove('show');
            }
        }
    });
}

// ===== NAVIGATION =====
let currentPage = 'dashboard';

function navigateTo(page) {
    currentPage = page;

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.add('active');

    // Update bottom nav
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.nav-tab[data-page="${page}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Update sidebar
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.sidebar-link[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');



    // Close sidebar
    closeSidebar();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh data
    if (page === 'dashboard') renderDashboard();
    if (page === 'reports') renderReports();
}

// ===== SIDEBAR =====
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
}

// ===== NOTIFICATIONS =====
function toggleNotifications() {
    const panel = document.getElementById('notifPanel');
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) {
        renderNotifications();
    }
}

function addNotification(text, type = 'info') {
    const notifs = getNotifications();
    notifs.unshift({
        id: generateId(),
        text,
        type,
        time: new Date().toISOString(),
        read: false
    });
    if (notifs.length > 50) notifs.pop();
    saveNotifications(notifs);
    updateNotifications();
}

function renderNotifications() {
    const notifs = getNotifications();
    const list = document.getElementById('notifList');
    if (notifs.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No notifications</p></div>';
        return;
    }
    list.innerHTML = notifs.slice(0, 20).map(n => `
        <div class="notif-item">
            <div class="notif-text">${n.text}</div>
            <div class="notif-time">${formatDate(n.time)}</div>
        </div>
    `).join('');
}

function updateNotifications() {
    const notifs = getNotifications();
    const dot = document.getElementById('notifDot');
    const unread = notifs.filter(n => !n.read);
    if (unread.length > 0) {
        dot.classList.add('show');
    } else {
        dot.classList.remove('show');
    }
}

function clearNotifications() {
    saveNotifications([]);
    renderNotifications();
    updateNotifications();
    document.getElementById('notifPanel').classList.remove('show');
}

// ===== QUICK ADD =====
function openQuickAdd() {
    document.getElementById('quickAddOverlay').classList.add('show');
    document.getElementById('quickAddMenu').classList.add('show');
}

function closeQuickAdd() {
    document.getElementById('quickAddOverlay').classList.remove('show');
    document.getElementById('quickAddMenu').classList.remove('show');
}

// ===== VEHICLE DROPDOWNS =====
function populateVehicleDropdowns() {
    const vehicles = getVehicles();
    const selectors = ['billVehicle', 'fuelVehicle', 'billVehicleFilter', 'fuelVehicleFilter'];
    selectors.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        // Keep first option
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        vehicles.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.name} - ${v.number}`;
            select.appendChild(opt);
        });
        select.value = currentVal;
    });
}

function populateMonthFilter() {
    const select = document.getElementById('fuelMonthFilter');
    if (!select) return;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    months.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = m;
        select.appendChild(opt);
    });
}

// ===== DASHBOARD =====
function renderDashboard() {
    const bills = getBills();
    const fuel = getFuelLogs();
    const vehicles = getVehicles();

    // Stats
    document.getElementById('totalVehicles').textContent = vehicles.length;
    document.getElementById('totalBills').textContent = bills.length;

    const revenue = bills.reduce((sum, b) => sum + (parseFloat(b.grandTotal) || 0), 0);
    document.getElementById('totalRevenue').textContent = formatCurrency(revenue);

    const fuelCost = fuel.reduce((sum, f) => sum + (parseFloat(f.totalAmount) || 0), 0);
    document.getElementById('totalFuelCost').textContent = formatCurrency(fuelCost);

    // Recent Activity
    renderRecentActivity(bills, fuel);

    // Fleet Cards
    renderFleetCards(vehicles, bills, fuel);
}

function renderRecentActivity(bills, fuel) {
    const container = document.getElementById('recentActivity');
    const activities = [];

    bills.forEach(b => {
        const v = getVehicleById(b.vehicleId);
        activities.push({
            type: 'bill',
            title: `Bill ${b.billNumber} - ${b.customerName}`,
            meta: v ? getVehicleDisplay(v) : '',
            amount: formatCurrency(b.grandTotal),
            date: b.date,
            timestamp: new Date(b.date).getTime()
        });
    });

    fuel.forEach(f => {
        const v = getVehicleById(f.vehicleId);
        activities.push({
            type: 'fuel',
            title: `Fuel - ${f.litres}L at ${f.station || 'Unknown Station'}`,
            meta: v ? getVehicleDisplay(v) : '',
            amount: formatCurrency(f.totalAmount),
            date: f.date,
            timestamp: new Date(f.date).getTime()
        });
    });

    activities.sort((a, b) => b.timestamp - a.timestamp);

    if (activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p>No recent activity. Start by creating a new bill or adding fuel!</p>
            </div>`;
        return;
    }

    container.innerHTML = activities.slice(0, 8).map(a => `
        <div class="activity-item">
            <div class="activity-dot ${a.type}"></div>
            <div class="activity-info">
                <div class="activity-title">${a.title}</div>
                <div class="activity-meta">${a.meta} • ${formatDate(a.date)}</div>
            </div>
            <div class="activity-amount" style="color: ${a.type === 'bill' ? 'var(--green)' : 'var(--red)'}">
                ${a.type === 'bill' ? '+' : '-'}${a.amount}
            </div>
        </div>
    `).join('');
}

function renderFleetCards(vehicles, bills, fuel) {
    const container = document.getElementById('fleetCards');
    container.innerHTML = vehicles.map(v => {
        const vBills = bills.filter(b => b.vehicleId === v.id);
        const vFuel = fuel.filter(f => f.vehicleId === v.id);
        const earnings = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fuelCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
        const totalLitres = vFuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);

        return `
        <div class="fleet-card">
            <div class="fleet-card-header">
                <div class="fleet-card-vehicle">
                    <div class="fleet-card-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    </div>
                    <div>
                        <div class="fleet-card-name">${v.name}</div>
                        <div style="margin-top:4px;"><span class="plate-hsrp sm"><span class="ind-tag">IND</span>${v.number}</span></div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <a href="https://app.fleetocity.co.in" target="_blank" rel="noopener noreferrer" class="vehicle-gps-action-btn" title="Track ${v.number} on Live GPS">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                        GPS
                    </a>
                    <span class="fleet-card-status active">Active</span>
                </div>
            </div>
            <div class="fleet-card-stats">
                <div class="fleet-stat">
                    <span class="fleet-stat-label">Trips</span>
                    <span class="fleet-stat-value">${vBills.length}</span>
                </div>
                <div class="fleet-stat">
                    <span class="fleet-stat-label">Revenue</span>
                    <span class="fleet-stat-value" style="color:var(--green);font-size:14px;">${formatCurrency(earnings)}</span>
                </div>
                <div class="fleet-stat">
                    <span class="fleet-stat-label">Fuel</span>
                    <span class="fleet-stat-value" style="font-size:14px;">${totalLitres.toFixed(1)}L</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ===== VEHICLES PAGE =====
function renderVehicles() {
    const vehicles = getVehicles();
    const bills = getBills();
    const fuel = getFuelLogs();
    const container = document.getElementById('vehicleGrid');

    container.innerHTML = vehicles.map(v => {
        const vBills = bills.filter(b => b.vehicleId === v.id);
        const vFuel = fuel.filter(f => f.vehicleId === v.id);
        const earnings = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fuelCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
        const totalLitres = vFuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
        const lastOdometer = vFuel.length > 0 ? vFuel.sort((a, b) => new Date(b.date) - new Date(a.date))[0].odometer || '-' : '-';

        return `
        <div class="vehicle-card">
            <div class="vehicle-card-top">
                <div class="vehicle-icon-lg">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
                <div class="vehicle-info">
                    <h3>${v.name}</h3>
                    <div style="margin-top:6px;"><span class="plate-hsrp"><span class="ind-tag">IND</span>${v.number}</span></div>
                </div>
            </div>
            <div class="vehicle-stats-grid">
                <div class="vehicle-stat-item">
                    <span class="v-label">Total Trips</span>
                    <span class="v-value">${vBills.length}</span>
                </div>
                <div class="vehicle-stat-item">
                    <span class="v-label">Revenue</span>
                    <span class="v-value" style="color:var(--green);">${formatCurrency(earnings)}</span>
                </div>
                <div class="vehicle-stat-item">
                    <span class="v-label">Fuel Cost</span>
                    <span class="v-value" style="color:var(--red);">${formatCurrency(fuelCost)}</span>
                </div>
                <div class="vehicle-stat-item">
                    <span class="v-label">Fuel Used</span>
                    <span class="v-value">${totalLitres.toFixed(1)}L</span>
                </div>
            </div>
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
                    <span class="live-blink" style="background:#10B981;width:7px;height:7px;border-radius:50%;display:inline-block;"></span> GPS Telematics
                </span>
                <a href="https://app.fleetocity.co.in" target="_blank" rel="noopener noreferrer" class="vehicle-gps-action-btn">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                    Live GPS View
                </a>
            </div>
        </div>`;
    }).join('');
}

// ===== BILLING =====
function openBillModal(billId) {
    const modal = document.getElementById('billModal');
    const form = document.getElementById('billForm');
    form.reset();

    // Reset line items
    document.getElementById('lineItems').innerHTML = `
        <div class="line-item" data-index="0">
            <input type="text" placeholder="Description (e.g., Transport Charge)" class="item-desc" required>
            <input type="number" placeholder="Amount" class="item-amount" min="0" step="0.01" required oninput="calculateBillTotal()">
            <button type="button" class="line-item-remove" onclick="removeLineItem(this)">✕</button>
        </div>`;

    if (billId) {
        // Edit mode
        const bill = getBills().find(b => b.id === billId);
        if (!bill) return;
        document.getElementById('billModalTitle').textContent = 'Edit Bill';
        document.getElementById('billId').value = bill.id;
        document.getElementById('billNumber').value = bill.billNumber;
        document.getElementById('billDate').value = bill.date;
        document.getElementById('billVehicle').value = bill.vehicleId;
        document.getElementById('customerName').value = bill.customerName;
        document.getElementById('customerPhone').value = bill.customerPhone || '';
        document.getElementById('fromLocation').value = bill.fromLocation;
        document.getElementById('toLocation').value = bill.toLocation;
        document.getElementById('goodsDesc').value = bill.goodsDesc || '';
        document.getElementById('gstPercent').value = bill.gstPercent || 0;
        document.getElementById('amountPaid').value = bill.amountPaid || 0;
        document.getElementById('paymentStatus').value = bill.paymentStatus;
        document.getElementById('billNotes').value = bill.notes || '';

        // Restore line items
        const lineItemsContainer = document.getElementById('lineItems');
        lineItemsContainer.innerHTML = '';
        (bill.lineItems || []).forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'line-item';
            div.dataset.index = i;
            div.innerHTML = `
                <input type="text" placeholder="Description" class="item-desc" value="${item.desc}" required>
                <input type="number" placeholder="Amount" class="item-amount" min="0" step="0.01" value="${item.amount}" required oninput="calculateBillTotal()">
                <button type="button" class="line-item-remove" onclick="removeLineItem(this)">✕</button>`;
            lineItemsContainer.appendChild(div);
        });

        calculateBillTotal();
        calculateBillBalance();
    } else {
        // New bill
        document.getElementById('billModalTitle').textContent = 'Create New Bill';
        document.getElementById('billId').value = '';
        document.getElementById('billNumber').value = getNextBillNumber();
        document.getElementById('billDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('billSubtotal').textContent = '₹0.00';
        document.getElementById('billGst').textContent = '₹0.00';
        document.getElementById('billGrandTotal').textContent = '₹0.00';
        document.getElementById('billBalance').value = '₹0.00';
    }

    const delBtn = document.getElementById('billModalDeleteBtn');
    if (delBtn) delBtn.style.display = billId ? 'inline-flex' : 'none';

    modal.classList.add('show');
}

function deleteCurrentModalBill() {
    const id = document.getElementById('billId').value;
    if (!id) return;
    deleteBill(id);
    closeBillModal();
}
window.deleteCurrentModalBill = deleteCurrentModalBill;

function closeBillModal() {
    document.getElementById('billModal').classList.remove('show');
}

function addLineItem() {
    const container = document.getElementById('lineItems');
    const index = container.children.length;
    const div = document.createElement('div');
    div.className = 'line-item';
    div.dataset.index = index;
    div.innerHTML = `
        <input type="text" placeholder="Description" class="item-desc" required>
        <input type="number" placeholder="Amount" class="item-amount" min="0" step="0.01" required oninput="calculateBillTotal()">
        <button type="button" class="line-item-remove" onclick="removeLineItem(this)">✕</button>`;
    container.appendChild(div);
    div.querySelector('.item-desc').focus();
}

function removeLineItem(btn) {
    const container = document.getElementById('lineItems');
    if (container.children.length <= 1) {
        showToast('At least one charge item is required', 'error');
        return;
    }
    btn.closest('.line-item').remove();
    calculateBillTotal();
}

function calculateBillTotal() {
    const amounts = document.querySelectorAll('#lineItems .item-amount');
    let subtotal = 0;
    amounts.forEach(input => {
        subtotal += parseFloat(input.value) || 0;
    });

    const gstPercent = parseFloat(document.getElementById('gstPercent').value) || 0;
    const gst = subtotal * (gstPercent / 100);
    const grandTotal = subtotal + gst;

    document.getElementById('billSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('billGst').textContent = formatCurrency(gst);
    document.getElementById('billGrandTotal').textContent = formatCurrency(grandTotal);

    calculateBillBalance();
}

function calculateBillBalance() {
    const amounts = document.querySelectorAll('#lineItems .item-amount');
    let subtotal = 0;
    amounts.forEach(input => {
        subtotal += parseFloat(input.value) || 0;
    });
    const gstPercent = parseFloat(document.getElementById('gstPercent').value) || 0;
    const grandTotal = subtotal + (subtotal * gstPercent / 100);
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const balance = grandTotal - paid;
    document.getElementById('billBalance').value = formatCurrency(balance);

    // Auto set payment status
    if (paid === 0) {
        document.getElementById('paymentStatus').value = 'unpaid';
    } else if (paid >= grandTotal) {
        document.getElementById('paymentStatus').value = 'paid';
    } else {
        document.getElementById('paymentStatus').value = 'partial';
    }
}

function saveBill(event) {
    event.preventDefault();
    const bills = getBills();
    const id = document.getElementById('billId').value;

    // Collect line items
    const lineItems = [];
    document.querySelectorAll('#lineItems .line-item').forEach(li => {
        lineItems.push({
            desc: li.querySelector('.item-desc').value,
            amount: parseFloat(li.querySelector('.item-amount').value) || 0
        });
    });

    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const gstPercent = parseFloat(document.getElementById('gstPercent').value) || 0;
    const gst = subtotal * (gstPercent / 100);
    const grandTotal = subtotal + gst;
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;

    const billData = {
        billNumber: document.getElementById('billNumber').value,
        date: document.getElementById('billDate').value,
        vehicleId: document.getElementById('billVehicle').value,
        customerName: document.getElementById('customerName').value,
        customerPhone: document.getElementById('customerPhone').value,
        fromLocation: document.getElementById('fromLocation').value,
        toLocation: document.getElementById('toLocation').value,
        goodsDesc: document.getElementById('goodsDesc').value,
        lineItems,
        subtotal,
        gstPercent,
        gst,
        grandTotal,
        amountPaid,
        balance: grandTotal - amountPaid,
        paymentStatus: document.getElementById('paymentStatus').value,
        notes: document.getElementById('billNotes').value,
        updatedAt: new Date().toISOString()
    };

    const targetBillId = id || generateUUID();
    billData.id = targetBillId;

    if (id) {
        // Update existing
        const index = bills.findIndex(b => b.id === id);
        if (index !== -1) {
            bills[index] = { ...bills[index], ...billData };
        }
        showToast('Bill updated successfully! ✅', 'success');
    } else {
        // New bill
        billData.createdAt = new Date().toISOString();
        bills.push(billData);
        addNotification(`New bill ${billData.billNumber} created for ${billData.customerName}`);
        showToast('Bill created successfully! 🎉', 'success');
    }

    saveBills(bills);

    if (isSupabaseConnected && supabaseClient) {
        uploadBillToSupabase(billData);
        persistFleetToSupabase();
    }
    closeBillModal();
    renderBills();
    renderDashboard();
    renderVehicles();
    renderReports();
}

function renderBills() {
    const bills = getBills();
    const container = document.getElementById('billsList');

    if (bills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <h3>No Bills Yet</h3>
                <p>Create your first transport bill</p>
            </div>`;
        return;
    }

    // Sort by date (newest first)
    const sortedBills = [...bills].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sortedBills.map(bill => {
        const v = getVehicleById(bill.vehicleId);
        return `
        <div class="bill-item" onclick="viewBill('${bill.id}')">
            <div class="bill-item-top">
                <span class="bill-item-number">${bill.billNumber}</span>
                <span class="bill-item-status ${bill.paymentStatus}">${bill.paymentStatus}</span>
            </div>
            <div class="bill-item-middle">
                <span class="bill-item-customer">${bill.customerName}</span>
                <span class="bill-item-route">${bill.fromLocation} → ${bill.toLocation}</span>
            </div>
            <div class="bill-item-bottom">
                <span class="bill-item-meta">
                    <span>${v ? getVehicleDisplay(v) : '-'}</span>
                    <span>${formatDate(bill.date)}</span>
                </span>
                <span class="bill-item-amount">${formatCurrency(bill.grandTotal)}</span>
            </div>
            <div class="bill-item-actions" onclick="event.stopPropagation()">
                <button class="bill-action-btn" onclick="openBillModal('${bill.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                </button>
                <button class="bill-action-btn" onclick="printBill('${bill.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print
                </button>
                <button class="bill-action-btn" onclick="shareBillWhatsApp('${bill.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    Share
                </button>
                <button class="bill-action-btn delete" onclick="event.stopPropagation(); deleteBill('${bill.id}');">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete
                </button>
            </div>
        </div>`;
    }).join('');
}

function filterBills() {
    const search = document.getElementById('billSearch').value.toLowerCase();
    const vehicleFilter = document.getElementById('billVehicleFilter').value;
    const statusFilter = document.getElementById('billStatusFilter').value;

    let bills = getBills();

    if (search) {
        bills = bills.filter(b =>
            b.billNumber.toLowerCase().includes(search) ||
            b.customerName.toLowerCase().includes(search) ||
            b.fromLocation.toLowerCase().includes(search) ||
            b.toLocation.toLowerCase().includes(search)
        );
    }

    if (vehicleFilter) {
        bills = bills.filter(b => b.vehicleId === vehicleFilter);
    }

    if (statusFilter) {
        bills = bills.filter(b => b.paymentStatus === statusFilter);
    }

    const container = document.getElementById('billsList');
    if (bills.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No matching bills found</p></div>';
        return;
    }

    const sortedBills = [...bills].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sortedBills.map(bill => {
        const v = getVehicleById(bill.vehicleId);
        return `
        <div class="bill-item" onclick="viewBill('${bill.id}')">
            <div class="bill-item-top">
                <span class="bill-item-number">${bill.billNumber}</span>
                <span class="bill-item-status ${bill.paymentStatus}">${bill.paymentStatus}</span>
            </div>
            <div class="bill-item-middle">
                <span class="bill-item-customer">${bill.customerName}</span>
                <span class="bill-item-route">${bill.fromLocation} → ${bill.toLocation}</span>
            </div>
            <div class="bill-item-bottom">
                <span class="bill-item-meta">
                    <span>${v ? getVehicleDisplay(v) : '-'}</span>
                    <span>${formatDate(bill.date)}</span>
                </span>
                <span class="bill-item-amount">${formatCurrency(bill.grandTotal)}</span>
            </div>
            <div class="bill-item-actions" onclick="event.stopPropagation()">
                <button class="bill-action-btn" onclick="openBillModal('${bill.id}')">Edit</button>
                <button class="bill-action-btn" onclick="printBill('${bill.id}')">Print</button>
                <button class="bill-action-btn" onclick="shareBillWhatsApp('${bill.id}')">Share</button>
                <button class="bill-action-btn delete" onclick="event.stopPropagation(); deleteBill('${bill.id}');">Delete</button>
            </div>
        </div>`;
    }).join('');
}

function viewBill(billId) {
    const bill = getBills().find(b => b.id === billId);
    if (!bill) return;
    const v = getVehicleById(bill.vehicleId);
    const modal = document.getElementById('billViewModal');
    const content = document.getElementById('billViewContent');

    content.innerHTML = `
    <div class="bill-view" id="billPrintArea-${billId}">
        <div class="bill-view-header">
            <img src="https://mr-vishal-dev.github.io/kuberatravels/logo.png" alt="Logo">
            <h2>Sri <span>Moorthy</span> Transport</h2>
            <p>PACKERS & MOVERS | 85/A Seenivasa Nagar, Sakkotai, Kumbakonam - 612401</p>
            <p>Phone: 8940481999, 9789401999 | Email: srimoorthypackersandmovers@gmail.com</p>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
            <div>
                <strong style="color:var(--orange);">${bill.billNumber}</strong>
            </div>
            <div style="text-align:right;">
                <strong>${formatDate(bill.date)}</strong>
            </div>
        </div>

        <div class="bill-view-section">
            <div class="bill-view-row"><span class="label">Customer</span><span class="value">${bill.customerName}</span></div>
            ${bill.customerPhone ? `<div class="bill-view-row"><span class="label">Phone</span><span class="value">${bill.customerPhone}</span></div>` : ''}
            <div class="bill-view-row"><span class="label">From</span><span class="value">${bill.fromLocation}</span></div>
            <div class="bill-view-row"><span class="label">To</span><span class="value">${bill.toLocation}</span></div>
            <div class="bill-view-row"><span class="label">Vehicle</span><span class="value">${v ? getVehicleDisplay(v) : '-'}</span></div>
            ${bill.goodsDesc ? `<div class="bill-view-row"><span class="label">Goods</span><span class="value">${bill.goodsDesc}</span></div>` : ''}
        </div>

        <div class="bill-view-items">
            <table>
                <thead>
                    <tr><th>#</th><th>Description</th><th style="text-align:right;">Amount</th></tr>
                </thead>
                <tbody>
                    ${(bill.lineItems || []).map((item, i) => `
                        <tr><td>${i + 1}</td><td>${item.desc}</td><td style="text-align:right;">${formatCurrency(item.amount)}</td></tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="bill-view-totals">
            <div class="bill-view-total-row"><span>Subtotal</span><span>${formatCurrency(bill.subtotal)}</span></div>
            ${bill.gstPercent > 0 ? `<div class="bill-view-total-row"><span>GST (${bill.gstPercent}%)</span><span>${formatCurrency(bill.gst)}</span></div>` : ''}
            <div class="bill-view-total-row grand"><span>Grand Total</span><span>${formatCurrency(bill.grandTotal)}</span></div>
            <div class="bill-view-total-row"><span>Paid</span><span style="color:var(--green);">${formatCurrency(bill.amountPaid)}</span></div>
            <div class="bill-view-total-row"><span>Balance</span><span style="color:${bill.balance > 0 ? 'var(--red)' : 'var(--green)'};">${formatCurrency(bill.balance)}</span></div>
        </div>

        ${bill.notes ? `<div style="margin-top:12px;padding:12px;background:var(--bg-surface);border-radius:var(--radius-sm);font-size:13px;color:var(--text-secondary);">
            <strong>Notes:</strong> ${bill.notes}
        </div>` : ''}

        <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:2px dashed var(--border);font-size:12px;color:var(--text-muted);">
            Thank you for choosing Sri Moorthy Transport!<br>
            www.srimoorthy.vercel.app
        </div>
    </div>

    <div class="bill-view-actions">
        <button class="btn-secondary-app" onclick="closeBillView()">Close</button>
        <button class="btn-secondary-app" style="color:var(--red);border-color:rgba(239,68,68,0.4);" onclick="deleteBill('${bill.id}'); closeBillView();">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
        </button>
        <button class="btn-primary-app" onclick="printBill('${bill.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
        </button>
        <button class="btn-primary-app" style="background:linear-gradient(135deg, #25D366, #128C7E);" onclick="shareBillWhatsApp('${bill.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            WhatsApp
        </button>
    </div>`;

    modal.classList.add('show');
}

function closeBillView() {
    document.getElementById('billViewModal').classList.remove('show');
}

function printBill(billId) {
    const bill = getBills().find(b => b.id === billId);
    if (!bill) return;
    const v = getVehicleById(bill.vehicleId);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Bill ${bill.billNumber} - Sri Moorthy Transport</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; padding: 24px; color: #333; max-width: 700px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #EF5226; padding-bottom: 16px; margin-bottom: 20px; }
            .header img { width: 60px; height: 60px; border-radius: 50%; margin-bottom: 8px; }
            .header h1 { font-family: 'Outfit', sans-serif; font-size: 22px; }
            .header h1 span { color: #EF5226; }
            .header p { font-size: 11px; color: #666; }
            .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
            .info-row .label { color: #888; }
            .info-row .value { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th { text-align: left; font-size: 11px; color: #888; padding: 8px 4px; border-bottom: 2px solid #eee; text-transform: uppercase; }
            td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 13px; }
            .totals { background: #f8f9fa; border-radius: 8px; padding: 14px; margin-top: 16px; }
            .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            .grand { border-top: 2px solid #333; padding-top: 8px; margin-top: 6px; font-size: 18px; font-weight: 800; font-family: 'Outfit', sans-serif; }
            .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 2px dashed #ddd; font-size: 12px; color: #888; }
            .bill-number { color: #EF5226; font-weight: 700; font-size: 16px; }
            @media print { body { padding: 0; } }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://mr-vishal-dev.github.io/kuberatravels/logo.png" alt="Logo">
            <h1>Sri <span>Moorthy</span> Transport</h1>
            <p>PACKERS & MOVERS</p>
            <p>85/A Seenivasa Nagar, Sakkotai(PO), Kumbakonam - 612401</p>
            <p>Phone: 8940481999, 9789401999 | Email: srimoorthypackersandmovers@gmail.com</p>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <span class="bill-number">${bill.billNumber}</span>
            <span style="font-weight:600;">${formatDate(bill.date)}</span>
        </div>

        <div class="info-row"><span class="label">Customer</span><span class="value">${bill.customerName}</span></div>
        ${bill.customerPhone ? `<div class="info-row"><span class="label">Phone</span><span class="value">${bill.customerPhone}</span></div>` : ''}
        <div class="info-row"><span class="label">From</span><span class="value">${bill.fromLocation}</span></div>
        <div class="info-row"><span class="label">To</span><span class="value">${bill.toLocation}</span></div>
        <div class="info-row"><span class="label">Vehicle</span><span class="value">${v ? getVehicleDisplay(v) : '-'}</span></div>
        ${bill.goodsDesc ? `<div class="info-row"><span class="label">Goods</span><span class="value">${bill.goodsDesc}</span></div>` : ''}

        <table>
            <thead><tr><th>#</th><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
            <tbody>
                ${(bill.lineItems || []).map((item, i) => `<tr><td>${i + 1}</td><td>${item.desc}</td><td style="text-align:right;">${formatCurrency(item.amount)}</td></tr>`).join('')}
            </tbody>
        </table>

        <div class="totals">
            <div class="total-row"><span>Subtotal</span><span>${formatCurrency(bill.subtotal)}</span></div>
            ${bill.gstPercent > 0 ? `<div class="total-row"><span>GST (${bill.gstPercent}%)</span><span>${formatCurrency(bill.gst)}</span></div>` : ''}
            <div class="total-row grand"><span>Grand Total</span><span>${formatCurrency(bill.grandTotal)}</span></div>
            <div class="total-row"><span>Amount Paid</span><span>${formatCurrency(bill.amountPaid)}</span></div>
            <div class="total-row"><span>Balance</span><span style="color:${bill.balance > 0 ? '#ef4444' : '#10b981'}">${formatCurrency(bill.balance)}</span></div>
        </div>

        ${bill.notes ? `<div style="margin-top:12px;padding:10px;background:#f8f9fa;border-radius:6px;font-size:12px;color:#666;"><strong>Notes:</strong> ${bill.notes}</div>` : ''}

        <div class="footer">
            Thank you for choosing Sri Moorthy Transport!<br>
            www.srimoorthy.vercel.app
        </div>

        <script>window.onload = () => window.print();<\/script>
    </body>
    </html>`);
    printWindow.document.close();
}

function shareBillWhatsApp(billId) {
    const bill = getBills().find(b => b.id === billId);
    if (!bill) return;
    const v = getVehicleById(bill.vehicleId);

    let text = `*📋 Sri Moorthy Transport - Bill*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `*Bill No:* ${bill.billNumber}\n`;
    text += `*Date:* ${formatDate(bill.date)}\n`;
    text += `*Customer:* ${bill.customerName}\n`;
    text += `*From:* ${bill.fromLocation}\n`;
    text += `*To:* ${bill.toLocation}\n`;
    text += `*Vehicle:* ${v ? getVehicleDisplay(v) : '-'}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    (bill.lineItems || []).forEach(item => {
        text += `• ${item.desc}: ${formatCurrency(item.amount)}\n`;
    });
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `*Grand Total: ${formatCurrency(bill.grandTotal)}*\n`;
    text += `*Paid: ${formatCurrency(bill.amountPaid)}*\n`;
    text += `*Balance: ${formatCurrency(bill.balance)}*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `Sri Moorthy Transport\n`;
    text += `📞 8940481999 | 🌐 srimoorthy.vercel.app`;

    const phoneNumber = bill.customerPhone ? bill.customerPhone.replace(/\D/g, '') : '';
    const waUrl = phoneNumber
        ? `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
}

function deleteBill(billId, skipConfirm = false) {
    if (!skipConfirm) {
        if (!confirm('Are you sure you want to delete this bill?')) return;
    }
    const cleanId = String(billId).trim();
    let bills = getBills();
    bills = bills.filter(b => String(b.id) !== cleanId && String(b.billNumber) !== cleanId);
    saveBills(bills);

    // Track deleted IDs so cloud sync never resurrects them
    let deletedBills = getStore('sm_deleted_bills') || [];
    if (!deletedBills.includes(cleanId)) {
        deletedBills.push(cleanId);
        setStore('sm_deleted_bills', deletedBills);
    }

    if (isSupabaseConnected && supabaseClient) {
        if (hasRelationalTables) {
            supabaseClient.from('bills').delete().eq('id', cleanId).then(({ error }) => {
                if (error) console.error('Failed to delete bill from Supabase:', error);
            });
        }
        persistFleetToSupabase();
    }

    renderBills();
    renderDashboard();
    renderVehicles();
    renderReports();
    showToast('Bill deleted successfully ✅', 'info');
}
window.deleteBill = deleteBill;


// ===== FUEL MANAGEMENT & SMART CALCULATOR =====

const DEFAULT_DIESEL_RATE = 100.22;
const DEFAULT_PETROL_RATE = 102.50;

function getLatestFuelRate(vehicleId = null, fuelType = 'diesel') {
    if (fuelType === 'diesel') {
        const customRate = parseFloat(localStorage.getItem('sm_diesel_rate'));
        return customRate > 0 ? customRate : DEFAULT_DIESEL_RATE;
    }
    const logs = getFuelLogs();
    if (vehicleId) {
        const vehicleLog = logs.find(f => f.vehicleId === vehicleId && (f.fuelType || 'diesel') === fuelType && f.rate > 0);
        if (vehicleLog) return parseFloat(vehicleLog.rate);
    }
    const typeLog = logs.find(f => (f.fuelType || 'diesel') === fuelType && f.rate > 0);
    if (typeLog) return parseFloat(typeLog.rate);
    return fuelType === 'petrol' ? DEFAULT_PETROL_RATE : DEFAULT_DIESEL_RATE;
}

function getPreviousOdometer(vehicleId, currentEntryId = null) {
    if (!vehicleId) return null;
    const logs = getFuelLogs().filter(f => f.vehicleId === vehicleId && f.id !== currentEntryId && f.odometer);
    if (logs.length === 0) return null;
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return parseFloat(logs[0].odometer) || null;
}

function openFuelModal(fuelId) {
    const modal = document.getElementById('fuelModal');
    const form = document.getElementById('fuelForm');
    form.reset();

    const rateBadge = document.getElementById('fuelRateBadge');

    if (fuelId) {
        const entry = getFuelLogs().find(f => f.id === fuelId);
        if (!entry) return;
        document.getElementById('fuelModalTitle').textContent = 'Edit Fuel Entry';
        document.getElementById('fuelId').value = entry.id;
        document.getElementById('fuelDate').value = entry.date;
        document.getElementById('fuelVehicle').value = entry.vehicleId;
        document.getElementById('fuelStation').value = entry.station || '';
        document.getElementById('fuelType').value = entry.fuelType || 'diesel';
        document.getElementById('fuelLitres').value = entry.litres;
        document.getElementById('fuelRate').value = entry.rate;
        const totalAmountEl = document.getElementById('fuelTotalAmount');
        if (totalAmountEl) totalAmountEl.value = entry.totalAmount;
        document.getElementById('fuelTotal').value = formatCurrency(entry.totalAmount);
        document.getElementById('fuelOdometer').value = entry.odometer || '';
        document.getElementById('fuelDriver').value = entry.driver || '';
        document.getElementById('fuelNotes').value = entry.notes || '';
        if (rateBadge) rateBadge.textContent = `Recorded: ₹${parseFloat(entry.rate).toFixed(2)}/L`;
    } else {
        document.getElementById('fuelModalTitle').textContent = 'Add Fuel Entry';
        document.getElementById('fuelId').value = '';
        document.getElementById('fuelDate').value = new Date().toISOString().split('T')[0];
        const defaultRate = getLatestFuelRate(null, 'diesel');
        document.getElementById('fuelRate').value = defaultRate.toFixed(2);
        document.getElementById('fuelLitres').value = '';
        const totalAmountEl = document.getElementById('fuelTotalAmount');
        if (totalAmountEl) totalAmountEl.value = '';
        document.getElementById('fuelTotal').value = '₹0.00';
        if (rateBadge) rateBadge.textContent = `Auto-rate: ₹${defaultRate.toFixed(2)}/L`;
    }

    const delBtn = document.getElementById('fuelModalDeleteBtn');
    if (delBtn) delBtn.style.display = fuelId ? 'inline-flex' : 'none';

    updateFuelAnalysis();
    modal.classList.add('show');
}

function deleteCurrentModalFuel() {
    const id = document.getElementById('fuelId').value;
    if (!id) return;
    deleteFuel(id);
    closeFuelModal();
}
window.deleteCurrentModalFuel = deleteCurrentModalFuel;

function closeFuelModal() {
    document.getElementById('fuelModal').classList.remove('show');
}

function onFuelRateInput() {
    const rate = parseFloat(document.getElementById('fuelRate').value) || 0;
    const litres = parseFloat(document.getElementById('fuelLitres').value) || 0;
    const totalInput = document.getElementById('fuelTotalAmount');
    const fuelType = document.getElementById('fuelType')?.value || 'diesel';

    if (rate > 0 && fuelType === 'diesel') {
        localStorage.setItem('sm_diesel_rate', rate.toFixed(2));
    }

    if (rate > 0 && litres > 0) {
        const total = litres * rate;
        if (totalInput) totalInput.value = total.toFixed(2);
        document.getElementById('fuelTotal').value = formatCurrency(total);
    }
    updateFuelAnalysis();
}

function onFuelLitresInput() {
    const litres = parseFloat(document.getElementById('fuelLitres').value) || 0;
    const rate = parseFloat(document.getElementById('fuelRate').value) || 0;
    const totalInput = document.getElementById('fuelTotalAmount');

    if (rate > 0) {
        const total = litres * rate;
        if (totalInput) totalInput.value = total > 0 ? total.toFixed(2) : '';
        document.getElementById('fuelTotal').value = formatCurrency(total);
    }
    updateFuelAnalysis();
}

function onFuelTotalAmountInput() {
    const total = parseFloat(document.getElementById('fuelTotalAmount').value) || 0;
    const rate = parseFloat(document.getElementById('fuelRate').value) || 0;
    const litresInput = document.getElementById('fuelLitres');

    if (rate > 0 && total > 0) {
        const litres = total / rate;
        if (litresInput) litresInput.value = litres.toFixed(2);
    }
    document.getElementById('fuelTotal').value = formatCurrency(total);
    updateFuelAnalysis();
}

function onFuelVehicleChanged() {
    const vehicleId = document.getElementById('fuelVehicle').value;
    const fuelType = document.getElementById('fuelType').value || 'diesel';
    const rateInput = document.getElementById('fuelRate');
    const rateBadge = document.getElementById('fuelRateBadge');

    const suggestedRate = getLatestFuelRate(vehicleId, fuelType);
    if (!rateInput.value || parseFloat(rateInput.value) <= 0) {
        rateInput.value = suggestedRate.toFixed(2);
    }
    if (rateBadge) {
        rateBadge.textContent = `Auto-rate: ₹${suggestedRate.toFixed(2)}/L`;
    }
    updateFuelAnalysis();
}

function onFuelTypeChanged() {
    const vehicleId = document.getElementById('fuelVehicle').value;
    const fuelType = document.getElementById('fuelType').value || 'diesel';
    const suggestedRate = getLatestFuelRate(vehicleId, fuelType);
    document.getElementById('fuelRate').value = suggestedRate.toFixed(2);
    const rateBadge = document.getElementById('fuelRateBadge');
    if (rateBadge) rateBadge.textContent = `Auto-rate: ₹${suggestedRate.toFixed(2)}/L`;
    onFuelRateInput();
}

function applyFuelAmount(amount) {
    const totalInput = document.getElementById('fuelTotalAmount');
    if (totalInput) totalInput.value = amount;
    onFuelTotalAmountInput();
    showToast(`Auto-calculated litres for ₹${amount}`, 'info');
}

function applyFuelLitres(litres) {
    const litresInput = document.getElementById('fuelLitres');
    if (litresInput) litresInput.value = litres;
    onFuelLitresInput();
    showToast(`Auto-calculated price for ${litres} L`, 'info');
}

function updateFuelAnalysis() {
    const litres = parseFloat(document.getElementById('fuelLitres')?.value) || 0;
    const rate = parseFloat(document.getElementById('fuelRate')?.value) || 0;
    const totalAmount = parseFloat(document.getElementById('fuelTotalAmount')?.value) || (litres * rate);
    const vehicleId = document.getElementById('fuelVehicle')?.value;
    const fuelId = document.getElementById('fuelId')?.value;
    const odoInput = document.getElementById('fuelOdometer')?.value;
    const currentOdo = odoInput ? parseFloat(odoInput) : null;

    // UI elements
    const analysisLitres = document.getElementById('analysisLitres');
    const analysisCost = document.getElementById('analysisCost');
    const analysisRateTrend = document.getElementById('analysisRateTrend');
    const analysisTripDistance = document.getElementById('analysisTripDistance');
    const analysisMileage = document.getElementById('analysisMileage');
    const analysisCostPerKm = document.getElementById('analysisCostPerKm');
    const efficiencyBadge = document.getElementById('fuelEfficiencyBadge');
    const odoNote = document.getElementById('fuelOdoNote');
    const prevOdoText = document.getElementById('fuelPrevOdoText');
    const odoDiffText = document.getElementById('fuelOdoDiffText');

    if (analysisLitres) analysisLitres.textContent = litres > 0 ? `${litres.toFixed(2)} L` : '0.00 L';
    if (analysisCost) analysisCost.textContent = formatCurrency(totalAmount);
    if (analysisRateTrend) analysisRateTrend.textContent = rate > 0 ? `₹${rate.toFixed(2)}/L` : '-';

    // Odometer & mileage analysis
    const prevOdo = getPreviousOdometer(vehicleId, fuelId);

    if (currentOdo && prevOdo && currentOdo > prevOdo) {
        const distance = currentOdo - prevOdo;
        if (analysisTripDistance) analysisTripDistance.textContent = `${distance.toLocaleString('en-IN')} km`;

        if (litres > 0) {
            const mileage = distance / litres;
            const costKm = totalAmount > 0 ? totalAmount / distance : (rate * litres) / distance;

            if (analysisMileage) analysisMileage.textContent = `${mileage.toFixed(1)} km/L`;
            if (analysisCostPerKm) analysisCostPerKm.textContent = `₹${costKm.toFixed(2)}/km`;

            if (efficiencyBadge) {
                if (mileage >= 13) {
                    efficiencyBadge.textContent = '🌟 Excellent Mileage';
                    efficiencyBadge.style.color = '#10b981';
                    efficiencyBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                } else if (mileage >= 9.5) {
                    efficiencyBadge.textContent = '✅ Normal Mileage';
                    efficiencyBadge.style.color = '#3b82f6';
                    efficiencyBadge.style.background = 'rgba(59, 130, 246, 0.15)';
                } else {
                    efficiencyBadge.textContent = '⚠️ Heavy Consumption';
                    efficiencyBadge.style.color = '#ef4444';
                    efficiencyBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                }
            }
        } else {
            if (analysisMileage) analysisMileage.textContent = '-';
            if (analysisCostPerKm) analysisCostPerKm.textContent = '-';
        }

        if (odoNote && prevOdoText && odoDiffText) {
            odoNote.style.display = 'flex';
            prevOdoText.textContent = `Previous: ${prevOdo.toLocaleString('en-IN')} km`;
            odoDiffText.textContent = `Distance: ${distance.toLocaleString('en-IN')} km`;
        }
    } else {
        if (analysisTripDistance) analysisTripDistance.textContent = currentOdo ? `${currentOdo.toLocaleString('en-IN')} km` : '-';
        if (analysisMileage) analysisMileage.textContent = '-';
        if (analysisCostPerKm) analysisCostPerKm.textContent = '-';
        if (efficiencyBadge) {
            efficiencyBadge.textContent = litres > 0 ? 'Cost Calculated' : 'Ready';
            efficiencyBadge.style.color = '#f59e0b';
            efficiencyBadge.style.background = 'rgba(245, 158, 11, 0.15)';
        }
        if (odoNote) {
            if (prevOdo) {
                odoNote.style.display = 'flex';
                prevOdoText.textContent = `Previous recorded: ${prevOdo.toLocaleString('en-IN')} km`;
                odoDiffText.textContent = currentOdo ? 'Enter reading > previous' : 'Enter current odometer for km/L';
            } else {
                odoNote.style.display = 'none';
            }
        }
    }
}

function calculateFuelTotal() {
    onFuelLitresInput();
}

function saveFuel(event) {
    event.preventDefault();
    const logs = getFuelLogs();
    const id = document.getElementById('fuelId').value;
    const litres = parseFloat(document.getElementById('fuelLitres').value) || 0;
    const rate = parseFloat(document.getElementById('fuelRate').value) || 0;
    const totalAmount = parseFloat(document.getElementById('fuelTotalAmount')?.value) || (litres * rate);

    const fuelData = {
        date: document.getElementById('fuelDate').value,
        vehicleId: document.getElementById('fuelVehicle').value,
        station: document.getElementById('fuelStation').value,
        fuelType: document.getElementById('fuelType').value,
        litres,
        rate,
        totalAmount,
        odometer: document.getElementById('fuelOdometer').value ? parseFloat(document.getElementById('fuelOdometer').value) : null,
        driver: document.getElementById('fuelDriver').value,
        notes: document.getElementById('fuelNotes').value,
        updatedAt: new Date().toISOString()
    };

    const targetFuelId = id || generateUUID();
    fuelData.id = targetFuelId;

    if (id) {
        const index = logs.findIndex(f => f.id === id);
        if (index !== -1) {
            logs[index] = { ...logs[index], ...fuelData };
        }
        showToast('Fuel entry updated! ✅', 'success');
    } else {
        fuelData.createdAt = new Date().toISOString();
        logs.push(fuelData);
        const v = getVehicleById(fuelData.vehicleId);
        addNotification(`Fuel added: ${litres}L for ${v ? getVehicleDisplay(v) : 'vehicle'}`);
        showToast(`Fuel entry saved: ${litres.toFixed(1)}L @ ${formatCurrency(rate)}! ⛽`, 'success');
    }

    saveFuelLogs(logs);

    if (isSupabaseConnected && supabaseClient) {
        uploadFuelToSupabase(fuelData);
        persistFleetToSupabase();
    }
    closeFuelModal();
    renderFuelLogs();
    renderDashboard();
    renderVehicles();
    renderReports();
}

function renderFuelLogs() {
    const logs = getFuelLogs();
    const container = document.getElementById('fuelList');

    // Fuel summary
    renderFuelSummary(logs);

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M13 10h4a2 2 0 0 1 2 2v8"/><line x1="3" y1="22" x2="23" y2="22"/></svg>
                <h3>No Fuel Records</h3>
                <p>Start tracking fuel expenses</p>
            </div>`;
        return;
    }

    const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sortedLogs.map(f => {
        const v = getVehicleById(f.vehicleId);
        const prevLog = sortedLogs.find(other => other.vehicleId === f.vehicleId && new Date(other.date) < new Date(f.date) && other.odometer);
        let mileageSnippet = '';
        if (prevLog && f.odometer && f.odometer > prevLog.odometer && f.litres > 0) {
            const dist = f.odometer - prevLog.odometer;
            const kmPerLitre = dist / f.litres;
            const costPerKm = f.totalAmount / dist;
            mileageSnippet = `
                <div style="margin-top:5px;display:flex;align-items:center;gap:8px;font-size:11px;flex-wrap:wrap;">
                    <span style="background:rgba(16,185,129,0.12);color:#10b981;padding:1px 7px;border-radius:4px;font-weight:700;">⚡ ${kmPerLitre.toFixed(1)} km/L</span>
                    <span style="color:var(--text-secondary);">📍 ${dist} km run</span>
                    <span style="color:var(--text-muted);">₹${costPerKm.toFixed(2)}/km</span>
                </div>`;
        } else if (f.odometer) {
            mileageSnippet = `<div style="margin-top:3px;font-size:11px;color:var(--text-muted);">Odometer: ${Number(f.odometer).toLocaleString('en-IN')} km</div>`;
        }

        return `
        <div class="fuel-item">
            <div class="fuel-item-icon">⛽</div>
            <div class="fuel-item-info">
                <div class="fuel-item-vehicle">${v ? getVehicleDisplay(v) : '-'}</div>
                <div class="fuel-item-details">${f.litres}L ${f.fuelType || 'diesel'} @ ₹${f.rate}/L${f.station ? ' • ' + f.station : ''}${f.driver ? ' • ' + f.driver : ''}</div>
                ${mileageSnippet}
            </div>
            <div class="fuel-item-right">
                <div class="fuel-item-amount" style="color:var(--red);">${formatCurrency(f.totalAmount)}</div>
                <div class="fuel-item-date">${formatDate(f.date)}</div>
            </div>
            <div class="fuel-item-actions">
                <button class="fuel-action-btn" onclick="openFuelModal('${f.id}')" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="fuel-action-btn" onclick="deleteFuel('${f.id}')" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        </div>`;
    }).join('');
}

function renderFuelSummary(logs) {
    const totalCost = logs.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
    const totalLitres = logs.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
    const avgRate = logs.length > 0 && totalLitres > 0 ? totalCost / totalLitres : 0;

    // Calculate fleet average mileage across all trucks
    let totalFleetDistance = 0;
    let totalFleetMileageLitres = 0;
    const vehicles = getVehicles();
    vehicles.forEach(v => {
        const vLogs = logs.filter(f => f.vehicleId === v.id && f.odometer).sort((a,b) => new Date(a.date) - new Date(b.date));
        if (vLogs.length >= 2) {
            const vDist = parseFloat(vLogs[vLogs.length - 1].odometer) - parseFloat(vLogs[0].odometer);
            const vLtrs = vLogs.slice(1).reduce((sum, item) => sum + (parseFloat(item.litres) || 0), 0);
            if (vDist > 0 && vLtrs > 0) {
                totalFleetDistance += vDist;
                totalFleetMileageLitres += vLtrs;
            }
        }
    });
    const avgMileage = totalFleetMileageLitres > 0 ? (totalFleetDistance / totalFleetMileageLitres).toFixed(1) + ' km/L' : '11.5 km/L';

    document.getElementById('fuelSummaryRow').innerHTML = `
        <div class="fuel-summary-card">
            <div class="fuel-summary-icon" style="background:var(--red-light);color:var(--red);">💰</div>
            <div>
                <span class="fuel-summary-label">Total Fuel Cost</span>
                <span class="fuel-summary-value">${formatCurrency(totalCost)}</span>
            </div>
        </div>
        <div class="fuel-summary-card">
            <div class="fuel-summary-icon" style="background:var(--blue-light);color:var(--blue);">⛽</div>
            <div>
                <span class="fuel-summary-label">Total Litres</span>
                <span class="fuel-summary-value">${totalLitres.toFixed(1)}L</span>
            </div>
        </div>
        <div class="fuel-summary-card">
            <div class="fuel-summary-icon" style="background:var(--purple-light);color:var(--purple);">📊</div>
            <div>
                <span class="fuel-summary-label">Avg Rate/Litre</span>
                <span class="fuel-summary-value">${avgRate > 0 ? '₹' + avgRate.toFixed(2) : '₹100.22'}</span>
            </div>
        </div>
        <div class="fuel-summary-card">
            <div class="fuel-summary-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">⚡</div>
            <div>
                <span class="fuel-summary-label">Fleet Mileage</span>
                <span class="fuel-summary-value" style="color:#10b981;">${avgMileage}</span>
            </div>
        </div>`;
}

function filterFuel() {
    const vehicleFilter = document.getElementById('fuelVehicleFilter').value;
    const monthFilter = document.getElementById('fuelMonthFilter').value;

    let logs = getFuelLogs();

    if (vehicleFilter) {
        logs = logs.filter(f => f.vehicleId === vehicleFilter);
    }

    if (monthFilter !== '') {
        logs = logs.filter(f => new Date(f.date).getMonth() === parseInt(monthFilter));
    }

    renderFuelSummary(logs);

    const container = document.getElementById('fuelList');
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No matching fuel records found</p></div>';
        return;
    }

    const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sortedLogs.map(f => {
        const v = getVehicleById(f.vehicleId);
        return `
        <div class="fuel-item">
            <div class="fuel-item-icon">⛽</div>
            <div class="fuel-item-info">
                <div class="fuel-item-vehicle">${v ? getVehicleDisplay(v) : '-'}</div>
                <div class="fuel-item-details">${f.litres}L ${f.fuelType || 'diesel'} @ ₹${f.rate}/L${f.station ? ' • ' + f.station : ''}</div>
            </div>
            <div class="fuel-item-right">
                <div class="fuel-item-amount" style="color:var(--red);">${formatCurrency(f.totalAmount)}</div>
                <div class="fuel-item-date">${formatDate(f.date)}</div>
            </div>
            <div class="fuel-item-actions">
                <button class="fuel-action-btn" onclick="openFuelModal('${f.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="fuel-action-btn" onclick="event.stopPropagation(); deleteFuel('${f.id}');"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
        </div>`;
    }).join('');
}

function deleteFuel(fuelId, skipConfirm = false) {
    if (!skipConfirm) {
        if (!confirm('Delete this fuel entry?')) return;
    }
    const cleanId = String(fuelId).trim();
    let logs = getFuelLogs();
    logs = logs.filter(f => String(f.id) !== cleanId);
    saveFuelLogs(logs);

    let deletedFuel = getStore('sm_deleted_fuel') || [];
    if (!deletedFuel.includes(cleanId)) {
        deletedFuel.push(cleanId);
        setStore('sm_deleted_fuel', deletedFuel);
    }

    if (isSupabaseConnected && supabaseClient) {
        if (hasRelationalTables) {
            supabaseClient.from('fuel_logs').delete().eq('id', cleanId).then(({ error }) => {
                if (error) console.error('Failed to delete fuel from Supabase:', error);
            });
        }
        persistFleetToSupabase();
    }

    renderFuelLogs();
    renderDashboard();
    renderVehicles();
    renderReports();
    showToast('Fuel entry deleted successfully ✅', 'info');
}
window.deleteFuel = deleteFuel;


// ===== REPORTS & ANALYTICS (Weekly, Monthly, Annual, Custom) =====
let reportState = {
    period: 'this_month', // 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all_time' | 'custom'
    vehicleId: 'all',
    monthGranularity: 'week', // 'week' (W1-W5) or 'day' (1-31)
    customStart: '',
    customEnd: '',
    txnTab: 'bills' // 'bills' | 'fuel'
};

function formatISODate(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getReportDateRange(period) {
    const now = new Date();
    let start, end, label, subLabel;

    if (period === 'this_week' || period === 'last_week') {
        const offset = period === 'this_week' ? 0 : -1;
        const d = new Date(now);
        const day = d.getDay(); // 0 is Sun, 1 is Mon
        const diff = d.getDate() - (day === 0 ? 6 : day - 1) + (offset * 7);
        start = new Date(d.setDate(diff));
        start.setHours(0, 0, 0, 0);

        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        const startStr = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const endStr = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        label = `${startStr} – ${endStr}`;
        subLabel = period === 'this_week' ? 'Current Week (7 Days)' : 'Previous Week (7 Days)';
    } else if (period === 'this_month' || period === 'last_month') {
        const offset = period === 'this_month' ? 0 : -1;
        const y = now.getFullYear();
        const m = now.getMonth() + offset;
        start = new Date(y, m, 1, 0, 0, 0, 0);
        end = new Date(y, m + 1, 0, 23, 59, 59, 999);

        const monthName = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const startStr = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const endStr = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        label = `${startStr} – ${endStr} (${monthName})`;
        subLabel = period === 'this_month' ? 'Current Month' : 'Previous Month';
    } else if (period === 'custom') {
        if (reportState.customStart && reportState.customEnd) {
            start = new Date(reportState.customStart + 'T00:00:00');
            end = new Date(reportState.customEnd + 'T23:59:59');
            const startStr = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const endStr = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            label = `${startStr} – ${endStr}`;
            subLabel = 'Custom Date Filter';
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            label = 'Custom Range';
            subLabel = 'Select dates';
        }
    } else { // 'all_time'
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        label = `All Time (${now.getFullYear()} Annual)`;
        subLabel = 'Full Fleet Lifetime Records';
    }

    return {
        start,
        end,
        startISO: formatISODate(start),
        endISO: formatISODate(end),
        label,
        subLabel
    };
}

function setReportPeriod(period) {
    reportState.period = period;
    
    // Update active tab buttons
    document.querySelectorAll('.report-period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });

    // Custom range inputs visibility
    const customPicker = document.getElementById('reportCustomPicker');
    if (customPicker) {
        customPicker.style.display = (period === 'custom') ? 'flex' : 'none';
        if (period === 'custom' && (!reportState.customStart || !reportState.customEnd)) {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startISO = formatISODate(startOfMonth);
            const endISO = formatISODate(now);
            const sInput = document.getElementById('reportCustomStart');
            const eInput = document.getElementById('reportCustomEnd');
            if (sInput) sInput.value = startISO;
            if (eInput) eInput.value = endISO;
            reportState.customStart = startISO;
            reportState.customEnd = endISO;
        }
    }

    // Granularity toggle visibility
    const granToggle = document.getElementById('reportGranularityToggle');
    if (granToggle) {
        granToggle.style.display = (period === 'this_month' || period === 'last_month') ? 'flex' : 'none';
    }

    renderReports();
}

function setMonthGranularity(gran) {
    reportState.monthGranularity = gran;
    const weeklyBtn = document.getElementById('granWeeklyBtn');
    const dailyBtn = document.getElementById('granDailyBtn');
    if (weeklyBtn) weeklyBtn.classList.toggle('active', gran === 'week');
    if (dailyBtn) dailyBtn.classList.toggle('active', gran === 'day');
    renderReports();
}

function onReportVehicleChange() {
    const sel = document.getElementById('reportVehicleFilter');
    if (sel) {
        reportState.vehicleId = sel.value;
        renderReports();
    }
}

function applyCustomReportDates() {
    const start = document.getElementById('reportCustomStart')?.value;
    const end = document.getElementById('reportCustomEnd')?.value;
    if (start && end) {
        if (start > end) {
            showToast('Start date cannot be after end date', 'error');
            return;
        }
        reportState.customStart = start;
        reportState.customEnd = end;
        renderReports();
        showToast('Custom period applied 📅', 'info');
    }
}

function switchReportTxnTab(tab) {
    reportState.txnTab = tab;
    const pillBills = document.getElementById('pillShowBills');
    const pillFuel = document.getElementById('pillShowFuel');
    const billsSec = document.getElementById('reportBillsSection');
    const fuelSec = document.getElementById('reportFuelSection');

    if (pillBills) pillBills.classList.toggle('active', tab === 'bills');
    if (pillFuel) pillFuel.classList.toggle('active', tab === 'fuel');
    if (billsSec) billsSec.style.display = tab === 'bills' ? 'flex' : 'none';
    if (fuelSec) fuelSec.style.display = tab === 'fuel' ? 'flex' : 'none';
}

function populateReportVehicleFilter() {
    const select = document.getElementById('reportVehicleFilter');
    if (!select) return;
    const vehicles = getVehicles();
    const currentVal = reportState.vehicleId || 'all';
    select.innerHTML = `<option value="all">All Fleet Vehicles (${vehicles.length})</option>` +
        vehicles.map(v => `<option value="${v.id}">${v.name} - ${v.number}</option>`).join('');
    select.value = currentVal;
}

// ===== MAIN RENDER REPORTS =====
function renderReports() {
    populateReportVehicleFilter();

    const dateRange = getReportDateRange(reportState.period);
    const rangeText = document.getElementById('reportRangeText');
    if (rangeText) {
        rangeText.textContent = `${dateRange.label} • ${dateRange.subLabel}`;
    }

    const allBills = getBills();
    const allFuel = getFuelLogs();
    const vehicles = getVehicles();

    // Filter by period
    let periodBills = allBills;
    let periodFuel = allFuel;
    if (reportState.period !== 'all_time') {
        periodBills = allBills.filter(b => {
            const d = (b.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        periodFuel = allFuel.filter(f => {
            const d = (f.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
    }

    // Filter by vehicle
    if (reportState.vehicleId !== 'all') {
        periodBills = periodBills.filter(b => b.vehicleId === reportState.vehicleId);
        periodFuel = periodFuel.filter(f => f.vehicleId === reportState.vehicleId);
    }

    // Update Counts & Tags
    const pnlTag = document.getElementById('pnlPeriodTag');
    if (pnlTag) {
        const periodNames = {
            this_week: 'This Week',
            last_week: 'Last Week',
            this_month: 'This Month',
            last_month: 'Last Month',
            all_time: 'All Time',
            custom: 'Custom Range'
        };
        pnlTag.textContent = periodNames[reportState.period] || 'Selected Period';
    }

    renderPeriodKPIs(periodBills, periodFuel, vehicles);
    renderRevenueChart(periodBills, dateRange, reportState.period);
    renderFuelChart(periodFuel, dateRange, reportState.period);
    renderVehicleChart(vehicles, periodBills, periodFuel);
    renderPnLTable(vehicles, periodBills, periodFuel);
    renderPeriodTxnList(periodBills, periodFuel);
}

// ===== EXECUTIVE KPIS =====
function renderPeriodKPIs(bills, fuel, vehicles) {
    const container = document.getElementById('reportKpiRow');
    if (!container) return;

    const totalRevenue = bills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const totalFuelCost = fuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
    const totalLitres = fuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
    const netProfit = totalRevenue - totalFuelCost;
    const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    const totalPending = bills.reduce((s, b) => s + (parseFloat(b.balance) || 0), 0);

    // Mileage calculation
    let totalKm = 0;
    vehicles.forEach(v => {
        const vFuel = fuel.filter(f => f.vehicleId === v.id && f.odometer > 0)
                          .sort((a, b) => parseFloat(a.odometer) - parseFloat(b.odometer));
        if (vFuel.length >= 2) {
            totalKm += (parseFloat(vFuel[vFuel.length - 1].odometer) - parseFloat(vFuel[0].odometer));
        }
    });
    const avgMileage = (totalKm > 0 && totalLitres > 0) ? (totalKm / totalLitres).toFixed(1) + ' km/L' : (totalLitres > 0 ? `${totalLitres.toFixed(0)} L used` : '—');

    container.innerHTML = `
        <div class="report-kpi-card">
            <div class="report-kpi-icon orange">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Gross Revenue</div>
                <div class="report-kpi-val">${formatCurrency(totalRevenue)}</div>
                <div class="report-kpi-sub">${bills.length} Bill${bills.length === 1 ? '' : 's'} issued</div>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon red">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M13 10h4a2 2 0 0 1 2 2v8"/><line x1="3" y1="22" x2="23" y2="22"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Fuel Expenses</div>
                <div class="report-kpi-val">${formatCurrency(totalFuelCost)}</div>
                <div class="report-kpi-sub">${totalLitres.toFixed(1)} Litres diesel</div>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon ${netProfit >= 0 ? 'green' : 'red'}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Net Profit</div>
                <div class="report-kpi-val" style="color:${netProfit >= 0 ? 'var(--green)' : 'var(--red)'};">${formatCurrency(netProfit)}</div>
                <span class="report-kpi-badge ${netProfit >= 0 ? 'profit' : 'loss'}">${netProfit >= 0 ? '+' : ''}${margin}% Margin</span>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Fleet Efficiency</div>
                <div class="report-kpi-val">${avgMileage}</div>
                <div class="report-kpi-sub">${totalKm > 0 ? totalKm.toFixed(0) + ' km driven' : 'Distance tracking'}</div>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Pending Dues</div>
                <div class="report-kpi-val" style="color:${totalPending > 0 ? 'var(--orange)' : 'var(--green)'};">${formatCurrency(totalPending)}</div>
                <div class="report-kpi-sub">Uncollected balance</div>
            </div>
        </div>
    `;
}

// ===== DYNAMIC REVENUE CHART =====
function renderRevenueChart(bills, dateRange, period) {
    const container = document.getElementById('revenueChart');
    const titleEl = document.getElementById('revenueChartTitle');
    const totalEl = document.getElementById('revenueChartTotal');
    if (!container) return;

    let buckets = [];
    const totalRev = bills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    if (totalEl) totalEl.textContent = formatCurrency(totalRev);

    if (period === 'this_week' || period === 'last_week') {
        if (titleEl) titleEl.textContent = `Daily Revenue (${period === 'this_week' ? 'This Week' : 'Last Week'})`;
        const curr = new Date(dateRange.start);
        for (let i = 0; i < 7; i++) {
            const dateISO = formatISODate(curr);
            const dayName = curr.toLocaleDateString('en-IN', { weekday: 'short' });
            const dayNum = String(curr.getDate()).padStart(2, '0');
            buckets.push({
                key: dateISO,
                label: `${dayName} ${dayNum}`,
                amount: 0
            });
            curr.setDate(curr.getDate() + 1);
        }
        bills.forEach(b => {
            const d = (b.date || '').split('T')[0];
            const bk = buckets.find(item => item.key === d);
            if (bk) bk.amount += parseFloat(b.grandTotal) || 0;
        });
    } else if (period === 'this_month' || period === 'last_month') {
        const monthName = dateRange.start.toLocaleDateString('en-IN', { month: 'short' });
        if (reportState.monthGranularity === 'day') {
            if (titleEl) titleEl.textContent = `Daily Revenue (${monthName} 1–${dateRange.end.getDate()})`;
            const daysInMonth = dateRange.end.getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const dayStr = String(i).padStart(2, '0');
                const curr = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), i);
                buckets.push({
                    key: formatISODate(curr),
                    label: dayStr,
                    amount: 0
                });
            }
            bills.forEach(b => {
                const d = (b.date || '').split('T')[0];
                const bk = buckets.find(item => item.key === d);
                if (bk) bk.amount += parseFloat(b.grandTotal) || 0;
            });
        } else {
            if (titleEl) titleEl.textContent = `Weekly Revenue (${monthName} Breakdown)`;
            const daysInMonth = dateRange.end.getDate();
            buckets = [
                { label: 'W1 (1-7)', startDay: 1, endDay: 7, amount: 0 },
                { label: 'W2 (8-14)', startDay: 8, endDay: 14, amount: 0 },
                { label: 'W3 (15-21)', startDay: 15, endDay: 21, amount: 0 },
                { label: 'W4 (22-28)', startDay: 22, endDay: 28, amount: 0 }
            ];
            if (daysInMonth > 28) {
                buckets.push({ label: `W5 (29-${daysInMonth})`, startDay: 29, endDay: daysInMonth, amount: 0 });
            }
            bills.forEach(b => {
                const d = new Date(b.date);
                const day = d.getDate();
                const bk = buckets.find(item => day >= item.startDay && day <= item.endDay);
                if (bk) bk.amount += parseFloat(b.grandTotal) || 0;
            });
        }
    } else { // all_time or custom
        if (titleEl) titleEl.textContent = period === 'all_time' ? 'Annual Monthly Revenue' : 'Revenue Breakdown';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        buckets = months.map(m => ({ label: m, amount: 0 }));
        bills.forEach(b => {
            const m = new Date(b.date).getMonth();
            if (m >= 0 && m < 12) buckets[m].amount += parseFloat(b.grandTotal) || 0;
        });
    }

    const maxVal = Math.max(...buckets.map(b => b.amount), 1);

    const minWidthStyle = buckets.length > 14 ? `style="min-width:${buckets.length * 24}px;"` : '';
    container.innerHTML = `
        <div class="chart-bars" ${minWidthStyle}>
            ${buckets.map(b => `
                <div class="chart-bar-wrap" title="${b.label}: ${formatCurrency(b.amount)}">
                    <span class="chart-bar-value">${b.amount > 0 ? (b.amount >= 1000 ? '₹' + (b.amount / 1000).toFixed(1) + 'k' : '₹' + b.amount) : ''}</span>
                    <div class="chart-bar orange" style="height: ${Math.max((b.amount / maxVal) * 140, 4)}px;"></div>
                    <span class="chart-bar-label">${b.label}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ===== DYNAMIC FUEL CHART =====
function renderFuelChart(fuel, dateRange, period) {
    const container = document.getElementById('fuelChart');
    const titleEl = document.getElementById('fuelChartTitle');
    const totalEl = document.getElementById('fuelChartTotal');
    if (!container) return;

    let buckets = [];
    const totalFuel = fuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
    if (totalEl) totalEl.textContent = formatCurrency(totalFuel);

    if (period === 'this_week' || period === 'last_week') {
        if (titleEl) titleEl.textContent = `Daily Fuel (${period === 'this_week' ? 'This Week' : 'Last Week'})`;
        const curr = new Date(dateRange.start);
        for (let i = 0; i < 7; i++) {
            const dateISO = formatISODate(curr);
            const dayName = curr.toLocaleDateString('en-IN', { weekday: 'short' });
            const dayNum = String(curr.getDate()).padStart(2, '0');
            buckets.push({
                key: dateISO,
                label: `${dayName} ${dayNum}`,
                amount: 0
            });
            curr.setDate(curr.getDate() + 1);
        }
        fuel.forEach(f => {
            const d = (f.date || '').split('T')[0];
            const bk = buckets.find(item => item.key === d);
            if (bk) bk.amount += parseFloat(f.totalAmount) || 0;
        });
    } else if (period === 'this_month' || period === 'last_month') {
        const monthName = dateRange.start.toLocaleDateString('en-IN', { month: 'short' });
        if (reportState.monthGranularity === 'day') {
            if (titleEl) titleEl.textContent = `Daily Fuel (${monthName} 1–${dateRange.end.getDate()})`;
            const daysInMonth = dateRange.end.getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const dayStr = String(i).padStart(2, '0');
                const curr = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), i);
                buckets.push({
                    key: formatISODate(curr),
                    label: dayStr,
                    amount: 0
                });
            }
            fuel.forEach(f => {
                const d = (f.date || '').split('T')[0];
                const bk = buckets.find(item => item.key === d);
                if (bk) bk.amount += parseFloat(f.totalAmount) || 0;
            });
        } else {
            if (titleEl) titleEl.textContent = `Weekly Fuel (${monthName} Breakdown)`;
            const daysInMonth = dateRange.end.getDate();
            buckets = [
                { label: 'W1 (1-7)', startDay: 1, endDay: 7, amount: 0 },
                { label: 'W2 (8-14)', startDay: 8, endDay: 14, amount: 0 },
                { label: 'W3 (15-21)', startDay: 15, endDay: 21, amount: 0 },
                { label: 'W4 (22-28)', startDay: 22, endDay: 28, amount: 0 }
            ];
            if (daysInMonth > 28) {
                buckets.push({ label: `W5 (29-${daysInMonth})`, startDay: 29, endDay: daysInMonth, amount: 0 });
            }
            fuel.forEach(f => {
                const d = new Date(f.date);
                const day = d.getDate();
                const bk = buckets.find(item => day >= item.startDay && day <= item.endDay);
                if (bk) bk.amount += parseFloat(f.totalAmount) || 0;
            });
        }
    } else { // all_time or custom
        if (titleEl) titleEl.textContent = period === 'all_time' ? 'Annual Monthly Fuel' : 'Fuel Expense Breakdown';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        buckets = months.map(m => ({ label: m, amount: 0 }));
        fuel.forEach(f => {
            const m = new Date(f.date).getMonth();
            if (m >= 0 && m < 12) buckets[m].amount += parseFloat(f.totalAmount) || 0;
        });
    }

    const maxVal = Math.max(...buckets.map(b => b.amount), 1);

    const minWidthStyle = buckets.length > 14 ? `style="min-width:${buckets.length * 24}px;"` : '';
    container.innerHTML = `
        <div class="chart-bars" ${minWidthStyle}>
            ${buckets.map(b => `
                <div class="chart-bar-wrap" title="${b.label}: ${formatCurrency(b.amount)}">
                    <span class="chart-bar-value">${b.amount > 0 ? (b.amount >= 1000 ? '₹' + (b.amount / 1000).toFixed(1) + 'k' : '₹' + b.amount) : ''}</span>
                    <div class="chart-bar green" style="height: ${Math.max((b.amount / maxVal) * 140, 4)}px;"></div>
                    <span class="chart-bar-label">${b.label}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ===== VEHICLE PERFORMANCE CHART =====
function renderVehicleChart(vehicles, bills, fuel) {
    const container = document.getElementById('vehicleChart');
    if (!container) return;

    const totalFleetRev = bills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);

    const earnings = vehicles.map(v => {
        const amount = bills.filter(b => b.vehicleId === v.id).reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fuelAmt = fuel.filter(f => f.vehicleId === v.id).reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
        const share = totalFleetRev > 0 ? ((amount / totalFleetRev) * 100).toFixed(1) : 0;
        return { vehicle: v, amount, fuelAmt, share };
    });

    const maxVal = Math.max(...earnings.map(e => e.amount), 1);
    const colors = ['var(--orange)', 'var(--blue)', 'var(--green)', 'var(--purple)'];

    container.innerHTML = earnings.map((e, i) => `
        <div class="vehicle-earning-item">
            <span class="ve-name">
                <strong>${e.vehicle.name}</strong><br>
                <small style="color:var(--text-muted);font-family:monospace;">${e.vehicle.number}</small>
            </span>
            <div class="ve-bar-wrap">
                <div class="ve-bar" style="width: ${(e.amount / maxVal) * 100}%; background: ${colors[i % colors.length]};"></div>
            </div>
            <div style="text-align:right;">
                <div class="ve-amount">${formatCurrency(e.amount)}</div>
                <small style="font-size:11px;color:var(--text-muted);">${e.share}% fleet</small>
            </div>
        </div>
    `).join('');
}

// ===== PERIOD P&L TABLE =====
function renderPnLTable(vehicles, bills, fuel) {
    const container = document.getElementById('pnlTable');
    if (!container) return;

    let totalBillsCount = 0;
    let totalRevenue = 0;
    let totalLitres = 0;
    let totalFuel = 0;

    let tableRows = vehicles.map(v => {
        const vBills = bills.filter(b => b.vehicleId === v.id);
        const vFuel = fuel.filter(f => f.vehicleId === v.id);

        const revenue = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fuelCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
        const litres = vFuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
        const profit = revenue - fuelCost;
        const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) + '%' : '0.0%';

        totalBillsCount += vBills.length;
        totalRevenue += revenue;
        totalLitres += litres;
        totalFuel += fuelCost;

        return `
            <tr>
                <td><strong>${v.name}</strong> <span style="font-size:11px;color:var(--text-muted);font-family:monospace;">(${v.number})</span></td>
                <td style="text-align:center;">${vBills.length}</td>
                <td style="color:var(--green);font-weight:700;">${formatCurrency(revenue)}</td>
                <td style="color:var(--text-secondary);">${litres.toFixed(1)} L</td>
                <td style="color:var(--red);font-weight:600;">${formatCurrency(fuelCost)}</td>
                <td class="${profit >= 0 ? 'profit' : 'loss'}">${formatCurrency(profit)}</td>
                <td style="font-weight:700;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};">${profit >= 0 ? '+' : ''}${margin}</td>
            </tr>`;
    }).join('');

    const totalProfit = totalRevenue - totalFuel;
    const totalMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '%' : '0.0%';

    container.innerHTML = `
    <table>
        <thead>
            <tr>
                <th>Vehicle</th>
                <th style="text-align:center;">Trips</th>
                <th>Revenue</th>
                <th>Fuel (L)</th>
                <th>Fuel Cost</th>
                <th>Net Profit</th>
                <th>Margin %</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
            <tr style="font-weight:800;border-top:2px solid var(--border);background:var(--bg-surface);">
                <td>TOTAL FLEET</td>
                <td style="text-align:center;">${totalBillsCount}</td>
                <td style="color:var(--green);">${formatCurrency(totalRevenue)}</td>
                <td>${totalLitres.toFixed(1)} L</td>
                <td style="color:var(--red);">${formatCurrency(totalFuel)}</td>
                <td class="${totalProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(totalProfit)}</td>
                <td style="color:${totalProfit >= 0 ? 'var(--green)' : 'var(--red)'};">${totalProfit >= 0 ? '+' : ''}${totalMargin}</td>
            </tr>
        </tbody>
    </table>`;
}

// ===== PERIOD TRANSACTION DRILLDOWN LIST =====
function renderPeriodTxnList(bills, fuel) {
    const billsSec = document.getElementById('reportBillsSection');
    const fuelSec = document.getElementById('reportFuelSection');
    const bCount = document.getElementById('periodBillsCount');
    const fCount = document.getElementById('periodFuelCount');

    if (bCount) bCount.textContent = bills.length;
    if (fCount) fCount.textContent = fuel.length;

    if (billsSec) {
        if (bills.length === 0) {
            billsSec.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted);"><p>No billing records found for this period</p></div>';
        } else {
            const sortedBills = [...bills].sort((a, b) => new Date(b.date) - new Date(a.date));
            billsSec.innerHTML = sortedBills.map(b => {
                const v = getVehicleById(b.vehicleId);
                return `
                    <div class="report-txn-item" onclick="viewBill('${b.id}')" style="cursor:pointer;" title="Click to view invoice">
                        <div class="report-txn-left">
                            <span class="report-txn-main">${b.billNumber} • ${b.customerName || 'Standard Consignment'}</span>
                            <span class="report-txn-sub">${formatDate(b.date)} | ${v ? v.name + ' (' + v.number + ')' : '-'} | ${b.fromLocation || ''} → ${b.toLocation || ''}</span>
                        </div>
                        <div class="report-txn-right">
                            <span class="report-txn-amount revenue">${formatCurrency(b.grandTotal)}</span>
                            <span class="report-txn-sub" style="color:${b.balance > 0 ? 'var(--red)' : 'var(--green)'};">${b.balance > 0 ? 'Due: ' + formatCurrency(b.balance) : 'Paid'}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    if (fuelSec) {
        if (fuel.length === 0) {
            fuelSec.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted);"><p>No fuel expense records found for this period</p></div>';
        } else {
            const sortedFuel = [...fuel].sort((a, b) => new Date(b.date) - new Date(a.date));
            fuelSec.innerHTML = sortedFuel.map(f => {
                const v = getVehicleById(f.vehicleId);
                return `
                    <div class="report-txn-item" onclick="openFuelModal('${f.id}')" style="cursor:pointer;" title="Click to view/edit fuel entry">
                        <div class="report-txn-left">
                            <span class="report-txn-main">${parseFloat(f.litres).toFixed(1)} L Diesel @ ${formatCurrency(f.rate)}/L</span>
                            <span class="report-txn-sub">${formatDate(f.date)} | ${v ? v.name + ' (' + v.number + ')' : '-'} | ${f.station || 'Fuel Station'}</span>
                        </div>
                        <div class="report-txn-right">
                            <span class="report-txn-amount fuel">${formatCurrency(f.totalAmount)}</span>
                            <span class="report-txn-sub">${f.odometer ? 'Odo: ' + f.odometer + ' km' : 'Refill'}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// ===== EXPORT PERIOD CSV =====
function exportPeriodReportCsv() {
    const dateRange = getReportDateRange(reportState.period);
    const allBills = getBills();
    const allFuel = getFuelLogs();
    const vehicles = getVehicles();

    let bills = allBills;
    let fuel = allFuel;
    if (reportState.period !== 'all_time') {
        bills = allBills.filter(b => {
            const d = (b.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        fuel = allFuel.filter(f => {
            const d = (f.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
    }

    if (reportState.vehicleId !== 'all') {
        bills = bills.filter(b => b.vehicleId === reportState.vehicleId);
        fuel = fuel.filter(f => f.vehicleId === reportState.vehicleId);
    }

    const totalRev = bills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const totalFuel = fuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
    const netProfit = totalRev - totalFuel;

    let csv = `Sri Moorthy Transport - Fleet Financial Statement\n`;
    csv += `Period,${dateRange.label}\n`;
    csv += `Scope,${reportState.vehicleId === 'all' ? 'All Fleet Vehicles' : reportState.vehicleId}\n`;
    csv += `Generated On,${new Date().toLocaleString('en-IN')}\n\n`;

    csv += `EXECUTIVE SUMMARY\n`;
    csv += `Gross Revenue,Fuel Expense,Net Profit,Profit Margin,Total Invoices,Total Fuel Logs\n`;
    csv += `${totalRev},${totalFuel},${netProfit},${totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) + '%' : '0%'},${bills.length},${fuel.length}\n\n`;

    csv += `VEHICLE PERFORMANCE SUMMARY\n`;
    csv += `Vehicle Name,Vehicle Number,Invoices,Gross Revenue,Fuel Litres,Fuel Expense,Net Profit\n`;
    vehicles.forEach(v => {
        const vBills = bills.filter(b => b.vehicleId === v.id);
        const vFuel = fuel.filter(f => f.vehicleId === v.id);
        const rev = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
        const ltrs = vFuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
        const prof = rev - fCost;
        csv += `"${v.name}","${v.number}",${vBills.length},${rev},${ltrs},${fCost},${prof}\n`;
    });

    csv += `\nDETAILED INVOICES & BILLS\n`;
    csv += `Bill No,Date,Vehicle,Customer,Route,Subtotal,GST,Grand Total,Paid,Balance,Status\n`;
    bills.forEach(b => {
        const v = getVehicleById(b.vehicleId);
        csv += `"${b.billNumber}","${b.date}","${v ? v.number : '-'}","${b.customerName || ''}","${b.fromLocation || ''} -> ${b.toLocation || ''}",${b.subtotal || 0},${b.gst || 0},${b.grandTotal || 0},${b.amountPaid || 0},${b.balance || 0},"${b.paymentStatus || ''}"\n`;
    });

    csv += `\nDETAILED FUEL EXPENSES\n`;
    csv += `Date,Vehicle,Station,Litres,Rate,Total Cost,Odometer,Driver\n`;
    fuel.forEach(f => {
        const v = getVehicleById(f.vehicleId);
        csv += `"${f.date}","${v ? v.number : '-'}","${f.station || ''}",${f.litres || 0},${f.rate || 0},${f.totalAmount || 0},"${f.odometer || ''}","${f.driver || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SriMoorthy_Report_${reportState.period}_${dateRange.startISO}_${dateRange.endISO}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Weekly/Monthly CSV report downloaded! 📊', 'success');
}

// ===== PRINT FORMAL REPORT STATEMENT =====
function printReportStatement() {
    const dateRange = getReportDateRange(reportState.period);
    const allBills = getBills();
    const allFuel = getFuelLogs();
    const vehicles = getVehicles();

    let bills = allBills;
    let fuel = allFuel;
    if (reportState.period !== 'all_time') {
        bills = allBills.filter(b => {
            const d = (b.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        fuel = allFuel.filter(f => {
            const d = (f.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
    }

    if (reportState.vehicleId !== 'all') {
        bills = bills.filter(b => b.vehicleId === reportState.vehicleId);
        fuel = fuel.filter(f => f.vehicleId === reportState.vehicleId);
    }

    const totalRev = bills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const totalFuel = fuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
    const totalLitres = fuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
    const netProfit = totalRev - totalFuel;
    const margin = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) + '%' : '0%';

    const pWin = window.open('', '_blank');
    pWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Sri Moorthy Transport - Statement (${dateRange.label})</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Inter', sans-serif; padding:30px; color:#1e293b; max-width:850px; margin:0 auto; font-size:13px; line-height:1.5; }
            .header { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #EF5226; padding-bottom:16px; margin-bottom:20px; }
            .brand h1 { font-family:'Outfit', sans-serif; font-size:24px; color:#0f172a; }
            .brand h1 span { color:#EF5226; }
            .brand p { font-size:11px; color:#64748b; }
            .meta { text-align:right; font-size:12px; color:#475569; }
            .meta strong { color:#0f172a; }
            .period-badge { display:inline-block; background:#fff1ee; color:#EF5226; font-weight:700; padding:4px 10px; border-radius:6px; margin-top:4px; font-size:12px; }
            .kpi-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin:20px 0; }
            .kpi-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
            .kpi-title { font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; }
            .kpi-val { font-family:'Outfit', sans-serif; font-size:18px; font-weight:800; color:#0f172a; margin-top:4px; }
            .kpi-val.green { color:#16a34a; }
            .kpi-val.red { color:#dc2626; }
            h3 { font-family:'Outfit', sans-serif; font-size:15px; margin:22px 0 10px 0; color:#0f172a; border-left:4px solid #EF5226; padding-left:8px; }
            table { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:12px; }
            th { background:#f1f5f9; padding:8px 10px; text-align:left; font-size:11px; text-transform:uppercase; color:#475569; border:1px solid #cbd5e1; }
            td { padding:8px 10px; border:1px solid #e2e8f0; }
            tr:nth-child(even) { background:#f8fafc; }
            .total-row { font-weight:800; background:#e2e8f0 !important; }
            .footer-sign { display:flex; justify-content:space-between; margin-top:40px; padding-top:20px; border-top:1px dashed #cbd5e1; }
            .sign-box { text-align:center; min-width:180px; }
            .sign-line { border-top:1px solid #475569; margin-top:40px; padding-top:6px; font-weight:600; font-size:11px; }
            @media print { body { padding:10px; } button { display:none; } }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="brand">
                <h1>SriMoorthy <span>FLEET</span></h1>
                <p>Heavy Transport, Logistics & Vehicle Fleet Operations</p>
                <div class="period-badge">📅 ${dateRange.label}</div>
            </div>
            <div class="meta">
                <p><strong>REPORT STATEMENT</strong></p>
                <p>Generated: ${new Date().toLocaleDateString('en-IN')}</p>
                <p>Scope: ${reportState.vehicleId === 'all' ? 'Entire Fleet' : reportState.vehicleId}</p>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-title">Gross Revenue</div>
                <div class="kpi-val green">${formatCurrency(totalRev)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Fuel Expenses</div>
                <div class="kpi-val red">${formatCurrency(totalFuel)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Net Operating Profit</div>
                <div class="kpi-val ${netProfit >= 0 ? 'green' : 'red'}">${formatCurrency(netProfit)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Operating Margin</div>
                <div class="kpi-val">${margin}</div>
            </div>
        </div>

        <h3>Vehicle Performance Summary</h3>
        <table>
            <thead>
                <tr>
                    <th>Vehicle</th>
                    <th>Invoices</th>
                    <th>Revenue</th>
                    <th>Fuel (L)</th>
                    <th>Fuel Cost</th>
                    <th>Net Profit</th>
                    <th>Margin</th>
                </tr>
            </thead>
            <tbody>
                ${vehicles.map(v => {
                    const vBills = bills.filter(b => b.vehicleId === v.id);
                    const vFuel = fuel.filter(f => f.vehicleId === v.id);
                    const rev = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
                    const fCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
                    const ltrs = vFuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
                    const prof = rev - fCost;
                    const marg = rev > 0 ? ((prof / rev) * 100).toFixed(1) + '%' : '0%';
                    return `<tr>
                        <td><strong>${v.name}</strong> (${v.number})</td>
                        <td>${vBills.length}</td>
                        <td style="color:#16a34a;font-weight:600;">${formatCurrency(rev)}</td>
                        <td>${ltrs.toFixed(1)} L</td>
                        <td style="color:#dc2626;">${formatCurrency(fCost)}</td>
                        <td style="font-weight:700;color:${prof >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(prof)}</td>
                        <td>${marg}</td>
                    </tr>`;
                }).join('')}
                <tr class="total-row">
                    <td>TOTAL FLEET</td>
                    <td>${bills.length}</td>
                    <td style="color:#16a34a;">${formatCurrency(totalRev)}</td>
                    <td>${totalLitres.toFixed(1)} L</td>
                    <td style="color:#dc2626;">${formatCurrency(totalFuel)}</td>
                    <td style="color:${netProfit >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(netProfit)}</td>
                    <td>${margin}</td>
                </tr>
            </tbody>
        </table>

        <h3>Invoices Issued in Period (${bills.length})</h3>
        <table>
            <thead>
                <tr><th>Bill No</th><th>Date</th><th>Vehicle</th><th>Customer</th><th>Route</th><th style="text-align:right;">Amount</th></tr>
            </thead>
            <tbody>
                ${bills.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No bills in this period</td></tr>' : bills.map(b => {
                    const v = getVehicleById(b.vehicleId);
                    return `<tr>
                        <td><strong>${b.billNumber}</strong></td>
                        <td>${b.date}</td>
                        <td>${v ? v.number : '-'}</td>
                        <td>${b.customerName || '-'}</td>
                        <td>${b.fromLocation || ''} → ${b.toLocation || ''}</td>
                        <td style="text-align:right;font-weight:700;">${formatCurrency(b.grandTotal)}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>

        <h3>Fuel Refills Recorded (${fuel.length})</h3>
        <table>
            <thead>
                <tr><th>Date</th><th>Vehicle</th><th>Station</th><th>Litres</th><th>Rate</th><th style="text-align:right;">Total Cost</th></tr>
            </thead>
            <tbody>
                ${fuel.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No fuel entries in this period</td></tr>' : fuel.map(f => {
                    const v = getVehicleById(f.vehicleId);
                    return `<tr>
                        <td>${f.date}</td>
                        <td>${v ? v.number : '-'}</td>
                        <td>${f.station || 'Fuel Station'}</td>
                        <td>${parseFloat(f.litres).toFixed(1)} L</td>
                        <td>${formatCurrency(f.rate)}</td>
                        <td style="text-align:right;font-weight:700;color:#dc2626;">${formatCurrency(f.totalAmount)}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>

        <div class="footer-sign">
            <div class="sign-box">
                <div class="sign-line">Prepared By (Accounts)</div>
            </div>
            <div class="sign-box">
                <div class="sign-line">Authorized Signatory (Sri Moorthy Transport)</div>
            </div>
        </div>
    </body>
    </html>
    `);
    pWin.document.close();
    setTimeout(() => {
        pWin.print();
    }, 400);
}

// ===== EXPORT DATA =====
function exportAllData() {
    const data = {
        exportDate: new Date().toISOString(),
        company: 'Sri Moorthy Transport',
        vehicles: getVehicles(),
        bills: getBills(),
        fuelLogs: getFuelLogs()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SriMoorthy_Data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully! 📁', 'success');
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== SERVICE WORKER REGISTRATION =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed'));
    });
}

// ===== CLOSE PANELS ON OUTSIDE CLICK =====
document.addEventListener('click', (e) => {
    const notifPanel = document.getElementById('notifPanel');
    const notifBtn = document.getElementById('notifBtn');
    if (notifPanel.classList.contains('show') &&
        !notifPanel.contains(e.target) &&
        !notifBtn.contains(e.target)) {
        notifPanel.classList.remove('show');
    }
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeBillModal();
        closeFuelModal();
        closeBillView();
        closeQuickAdd();
        closeSidebar();
        closeSupabaseModal();
    }
});

// ==========================================
// SUPABASE BACKEND INTEGRATION METHODS
// ==========================================

function mapVehicleFromSupabase(row) {
    return {
        id: row.id,
        uuid: row.id,
        name: row.name,
        number: row.number,
        type: row.type,
        status: row.status || 'active',
        color: row.color || '#EF5226'
    };
}

function mapBillToSupabase(b) {
    const vUUID = getVehicleUUID(b.vehicleId);
    return {
        id: isValidUUID(b.id) ? b.id : generateUUID(),
        bill_number: b.billNumber,
        date: b.date,
        vehicle_id: vUUID,
        customer_name: b.customerName,
        customer_phone: b.customerPhone || null,
        from_location: b.fromLocation,
        to_location: b.toLocation,
        goods_desc: b.goodsDesc || null,
        line_items: b.lineItems || [],
        subtotal: parseFloat(b.subtotal) || 0,
        gst_percent: parseFloat(b.gstPercent) || 0,
        gst: parseFloat(b.gst) || 0,
        grand_total: parseFloat(b.grandTotal) || 0,
        amount_paid: parseFloat(b.amountPaid) || 0,
        balance: parseFloat(b.balance) || 0,
        payment_status: b.paymentStatus || 'unpaid',
        notes: b.notes || null,
        created_at: b.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

function mapBillFromSupabase(row) {
    return {
        id: row.id,
        billNumber: row.bill_number,
        date: row.date,
        vehicleId: row.vehicle_id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone || '',
        fromLocation: row.from_location,
        toLocation: row.to_location,
        goodsDesc: row.goods_desc || '',
        lineItems: row.line_items || [],
        subtotal: parseFloat(row.subtotal) || 0,
        gstPercent: parseFloat(row.gst_percent) || 0,
        gst: parseFloat(row.gst) || 0,
        grandTotal: parseFloat(row.grand_total) || 0,
        amountPaid: parseFloat(row.amount_paid) || 0,
        balance: parseFloat(row.balance) || 0,
        paymentStatus: row.payment_status || 'unpaid',
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapFuelToSupabase(f) {
    const vUUID = getVehicleUUID(f.vehicleId);
    return {
        id: isValidUUID(f.id) ? f.id : generateUUID(),
        date: f.date,
        vehicle_id: vUUID,
        station: f.station || null,
        fuel_type: f.fuelType || 'diesel',
        litres: parseFloat(f.litres) || 0,
        rate: parseFloat(f.rate) || 0,
        total_amount: parseFloat(f.totalAmount) || 0,
        odometer: f.odometer ? parseFloat(f.odometer) : null,
        driver: f.driver || null,
        notes: f.notes || null,
        created_at: f.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

function mapFuelFromSupabase(row) {
    return {
        id: row.id,
        date: row.date,
        vehicleId: row.vehicle_id,
        station: row.station || '',
        fuelType: row.fuel_type || 'diesel',
        litres: parseFloat(row.litres) || 0,
        rate: parseFloat(row.rate) || 0,
        totalAmount: parseFloat(row.total_amount) || 0,
        odometer: row.odometer,
        driver: row.driver || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function uploadBillToSupabase(bill) {
    if (!supabaseClient || !isSupabaseConnected) return;
    if (!hasRelationalTables) {
        console.warn('Supabase tables not configured yet. Bill saved locally.');
        showToast('Saved locally. (Run SQL schema in Supabase to sync to cloud)', 'info');
        return;
    }
    try {
        const row = mapBillToSupabase(bill);
        const { error } = await supabaseClient.from('bills').upsert(row);
        if (error) {
            console.error('Supabase bill upsert error:', error);
            showToast('Cloud sync notice: ' + (error.message || 'Could not save to Supabase'), 'error');
        } else {
            console.log('Bill synced to Supabase successfully:', row.bill_number);
        }
    } catch (err) {
        console.error('Supabase uploadBill error:', err);
    }
}

async function uploadFuelToSupabase(fuel) {
    if (!supabaseClient || !isSupabaseConnected) return;
    if (!hasRelationalTables) {
        console.warn('Supabase tables not configured yet. Fuel entry saved locally.');
        showToast('Saved locally. (Run SQL schema in Supabase to sync to cloud)', 'info');
        return;
    }
    try {
        const row = mapFuelToSupabase(fuel);
        const { error } = await supabaseClient.from('fuel_logs').upsert(row);
        if (error) {
            console.error('Supabase fuel upsert error:', error);
            showToast('Cloud sync notice: ' + (error.message || 'Could not save to Supabase'), 'error');
        } else {
            console.log('Fuel log synced to Supabase successfully:', row.id);
        }
    } catch (err) {
        console.error('Supabase uploadFuel error:', err);
    }
}

async function persistFleetToSupabase() {
    if (!supabaseClient || !isSupabaseConnected) return;
    try {
        const payload = {
            vehicles: getVehicles(),
            bills: getBills(),
            fuel: getFuelLogs(),
            notifications: getNotifications(),
            billCounter: getStore(STORAGE_KEYS.billCounter) || 0,
            updatedAt: new Date().toISOString()
        };

        const effectiveKey = getStore(STORAGE_KEYS.supabaseKey) || DEFAULT_SUPABASE_KEY;
        const uploadUrl = `${DEFAULT_SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/fleet_data.json`;

        await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'apikey': effectiveKey,
                'Authorization': `Bearer ${effectiveKey}`,
                'Content-Type': 'application/json',
                'x-upsert': 'true'
            },
            body: JSON.stringify(payload)
        }).catch(err => console.warn('Supabase cloud bucket sync warning:', err));
    } catch (e) {
        console.warn('persistFleetToSupabase notice:', e);
    }
}

async function initSupabase() {
    const savedUrl = getStore(STORAGE_KEYS.supabaseUrl) || DEFAULT_SUPABASE_URL;
    const savedKey = getStore(STORAGE_KEYS.supabaseKey) || DEFAULT_SUPABASE_KEY;
    const savedMethod = getStore(STORAGE_KEYS.storageMethod) || 'supabase';

    if (savedMethod === 'local') {
        currentStorageMethod = 'local';
        updateSupabaseUI(false, 'Local storage mode active on this device.');
        return;
    }

    await connectToSupabase(savedUrl, savedKey, false);
}

async function connectToSupabase(url, key, verbose = true) {
    if (!window.supabase) {
        if (verbose) showToast('Supabase SDK loading... please wait 2s', 'error');
        return false;
    }

    url = (url || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, '');
    let effectiveKey = (key || getStore(STORAGE_KEYS.supabaseKey) || DEFAULT_SUPABASE_KEY).trim();

    const connectBtn = document.getElementById('supabaseConnectBtn');
    const spinner = document.getElementById('connectBtnSpinner');
    if (connectBtn && spinner) {
        spinner.style.display = 'inline';
        connectBtn.disabled = true;
    }

    try {
        const client = window.supabase.createClient(url, effectiveKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        supabaseClient = client;
        isSupabaseConnected = true;
        currentStorageMethod = 'supabase';
        setStore(STORAGE_KEYS.supabaseUrl, url);
        setStore(STORAGE_KEYS.supabaseKey, key || effectiveKey);
        setStore(STORAGE_KEYS.storageMethod, 'supabase');

        // Test Postgres relational tables
        let tablesFound = false;
        try {
            const { data: vData, error: vErr } = await client
                .from('vehicles')
                .select('*')
                .limit(10);
            if (!vErr) {
                tablesFound = true;
                hasRelationalTables = true;
                if (vData && vData.length > 0) {
                    setStore(STORAGE_KEYS.vehicles, vData.map(mapVehicleFromSupabase));
                }
            } else {
                hasRelationalTables = false;
                console.warn('Supabase relational tables check notice:', vErr);
            }
        } catch (e) {
            hasRelationalTables = false;
            console.warn('Supabase table query exception:', e);
        }

        // Pull latest cloud data if tables exist
        if (tablesFound) {
            await pullFromSupabase(false);
            // If local bills or fuel logs exist, automatically sync them to Supabase
            const localBills = getBills();
            const localFuel = getFuelLogs();
            if (localBills.length > 0 || localFuel.length > 0) {
                await syncLocalToSupabase(false);
            }
        }

        // Auto backup current data to Supabase Storage if fresh
        await persistFleetToSupabase();

        // Update UI state with table readiness flag
        updateSupabaseUI(true, tablesFound
            ? 'Connected to live Supabase Postgres database. All records sync in real time.'
            : 'Connected to Supabase project, but database tables (bills, fuel_logs, vehicles) are not created yet. Run the SQL schema to enable saving.',
            tablesFound
        );

        // Setup realtime if relational tables are available
        if (hasRelationalTables) {
            setupSupabaseRealtime();
        }

        // Refresh UI & dropdowns
        populateVehicleDropdowns();
        renderDashboard();
        renderVehicles();
        renderBills();
        renderFuelLogs();
        renderReports();

        if (verbose) {
            if (tablesFound) {
                showToast('Connected to Supabase Cloud Database! ☁️🚀', 'success');
            } else {
                showToast('Connected to Supabase! Run SQL schema to create tables.', 'warning');
            }
        }
        return true;
    } catch (err) {
        console.error('Connection failed:', err);
        isSupabaseConnected = false;
        updateSupabaseUI(false, `Connection issue: ${err.message || 'Check URL and key'}`);
        if (verbose) showToast(`Connection failed: ${err.message}`, 'error');
        return false;
    } finally {
        if (connectBtn && spinner) {
            spinner.style.display = 'none';
            connectBtn.disabled = false;
        }
    }
}

async function seedDefaultVehiclesToCloud() {
    if (!supabaseClient) return;
    try {
        const toInsert = DEFAULT_VEHICLES.map(v => ({
            name: v.name,
            number: v.number,
            type: v.type,
            status: v.status,
            color: v.color
        }));
        const { data, error } = await supabaseClient.from('vehicles').upsert(toInsert, { onConflict: 'number' }).select();
        if (!error && data) {
            setStore(STORAGE_KEYS.vehicles, data.map(mapVehicleFromSupabase));
        }
    } catch (e) {
        console.error('Error seeding vehicles:', e);
    }
}

function setupSupabaseRealtime() {
    if (!supabaseClient || !hasRelationalTables) return;
    try {
        supabaseClient
            .channel('fleet_sync_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, async () => {
                console.log('Realtime bill update detected');
                await pullFromSupabase(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'fuel_logs' }, async () => {
                console.log('Realtime fuel update detected');
                await pullFromSupabase(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, async () => {
                console.log('Realtime vehicles update detected');
                await pullFromSupabase(false);
            })
            .subscribe();
    } catch (e) {
        console.warn('Realtime subscription warning:', e);
    }
}

async function pullFromSupabase(showToastMsg = true) {
    if (!supabaseClient || !isSupabaseConnected) {
        if (showToastMsg) showToast('Not connected to Supabase', 'error');
        return;
    }

    try {
        let pulledData = false;

        const deletedBills = getStore('sm_deleted_bills') || [];
        const deletedFuel = getStore('sm_deleted_fuel') || [];

        // 1. Pull from relational tables if available
        if (hasRelationalTables) {
            try {
                const { data: vData } = await supabaseClient.from('vehicles').select('*');
                if (vData && vData.length > 0) {
                    setStore(STORAGE_KEYS.vehicles, vData.map(mapVehicleFromSupabase));
                    pulledData = true;
                }

                const { data: bData, error: bErr } = await supabaseClient.from('bills').select('*');
                if (!bErr && bData) {
                    const validBills = bData.map(mapBillFromSupabase).filter(b => !deletedBills.includes(String(b.id)) && !deletedBills.includes(String(b.billNumber)));
                    setStore(STORAGE_KEYS.bills, validBills);
                    pulledData = true;
                }

                const { data: fData, error: fErr } = await supabaseClient.from('fuel_logs').select('*');
                if (!fErr && fData) {
                    const validFuel = fData.map(mapFuelFromSupabase).filter(f => !deletedFuel.includes(String(f.id)));
                    setStore(STORAGE_KEYS.fuel, validFuel);
                    pulledData = true;
                }
            } catch (tableErr) {
                console.warn('Table query note:', tableErr);
            }
        }

        // 2. Pull from Cloud Storage Bucket (fleet_storage/fleet_data.json)
        try {
            const publicUrl = `${DEFAULT_SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/fleet_data.json?t=${Date.now()}`;
            const res = await fetch(publicUrl);
            if (res.ok) {
                const cloudJson = await res.json();
                if (cloudJson) {
                    if (cloudJson.vehicles && cloudJson.vehicles.length > 0 && !hasRelationalTables) {
                        setStore(STORAGE_KEYS.vehicles, cloudJson.vehicles);
                    }
                    if (cloudJson.bills && cloudJson.bills.length > 0 && (!hasRelationalTables || getBills().length === 0)) {
                        const validBills = cloudJson.bills.filter(b => !deletedBills.includes(String(b.id)) && !deletedBills.includes(String(b.billNumber)));
                        setStore(STORAGE_KEYS.bills, validBills);
                    }
                    if (cloudJson.fuel && cloudJson.fuel.length > 0 && (!hasRelationalTables || getFuelLogs().length === 0)) {
                        const validFuel = cloudJson.fuel.filter(f => !deletedFuel.includes(String(f.id)));
                        setStore(STORAGE_KEYS.fuel, validFuel);
                    }
                    if (cloudJson.billCounter) {
                        setStore(STORAGE_KEYS.billCounter, cloudJson.billCounter);
                    }
                    pulledData = true;
                }
            }
        } catch (bucketErr) {
            console.warn('Bucket fetch note:', bucketErr);
        }

        // Refresh UI
        populateVehicleDropdowns();
        renderDashboard();
        renderVehicles();
        renderBills();
        renderFuelLogs();
        renderReports();

        if (showToastMsg) {
            showToast(pulledData ? 'Pulled latest cloud data successfully! ☁️' : 'Supabase storage is up to date ☁️', 'success');
        }
    } catch (e) {
        console.error('Failed to pull from Supabase:', e);
        if (showToastMsg) showToast('Failed to pull cloud data', 'error');
    }
}

async function syncLocalToSupabase(showSuccessToast = true) {
    if (!supabaseClient || !isSupabaseConnected) {
        showToast('Please connect to Supabase first', 'error');
        return;
    }

    if (!hasRelationalTables) {
        if (showSuccessToast) showToast('Supabase tables not found. Run SQL schema in Supabase first!', 'warning');
        return;
    }

    const bills = getBills();
    const fuel = getFuelLogs();

    if (showSuccessToast) showToast('Syncing records to Supabase Cloud...', 'info');

    let billsSynced = 0;
    let fuelSynced = 0;

    try {
        for (const bill of bills) {
            const row = mapBillToSupabase(bill);
            const { error } = await supabaseClient.from('bills').upsert(row);
            if (!error) billsSynced++;
            else console.warn('Bill sync item warning:', error);
        }

        for (const log of fuel) {
            const row = mapFuelToSupabase(log);
            const { error } = await supabaseClient.from('fuel_logs').upsert(row);
            if (!error) fuelSynced++;
            else console.warn('Fuel sync item warning:', error);
        }

        await persistFleetToSupabase();
        if (showSuccessToast) {
            showToast(`✅ Synced ${billsSynced}/${bills.length} bills & ${fuelSynced}/${fuel.length} fuel logs to Supabase! 🚀☁️`, 'success');
        }
    } catch (e) {
        console.error('Sync error:', e);
        if (showSuccessToast) showToast('Sync error: ' + e.message, 'error');
    }
}
window.syncLocalToSupabase = syncLocalToSupabase;

async function checkSupabaseTables(verbose = true) {
    if (!supabaseClient) {
        if (verbose) showToast('Connecting to Supabase...', 'info');
        const ok = await connectToSupabase(null, null, verbose);
        return ok;
    }
    if (verbose) showToast('Verifying database tables in Supabase...', 'info');

    try {
        const { data, error } = await supabaseClient.from('vehicles').select('*').limit(5);
        if (error) {
            hasRelationalTables = false;
            updateSupabaseUI(true, 'Tables not found: ' + (error.message || 'PGRST205 error'), false);
            if (verbose) showToast('Database tables not found. Run the SQL schema in Supabase!', 'error');
            return false;
        } else {
            hasRelationalTables = true;
            updateSupabaseUI(true, 'Live Postgres database active. All records sync with Supabase.', true);
            if (data && data.length > 0) {
                setStore(STORAGE_KEYS.vehicles, data.map(mapVehicleFromSupabase));
                populateVehicleDropdowns();
                renderVehicles();
            }
            // Auto sync local bills & fuel to cloud
            await syncLocalToSupabase(true);
            return true;
        }
    } catch (err) {
        hasRelationalTables = false;
        updateSupabaseUI(true, 'Connection check failed: ' + err.message, false);
        if (verbose) showToast('Connection check failed: ' + err.message, 'error');
        return false;
    }
}
window.checkSupabaseTables = checkSupabaseTables;

function updateSupabaseUI(connected, message, tablesReady = true) {
    const pill = document.getElementById('cloudStatusBtn');
    const label = document.getElementById('cloudLabel');
    const sidebarTag = document.getElementById('sidebarCloudTag');
    const statusCard = document.getElementById('supabaseStatusCard');
    const statusTitle = document.getElementById('supabaseStatusTitle');
    const statusDesc = document.getElementById('supabaseStatusDesc');
    const badge = document.getElementById('storageBadge');
    const optSupabase = document.getElementById('storageOptSupabase');
    const optLocal = document.getElementById('storageOptLocal');
    const missingBanner = document.getElementById('supabaseTablesMissingBanner');

    if (connected) {
        if (tablesReady) {
            if (pill) {
                pill.className = 'cloud-status-pill connected';
                if (label) label.textContent = 'Supabase Active';
            }
            if (sidebarTag) {
                sidebarTag.className = 'sidebar-cloud-tag connected';
                sidebarTag.textContent = 'Online';
            }
            if (statusCard) {
                statusCard.className = 'supabase-status-card connected';
            }
            if (statusTitle) statusTitle.textContent = 'Supabase Cloud Database: Active ✅';
            if (statusDesc) statusDesc.textContent = message || 'Live Postgres database active. All fleet records, bills, and fuel entries sync directly with Supabase.';
            if (badge) {
                badge.textContent = 'Supabase Cloud Active';
                badge.style.background = '';
                badge.style.color = '';
            }
            if (missingBanner) missingBanner.style.display = 'none';
        } else {
            // Connected to project, but tables not created in SQL editor yet
            if (pill) {
                pill.className = 'cloud-status-pill warning';
                if (label) label.textContent = 'SQL Tables Missing';
            }
            if (sidebarTag) {
                sidebarTag.className = 'sidebar-cloud-tag warning';
                sidebarTag.textContent = 'SQL Setup Needed';
            }
            if (statusCard) {
                statusCard.className = 'supabase-status-card warning';
            }
            if (statusTitle) statusTitle.textContent = 'Supabase Connected (SQL Setup Required) ⚠️';
            if (statusDesc) statusDesc.textContent = message || 'Project connected, but database tables (bills, fuel_logs, vehicles) have not been created yet in Supabase.';
            if (badge) {
                badge.textContent = 'Tables Not Created';
                badge.style.background = 'rgba(239, 82, 38, 0.2)';
                badge.style.color = 'var(--orange, #EF5226)';
            }
            if (missingBanner) missingBanner.style.display = 'block';
        }
        if (optSupabase) optSupabase.classList.add('active');
        if (optLocal) optLocal.classList.remove('active');
    } else {
        if (pill) {
            pill.className = 'cloud-status-pill';
            if (label) label.textContent = 'Local Storage';
        }
        if (sidebarTag) {
            sidebarTag.className = 'sidebar-cloud-tag';
            sidebarTag.textContent = 'Offline';
        }
        if (statusCard) {
            statusCard.className = 'supabase-status-card disconnected';
        }
        if (statusTitle) statusTitle.textContent = 'Local Storage Mode';
        if (statusDesc) statusDesc.textContent = message || 'Data stored locally on this device. Connect Supabase to enable cloud persistence.';
        if (badge) {
            badge.textContent = 'Local Only';
            badge.style.background = '';
            badge.style.color = '';
        }
        if (missingBanner) missingBanner.style.display = 'none';
        if (optSupabase) optSupabase.classList.remove('active');
        if (optLocal) optLocal.classList.add('active');
    }
}

function setStorageEngine(method) {
    if (method === 'supabase') {
        const savedUrl = getStore(STORAGE_KEYS.supabaseUrl) || DEFAULT_SUPABASE_URL;
        const savedKey = getStore(STORAGE_KEYS.supabaseKey) || DEFAULT_SUPABASE_KEY;
        connectToSupabase(savedUrl, savedKey, true);
    } else {
        currentStorageMethod = 'local';
        isSupabaseConnected = false;
        setStore(STORAGE_KEYS.storageMethod, 'local');
        updateSupabaseUI(false, 'Local storage mode selected. Records saved only on this device.');
        showToast('Storage method changed to Local Storage', 'info');
    }
}

function openSupabaseModal() {
    const modal = document.getElementById('supabaseModal');
    const urlInput = document.getElementById('supabaseUrlInput');
    const keyInput = document.getElementById('supabaseKeyInput');

    const savedUrl = getStore(STORAGE_KEYS.supabaseUrl) || DEFAULT_SUPABASE_URL;

    if (urlInput) urlInput.value = savedUrl;

    // SECURITY: NEVER display the raw API key in the UI or input field
    if (keyInput) {
        keyInput.value = '';
        const hasKey = !!(getStore(STORAGE_KEYS.supabaseKey) || DEFAULT_SUPABASE_KEY);
        keyInput.placeholder = hasKey
            ? '•••••••••••••••••••••••• (Key Configured & Secured)'
            : 'Enter Supabase Publishable Key';
    }

    if (modal) modal.classList.add('show');
}

function closeSupabaseModal() {
    const modal = document.getElementById('supabaseModal');
    if (modal) modal.classList.remove('show');
}

function toggleKeyVisibility() {
    // Disabled for security: API keys are never revealed in plain text
}

async function saveSupabaseConfig(event) {
    event.preventDefault();
    const url = document.getElementById('supabaseUrlInput').value.trim();
    let key = document.getElementById('supabaseKeyInput').value.trim();

    // If key is left blank, preserve existing configured key
    if (!key) {
        key = getStore(STORAGE_KEYS.supabaseKey) || DEFAULT_SUPABASE_KEY;
    }

    const ok = await connectToSupabase(url, key, true);
    if (ok) {
        closeSupabaseModal();
    }
}

function disconnectSupabase() {
    if (!confirm('Disconnect from Supabase? The app will return to Local Storage mode.')) return;
    supabaseClient = null;
    isSupabaseConnected = false;
    localStorage.removeItem(STORAGE_KEYS.supabaseUrl);
    updateSupabaseUI(false, 'Disconnected from cloud. Using local storage.');
    showToast('Disconnected from Supabase. Back to local mode.', 'info');
}

async function resetDatabase() {
    const confirmed = confirm('⚠️ ARE YOU SURE YOU WANT TO RESET THE DATABASE?\n\nThis will permanently clear:\n• All bills and invoices\n• All fuel logs\n• Reset bill counter to SM-0001\n• Reset vehicles to the default 3 vehicles\n\nAre you sure you want to proceed?');
    if (!confirmed) return;

    try {
        showToast('Resetting database...', 'info');

        // 1. Reset Local Storage data
        setStore(STORAGE_KEYS.bills, []);
        setStore(STORAGE_KEYS.fuel, []);
        setStore(STORAGE_KEYS.notifications, []);
        setStore(STORAGE_KEYS.billCounter, 0);
        setStore(STORAGE_KEYS.vehicles, DEFAULT_VEHICLES);

        // 2. If Supabase is connected, clear cloud tables
        if (supabaseClient) {
            try {
                await supabaseClient.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabaseClient.from('fuel_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                const toInsert = DEFAULT_VEHICLES.map(v => ({
                    name: v.name,
                    number: v.number,
                    type: v.type,
                    status: v.status,
                    color: v.color
                }));
                await supabaseClient.from('vehicles').upsert(toInsert, { onConflict: 'number' });
            } catch (cloudErr) {
                console.warn('Supabase cloud reset warning:', cloudErr);
            }
        }

        // 3. Re-render UI views
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderBills === 'function') renderBills();
        if (typeof renderFuel === 'function') renderFuel();
        if (typeof renderVehicles === 'function') renderVehicles();
        if (typeof updateNotificationsUI === 'function') updateNotificationsUI();

        showToast('✅ Database reset successfully! All data cleared to fresh state.', 'success');
        if (typeof closeSupabaseModal === 'function') closeSupabaseModal();
    } catch (e) {
        console.error('Reset error:', e);
        showToast('Error resetting database: ' + e.message, 'error');
    }
}
window.resetDatabase = resetDatabase;


const SUPABASE_SCHEMA_SQL = `-- ========================================================
-- SRI MOORTHY TRANSPORT - COMPLETE SUPABASE DATABASE SETUP
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gusrwwwoammurxzwywmy/sql/new
-- ========================================================

-- 1. VEHICLES TABLE
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    color TEXT DEFAULT '#EF5226',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BILLS TABLE
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    goods_desc TEXT,
    line_items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12,2) DEFAULT 0,
    gst_percent NUMERIC(5,2) DEFAULT 0,
    gst NUMERIC(12,2) DEFAULT 0,
    grand_total NUMERIC(12,2) DEFAULT 0,
    amount_paid NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FUEL LOGS TABLE
CREATE TABLE IF NOT EXISTS public.fuel_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    station TEXT,
    fuel_type TEXT DEFAULT 'diesel' CHECK (fuel_type IN ('diesel', 'petrol')),
    litres NUMERIC(10,2) NOT NULL,
    rate NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    odometer NUMERIC(12,0),
    driver TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_bills_vehicle_id ON public.bills(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON public.bills(date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_id ON public.fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_date ON public.fuel_logs(date DESC);

-- 6. SEED DEFAULT FLEET VEHICLES
INSERT INTO public.vehicles (name, number, type, color, status)
VALUES 
    ('TATA ACE', 'TN68C6003', 'TATA ACE', '#EF5226', 'active'),
    ('TATA ACE', 'TN68W2419', 'TATA ACE', '#3b82f6', 'active'),
    ('DOST+', 'TN82K1945', 'DOST+', '#10b981', 'active')
ON CONFLICT (number) DO NOTHING;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow public write access to vehicles" ON public.vehicles;
CREATE POLICY "Allow public read access to vehicles" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Allow public write access to vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to bills" ON public.bills;
DROP POLICY IF EXISTS "Allow public write access to bills" ON public.bills;
CREATE POLICY "Allow public read access to bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Allow public write access to bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to fuel_logs" ON public.fuel_logs;
DROP POLICY IF EXISTS "Allow public write access to fuel_logs" ON public.fuel_logs;
CREATE POLICY "Allow public read access to fuel_logs" ON public.fuel_logs FOR SELECT USING (true);
CREATE POLICY "Allow public write access to fuel_logs" ON public.fuel_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public write access to app_settings" ON public.app_settings;
CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public write access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- 8. STORAGE BUCKET & POLICIES (FOR JSON BACKUP FALLBACK)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fleet_storage', 'fleet_storage', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Select Storage" ON storage.objects;
CREATE POLICY "Public Select Storage" ON storage.objects FOR SELECT USING (bucket_id = 'fleet_storage');

DROP POLICY IF EXISTS "Public Insert Storage" ON storage.objects;
CREATE POLICY "Public Insert Storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fleet_storage');

DROP POLICY IF EXISTS "Public Update Storage" ON storage.objects;
CREATE POLICY "Public Update Storage" ON storage.objects FOR UPDATE USING (bucket_id = 'fleet_storage') WITH CHECK (bucket_id = 'fleet_storage');

DROP POLICY IF EXISTS "Public Delete Storage" ON storage.objects;
CREATE POLICY "Public Delete Storage" ON storage.objects FOR DELETE USING (bucket_id = 'fleet_storage');

-- 9. REALTIME SUBSCRIPTIONS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'vehicles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bills'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'fuel_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_logs;
    END IF;
END $$;`;

function copySupabaseSql() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL).then(() => {
            showToast('SQL Schema copied to clipboard! Paste in SQL Editor 📋', 'success');
            const btnText = document.getElementById('copySqlBtnText');
            if (btnText) {
                btnText.textContent = 'Copied to Clipboard! ✅';
                setTimeout(() => { btnText.textContent = 'Copy SQL Script (Schema)'; }, 3000);
            }
        }).catch(() => fallbackCopySql());
    } else {
        fallbackCopySql();
    }
}

function fallbackCopySql() {
    const textarea = document.createElement('textarea');
    textarea.value = SUPABASE_SCHEMA_SQL;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('SQL Schema copied to clipboard! Paste in SQL Editor 📋', 'success');
}

function openSupabaseSqlEditor() {
    const url = (getStore(STORAGE_KEYS.supabaseUrl) || DEFAULT_SUPABASE_URL);
    const match = url.match(/https:\/\/([a-zA-Z0-9_-]+)\.supabase\.co/);
    const projId = match ? match[1] : 'gusrwwwoammurxzwywmy';
    const sqlUrl = `https://supabase.com/dashboard/project/${projId}/sql/new`;
    window.open(sqlUrl, '_blank');
    showToast('Opening SQL Editor in Supabase. Paste & click RUN! 🚀', 'info');
}

// ===== GPS TRACKING MODAL =====
function openGpsModal() {
    const modal = document.getElementById('gpsModal');
    if (modal) modal.classList.add('show');
}

function closeGpsModal() {
    const modal = document.getElementById('gpsModal');
    if (modal) modal.classList.remove('show');
}

// ===== INSTALL APP / APK MODAL & PWA PROMPT =====
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] beforeinstallprompt event captured');

    const headerBtn = document.getElementById('installAppHeaderBtn');
    if (headerBtn) {
        headerBtn.style.display = 'inline-flex';
    }
    const ctaBtn = document.getElementById('nativePwaInstallBtn');
    if (ctaBtn) {
        ctaBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Tap to Install on This Device ⚡</span>`;
    }
});

window.addEventListener('appinstalled', () => {
    console.log('[PWA] App successfully installed!');
    deferredInstallPrompt = null;
    showToast('Sri Moorthy Fleet installed on device! 🎉', 'success');
    closeInstallModal();
});

function openInstallModal() {
    const modal = document.getElementById('installModal');
    if (modal) modal.classList.add('show');
}

function closeInstallModal() {
    const modal = document.getElementById('installModal');
    if (modal) modal.classList.remove('show');
}

function switchInstallTab(tab) {
    const mobileTab = document.getElementById('installTabMobile');
    const apkTab = document.getElementById('installTabApk');
    const mobileBtn = document.getElementById('tabInstallMobileBtn');
    const apkBtn = document.getElementById('tabInstallApkBtn');

    if (tab === 'mobile') {
        if (mobileTab) mobileTab.style.display = 'block';
        if (apkTab) apkTab.style.display = 'none';
        if (mobileBtn) mobileBtn.classList.add('active');
        if (apkBtn) apkBtn.classList.remove('active');
    } else {
        if (mobileTab) mobileTab.style.display = 'none';
        if (apkTab) apkTab.style.display = 'block';
        if (mobileBtn) mobileBtn.classList.remove('active');
        if (apkBtn) apkBtn.classList.add('active');
    }
}

function copyLocalServerUrl() {
    const urlText = document.getElementById('localServerUrl')?.textContent || 'https://mortgage-placed-utilization-flight.trycloudflare.com';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(urlText).then(() => {
            showToast('URL copied to clipboard! Paste in mobile browser 📋', 'success');
        }).catch(() => {
            fallbackCopyText(urlText);
        });
    } else {
        fallbackCopyText(urlText);
    }
}

function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('URL copied to clipboard! 📋', 'success');
}

function triggerNativeInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast('Installing Sri Moorthy Fleet... 🚀', 'success');
            } else {
                showToast('Installation cancelled', 'info');
            }
            deferredInstallPrompt = null;
        });
    } else {
        showToast('To install: Open in Android Chrome and tap "Install app" / "Add to Home screen" 📲', 'info');
    }
}

