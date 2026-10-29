/* ==========================================
   SRI MOORTHY TRANSPORT - FLEET MANAGER APP
   JavaScript Application Logic
   ========================================== */

// ===== DATA STORE (Supabase Cloud Primary with Local Cache) =====
const STORAGE_KEYS = {
    vehicles: 'sm_vehicles',
    bills: 'sm_bills',
    fuel: 'sm_fuel',
    services: 'sm_vehicle_services',
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
        uuid: 'efeae18b-7840-4d36-88ae-74d1c2ed3fc7',
        name: 'TATA ACE',
        number: 'TN68C6003',
        type: 'TATA ACE',
        status: 'active',
        color: '#EF5226'
    },
    {
        id: 'v2',
        uuid: 'c3a24376-810e-49c4-9461-681bd9818c9a',
        name: 'TATA ACE',
        number: 'TN68W2419',
        type: 'TATA ACE',
        status: 'active',
        color: '#3b82f6'
    },
    {
        id: 'v3',
        uuid: '4b8e9e8d-68cd-4ed8-be9c-5a40481d3152',
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
    recalibrateBillCounter();
}

function getFuelLogs() {
    return getStore(STORAGE_KEYS.fuel) || [];
}

function saveFuelLogs(logs) {
    setStore(STORAGE_KEYS.fuel, logs);
}

function getVehicleServices() {
    return getStore(STORAGE_KEYS.services) || [];
}
window.getVehicleServices = getVehicleServices;

function saveVehicleServices(services) {
    setStore(STORAGE_KEYS.services, services);
}
window.saveVehicleServices = saveVehicleServices;

function getNotifications() {
    return getStore(STORAGE_KEYS.notifications) || [];
}

function saveNotifications(notifs) {
    setStore(STORAGE_KEYS.notifications, notifs);
}

function getHighestExistingBillNumber() {
    const bills = getBills();
    let max = 0;
    (bills || []).forEach(b => {
        if (b && b.billNumber) {
            const m = String(b.billNumber).match(/(\d+)$/);
            if (m) {
                const n = parseInt(m[1], 10);
                if (!isNaN(n) && n > max) max = n;
            }
        }
    });
    return max;
}

function recalibrateBillCounter() {
    const highest = getHighestExistingBillNumber();
    const stored = getStore(STORAGE_KEYS.billCounter);
    const counterVal = Math.max(highest, parseInt(stored, 10) || 0);
    setStore(STORAGE_KEYS.billCounter, counterVal);
    return counterVal;
}

function peekNextBillNumber() {
    const highest = getHighestExistingBillNumber();
    const stored = getStore(STORAGE_KEYS.billCounter);
    const counterVal = Math.max(highest, parseInt(stored, 10) || 0);
    setStore(STORAGE_KEYS.billCounter, counterVal);
    const nextVal = counterVal + 1;
    return 'SM-' + String(nextVal).padStart(4, '0');
}

function getNextBillNumber() {
    return peekNextBillNumber();
}

function autoChangeBillNumber() {
    recalibrateBillCounter();
    const nextNum = getNextBillNumber();
    const billNumberInput = document.getElementById('billNumber');
    if (billNumberInput) {
        billNumberInput.value = nextNum;
        billNumberInput.style.transition = 'all 0.3s ease';
        billNumberInput.style.borderColor = 'var(--green, #10B981)';
        billNumberInput.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
        setTimeout(() => {
            billNumberInput.style.borderColor = '';
            billNumberInput.style.boxShadow = '';
        }, 800);
    }
    showToast(`Bill # auto-set to ${nextNum} ⚡`, 'success');
    return nextNum;
}
window.autoChangeBillNumber = autoChangeBillNumber;
window.getNextBillNumber = getNextBillNumber;

function commitBillNumber(billNumberStr) {
    if (!billNumberStr) return;
    const m = String(billNumberStr).match(/(\d+)$/);
    if (m) {
        const num = parseInt(m[1], 10);
        const current = getStore(STORAGE_KEYS.billCounter) || 0;
        setStore(STORAGE_KEYS.billCounter, Math.max(parseInt(current, 10) || 0, num));
    }
}

function resetBillNumber(newStartingNumber = 1) {
    const val = Math.max(1, parseInt(newStartingNumber, 10) || 1);
    const counterVal = val - 1; // e.g. Starting with 1 means counter is 0, so nextVal is 0+1=1 -> SM-0001
    setStore(STORAGE_KEYS.billCounter, counterVal);
    const formatted = 'SM-' + String(val).padStart(4, '0');
    const billNumberInput = document.getElementById('billNumber');
    if (billNumberInput) {
        billNumberInput.value = formatted;
    }
    showToast(`Bill sequence reset to ${formatted} ✅ (Next bill will be ${formatted})`, 'success');
}
window.resetBillNumber = resetBillNumber;

function promptResetBillNumber() {
    const current = document.getElementById('billNumber')?.value || peekNextBillNumber();
    const currentDigits = current.replace(/\D/g, '') || '1';
    const input = prompt(
        'Enter starting bill number sequence (e.g. 1 for SM-0001):\n\n(Note: Opening the bill modal without booking will NEVER advance or change the bill number.)',
        '1'
    );
    if (input === null) return;
    const val = parseInt(input.trim(), 10);
    if (isNaN(val) || val < 1) {
        showToast('Please enter a valid positive number (e.g. 1 for SM-0001)', 'error');
        return;
    }
    resetBillNumber(val);
}
window.promptResetBillNumber = promptResetBillNumber;

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

function normalizePlateNumber(str) {
    return (str || '').toString().replace(/[\s-]/g, '').toUpperCase();
}

const LEGACY_VEHICLE_NUMBERS = {
    'v1': 'TN68C6003',
    'v2': 'TN68W2419',
    'v3': 'TN82K1945'
};

function isItemForVehicle(itemVehicleId, v) {
    if (!v || !itemVehicleId) return false;
    if (itemVehicleId === v.id || (v.uuid && itemVehicleId === v.uuid)) return true;
    const normItem = normalizePlateNumber(itemVehicleId);
    const normPlate = normalizePlateNumber(v.number);
    if (normItem && normPlate && normItem === normPlate) return true;
    if (LEGACY_VEHICLE_NUMBERS[itemVehicleId] && normalizePlateNumber(LEGACY_VEHICLE_NUMBERS[itemVehicleId]) === normPlate) return true;
    if (LEGACY_VEHICLE_NUMBERS[v.id] && normalizePlateNumber(LEGACY_VEHICLE_NUMBERS[v.id]) === normItem) return true;
    return false;
}

function isVehicleMatch(itemVehicleId, targetVehicleId) {
    if (!itemVehicleId || !targetVehicleId) return false;
    if (targetVehicleId === 'all') return true;
    if (itemVehicleId === targetVehicleId) return true;

    const vehicles = getVehicles();
    const targetVeh = vehicles.find(v => isItemForVehicle(targetVehicleId, v));
    const itemVeh = vehicles.find(v => isItemForVehicle(itemVehicleId, v));

    if (targetVeh && itemVeh && (targetVeh === itemVeh || normalizePlateNumber(targetVeh.number) === normalizePlateNumber(itemVeh.number))) {
        return true;
    }
    if (targetVeh && isItemForVehicle(itemVehicleId, targetVeh)) return true;
    if (itemVeh && isItemForVehicle(targetVehicleId, itemVeh)) return true;

    return false;
}

function getVehicleById(id) {
    if (!id) return null;
    const vehicles = getVehicles();
    return vehicles.find(v => isItemForVehicle(id, v)) || null;
}

function getVehicleUUID(vehicleIdOrNumber) {
    if (!vehicleIdOrNumber) return null;
    if (isValidUUID(vehicleIdOrNumber)) return vehicleIdOrNumber;
    const vehicles = getVehicles();
    const v = vehicles.find(veh => isItemForVehicle(vehicleIdOrNumber, veh));
    if (!v) return null;
    if (v.id && isValidUUID(v.id)) return v.id;
    if (v.uuid && isValidUUID(v.uuid)) return v.uuid;
    return null;
}

function getVehicleDisplay(v) {
    if (!v) return '-';
    return `<span style="font-weight:700;margin-right:6px;">${v.name}</span><span class="plate-hsrp sm"><span class="ind-tag">IND</span>${v.number}</span>`;
}

// ===== THEME MODE SYSTEM (Titanium Light Exclusive) =====
function initThemeMode() {
    // Enforce clean Titanium Light theme exclusively
    setThemeMode('light', false);
}

function setThemeMode(mode = 'light', showToastMsg = false) {
    document.documentElement.setAttribute('data-mode', 'light');
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    try {
        localStorage.setItem('sm_theme_mode', 'light');
    } catch (_) {}

    const sunIcons = document.querySelectorAll('.mode-icon-sun');
    const moonIcons = document.querySelectorAll('.mode-icon-moon');
    const modeLabels = document.querySelectorAll('.mode-label-text');

    sunIcons.forEach(i => i.style.display = 'none');
    moonIcons.forEach(i => i.style.display = 'none');
    modeLabels.forEach(l => l.textContent = 'Titanium Light');

    if (showToastMsg && typeof showToast === 'function') {
        showToast('☀️ Titanium Light Mode Active', 'info');
    }
}

function toggleThemeMode() {
    setThemeMode('light', false);
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
    { id: 'act-theme', title: 'Theme Accent Colors', desc: 'Customize fleet accent colors (Orange, Blue, Green, Purple, Red)', icon: '🎨', category: 'Appearance', action: toggleThemePicker },
    { id: 'act-supa', title: 'Supabase Cloud Database Settings', desc: 'Manage cloud URL, anon key and database tables', icon: '☁️', category: 'System', action: openSupabaseModal },
    { id: 'act-apk', title: 'Install PWA or Export APK', desc: 'Install app to device home screen or build Android APK', icon: '📱', category: 'System', action: openInstallModal },
    { id: 'act-logout', title: 'Lock Application & Sign Out', desc: 'Securely lock the fleet app and return to login screen', icon: '🔒', category: 'Security', action: () => handleLogout(false) },
    { id: 'act-reset', title: 'Reset Database (Clear All Data)', desc: 'Permanently wipe bills & fuel logs to a clean fresh state', icon: '🗑️', category: 'Danger Zone', action: resetDatabase }
];

let selectedCommandIndex = 0;
let filteredCommands = [...COMMAND_ITEMS];

function openCommandPalette() {
    if (!isUserAuthenticated()) return;
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

// ===== SECURE ENTERPRISE AUTHENTICATION SYSTEM =====
const AUTH_CONFIG = {
    username: 'moorthy',
    passwordHash: '6ccfc89bd2a5d5a2cc30ad90667287c4259a3efe870c82769364134b6f31f4fd', // SHA-256 of 'moorthy:kum@12345'
    passwordFallback: 'kum@12345',
    maxAttempts: 5,
    lockoutDurationMs: 30000, // 30 seconds lockout cooldown
    sessionDurationDays: 7, // 7 days persistent if Remember Me is checked
    inactivityTimeoutMs: 30 * 60 * 1000 // 30 minutes auto-lock
};

let lockoutTimerInterval = null;
let lastUserActivityTime = Date.now();
let inactivityInterval = null;

// Cryptographic SHA-256 helper with graceful fallback
async function sha256Hex(str) {
    try {
        if (window.crypto && window.crypto.subtle && window.TextEncoder) {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {
        console.warn('[Security] WebCrypto digest fallback:', e);
    }
    return null;
}

// Session Management
function getAuthSession() {
    try {
        const local = localStorage.getItem('sm_auth_session');
        if (local) {
            const parsed = JSON.parse(local);
            if (parsed && parsed.token && parsed.expiresAt > Date.now() && (parsed.username || '').toLowerCase() === AUTH_CONFIG.username.toLowerCase()) {
                return parsed;
            }
            localStorage.removeItem('sm_auth_session');
        }

        const session = sessionStorage.getItem('sm_auth_session');
        if (session) {
            const parsed = JSON.parse(session);
            if (parsed && parsed.token && parsed.expiresAt > Date.now() && (parsed.username || '').toLowerCase() === AUTH_CONFIG.username.toLowerCase()) {
                return parsed;
            }
            sessionStorage.removeItem('sm_auth_session');
        }
    } catch (err) {
        console.error('[Security] Error reading auth session:', err);
    }
    return null;
}

function isUserAuthenticated() {
    return !!getAuthSession();
}

function saveAuthSession(sessionData, rememberMe) {
    try {
        const payload = JSON.stringify(sessionData);
        if (rememberMe) {
            localStorage.setItem('sm_auth_session', payload);
            sessionStorage.removeItem('sm_auth_session');
        } else {
            sessionStorage.setItem('sm_auth_session', payload);
            localStorage.removeItem('sm_auth_session');
        }
    } catch (e) {
        console.error('[Security] Failed to save auth session:', e);
    }
}

function clearAuthSession() {
    try {
        localStorage.removeItem('sm_auth_session');
        sessionStorage.removeItem('sm_auth_session');
    } catch (_) {}
}

// Failed Attempts & Brute-Force Rate Limiting
function getFailedAttempts() {
    try {
        return parseInt(sessionStorage.getItem('sm_failed_login_attempts') || '0', 10);
    } catch {
        return 0;
    }
}

function setFailedAttempts(count) {
    try {
        sessionStorage.setItem('sm_failed_login_attempts', String(count));
    } catch (_) {}
}

function getLockoutEndTime() {
    try {
        return parseInt(sessionStorage.getItem('sm_login_lockout_until') || '0', 10);
    } catch {
        return 0;
    }
}

function setLockoutEndTime(timestamp) {
    try {
        sessionStorage.setItem('sm_login_lockout_until', String(timestamp));
    } catch (_) {}
}

function checkAndApplyLockout() {
    const lockoutUntil = getLockoutEndTime();
    const now = Date.now();
    const banner = document.getElementById('loginLockoutBanner');
    const timerSpan = document.getElementById('lockoutTimerSeconds');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const userInput = document.getElementById('loginUsername');
    const passInput = document.getElementById('loginPassword');

    if (lockoutUntil > now) {
        const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
        if (banner) banner.style.display = 'flex';
        if (timerSpan) timerSpan.textContent = remainingSeconds;
        if (submitBtn) submitBtn.disabled = true;
        if (userInput) userInput.disabled = true;
        if (passInput) passInput.disabled = true;

        if (!lockoutTimerInterval) {
            lockoutTimerInterval = setInterval(() => {
                const updatedNow = Date.now();
                const rem = Math.ceil((lockoutUntil - updatedNow) / 1000);
                if (rem <= 0) {
                    clearInterval(lockoutTimerInterval);
                    lockoutTimerInterval = null;
                    setLockoutEndTime(0);
                    setFailedAttempts(0);
                    if (banner) banner.style.display = 'none';
                    if (submitBtn) submitBtn.disabled = false;
                    if (userInput) userInput.disabled = false;
                    if (passInput) passInput.disabled = false;
                    hideLoginAlert();
                } else {
                    if (timerSpan) timerSpan.textContent = rem;
                }
            }, 1000);
        }
        return true;
    } else {
        if (banner) banner.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
        if (userInput) userInput.disabled = false;
        if (passInput) passInput.disabled = false;
        if (lockoutTimerInterval) {
            clearInterval(lockoutTimerInterval);
            lockoutTimerInterval = null;
        }
        return false;
    }
}

// UI Alert & Shake Helpers
function showLoginAlert(msg) {
    const alertEl = document.getElementById('loginAlert');
    const msgEl = document.getElementById('loginAlertMsg');
    if (alertEl && msgEl) {
        msgEl.textContent = msg;
        alertEl.style.display = 'flex';
    }
    const card = document.getElementById('loginCard');
    if (card) {
        card.classList.remove('shake');
        void card.offsetWidth; // trigger reflow
        card.classList.add('shake');
    }
}

function hideLoginAlert() {
    const alertEl = document.getElementById('loginAlert');
    if (alertEl) alertEl.style.display = 'none';
}

function togglePasswordVisibility() {
    const passInput = document.getElementById('loginPassword');
    const showIcon = document.querySelector('.eye-icon-show');
    const hideIcon = document.querySelector('.eye-icon-hide');
    if (!passInput) return;

    if (passInput.type === 'password') {
        passInput.type = 'text';
        if (showIcon) showIcon.style.display = 'none';
        if (hideIcon) hideIcon.style.display = 'inline-block';
    } else {
        passInput.type = 'password';
        if (showIcon) showIcon.style.display = 'inline-block';
        if (hideIcon) hideIcon.style.display = 'none';
    }
}

function onForgotPasswordClick() {
    showToast('Password Assistance: Default operator password is provided by Fleet Control. Call: 8940481999', 'info');
}
window.onForgotPasswordClick = onForgotPasswordClick;

function onLoginReportsClick() {
    showToast('Please sign in with operator credentials to view complete fleet reports & analytics 📊', 'info');
}
window.onLoginReportsClick = onLoginReportsClick;

// Login Submission Handler
async function handleLoginSubmit(event) {
    if (event) event.preventDefault();

    if (checkAndApplyLockout()) {
        showLoginAlert('Too many failed attempts. Account temporarily locked for security.');
        return;
    }

    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const rememberMeInput = document.getElementById('loginRememberMe');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const spinner = document.getElementById('loginBtnSpinner');
    const btnText = document.getElementById('loginBtnText');

    const enteredUsername = (usernameInput ? usernameInput.value : '').trim();
    const enteredPassword = passwordInput ? passwordInput.value : '';
    const rememberMe = rememberMeInput ? rememberMeInput.checked : true;

    if (!enteredUsername || !enteredPassword) {
        showLoginAlert('Please enter both username and password.');
        if (!enteredUsername && usernameInput) usernameInput.focus();
        else if (passwordInput) passwordInput.focus();
        return;
    }

    // Set UI loading state
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Verifying Credentials...';

    // Verify credentials
    let isValid = false;
    const isUserMatch = enteredUsername.toLowerCase() === AUTH_CONFIG.username.toLowerCase();

    if (isUserMatch) {
        // Direct password match check
        if (enteredPassword === AUTH_CONFIG.passwordFallback) {
            isValid = true;
        } else {
            // SHA-256 hash validation
            const computedHash = await sha256Hex(`moorthy:${enteredPassword}`);
            if (computedHash === AUTH_CONFIG.passwordHash) {
                isValid = true;
            }
        }
    }

    if (!isValid) {
        // Record failed attempt
        let attempts = getFailedAttempts() + 1;
        setFailedAttempts(attempts);

        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.textContent = 'Sign In to Dashboard';
        if (submitBtn) submitBtn.disabled = false;

        if (attempts >= AUTH_CONFIG.maxAttempts) {
            const lockoutUntil = Date.now() + AUTH_CONFIG.lockoutDurationMs;
            setLockoutEndTime(lockoutUntil);
            checkAndApplyLockout();
            showLoginAlert(`Security Alert: Maximum attempts exceeded. Locked for 30s.`);
        } else {
            const remaining = AUTH_CONFIG.maxAttempts - attempts;
            showLoginAlert(`Invalid username or password. (${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining)`);
        }

        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
        return;
    }

    // Successful Authentication
    setFailedAttempts(0);
    setLockoutEndTime(0);
    hideLoginAlert();

    // Trigger Google Password Manager / Browser "Save Password" prompt via Credential Management API
    try {
        if (typeof window !== 'undefined' && window.PasswordCredential && navigator.credentials && typeof navigator.credentials.store === 'function') {
            const formEl = document.getElementById('loginForm');
            let cred = null;
            if (formEl) {
                try {
                    cred = new PasswordCredential(formEl);
                } catch (_) {}
            }
            if (!cred) {
                cred = new PasswordCredential({
                    id: enteredUsername,
                    password: enteredPassword,
                    name: 'SRI MOORTHY TRANSPORT'
                });
            }
            if (cred) {
                navigator.credentials.store(cred).then(() => {
                    console.log('[Auth] Google / Browser credential prompt triggered successfully');
                }).catch((err) => {
                    console.log('[Auth] Credential store handled:', err);
                });
            }
        }
    } catch (credErr) {
        console.log('[Auth] Password credential notice:', credErr);
    }

    const expiryTime = rememberMe 
        ? Date.now() + (AUTH_CONFIG.sessionDurationDays * 24 * 60 * 60 * 1000)
        : Date.now() + (24 * 60 * 60 * 1000);

    const sessionData = {
        username: 'moorthy',
        role: 'Administrator',
        name: 'Sri Moorthy Admin',
        token: 'smt_' + (window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()),
        loginTime: Date.now(),
        expiresAt: expiryTime,
        rememberMe: rememberMe
    };

    saveAuthSession(sessionData, rememberMe);

    if (btnText) btnText.textContent = 'Access Granted! Entering Fleet...';

    setTimeout(() => {
        const loginScreen = document.getElementById('loginScreen');
        const appEl = document.getElementById('app');

        if (loginScreen) {
            loginScreen.classList.add('hide');
            setTimeout(() => {
                loginScreen.style.display = 'none';
                loginScreen.classList.remove('hide');
            }, 350);
        }

        if (appEl) {
            appEl.style.display = 'flex';
        }

        // Initialize Application
        try {
            initApp();
        } catch (err) {
            console.error('Error initializing app after login:', err);
        }

        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.textContent = 'Sign In to Dashboard';
        if (submitBtn) submitBtn.disabled = false;

        showToast('Welcome back, Sri Moorthy! 🚛 Fleet Portal Unlocked', 'success');
        startInactivityTracker();
    }, 120);
}

// Secure Logout / Lock Application
function handleLogout(isAutoLock = false) {
    clearAuthSession();
    closeSidebar();

    const appEl = document.getElementById('app');
    const loginScreen = document.getElementById('loginScreen');
    const passInput = document.getElementById('loginPassword');

    if (appEl) {
        appEl.style.display = 'none';
    }

    if (loginScreen) {
        loginScreen.style.display = 'flex';
        loginScreen.classList.remove('hide');
    }

    if (passInput) {
        passInput.value = '';
    }

    hideLoginAlert();
    checkAndApplyLockout();

    const userInput = document.getElementById('loginUsername');
    if (userInput && !userInput.value) {
        setTimeout(() => userInput.focus(), 100);
    }

    showToast(isAutoLock ? 'Session locked for security due to inactivity 🔒' : 'Signed out safely. System locked 🔒', 'info');
}

// Inactivity Auto-Lock Protection (30 Minutes)
function resetUserActivity() {
    lastUserActivityTime = Date.now();
}

function startInactivityTracker() {
    if (inactivityInterval) return;
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        window.addEventListener(evt, resetUserActivity, { passive: true });
    });

    inactivityInterval = setInterval(() => {
        if (!isUserAuthenticated()) return;
        const idleTime = Date.now() - lastUserActivityTime;
        if (idleTime > AUTH_CONFIG.inactivityTimeoutMs) {
            console.log('[Security] Auto-locking session due to inactivity');
            handleLogout(true);
        }
    }, 60000);
}

// ===== SPLASH SCREEN & GATEWAY INITIALIZATION =====
let splashDismissed = false;

// Fast, Instant splash dismissal transitioning to Login / App
function dismissSplash() {
    if (splashDismissed) return;
    splashDismissed = true;

    const splash = document.getElementById('splashScreen');
    const loginScreen = document.getElementById('loginScreen');
    const appEl = document.getElementById('app');

    // Check if user has an active, authenticated session
    const authenticated = isUserAuthenticated();

    if (authenticated) {
        if (splash) {
            splash.classList.add('hide');
            setTimeout(() => { splash.style.display = 'none'; }, 200);
        }
        if (loginScreen) loginScreen.style.display = 'none';
        if (appEl) appEl.style.display = 'flex';
        try {
            initApp();
            startInactivityTracker();
        } catch (err) {
            console.error('Error during app initialization:', err);
        }
    } else {
        // Enforce Login as FIRST page - INSTANT display without splash lag
        if (splash) splash.style.display = 'none';
        if (appEl) appEl.style.display = 'none';
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            checkAndApplyLockout();
            const userInput = document.getElementById('loginUsername');
            if (userInput) {
                // Preserve browser autofilled credentials or focus if empty
                if (!userInput.value) {
                    try {
                        const saved = localStorage.getItem('sm_auth_session');
                        if (saved) {
                            const parsed = JSON.parse(saved);
                            if (parsed && parsed.username) userInput.value = parsed.username;
                        }
                    } catch (_) {}
                    setTimeout(() => userInput.focus(), 80);
                }
            }
            const passInput = document.getElementById('loginPassword');
            if (passInput && !passInput.value) {
                // Keep intact if browser autofilled password
            }
        }
    }
}

// Attach tap / click listener on splash screen
(function attachSplashDismissListeners() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.addEventListener('click', dismissSplash);
        splash.addEventListener('touchstart', dismissSplash, { passive: true });
    }
    try {
        initThemeMode();
        initThemeColor();
    } catch (_) {}
})();

// Instant load - zero lag
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dismissSplash);
} else {
    dismissSplash();
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

    // Recalibrate bill counter so unbooked modal opens do not artificially advance bill numbers
    recalibrateBillCounter();

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

    // Bind direct instant click for Add Driver Salary button
    const addDsBtn = document.getElementById('addDriverSalaryBtn');
    if (addDsBtn) {
        addDsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openDriverSalaryModal();
        });
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
    if (!isUserAuthenticated()) {
        handleLogout();
        return;
    }
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
    if (page === 'dashboard') {
        renderDashboard();
    } else if (page === 'reports') {
        renderReports();
    } else if (page === 'vehicles') {
        if (typeof renderVehicles === 'function') renderVehicles();
    } else if (page === 'billing') {
        if (typeof renderBills === 'function') renderBills();
    } else if (page === 'fuel') {
        if (typeof renderFuelLogs === 'function') renderFuelLogs();
    }
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
    const selectors = ['billVehicle', 'fuelVehicle', 'billVehicleFilter', 'fuelVehicleFilter', 'dsVehicle', 'serviceVehicle'];
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

// Button Success Feedback Helper
function animateButtonSuccess(btn, successText, callback) {
    if (!btn) {
        if (callback) callback();
        return;
    }
    const origHtml = btn.dataset.origHtml || btn.innerHTML;
    const origBg = btn.dataset.origBg || btn.style.background;
    const origBorder = btn.dataset.origBorder || btn.style.borderColor;
    btn.dataset.origHtml = origHtml;
    btn.dataset.origBg = origBg;
    btn.dataset.origBorder = origBorder;

    btn.disabled = true;
    btn.classList.add('btn-saved-success');
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" style="vertical-align:middle;margin-right:6px;display:inline-block;animation:checkmarkBounce 0.4s ease;">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>${successText || 'Saved Successfully!'}</span>
    `;

    setTimeout(() => {
        if (callback) callback();
        setTimeout(() => {
            btn.innerHTML = origHtml;
            btn.style.background = origBg;
            btn.style.borderColor = origBorder;
            btn.disabled = false;
            btn.classList.remove('btn-saved-success');
        }, 350);
    }, 700);
}
window.animateButtonSuccess = animateButtonSuccess;

// ===== DASHBOARD (MONTHLY CALCULATION HUB) =====
let dashboardMonthState = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() // 0-indexed (0=Jan, 9=Oct, etc.)
};

function getDashboardMonthRange() {
    const start = new Date(dashboardMonthState.year, dashboardMonthState.month, 1, 0, 0, 0, 0);
    const end = new Date(dashboardMonthState.year, dashboardMonthState.month + 1, 0, 23, 59, 59, 999);
    const monthName = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const startStr = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const endStr = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return {
        start,
        end,
        startISO: formatISODate(start),
        endISO: formatISODate(end),
        monthName,
        label: `${startStr} – ${endStr}`
    };
}

function changeDashboardMonth(delta) {
    let newMonth = dashboardMonthState.month + delta;
    let newYear = dashboardMonthState.year;
    if (newMonth < 0) {
        newMonth = 11;
        newYear--;
    } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
    }
    dashboardMonthState.month = newMonth;
    dashboardMonthState.year = newYear;
    renderDashboard();
}
window.changeDashboardMonth = changeDashboardMonth;

function resetDashboardToCurrentMonth() {
    const now = new Date();
    dashboardMonthState.year = now.getFullYear();
    dashboardMonthState.month = now.getMonth();
    renderDashboard();
}
window.resetDashboardToCurrentMonth = resetDashboardToCurrentMonth;

function onDashboardMonthSelectChange() {
    const sel = document.getElementById('dashboardMonthSelect');
    if (!sel || !sel.value) return;
    const parts = sel.value.split('-');
    if (parts.length === 2) {
        dashboardMonthState.year = parseInt(parts[0], 10);
        dashboardMonthState.month = parseInt(parts[1], 10);
        renderDashboard();
    }
}
window.onDashboardMonthSelectChange = onDashboardMonthSelectChange;

function populateDashboardMonthSelect() {
    const sel = document.getElementById('dashboardMonthSelect');
    if (!sel) return;

    const now = new Date();
    let optionsHtml = '';
    // Generate 12 months: 8 past, current, 3 future
    for (let i = -8; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const val = `${y}-${m}`;
        const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const isSelected = (y === dashboardMonthState.year && m === dashboardMonthState.month);
        const isCurrent = (y === now.getFullYear() && m === now.getMonth());
        optionsHtml += `<option value="${val}" ${isSelected ? 'selected' : ''}>${label}${isCurrent ? ' (Current)' : ''}</option>`;
    }
    sel.innerHTML = optionsHtml;
}

function renderDashboard() {
    populateDashboardMonthSelect();
    const dateRange = getDashboardMonthRange();

    // Update Header Pill and Subtitle
    const headingPill = document.getElementById('dashboardMonthPill');
    if (headingPill) headingPill.textContent = dateRange.monthName;

    const rangeSubtitle = document.getElementById('dashboardMonthRange');
    if (rangeSubtitle) rangeSubtitle.textContent = `Calculations for ${dateRange.label} (Trip Income, Fuel & Net Margin)`;

    const allBills = getBills();
    const allFuel = getFuelLogs();
    const vehicles = getVehicles();
    const allSalaries = typeof getDriverSalaries === 'function' ? getDriverSalaries() : [];
    const allServices = typeof getVehicleServices === 'function' ? getVehicleServices() : [];

    // Filter by the selected month
    const monthlyBills = allBills.filter(b => {
        const d = (b.date || '').split('T')[0];
        return d >= dateRange.startISO && d <= dateRange.endISO;
    });

    const monthlyFuel = allFuel.filter(f => {
        const d = (f.date || '').split('T')[0];
        return d >= dateRange.startISO && d <= dateRange.endISO;
    });

    const monthlySalaries = allSalaries.filter(s => {
        const d = (s.date || '').split('T')[0];
        return d >= dateRange.startISO && d <= dateRange.endISO;
    });

    const monthlyServices = allServices.filter(s => {
        const d = (s.date || '').split('T')[0];
        return d >= dateRange.startISO && d <= dateRange.endISO;
    });

    // Counts
    const localTripsCount = monthlyBills.filter(b => b.isLocalIncome).length;

    // Gross Revenue
    const monthlyRevenue = monthlyBills.reduce((sum, b) => sum + (parseFloat(b.grandTotal) || 0), 0);

    // Fuel Cost & Litres
    const monthlyFuelCost = monthlyFuel.reduce((sum, f) => sum + (parseFloat(f.totalAmount) || 0), 0);
    const monthlyFuelLitres = monthlyFuel.reduce((sum, f) => sum + (parseFloat(f.litres) || 0), 0);

    // Salary Cost (Standalone salary payments + legacy bill driver salaries in this month)
    const directSalaryCost = monthlySalaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const legacyBillSalaries = monthlyBills.reduce((sum, b) => (b.addToDriverSalary && b.driverSalaryAmount) ? sum + (parseFloat(b.driverSalaryAmount) || 0) : sum, 0);
    const monthlySalaryCost = directSalaryCost + legacyBillSalaries;

    // Service & Maintenance Cost
    const monthlyServiceCost = monthlyServices.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

    // Total Monthly Expenses & Net Monthly Profit
    const monthlyTotalExpenses = monthlyFuelCost + monthlySalaryCost + monthlyServiceCost;
    const monthlyNetProfit = monthlyRevenue - monthlyTotalExpenses;
    const margin = monthlyRevenue > 0 ? ((monthlyNetProfit / monthlyRevenue) * 100).toFixed(1) : '0.0';

    // 1. Update Monthly Calculation Command Hub elements
    const calcGrossEl = document.getElementById('calcGrossIncome');
    if (calcGrossEl) calcGrossEl.textContent = formatCurrency(monthlyRevenue);

    const calcBillsCountEl = document.getElementById('calcBillsCount');
    if (calcBillsCountEl) {
        calcBillsCountEl.textContent = `${monthlyBills.length} Trips (${localTripsCount} Local)`;
    }

    const calcFuelEl = document.getElementById('calcFuelExpense');
    if (calcFuelEl) calcFuelEl.textContent = formatCurrency(monthlyFuelCost);

    const calcFuelLitresEl = document.getElementById('calcFuelLitres');
    if (calcFuelLitresEl) calcFuelLitresEl.textContent = `${monthlyFuelLitres.toFixed(1)} L Diesel`;

    const calcSalaryEl = document.getElementById('calcSalaryExpense');
    if (calcSalaryEl) calcSalaryEl.textContent = formatCurrency(monthlySalaryCost);

    const calcSalaryCountEl = document.getElementById('calcSalaryCount');
    if (calcSalaryCountEl) calcSalaryCountEl.textContent = `${monthlySalaries.length} Salary Entries`;

    const calcServiceEl = document.getElementById('calcServiceExpense');
    if (calcServiceEl) calcServiceEl.textContent = formatCurrency(monthlyServiceCost);

    const calcServiceCountEl = document.getElementById('calcServiceCount');
    if (calcServiceCountEl) calcServiceCountEl.textContent = `${monthlyServices.length} Service Records`;

    const calcNetProfitEl = document.getElementById('calcNetProfit');
    const calcMarginBadgeEl = document.getElementById('calcMarginBadge');
    const calcNetProfitBox = document.getElementById('calcNetProfitBox');
    if (calcNetProfitEl) {
        calcNetProfitEl.textContent = formatCurrency(monthlyNetProfit);
    }
    if (calcMarginBadgeEl) {
        calcMarginBadgeEl.textContent = `${monthlyNetProfit >= 0 ? '+' : ''}${margin}% Margin`;
    }
    if (calcNetProfitBox) {
        calcNetProfitBox.classList.toggle('profit-negative', monthlyNetProfit < 0);
    }

    // 2. Update Standard Dashboard Stat Cards (Now displaying Monthly Calculations)
    const totalVehiclesEl = document.getElementById('totalVehicles');
    if (totalVehiclesEl) totalVehiclesEl.textContent = vehicles.length;

    const totalBillsEl = document.getElementById('totalBills');
    if (totalBillsEl) totalBillsEl.textContent = monthlyBills.length;

    const totalRevenueEl = document.getElementById('totalRevenue');
    if (totalRevenueEl) totalRevenueEl.textContent = formatCurrency(monthlyRevenue);

    const totalFuelCostEl = document.getElementById('totalFuelCost');
    if (totalFuelCostEl) totalFuelCostEl.textContent = formatCurrency(monthlyFuelCost);

    const netProfitEl = document.getElementById('totalNetProfit');
    const netProfitMarginEl = document.getElementById('netProfitMarginBadge');
    const netProfitProgressEl = document.getElementById('netProfitProgressBar');
    const netProfitCard = document.getElementById('statCardNetProfit');

    if (netProfitEl) {
        netProfitEl.textContent = formatCurrency(monthlyNetProfit);
        netProfitEl.style.color = monthlyNetProfit >= 0 ? 'var(--green, #10b981)' : 'var(--red, #ef4444)';
    }
    if (netProfitMarginEl) {
        netProfitMarginEl.textContent = `${monthlyNetProfit >= 0 ? '+' : ''}${margin}% Margin`;
        netProfitMarginEl.className = `stat-trend-chip ${monthlyNetProfit >= 0 ? 'green' : 'red'}`;
    }
    if (netProfitProgressEl) {
        const percent = monthlyRevenue > 0 ? Math.min(100, Math.max(0, (monthlyNetProfit / monthlyRevenue) * 100)) : 0;
        netProfitProgressEl.style.width = `${percent}%`;
        netProfitProgressEl.className = `stat-progress-bar ${monthlyNetProfit >= 0 ? 'green' : 'red'}`;
    }
    if (netProfitCard) {
        netProfitCard.classList.toggle('glow-green', monthlyNetProfit >= 0);
        netProfitCard.classList.toggle('glow-red', monthlyNetProfit < 0);
    }

    // 3. Render Recent Activity for Selected Month (or overall if none in month)
    const activityBills = monthlyBills.length > 0 ? monthlyBills : allBills;
    const activityFuel = monthlyFuel.length > 0 ? monthlyFuel : allFuel;
    renderRecentActivity(activityBills, activityFuel);

    // 4. Render Fleet Cards (Vehicles stats for THIS MONTH)
    renderFleetCards(vehicles, monthlyBills, monthlyFuel);
}

function renderRecentActivity(bills, fuel) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    const activities = [];

    bills.forEach(b => {
        const v = getVehicleById(b.vehicleId);
        activities.push({
            type: 'bill',
            title: `Bill ${b.billNumber} - ${b.customerName || (b.isLocalIncome ? 'Local Income Run' : 'Direct Trip')}`,
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
                <p>No transactions recorded for this month.</p>
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
    if (!container) return;
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
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    </div>
                    <div>
                        <div class="fleet-card-name">${v.name}</div>
                        <div style="margin-top:4px;"><span class="plate-hsrp sm"><span class="ind-tag">IND</span>${v.number}</span></div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="fleet-card-status active">Active</span>
                </div>
            </div>
            <div class="fleet-card-stats">
                <div class="fleet-stat">
                    <span class="fleet-stat-label">Month Trips</span>
                    <span class="fleet-stat-value">${vBills.length}</span>
                </div>
                <div class="fleet-stat">
                    <span class="fleet-stat-label">Month Revenue</span>
                    <span class="fleet-stat-value" style="color:var(--green);font-size:14px;">${formatCurrency(earnings)}</span>
                </div>
                <div class="fleet-stat">
                    <span class="fleet-stat-label">Month Fuel</span>
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
    const services = typeof getVehicleServices === 'function' ? getVehicleServices() : [];
    const salaries = typeof getDriverSalaries === 'function' ? getDriverSalaries() : [];
    const container = document.getElementById('vehicleGrid');

    container.innerHTML = vehicles.map(v => {
        const vBills = bills.filter(b => b.vehicleId === v.id);
        const vFuel = fuel.filter(f => f.vehicleId === v.id);
        const vServices = services.filter(s => s.vehicleId === v.id);
        const vSalaries = salaries.filter(s => s.vehicleId === v.id);

        const earnings = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fuelCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
        const serviceCost = vServices.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
        const totalLitres = vFuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);

        const legacySalary = vBills.reduce((s, b) => (b.addToDriverSalary && b.driverSalaryAmount) ? s + (parseFloat(b.driverSalaryAmount) || 0) : s, 0);
        const directSalary = vSalaries.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
        const driverSalary = legacySalary + directSalary;

        const totalExpenses = fuelCost + driverSalary + serviceCost;
        const vNetProfit = earnings - totalExpenses;

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
                    <span class="v-label">Gross Revenue</span>
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
                <div class="vehicle-stat-item" style="border:1px solid rgba(239,82,38,0.25);background:rgba(239,82,38,0.06);">
                    <span class="v-label" style="color:var(--orange);">Service Expense</span>
                    <span class="v-value" style="color:var(--orange);">${formatCurrency(serviceCost)}</span>
                </div>
                <div class="vehicle-stat-item">
                    <span class="v-label">Net Profit</span>
                    <span class="v-value" style="color:${vNetProfit >= 0 ? 'var(--green)' : 'var(--red)'};">${formatCurrency(vNetProfit)}</span>
                </div>
            </div>
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <button type="button" class="vehicle-service-action-btn" onclick="openVehicleServiceModal(null, '${v.id}')" title="Log service expense for ${v.number}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    + Service Expense
                </button>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
                        <span class="live-blink" style="background:#10B981;width:7px;height:7px;border-radius:50%;display:inline-block;"></span> GPS
                    </span>
                    <a href="https://app.fleetocity.co.in" target="_blank" rel="noopener noreferrer" class="vehicle-gps-action-btn">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                        Live GPS
                    </a>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ===================================================
// DRIVER SALARIES STORE & MANAGEMENT
// ===================================================
function getDriverSalaries() {
    try {
        const data = localStorage.getItem('sm_driver_salaries');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error reading driver salaries:', e);
        return [];
    }
}
window.getDriverSalaries = getDriverSalaries;

function saveDriverSalaries(list) {
    try {
        localStorage.setItem('sm_driver_salaries', JSON.stringify(list));
    } catch (e) {
        console.error('Error saving driver salaries:', e);
    }
}
window.saveDriverSalaries = saveDriverSalaries;

// Helper: Known drivers from system (Kumar, Saravanan, Thanda Padi guaranteed)
function getKnownDrivers() {
    const known = new Set(['Kumar', 'Saravanan', 'Thanda Padi']);
    getDriverSalaries().forEach(s => { if (s.driverName && s.driverName.trim()) known.add(s.driverName.trim()); });
    getFuelLogs().forEach(f => { if (f.driver && f.driver.trim()) known.add(f.driver.trim()); });
    getBills().forEach(b => { if (b.driverName && b.driverName.trim()) known.add(b.driverName.trim()); });
    return Array.from(known).sort();
}
window.getKnownDrivers = getKnownDrivers;

// Driver Salary Modal Controls
function openDriverSalaryModal(salaryId, prefillDriverName) {
    const modal = document.getElementById('driverSalaryModal');
    if (!modal) return;

    // Fast check: populate vehicle dropdown only if needed
    const vSelect = document.getElementById('dsVehicle');
    if (vSelect && (!vSelect.options || vSelect.options.length <= 1)) {
        const vehicles = getVehicles();
        vSelect.innerHTML = '<option value="">General / All Fleet</option>' + 
            vehicles.map(v => `<option value="${v.id}">${v.name} (${v.number})</option>`).join('');
    }

    if (salaryId) {
        const salaries = getDriverSalaries();
        const item = salaries.find(s => s.id === salaryId);
        if (item) {
            document.getElementById('driverSalaryModalTitle').textContent = 'Edit Driver Salary';
            document.getElementById('dsId').value = item.id;
            document.getElementById('dsDriverName').value = item.driverName || '';
            document.getElementById('dsAmount').value = item.amount || '';
            document.getElementById('dsDate').value = item.date || new Date().toISOString().split('T')[0];
            document.getElementById('dsVehicle').value = item.vehicleId || '';
            document.getElementById('dsNotes').value = item.notes || '';
            setDsStatus(item.status || 'paid');
            highlightPrimaryDriverCard(item.driverName || '');
            const delBtn = document.getElementById('dsDeleteBtn');
            if (delBtn) delBtn.style.display = 'inline-flex';
            modal.classList.add('show');
            return;
        }
    }

    // New Driver Salary
    document.getElementById('driverSalaryModalTitle').textContent = 'Add Driver Salary';
    document.getElementById('dsId').value = '';
    document.getElementById('dsDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('dsAmount').value = '';
    document.getElementById('dsNotes').value = '';
    setDsStatus('paid');
    const delBtn = document.getElementById('dsDeleteBtn');
    if (delBtn) delBtn.style.display = 'none';

    if (prefillDriverName) {
        selectPrimaryDriver(prefillDriverName);
    } else {
        document.getElementById('dsDriverName').value = '';
        highlightPrimaryDriverCard('');
    }

    modal.classList.add('show');
}
window.openDriverSalaryModal = openDriverSalaryModal;

function openDriverSalaryModalWith(driverName) {
    openDriverSalaryModal(null, driverName);
}
window.openDriverSalaryModalWith = openDriverSalaryModalWith;

function closeDriverSalaryModal() {
    const modal = document.getElementById('driverSalaryModal');
    if (modal) modal.classList.remove('show');
}
window.closeDriverSalaryModal = closeDriverSalaryModal;

function highlightPrimaryDriverCard(name) {
    const clean = (name || '').trim().toLowerCase();
    const isKumar = clean === 'kumar';
    const isSaravanan = clean === 'saravanan';
    const isThanda = clean.includes('thanda');

    const kCard = document.getElementById('cardDriverKumar');
    const sCard = document.getElementById('cardDriverSaravanan');
    const tCard = document.getElementById('cardDriverThandaPadi');
    if (kCard) kCard.classList.toggle('active', isKumar);
    if (sCard) sCard.classList.toggle('active', isSaravanan);
    if (tCard) tCard.classList.toggle('active', isThanda);

    const kChk = document.getElementById('chkDriverKumar');
    const sChk = document.getElementById('chkDriverSaravanan');
    const tChk = document.getElementById('chkDriverThandaPadi');
    if (kChk) kChk.checked = isKumar;
    if (sChk) sChk.checked = isSaravanan;
    if (tChk) tChk.checked = isThanda;
}
window.highlightPrimaryDriverCard = highlightPrimaryDriverCard;

function onDriverCheckboxToggle(name, isChecked) {
    const input = document.getElementById('dsDriverName');
    if (!input) return;

    if (isChecked) {
        input.value = name;
        highlightPrimaryDriverCard(name);
        const amtInput = document.getElementById('dsAmount');
        if (amtInput) {
            amtInput.focus();
            amtInput.select();
        }
        showToast(`Driver selected: ${name} (Checkbox checked)`, 'info');
    } else {
        if (input.value.trim().toLowerCase() === name.trim().toLowerCase()) {
            input.value = '';
            highlightPrimaryDriverCard('');
        }
    }
}
window.onDriverCheckboxToggle = onDriverCheckboxToggle;

function onDriverCardClick(name, event) {
    if (event && event.target && event.target.tagName === 'INPUT') return;
    const input = document.getElementById('dsDriverName');
    const currentName = input ? input.value.trim().toLowerCase() : '';
    const clickedName = name.trim().toLowerCase();

    if (currentName === clickedName) {
        onDriverCheckboxToggle(name, false);
    } else {
        onDriverCheckboxToggle(name, true);
    }
}
window.onDriverCardClick = onDriverCardClick;

function selectPrimaryDriver(name) {
    onDriverCheckboxToggle(name, true);
}
window.selectPrimaryDriver = selectPrimaryDriver;

function onDsDriverNameTyped(val) {
    highlightPrimaryDriverCard(val);
}
window.onDsDriverNameTyped = onDsDriverNameTyped;

function setDsAmount(amt) {
    const amtInput = document.getElementById('dsAmount');
    if (amtInput) {
        amtInput.value = parseFloat(amt).toFixed(2);
        showToast(`Amount set to ${formatCurrency(amt)}`, 'info');
    }
}
window.setDsAmount = setDsAmount;

function setDsStatus(status) {
    const hidden = document.getElementById('dsStatus');
    if (hidden) hidden.value = status;
    const btnPaid = document.getElementById('btnDsPaid');
    const btnUnpaid = document.getElementById('btnDsUnpaid');
    if (btnPaid && btnUnpaid) {
        if (status === 'unpaid') {
            btnPaid.classList.remove('active');
            btnUnpaid.classList.add('active');
        } else {
            btnPaid.classList.add('active');
            btnUnpaid.classList.remove('active');
        }
    }
}
window.setDsStatus = setDsStatus;

function saveDriverSalary(event) {
    event.preventDefault();
    const id = document.getElementById('dsId').value;
    const driverName = document.getElementById('dsDriverName').value.trim();
    const amount = parseFloat(document.getElementById('dsAmount').value) || 0;
    const date = document.getElementById('dsDate').value;
    const vehicleId = document.getElementById('dsVehicle').value;
    const status = document.getElementById('dsStatus').value || 'paid';
    const notes = document.getElementById('dsNotes').value.trim();

    if (!driverName) {
        showToast('Please select or enter a driver name', 'error');
        return;
    }
    if (amount <= 0) {
        showToast('Please enter a valid salary amount', 'error');
        return;
    }

    const salaries = getDriverSalaries();
    let record;
    if (id) {
        const index = salaries.findIndex(s => s.id === id);
        if (index !== -1) {
            record = {
                ...salaries[index],
                driverName,
                amount,
                date,
                vehicleId,
                status,
                notes,
                updatedAt: new Date().toISOString()
            };
            salaries[index] = record;
        }
    } else {
        record = {
            id: 'ds_' + Date.now(),
            driverName,
            amount,
            date,
            vehicleId,
            status,
            notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        salaries.unshift(record);
    }

    saveDriverSalaries(salaries);

    // Sync to Supabase
    if (typeof isSupabaseConnected !== 'undefined' && isSupabaseConnected && supabaseClient) {
        uploadDriverSalaryToSupabase(record);
    }

    const submitBtn = (event && event.target) ? event.target.querySelector('button[type="submit"]') : document.querySelector('#driverSalaryForm button[type="submit"]');
    animateButtonSuccess(submitBtn, '✓ Saved Successfully!', () => {
        closeDriverSalaryModal();
        showToast(`Driver salary for ${driverName} (${formatCurrency(amount)}) saved as ${status.toUpperCase()}! ✅`, 'success');

        // Refresh UI
        renderReports();
        renderDashboard();
        if (typeof filterBills === 'function') filterBills();
    });
}
window.saveDriverSalary = saveDriverSalary;

function deleteCurrentDriverSalary() {
    const id = document.getElementById('dsId').value;
    if (!id) return;
    if (confirm('Are you sure you want to delete this driver salary record?')) {
        let salaries = getDriverSalaries();
        salaries = salaries.filter(s => s.id !== id);
        saveDriverSalaries(salaries);

        if (typeof isSupabaseConnected !== 'undefined' && isSupabaseConnected && supabaseClient) {
            deleteDriverSalaryFromSupabase(id);
        }

        closeDriverSalaryModal();
        showToast('Driver salary record deleted', 'info');
        renderReports();
        renderDashboard();
        if (typeof filterBills === 'function') filterBills();
    }
}
window.deleteCurrentDriverSalary = deleteCurrentDriverSalary;

function deleteDriverSalaryById(salaryId) {
    if (!salaryId) return;
    if (confirm('Are you sure you want to delete this driver salary record?')) {
        let salaries = getDriverSalaries();
        salaries = salaries.filter(s => s.id !== salaryId);
        saveDriverSalaries(salaries);

        if (typeof isSupabaseConnected !== 'undefined' && isSupabaseConnected && supabaseClient) {
            deleteDriverSalaryFromSupabase(salaryId);
        }

        showToast('Driver salary record deleted', 'info');
        renderReports();
        renderDashboard();
        if (typeof filterBills === 'function') filterBills();
    }
}
window.deleteDriverSalaryById = deleteDriverSalaryById;

function toggleStandaloneSalaryPaidStatus(salaryId, newStatus, event) {
    if (event) event.stopPropagation();
    const salaries = getDriverSalaries();
    const record = salaries.find(s => s.id === salaryId);
    if (!record) return;

    record.status = newStatus;
    record.updatedAt = new Date().toISOString();
    saveDriverSalaries(salaries);

    if (typeof isSupabaseConnected !== 'undefined' && isSupabaseConnected && supabaseClient) {
        uploadDriverSalaryToSupabase(record);
    }

    showToast(`Salary for ${record.driverName} marked as ${newStatus.toUpperCase()}! ✅`, 'success');
    renderReports();
}
window.toggleStandaloneSalaryPaidStatus = toggleStandaloneSalaryPaidStatus;

// Backward compatibility helper stubs
function populateDriverQuickChips(selectedDriver) {}
window.populateDriverQuickChips = populateDriverQuickChips;
function selectDriverName(name) { selectPrimaryDriver(name); }
window.selectDriverName = selectDriverName;
function onDriverNameInput(val) {}
window.onDriverNameInput = onDriverNameInput;
function setDriverSalaryAmount(amount) { setDsAmount(amount); }
window.setDriverSalaryAmount = setDriverSalaryAmount;
function setDriverSalaryStatus(status) { setDsStatus(status); }
window.setDriverSalaryStatus = setDriverSalaryStatus;

// ===================================================
// VEHICLE SERVICE EXPENSES STORE & MANAGEMENT
// ===================================================
function openVehicleServiceModal(serviceId, prefillVehicleId) {
    const modal = document.getElementById('vehicleServiceModal');
    if (!modal) return;

    // Ensure vehicle dropdown is populated
    const vSelect = document.getElementById('serviceVehicle');
    if (vSelect && (!vSelect.options || vSelect.options.length <= 1)) {
        const vehicles = getVehicles();
        vSelect.innerHTML = '<option value="">Select Vehicle</option>' + 
            vehicles.map(v => `<option value="${v.id}">${v.name} (${v.number})</option>`).join('');
    }

    if (serviceId) {
        const services = getVehicleServices();
        const item = services.find(s => s.id === serviceId);
        if (item) {
            document.getElementById('vehicleServiceModalTitle').textContent = 'Edit Vehicle Service Expense';
            document.getElementById('serviceId').value = item.id;
            document.getElementById('serviceDate').value = item.date || new Date().toISOString().split('T')[0];
            document.getElementById('serviceVehicle').value = item.vehicleId || '';
            document.getElementById('serviceType').value = item.serviceType || 'General Service';
            document.getElementById('serviceAmount').value = item.amount || '';
            document.getElementById('serviceGarage').value = item.garage || '';
            document.getElementById('serviceOdometer').value = item.odometer || '';
            document.getElementById('serviceNotes').value = item.notes || '';
            const delBtn = document.getElementById('serviceDeleteBtn');
            if (delBtn) delBtn.style.display = 'inline-flex';
            modal.classList.add('show');
            return;
        }
    }

    // New Service entry
    document.getElementById('vehicleServiceModalTitle').textContent = 'Add Vehicle Service Expense';
    document.getElementById('serviceId').value = '';
    document.getElementById('serviceDate').value = new Date().toISOString().split('T')[0];
    if (prefillVehicleId) {
        document.getElementById('serviceVehicle').value = prefillVehicleId;
    } else {
        document.getElementById('serviceVehicle').value = '';
    }
    document.getElementById('serviceType').value = 'General Service';
    document.getElementById('serviceAmount').value = '';
    document.getElementById('serviceGarage').value = '';
    document.getElementById('serviceOdometer').value = '';
    document.getElementById('serviceNotes').value = '';
    const delBtn = document.getElementById('serviceDeleteBtn');
    if (delBtn) delBtn.style.display = 'none';

    modal.classList.add('show');
}
window.openVehicleServiceModal = openVehicleServiceModal;

function closeVehicleServiceModal() {
    const modal = document.getElementById('vehicleServiceModal');
    if (modal) modal.classList.remove('show');
}
window.closeVehicleServiceModal = closeVehicleServiceModal;

function saveVehicleService(event) {
    if (event) event.preventDefault();
    const id = document.getElementById('serviceId').value;
    const date = document.getElementById('serviceDate').value;
    const vehicleId = document.getElementById('serviceVehicle').value;
    const serviceType = document.getElementById('serviceType').value;
    const amount = parseFloat(document.getElementById('serviceAmount').value) || 0;
    const garage = (document.getElementById('serviceGarage').value || '').trim();
    const odometer = document.getElementById('serviceOdometer').value ? parseFloat(document.getElementById('serviceOdometer').value) : null;
    const notes = (document.getElementById('serviceNotes').value || '').trim();

    if (!vehicleId) {
        showToast('Please select a fleet vehicle', 'warning');
        return;
    }
    if (amount <= 0) {
        showToast('Please enter a valid service price / amount', 'warning');
        return;
    }

    const services = getVehicleServices();
    const serviceData = {
        date,
        vehicleId,
        serviceType,
        amount,
        garage,
        odometer,
        notes,
        updatedAt: new Date().toISOString()
    };

    const targetId = id || generateUUID();
    serviceData.id = targetId;

    if (id) {
        const index = services.findIndex(s => s.id === id);
        if (index !== -1) {
            services[index] = { ...services[index], ...serviceData };
        }
        showToast('Service expense record updated! ✅', 'success');
    } else {
        serviceData.createdAt = new Date().toISOString();
        services.push(serviceData);
        const v = getVehicleById(vehicleId);
        addNotification(`Service expense: ${formatCurrency(amount)} for ${v ? getVehicleDisplay(v) : 'vehicle'} (${serviceType})`);
        showToast(`Service expense saved: ${formatCurrency(amount)} for ${v ? v.number : 'vehicle'}! 🛠️`, 'success');
    }

    saveVehicleServices(services);

    if (isSupabaseConnected && supabaseClient) {
        uploadVehicleServiceToSupabase(serviceData);
        persistFleetToSupabase();
    }

    const submitBtn = (event && event.target) ? event.target.querySelector('button[type="submit"]') : document.querySelector('#vehicleServiceForm button[type="submit"]');
    animateButtonSuccess(submitBtn, '✓ Saved Successfully!', () => {
        closeVehicleServiceModal();
        renderVehicles();
        renderDashboard();
        renderReports();
    });
}
window.saveVehicleService = saveVehicleService;

function deleteCurrentVehicleService() {
    const id = document.getElementById('serviceId').value;
    if (!id) return;
    if (!confirm('Are you sure you want to delete this vehicle service record?')) return;

    let services = getVehicleServices();
    services = services.filter(s => s.id !== id);
    saveVehicleServices(services);

    if (isSupabaseConnected && supabaseClient) {
        deleteVehicleServiceFromSupabase(id);
        persistFleetToSupabase();
    }

    closeVehicleServiceModal();
    renderVehicles();
    renderDashboard();
    renderReports();
    showToast('Vehicle service expense deleted 🗑️', 'info');
}
window.deleteCurrentVehicleService = deleteCurrentVehicleService;

function mapVehicleServiceToSupabase(s) {
    return {
        id: s.id,
        date: s.date,
        vehicle_id: s.vehicleId || null,
        service_type: s.serviceType || 'General Service',
        amount: parseFloat(s.amount) || 0,
        garage: s.garage || null,
        odometer: s.odometer ? parseFloat(s.odometer) : null,
        notes: s.notes || null,
        updated_at: s.updatedAt || new Date().toISOString()
    };
}
window.mapVehicleServiceToSupabase = mapVehicleServiceToSupabase;

function mapVehicleServiceFromSupabase(row) {
    return {
        id: row.id,
        date: row.date,
        vehicleId: row.vehicle_id,
        serviceType: row.service_type || 'General Service',
        amount: parseFloat(row.amount) || 0,
        garage: row.garage || '',
        odometer: row.odometer,
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
window.mapVehicleServiceFromSupabase = mapVehicleServiceFromSupabase;


function updateLocalTripUI(isLocal) {
    const custRow = document.getElementById('billCustomerDetailsRow');
    const notice = document.getElementById('localTripCustomerNotice');
    const custName = document.getElementById('customerName');
    if (isLocal) {
        if (custRow) custRow.style.display = 'none';
        if (notice) notice.style.display = 'flex';
        if (custName) {
            custName.removeAttribute('required');
            if (!custName.value || custName.value === 'Local Trip') custName.value = 'Local Trip';
        }
    } else {
        if (custRow) custRow.style.display = 'flex';
        if (notice) notice.style.display = 'none';
        if (custName) {
            custName.setAttribute('required', 'required');
            if (custName.value === 'Local Trip') custName.value = '';
        }
    }
}
window.updateLocalTripUI = updateLocalTripUI;

// ===== BILL FROM / TO LOCATION HELPERS =====
function onFromLocationChange() {
    const sel = document.getElementById('fromLocation');
    const wrap = document.getElementById('fromLocationCustomWrap');
    const custom = document.getElementById('fromLocationCustom');
    if (!sel || !wrap) return;
    if (sel.value === 'OTHER') {
        wrap.style.display = 'block';
        if (custom) custom.focus();
    } else {
        wrap.style.display = 'none';
    }
}
window.onFromLocationChange = onFromLocationChange;

function onToLocationChange() {
    const sel = document.getElementById('toLocation');
    const wrap = document.getElementById('toLocationCustomWrap');
    const custom = document.getElementById('toLocationCustom');
    if (!sel || !wrap) return;
    if (sel.value === 'OTHER') {
        wrap.style.display = 'block';
        if (custom) custom.focus();
    } else {
        wrap.style.display = 'none';
    }
}
window.onToLocationChange = onToLocationChange;

function getFromLocationValue() {
    const sel = document.getElementById('fromLocation');
    const custom = document.getElementById('fromLocationCustom');
    if (!sel) return 'Kumbakonam';
    if (sel.value === 'OTHER') {
        return (custom ? custom.value.trim() : '') || 'Kumbakonam';
    }
    return sel.value || 'Kumbakonam';
}
window.getFromLocationValue = getFromLocationValue;

function setFromLocationValue(val) {
    const sel = document.getElementById('fromLocation');
    const wrap = document.getElementById('fromLocationCustomWrap');
    const custom = document.getElementById('fromLocationCustom');
    if (!sel) return;
    const targetVal = val ? val.trim() : 'Kumbakonam';
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.toLowerCase() === targetVal.toLowerCase()) {
            sel.selectedIndex = i;
            found = true;
            break;
        }
    }
    if (found) {
        if (wrap) wrap.style.display = 'none';
    } else {
        sel.value = 'OTHER';
        if (wrap) {
            wrap.style.display = 'block';
            if (custom) custom.value = targetVal;
        }
    }
}
window.setFromLocationValue = setFromLocationValue;

function getToLocationValue() {
    const sel = document.getElementById('toLocation');
    const custom = document.getElementById('toLocationCustom');
    if (!sel) return '';
    if (sel.value === 'OTHER') {
        return (custom ? custom.value.trim() : '');
    }
    return sel.value || '';
}
window.getToLocationValue = getToLocationValue;

function setToLocationValue(val) {
    const sel = document.getElementById('toLocation');
    const wrap = document.getElementById('toLocationCustomWrap');
    const custom = document.getElementById('toLocationCustom');
    if (!sel) return;
    if (!val) {
        sel.value = 'Kumbakonam';
        if (wrap) wrap.style.display = 'none';
        return;
    }
    const targetVal = val.trim();
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.toLowerCase() === targetVal.toLowerCase()) {
            sel.selectedIndex = i;
            found = true;
            break;
        }
    }
    if (found) {
        if (wrap) wrap.style.display = 'none';
    } else {
        sel.value = 'OTHER';
        if (wrap) {
            wrap.style.display = 'block';
            if (custom) custom.value = targetVal;
        }
    }
}
window.setToLocationValue = setToLocationValue;


// ===== BILLING =====
// Charge Description Presets (Local Delivery first)
const CHARGE_DESCRIPTION_OPTIONS = [
    { value: 'Local Delivery', label: 'Local Delivery' },
    { value: 'Transport Charge', label: 'Transport Charge' },
    { value: 'Loading & Unloading Charge', label: 'Loading & Unloading Charge' },
    { value: 'Halting / Detention Charge', label: 'Halting / Detention Charge' },
    { value: 'Toll & Fastag Charge', label: 'Toll & Fastag Charge' },
    { value: 'Driver Batta / Allowance', label: 'Driver Batta / Allowance' },
    { value: 'Fuel Surcharge', label: 'Fuel Surcharge' },
    { value: 'OTHER', label: '✏️ Other / Custom Description...' }
];

function renderLineItemRow(index = 0, defaultDesc = 'Local Delivery', defaultAmount = '') {
    const isStandard = CHARGE_DESCRIPTION_OPTIONS.some(o => o.value === defaultDesc && o.value !== 'OTHER');
    const selected = isStandard ? defaultDesc : (defaultDesc ? 'OTHER' : 'Local Delivery');
    const customVal = isStandard ? '' : (defaultDesc || '');
    const isCustom = selected === 'OTHER';

    const optsHtml = CHARGE_DESCRIPTION_OPTIONS.map(o => 
        `<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    const safeDesc = (defaultDesc || 'Local Delivery').replace(/"/g, '&quot;');
    const safeCustom = customVal.replace(/"/g, '&quot;');
    const amountVal = (defaultAmount !== '' && defaultAmount !== null && defaultAmount !== undefined) ? defaultAmount : '';

    return `
        <div class="line-item" data-index="${index}">
            <div class="item-desc-wrap">
                <select class="item-desc-select" onchange="handleChargeSelectChange(this)" aria-label="Charge Description">
                    ${optsHtml}
                </select>
                <input 
                    type="text" 
                    placeholder="Type custom charge description..." 
                    class="item-desc-custom" 
                    value="${safeCustom}" 
                    style="${isCustom ? 'display:block;' : 'display:none;'}"
                    oninput="handleChargeCustomInput(this)"
                >
                <input type="hidden" class="item-desc" value="${safeDesc}">
            </div>
            <input type="number" placeholder="Amount (₹)" class="item-amount" min="0" step="0.01" value="${amountVal}" required oninput="calculateBillTotal()">
            <button type="button" class="line-item-remove" onclick="removeLineItem(this)" title="Remove Charge">✕</button>
        </div>`;
}

function handleChargeSelectChange(selectEl) {
    const wrap = selectEl.closest('.item-desc-wrap');
    if (!wrap) return;
    const customInput = wrap.querySelector('.item-desc-custom');
    const hiddenInput = wrap.querySelector('.item-desc');
    const val = selectEl.value;

    if (val === 'OTHER') {
        if (customInput) {
            customInput.style.display = 'block';
            customInput.focus();
            if (hiddenInput) hiddenInput.value = customInput.value.trim() || 'Custom Charge';
        }
    } else {
        if (customInput) customInput.style.display = 'none';
        if (hiddenInput) hiddenInput.value = val;
    }
}
window.handleChargeSelectChange = handleChargeSelectChange;

function handleChargeCustomInput(inputEl) {
    const wrap = inputEl.closest('.item-desc-wrap');
    if (!wrap) return;
    const hiddenInput = wrap.querySelector('.item-desc');
    if (hiddenInput) {
        hiddenInput.value = inputEl.value.trim() || 'Custom Charge';
    }
}
window.handleChargeCustomInput = handleChargeCustomInput;

function applyQuickChargePreset(presetName) {
    const container = document.getElementById('lineItems');
    if (!container) return;
    const rows = container.querySelectorAll('.line-item');
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
    const lastAmount = lastRow ? lastRow.querySelector('.item-amount')?.value : '';

    if (lastRow && (!lastAmount || parseFloat(lastAmount) === 0)) {
        const select = lastRow.querySelector('.item-desc-select');
        const hidden = lastRow.querySelector('.item-desc');
        const custom = lastRow.querySelector('.item-desc-custom');
        if (select) {
            select.value = presetName;
            if (custom) custom.style.display = 'none';
            if (hidden) hidden.value = presetName;
        }
        lastRow.querySelector('.item-amount')?.focus();
    } else {
        addLineItem(presetName);
    }
    showToast(`Charge set: ${presetName} 🚚`, 'info');
}
window.applyQuickChargePreset = applyQuickChargePreset;

function openBillModal(billId) {
    const modal = document.getElementById('billModal');
    const form = document.getElementById('billForm');
    form.reset();

    // Reset line items with Local Delivery as first default
    document.getElementById('lineItems').innerHTML = renderLineItemRow(0, 'Local Delivery', '');

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
        setFromLocationValue(bill.fromLocation || 'Kumbakonam');
        setToLocationValue(bill.toLocation || 'Kumbakonam');
        document.getElementById('goodsDesc').value = bill.goodsDesc || '';

        // Local Income Trip option
        const isLocal = Boolean(bill.isLocalIncome || bill.tripType === 'local');
        const localCheck = document.getElementById('isLocalIncome');
        if (localCheck) localCheck.checked = isLocal;
        updateLocalTripUI(isLocal);

        document.getElementById('gstPercent').value = bill.gstPercent || 0;
        document.getElementById('amountPaid').value = bill.amountPaid || 0;
        document.getElementById('paymentStatus').value = bill.paymentStatus;
        document.getElementById('billNotes').value = bill.notes || '';

        // Restore line items
        const lineItemsContainer = document.getElementById('lineItems');
        lineItemsContainer.innerHTML = '';
        if (bill.lineItems && bill.lineItems.length > 0) {
            bill.lineItems.forEach((item, i) => {
                lineItemsContainer.insertAdjacentHTML('beforeend', renderLineItemRow(i, item.desc || 'Local Delivery', item.amount || 0));
            });
        } else {
            lineItemsContainer.innerHTML = renderLineItemRow(0, 'Local Delivery', '');
        }

        calculateBillTotal();
        calculateBillBalance();
    } else {
        // New bill
        document.getElementById('billModalTitle').textContent = 'Create New Bill';
        document.getElementById('billId').value = '';
        recalibrateBillCounter();
        const autoNext = getNextBillNumber();
        document.getElementById('billNumber').value = autoNext;
        document.getElementById('billDate').value = new Date().toISOString().split('T')[0];
        setFromLocationValue('Kumbakonam');
        setToLocationValue('Kumbakonam');
        const localCheck = document.getElementById('isLocalIncome');
        if (localCheck) localCheck.checked = false;
        updateLocalTripUI(false);

        document.getElementById('billSubtotal').textContent = '₹0.00';
        document.getElementById('billGst').textContent = '₹0.00';
        document.getElementById('billGrandTotal').textContent = '₹0.00';
        document.getElementById('billBalance').value = '₹0.00';
    }

    const delBtn = document.getElementById('billModalDeleteBtn');
    if (delBtn) delBtn.style.display = billId ? 'inline-flex' : 'none';

    modal.classList.add('show');
}

let driverSalaryManuallyEdited = false;
function onDriverSalaryAmountInput() {
    driverSalaryManuallyEdited = true;
}
window.onDriverSalaryAmountInput = onDriverSalaryAmountInput;

function onLocalIncomeTripToggle() {
    const isLocal = document.getElementById('isLocalIncome').checked;
    updateLocalTripUI(isLocal);
    if (isLocal) {
        showToast('⚡ Local Trip enabled: Customer details hidden & omitted', 'info');
    } else {
        showToast('Standard Trip: Customer details restored', 'info');
    }
}
window.onLocalIncomeTripToggle = onLocalIncomeTripToggle;

function toggleDriverSalaryFields() {
    const isChecked = document.getElementById('addToDriverSalary').checked;
    const salaryDrawer = document.getElementById('driverSalaryDetails');
    if (salaryDrawer) {
        salaryDrawer.style.display = isChecked ? 'block' : 'none';
    }
    if (isChecked) {
        const driverInput = document.getElementById('driverName');
        if (driverInput && !driverInput.value) {
            const vId = document.getElementById('billVehicle').value;
            if (vId) {
                const recent = getFuelLogs().filter(f => f.vehicleId === vId && f.driver).sort((a,b) => new Date(b.date) - new Date(a.date));
                if (recent.length > 0) driverInput.value = recent[0].driver;
            }
        }
        populateDriverQuickChips(driverInput ? driverInput.value : '');
        const salaryInput = document.getElementById('driverSalaryAmount');
        if (salaryInput && (!salaryInput.value || parseFloat(salaryInput.value) === 0)) {
            syncDriverSalaryWithTotal();
        }
    }
}
window.toggleDriverSalaryFields = toggleDriverSalaryFields;

function syncDriverSalaryWithTotal() {
    const amounts = document.querySelectorAll('#lineItems .item-amount');
    let subtotal = 0;
    amounts.forEach(input => { subtotal += parseFloat(input.value) || 0; });
    const gstPercent = parseFloat(document.getElementById('gstPercent').value) || 0;
    const grandTotal = subtotal + (subtotal * gstPercent / 100);
    const salaryInput = document.getElementById('driverSalaryAmount');
    if (salaryInput) {
        salaryInput.value = grandTotal > 0 ? grandTotal.toFixed(2) : '0.00';
        driverSalaryManuallyEdited = false;
        showToast('Salary set to bill total: ' + formatCurrency(grandTotal), 'info');
    }
}
window.syncDriverSalaryWithTotal = syncDriverSalaryWithTotal;

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

function addLineItem(defaultDesc = 'Local Delivery') {
    const container = document.getElementById('lineItems');
    const index = container.children.length;
    container.insertAdjacentHTML('beforeend', renderLineItemRow(index, defaultDesc, ''));
    const newRow = container.lastElementChild;
    const amtInput = newRow?.querySelector('.item-amount');
    if (amtInput) amtInput.focus();
}
window.addLineItem = addLineItem;

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

    // Keep Driver Salary synced if enabled and not manually overridden
    const addSalary = document.getElementById('addToDriverSalary');
    const salaryInput = document.getElementById('driverSalaryAmount');
    if (addSalary && addSalary.checked && salaryInput && !driverSalaryManuallyEdited) {
        salaryInput.value = grandTotal > 0 ? grandTotal.toFixed(2) : '';
    }

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
        const hidden = li.querySelector('.item-desc');
        const select = li.querySelector('.item-desc-select');
        const custom = li.querySelector('.item-desc-custom');
        let desc = '';
        if (hidden && hidden.value) {
            desc = hidden.value.trim();
        } else if (select && select.value) {
            desc = select.value === 'OTHER' ? (custom?.value.trim() || 'Custom Charge') : select.value;
        }
        if (!desc) desc = 'Local Delivery';

        lineItems.push({
            desc: desc,
            amount: parseFloat(li.querySelector('.item-amount')?.value) || 0
        });
    });

    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const gstPercent = parseFloat(document.getElementById('gstPercent').value) || 0;
    const gst = subtotal * (gstPercent / 100);
    const grandTotal = subtotal + gst;
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;

    const isLocalIncome = document.getElementById('isLocalIncome') ? document.getElementById('isLocalIncome').checked : false;
    const addToDriverSalary = document.getElementById('addToDriverSalary') ? document.getElementById('addToDriverSalary').checked : false;
    const driverName = document.getElementById('driverName') ? document.getElementById('driverName').value.trim() : '';
    const driverSalaryAmount = addToDriverSalary ? (parseFloat(document.getElementById('driverSalaryAmount')?.value) || 0) : 0;
    const driverSalaryStatus = document.getElementById('driverSalaryStatus') ? document.getElementById('driverSalaryStatus').value : 'paid';

    let customerName = document.getElementById('customerName').value.trim();
    let customerPhone = document.getElementById('customerPhone').value.trim();
    if (isLocalIncome) {
        if (!customerName || customerName === 'Local Trip') customerName = 'Local Trip';
        customerPhone = '';
    }

    const billData = {
        billNumber: document.getElementById('billNumber').value,
        date: document.getElementById('billDate').value,
        vehicleId: document.getElementById('billVehicle').value,
        customerName: customerName,
        customerPhone: customerPhone,
        fromLocation: getFromLocationValue(),
        toLocation: getToLocationValue(),
        goodsDesc: document.getElementById('goodsDesc').value,
        isLocalIncome: isLocalIncome,
        addToDriverSalary: addToDriverSalary,
        driverName: driverName,
        driverSalaryAmount: driverSalaryAmount,
        driverSalaryStatus: driverSalaryStatus,
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
        // New bill booking: ensure unique sequential bill number
        let assignedNumber = (document.getElementById('billNumber').value || '').trim();
        const existingBills = getBills();
        const isDuplicate = assignedNumber && existingBills.some(b => b.billNumber && b.billNumber.trim().toLowerCase() === assignedNumber.toLowerCase());

        if (!assignedNumber || isDuplicate) {
            recalibrateBillCounter();
            assignedNumber = getNextBillNumber();
            if (isDuplicate) {
                showToast(`Bill # was duplicate. Auto-changed to ${assignedNumber} ⚡`, 'info');
            }
        }
        billData.billNumber = assignedNumber;
        commitBillNumber(assignedNumber);

        billData.createdAt = new Date().toISOString();
        bills.push(billData);
        addNotification(`New bill ${billData.billNumber} created for ${billData.customerName}`);
        showToast(`Bill ${billData.billNumber} created successfully! 🎉`, 'success');
    }

    saveBills(bills);

    if (isSupabaseConnected && supabaseClient) {
        uploadBillToSupabase(billData);
        persistFleetToSupabase();
    }
    const submitBtn = (event && event.target) ? event.target.querySelector('button[type="submit"]') : document.querySelector('#billForm button[type="submit"]');
    animateButtonSuccess(submitBtn, '✓ Saved Successfully!', () => {
        closeBillModal();
        renderBills();
        renderDashboard();
        renderVehicles();
        renderReports();
    });
}

function renderBillCardHtml(bill) {
    const v = getVehicleById(bill.vehicleId);
    const isLocal = Boolean(bill.isLocalIncome || bill.tripType === 'local');
    const hasSalary = Boolean(bill.addToDriverSalary);
    const salaryAmt = parseFloat(bill.driverSalaryAmount) || parseFloat(bill.grandTotal) || 0;
    const salaryStatus = bill.driverSalaryStatus || 'paid';

    return `
    <div class="bill-item" onclick="viewBill('${bill.id}')">
        <div class="bill-item-top">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span class="bill-item-number">${bill.billNumber}</span>
                ${isLocal ? `<span class="badge-tag-local" title="Local Income Trip">⚡ Local Trip</span>` : ''}
                ${hasSalary ? `<span class="badge-tag-salary" title="Driver Salary Allocated">👤 Salary: ${formatCurrency(salaryAmt)}${bill.driverName ? ' (' + bill.driverName + ')' : ''} <span class="${salaryStatus === 'unpaid' ? 'badge-salary-unpaid' : 'badge-salary-paid'}" style="margin-left:2px;font-size:9px;padding:1px 5px;">${salaryStatus.toUpperCase()}</span></span>` : ''}
            </div>
            <span class="bill-item-status ${bill.paymentStatus}">${bill.paymentStatus}</span>
        </div>
        <div class="bill-item-middle">
            <span class="bill-item-customer">${isLocal ? '<span style="color:var(--orange,#EF5226);font-weight:700;">⚡ Local Income Trip</span>' : bill.customerName}</span>
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
    container.innerHTML = sortedBills.map(renderBillCardHtml).join('');
}

function renderDriverSalaryCardHtml(s) {
    const v = getVehicleById(s.vehicleId);
    const isPaid = (s.status || 'paid') !== 'unpaid';

    return `
    <div class="bill-item salary-entry-card" onclick="openDriverSalaryModal('${s.id}')" style="border-left:3px solid #10b981;">
        <div class="bill-item-top">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span class="badge-tag-salary" style="font-size:11px;padding:3px 9px;">👤 Driver Salary</span>
                <span class="${isPaid ? 'badge-salary-paid' : 'badge-salary-unpaid'}">${isPaid ? '✓ PAID' : '⏳ UNPAID'}</span>
            </div>
            <span class="bill-item-amount" style="color:#0ea5e9;">${formatCurrency(s.amount)}</span>
        </div>
        <div class="bill-item-middle">
            <span class="bill-item-customer" style="color:#000000;font-weight:700;">👤 ${s.driverName}</span>
            <span class="bill-item-route">${s.notes || 'Driver salary payout'}</span>
        </div>
        <div class="bill-item-bottom">
            <span class="bill-item-meta">
                <span>${v ? getVehicleDisplay(v) : 'General Fleet'}</span>
                <span>${formatDate(s.date)}</span>
            </span>
        </div>
        <div class="bill-item-actions" onclick="event.stopPropagation()">
            <button class="bill-action-btn" onclick="openDriverSalaryModal('${s.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
            </button>
            <button class="bill-action-btn delete" onclick="event.stopPropagation(); deleteDriverSalaryById('${s.id}');">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
            </button>
        </div>
    </div>`;
}

function filterBills() {
    const search = (document.getElementById('billSearch').value || '').toLowerCase();
    const vehicleFilter = document.getElementById('billVehicleFilter').value;
    const typeFilter = document.getElementById('billTypeFilter') ? document.getElementById('billTypeFilter').value : 'all';
    const statusFilter = document.getElementById('billStatusFilter').value;

    let bills = getBills();
    let standaloneSalaries = [];

    // Include standalone driver salaries when salary filter is active or showing all
    if (typeFilter === 'salary' || typeFilter === 'salary_unpaid' || typeFilter === 'salary_paid' || typeFilter === 'all') {
        standaloneSalaries = getDriverSalaries();
    }

    if (search) {
        bills = bills.filter(b =>
            (b.billNumber && b.billNumber.toLowerCase().includes(search)) ||
            (b.customerName && b.customerName.toLowerCase().includes(search)) ||
            (b.fromLocation && b.fromLocation.toLowerCase().includes(search)) ||
            (b.toLocation && b.toLocation.toLowerCase().includes(search)) ||
            (b.driverName && b.driverName.toLowerCase().includes(search))
        );
        standaloneSalaries = standaloneSalaries.filter(s =>
            (s.driverName && s.driverName.toLowerCase().includes(search)) ||
            (s.notes && s.notes.toLowerCase().includes(search))
        );
    }

    if (vehicleFilter) {
        bills = bills.filter(b => b.vehicleId === vehicleFilter);
        standaloneSalaries = standaloneSalaries.filter(s => s.vehicleId === vehicleFilter);
    }

    if (typeFilter === 'local') {
        bills = bills.filter(b => b.isLocalIncome === true || b.tripType === 'local');
        standaloneSalaries = []; // No standalone salaries for local filter
    } else if (typeFilter === 'standard') {
        bills = bills.filter(b => !b.isLocalIncome && b.tripType !== 'local');
        standaloneSalaries = []; // No standalone salaries for standard filter
    } else if (typeFilter === 'salary') {
        bills = bills.filter(b => b.addToDriverSalary === true);
        // Keep all standalone salaries
    } else if (typeFilter === 'salary_unpaid') {
        bills = bills.filter(b => b.addToDriverSalary === true && b.driverSalaryStatus === 'unpaid');
        standaloneSalaries = standaloneSalaries.filter(s => s.status === 'unpaid');
    } else if (typeFilter === 'salary_paid') {
        bills = bills.filter(b => b.addToDriverSalary === true && b.driverSalaryStatus !== 'unpaid');
        standaloneSalaries = standaloneSalaries.filter(s => (s.status || 'paid') !== 'unpaid');
    } else {
        // typeFilter === 'all' — don't include standalone salaries in the "all" view to avoid cluttering
        standaloneSalaries = [];
    }

    if (statusFilter) {
        bills = bills.filter(b => b.paymentStatus === statusFilter);
        // For standalone salaries, map paid/unpaid to status filter
        if (statusFilter === 'paid') {
            standaloneSalaries = standaloneSalaries.filter(s => (s.status || 'paid') !== 'unpaid');
        } else if (statusFilter === 'unpaid') {
            standaloneSalaries = standaloneSalaries.filter(s => s.status === 'unpaid');
        } else {
            standaloneSalaries = [];
        }
    }

    const container = document.getElementById('billsList');

    if (bills.length === 0 && standaloneSalaries.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No matching bills found</p></div>';
        return;
    }

    // Create combined sorted items
    const billItems = bills.map(b => ({ type: 'bill', date: b.date, data: b }));
    const salaryItems = standaloneSalaries.map(s => ({ type: 'salary', date: s.date, data: s }));
    const combined = [...billItems, ...salaryItems].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = combined.map(item => {
        if (item.type === 'salary') {
            return renderDriverSalaryCardHtml(item.data);
        }
        return renderBillCardHtml(item.data);
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
            ${(bill.isLocalIncome || bill.tripType === 'local') ? `
                <div class="bill-view-row"><span class="label">Trip Classification</span><span class="value" style="color:var(--orange);font-weight:700;">⚡ Local Income Trip</span></div>
            ` : `
                <div class="bill-view-row"><span class="label">Customer</span><span class="value">${bill.customerName}</span></div>
                ${bill.customerPhone ? `<div class="bill-view-row"><span class="label">Phone</span><span class="value">${bill.customerPhone}</span></div>` : ''}
            `}
            <div class="bill-view-row"><span class="label">From</span><span class="value">${bill.fromLocation}</span></div>
            <div class="bill-view-row"><span class="label">To</span><span class="value">${bill.toLocation}</span></div>
            <div class="bill-view-row"><span class="label">Vehicle</span><span class="value">${v ? getVehicleDisplay(v) : '-'}</span></div>
            ${bill.goodsDesc ? `<div class="bill-view-row"><span class="label">Goods</span><span class="value">${bill.goodsDesc}</span></div>` : ''}
            ${bill.addToDriverSalary ? `<div class="bill-view-row"><span class="label">Driver Salary</span><span class="value" style="color:#0ea5e9;font-weight:700;">${formatCurrency(bill.driverSalaryAmount || bill.grandTotal)} ${bill.driverName ? `(Driver: ${bill.driverName})` : ''} <span class="${(bill.driverSalaryStatus || 'paid') === 'unpaid' ? 'badge-salary-unpaid' : 'badge-salary-paid'}" style="margin-left:4px;font-size:10px;">${(bill.driverSalaryStatus || 'paid').toUpperCase()}</span></span></div>` : ''}
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

        ${(bill.isLocalIncome || bill.tripType === 'local') ? `
            <div class="info-row"><span class="label">Trip Classification</span><span class="value" style="color:#EF5226;font-weight:700;">⚡ Local Income Trip</span></div>
        ` : `
            <div class="info-row"><span class="label">Customer</span><span class="value">${bill.customerName}</span></div>
            ${bill.customerPhone ? `<div class="info-row"><span class="label">Phone</span><span class="value">${bill.customerPhone}</span></div>` : ''}
        `}
        <div class="info-row"><span class="label">From</span><span class="value">${bill.fromLocation}</span></div>
        <div class="info-row"><span class="label">To</span><span class="value">${bill.toLocation}</span></div>
        <div class="info-row"><span class="label">Vehicle</span><span class="value">${v ? getVehicleDisplay(v) : '-'}</span></div>
        ${bill.goodsDesc ? `<div class="info-row"><span class="label">Goods</span><span class="value">${bill.goodsDesc}</span></div>` : ''}
        ${bill.addToDriverSalary ? `<div class="info-row"><span class="label">Driver Salary</span><span class="value" style="color:#0284c7;font-weight:700;">${formatCurrency(bill.driverSalaryAmount || bill.grandTotal)} ${bill.driverName ? `(${bill.driverName})` : ''} [${(bill.driverSalaryStatus || 'paid').toUpperCase()}]</span></div>` : ''}

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
    if (!bill.isLocalIncome && bill.tripType !== 'local') {
        text += `*Customer:* ${bill.customerName}\n`;
    } else {
        text += `*Trip Type:* ⚡ Local Income Trip\n`;
    }
    text += `*From:* ${bill.fromLocation}\n`;
    text += `*To:* ${bill.toLocation}\n`;
    text += `*Vehicle:* ${v ? getVehicleDisplay(v) : '-'}\n`;
    if (bill.addToDriverSalary) text += `*Driver Salary:* ${formatCurrency(bill.driverSalaryAmount || bill.grandTotal)} (${bill.driverName || 'Assigned Driver'}) [${(bill.driverSalaryStatus || 'paid').toUpperCase()}]\n`;
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

function onFuelStationChange() {
    const sel = document.getElementById('fuelStation');
    const wrap = document.getElementById('fuelStationCustomWrap');
    const custom = document.getElementById('fuelStationCustom');
    if (sel && wrap) {
        if (sel.value === 'OTHER') {
            wrap.style.display = 'block';
            if (custom) custom.focus();
        } else {
            wrap.style.display = 'none';
        }
    }
}
window.onFuelStationChange = onFuelStationChange;

function onFuelDriverChange() {
    const sel = document.getElementById('fuelDriver');
    const wrap = document.getElementById('fuelDriverCustomWrap');
    const custom = document.getElementById('fuelDriverCustom');
    if (sel && wrap) {
        if (sel.value === 'OTHER') {
            wrap.style.display = 'block';
            if (custom) custom.focus();
        } else {
            wrap.style.display = 'none';
        }
    }
}
window.onFuelDriverChange = onFuelDriverChange;

function getSelectedFuelStation() {
    const sel = document.getElementById('fuelStation');
    const custom = document.getElementById('fuelStationCustom');
    if (!sel) return 'Kumbakonam (Main)';
    if (sel.value === 'OTHER') {
        return (custom ? custom.value.trim() : '') || 'Kumbakonam (Main)';
    }
    return sel.value || 'Kumbakonam (Main)';
}

function setFuelStationValue(val) {
    const sel = document.getElementById('fuelStation');
    const wrap = document.getElementById('fuelStationCustomWrap');
    const custom = document.getElementById('fuelStationCustom');
    if (!sel) return;
    if (!val) {
        sel.value = 'Kumbakonam (Main)';
        if (wrap) wrap.style.display = 'none';
        return;
    }
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === val || sel.options[i].value.toLowerCase() === val.toLowerCase()) {
            sel.selectedIndex = i;
            found = true;
            break;
        }
    }
    if (found) {
        if (wrap) wrap.style.display = 'none';
    } else {
        sel.value = 'OTHER';
        if (wrap) {
            wrap.style.display = 'block';
            if (custom) custom.value = val;
        }
    }
}

function getSelectedFuelDriver() {
    const sel = document.getElementById('fuelDriver');
    const custom = document.getElementById('fuelDriverCustom');
    if (!sel) return '';
    if (sel.value === 'OTHER') {
        return (custom ? custom.value.trim() : '');
    }
    return sel.value || '';
}

function setFuelDriverValue(val) {
    const sel = document.getElementById('fuelDriver');
    const wrap = document.getElementById('fuelDriverCustomWrap');
    const custom = document.getElementById('fuelDriverCustom');
    if (!sel) return;
    if (!val) {
        sel.value = '';
        if (wrap) wrap.style.display = 'none';
        return;
    }
    let found = false;
    const cleanVal = val.trim().toUpperCase();
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.toUpperCase() === cleanVal) {
            sel.selectedIndex = i;
            found = true;
            break;
        }
    }
    if (found) {
        if (wrap) wrap.style.display = 'none';
    } else {
        sel.value = 'OTHER';
        if (wrap) {
            wrap.style.display = 'block';
            if (custom) custom.value = val;
        }
    }
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
        setFuelStationValue(entry.station || 'Kumbakonam (Main)');
        document.getElementById('fuelType').value = entry.fuelType || 'diesel';
        document.getElementById('fuelLitres').value = entry.litres;
        document.getElementById('fuelRate').value = entry.rate;
        const totalAmountEl = document.getElementById('fuelTotalAmount');
        if (totalAmountEl) totalAmountEl.value = entry.totalAmount;
        document.getElementById('fuelTotal').value = formatCurrency(entry.totalAmount);
        document.getElementById('fuelOdometer').value = entry.odometer || '';
        setFuelDriverValue(entry.driver || '');
        document.getElementById('fuelNotes').value = entry.notes || '';
        if (rateBadge) rateBadge.textContent = `Recorded: ₹${parseFloat(entry.rate).toFixed(2)}/L`;
    } else {
        document.getElementById('fuelModalTitle').textContent = 'Add Fuel Entry';
        document.getElementById('fuelId').value = '';
        document.getElementById('fuelDate').value = new Date().toISOString().split('T')[0];
        setFuelStationValue('Kumbakonam (Main)');
        setFuelDriverValue('');
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

    const station = getSelectedFuelStation();
    const driver = getSelectedFuelDriver();

    const fuelData = {
        date: document.getElementById('fuelDate').value,
        vehicleId: document.getElementById('fuelVehicle').value,
        station,
        fuelType: document.getElementById('fuelType').value,
        litres,
        rate,
        totalAmount,
        odometer: document.getElementById('fuelOdometer').value ? parseFloat(document.getElementById('fuelOdometer').value) : null,
        driver,
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
    const submitBtn = (event && event.target) ? event.target.querySelector('button[type="submit"]') : document.querySelector('#fuelForm button[type="submit"]');
    animateButtonSuccess(submitBtn, '✓ Saved Successfully!', () => {
        closeFuelModal();
        renderFuelLogs();
        renderDashboard();
        renderVehicles();
        renderReports();
    });
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
            <div class="fuel-summary-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">📋</div>
            <div>
                <span class="fuel-summary-label">Fuel Entries</span>
                <span class="fuel-summary-value" style="color:#10b981;">${logs.length} Logs</span>
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
    const pillSalary = document.getElementById('pillShowSalary');
    const pillService = document.getElementById('pillShowService');
    const billsSec = document.getElementById('reportBillsSection');
    const fuelSec = document.getElementById('reportFuelSection');
    const salarySec = document.getElementById('reportSalarySection');
    const serviceSec = document.getElementById('reportServiceSection');

    if (pillBills) pillBills.classList.toggle('active', tab === 'bills');
    if (pillFuel) pillFuel.classList.toggle('active', tab === 'fuel');
    if (pillSalary) pillSalary.classList.toggle('active', tab === 'salary');
    if (pillService) pillService.classList.toggle('active', tab === 'service');
    if (billsSec) billsSec.style.display = tab === 'bills' ? 'flex' : 'none';
    if (fuelSec) fuelSec.style.display = tab === 'fuel' ? 'flex' : 'none';
    if (salarySec) salarySec.style.display = tab === 'salary' ? 'flex' : 'none';
    if (serviceSec) serviceSec.style.display = tab === 'service' ? 'flex' : 'none';
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

    // Filter salaries by period
    let periodSalaries = getDriverSalaries();
    if (reportState.period !== 'all_time') {
        periodSalaries = periodSalaries.filter(s => {
            const d = (s.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
    }

    // Filter services by period
    let periodServices = typeof getVehicleServices === 'function' ? getVehicleServices() : [];
    if (reportState.period !== 'all_time') {
        periodServices = periodServices.filter(s => {
            const d = (s.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
    }

    // Filter by vehicle
    if (reportState.vehicleId !== 'all') {
        periodBills = periodBills.filter(b => isVehicleMatch(b.vehicleId, reportState.vehicleId));
        periodFuel = periodFuel.filter(f => isVehicleMatch(f.vehicleId, reportState.vehicleId));
        periodSalaries = periodSalaries.filter(s => !s.vehicleId || isVehicleMatch(s.vehicleId, reportState.vehicleId));
        periodServices = periodServices.filter(s => !s.vehicleId || isVehicleMatch(s.vehicleId, reportState.vehicleId));
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

    renderPeriodKPIs(periodBills, periodFuel, vehicles, periodSalaries, periodServices);
    renderRevenueChart(periodBills, dateRange, reportState.period);
    renderFuelChart(periodFuel, dateRange, reportState.period);
    renderVehicleChart(vehicles, periodBills, periodFuel);
    renderPnLTable(vehicles, periodBills, periodFuel, periodSalaries, periodServices);
    renderPeriodTxnList(periodBills, periodFuel, periodSalaries, periodServices);
}

// ===== EXECUTIVE KPIS =====
function renderPeriodKPIs(bills, fuel, vehicles, salaries, services) {
    const container = document.getElementById('reportKpiRow');
    if (!container) return;

    if (!salaries) salaries = getDriverSalaries();
    if (!services) services = typeof getVehicleServices === 'function' ? getVehicleServices() : [];

    const stdBills = bills.filter(b => !b.isLocalIncome && b.tripType !== 'local');
    const localBills = bills.filter(b => b.isLocalIncome === true || b.tripType === 'local');
    const stdRevenue = stdBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const localRevenue = localBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const totalRevenue = stdRevenue + localRevenue;

    const totalFuelCost = fuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
    const totalLitres = fuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);

    const salaryBills = bills.filter(b => b.addToDriverSalary === true);
    const legacySalaryTotal = salaryBills.reduce((s, b) => {
        const amt = parseFloat(b.driverSalaryAmount);
        return s + (!isNaN(amt) && amt > 0 ? amt : (parseFloat(b.grandTotal) || 0));
    }, 0);
    const directSalaryTotal = (salaries || []).reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
    const totalDriverSalary = legacySalaryTotal + directSalaryTotal;
    const totalSalaryCount = salaryBills.length + (salaries || []).length;

    const totalServiceCost = (services || []).reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
    const totalServiceCount = (services || []).length;

    const totalOperatingExpenses = totalFuelCost + totalDriverSalary + totalServiceCost;
    const netProfit = totalRevenue - totalOperatingExpenses;
    const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    const totalPending = bills.reduce((s, b) => s + (parseFloat(b.balance) || 0), 0);

    // Mileage calculation
    let totalKm = 0;
    vehicles.forEach(v => {
        const vFuel = fuel.filter(f => isItemForVehicle(f.vehicleId, v) && f.odometer > 0)
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
                <div class="report-kpi-sub">${stdBills.length} Std (${formatCurrency(stdRevenue)}) • ${localBills.length} Local</div>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon" style="background:rgba(245, 158, 11, 0.12);color:#f59e0b;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Local Trip Income</div>
                <div class="report-kpi-val" style="color:#f59e0b;">${formatCurrency(localRevenue)}</div>
                <div class="report-kpi-sub">${localBills.length} Local dispatch${localBills.length === 1 ? '' : 'es'}</div>
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
            <div class="report-kpi-icon teal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Driver Salary</div>
                <div class="report-kpi-val" style="color:#0ea5e9;">${formatCurrency(totalDriverSalary)}</div>
                <div class="report-kpi-sub">${totalSalaryCount} Payout${totalSalaryCount === 1 ? '' : 's'} (Expense)</div>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon orange" style="background:rgba(239,82,38,0.15);color:var(--orange);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Service & Repairs</div>
                <div class="report-kpi-val" style="color:var(--orange);">${formatCurrency(totalServiceCost)}</div>
                <div class="report-kpi-sub">${totalServiceCount} Maintenance log${totalServiceCount === 1 ? '' : 's'}</div>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon ${netProfit >= 0 ? 'green' : 'red'}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">${netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</div>
                <div class="report-kpi-val" style="color:${netProfit >= 0 ? 'var(--green)' : 'var(--red)'};">${formatCurrency(netProfit)}</div>
                <span class="report-kpi-badge ${netProfit >= 0 ? 'profit' : 'loss'}">${netProfit >= 0 ? '+' : ''}${margin}% Margin</span>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon" style="background:rgba(16, 185, 129, 0.12);color:var(--green);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Fleet Efficiency</div>
                <div class="report-kpi-val" style="color:var(--green);">${avgMileage}</div>
                <div class="report-kpi-sub">${totalKm > 0 ? `${totalKm.toFixed(0)} km recorded` : 'Fleet consumption'}</div>
            </div>
        </div>

        <div class="report-kpi-card">
            <div class="report-kpi-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="report-kpi-content">
                <div class="report-kpi-title">Pending Dues</div>
                <div class="report-kpi-val" style="color:${totalPending > 0 ? 'var(--orange)' : 'var(--green)'};">${formatCurrency(totalPending)}</div>
                <div class="report-kpi-sub">Uncollected customer balance</div>
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
        const amount = bills.filter(b => isItemForVehicle(b.vehicleId, v)).reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fuelAmt = fuel.filter(f => isItemForVehicle(f.vehicleId, v)).reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
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
function renderPnLTable(vehicles, bills, fuel, salaries, services) {
    const container = document.getElementById('pnlTable');
    if (!container) return;

    if (!salaries) salaries = getDriverSalaries();
    if (!services) services = typeof getVehicleServices === 'function' ? getVehicleServices() : [];

    let targetVehicles = vehicles;
    const isSingleVehicle = reportState.vehicleId && reportState.vehicleId !== 'all';
    if (isSingleVehicle) {
        targetVehicles = vehicles.filter(v => isItemForVehicle(reportState.vehicleId, v) || isVehicleMatch(v.id, reportState.vehicleId));
        if (targetVehicles.length === 0) targetVehicles = vehicles;
    }

    let totalBillsCount = 0;
    let totalStdCount = 0;
    let totalLocalCount = 0;
    let totalRevenue = 0;
    let totalLocalRevenue = 0;
    let totalLitres = 0;
    let totalFuel = 0;
    let totalDriverSalary = 0;
    let totalServiceExpense = 0;

    let tableRows = targetVehicles.map(v => {
        const vBills = bills.filter(b => isItemForVehicle(b.vehicleId, v));
        const vFuel = fuel.filter(f => isItemForVehicle(f.vehicleId, v));
        const vSalaries = (salaries || []).filter(s => isItemForVehicle(s.vehicleId, v));
        const vServices = (services || []).filter(s => isItemForVehicle(s.vehicleId, v));

        const vStd = vBills.filter(b => !b.isLocalIncome && b.tripType !== 'local');
        const vLocal = vBills.filter(b => b.isLocalIncome === true || b.tripType === 'local');

        const revenue = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const localRev = vLocal.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fuelCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
        const litres = vFuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
        const serviceCost = vServices.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);

        const legacySalary = vBills.reduce((s, b) => {
            if (b.addToDriverSalary) {
                const amt = parseFloat(b.driverSalaryAmount);
                return s + (!isNaN(amt) && amt > 0 ? amt : (parseFloat(b.grandTotal) || 0));
            }
            return s;
        }, 0);
        const directSalary = vSalaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
        const driverSalary = legacySalary + directSalary;

        const totalExpenses = fuelCost + driverSalary + serviceCost;
        const profit = revenue - totalExpenses;
        const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) + '%' : '0.0%';

        totalBillsCount += vBills.length;
        totalStdCount += vStd.length;
        totalLocalCount += vLocal.length;
        totalRevenue += revenue;
        totalLocalRevenue += localRev;
        totalLitres += litres;
        totalFuel += fuelCost;
        totalDriverSalary += driverSalary;
        totalServiceExpense += serviceCost;

        return `
            <tr>
                <td><strong>${v.name}</strong> <span style="font-size:11px;color:var(--text-muted);font-family:monospace;">(${v.number})</span></td>
                <td style="text-align:center;">
                    ${vBills.length}
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">
                        <span>${vStd.length} std</span> ${vLocal.length > 0 ? `• <span style="color:var(--orange);font-weight:700;">${vLocal.length} local</span>` : ''}
                    </div>
                </td>
                <td>
                    <div style="color:var(--green);font-weight:700;">${formatCurrency(revenue)}</div>
                    ${localRev > 0 ? `<div style="font-size:10px;color:var(--orange);">Local: ${formatCurrency(localRev)}</div>` : ''}
                </td>
                <td style="color:var(--red);font-weight:600;">
                    ${formatCurrency(fuelCost)}
                    <div style="font-size:10px;color:var(--text-muted);">${litres.toFixed(1)} L</div>
                </td>
                <td style="color:#0ea5e9;font-weight:600;">
                    ${driverSalary > 0 ? formatCurrency(driverSalary) : '—'}
                </td>
                <td style="color:var(--orange);font-weight:600;">
                    ${serviceCost > 0 ? formatCurrency(serviceCost) : '—'}
                </td>
                <td style="color:var(--text-secondary);font-weight:600;">
                    ${formatCurrency(totalExpenses)}
                </td>
                <td class="${profit >= 0 ? 'profit' : 'loss'}">${formatCurrency(profit)}</td>
                <td style="font-weight:700;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};">${profit >= 0 ? '+' : ''}${margin}</td>
            </tr>`;
    }).join('');

    // General / unassigned fleet salaries (only in fleet total if not single vehicle)
    if (!isSingleVehicle) {
        const generalSalaries = (salaries || []).filter(s => !s.vehicleId || !vehicles.some(v => isItemForVehicle(s.vehicleId, v)));
        const generalSalaryTotal = generalSalaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
        totalDriverSalary += generalSalaryTotal;
    }

    const totalFleetExpenses = totalFuel + totalDriverSalary + totalServiceExpense;
    const totalProfit = totalRevenue - totalFleetExpenses;
    const totalMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '%' : '0.0%';

    const totalTitle = isSingleVehicle 
        ? `SUBTOTAL (${targetVehicles[0]?.name || ''} ${targetVehicles[0]?.number || ''})` 
        : 'TOTAL FLEET';

    container.innerHTML = `
    <table>
        <thead>
            <tr>
                <th>Vehicle</th>
                <th style="text-align:center;">Trips (Std / Local)</th>
                <th>Gross Revenue</th>
                <th>Fuel Cost</th>
                <th>Driver Salary</th>
                <th style="color:var(--orange);">Service Expense</th>
                <th>Total Expenses</th>
                <th>Net Profit / Loss</th>
                <th>Margin %</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
            <tr style="font-weight:800;border-top:2px solid var(--border);background:var(--bg-surface);">
                <td>${totalTitle}</td>
                <td style="text-align:center;">
                    ${totalBillsCount}
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">
                        ${totalStdCount} std • <span style="color:var(--orange);">${totalLocalCount} local</span>
                    </div>
                </td>
                <td>
                    <div style="color:var(--green);">${formatCurrency(totalRevenue)}</div>
                    ${totalLocalRevenue > 0 ? `<div style="font-size:10px;color:var(--orange);">Local: ${formatCurrency(totalLocalRevenue)}</div>` : ''}
                </td>
                <td style="color:var(--red);">
                    ${formatCurrency(totalFuel)}
                    <div style="font-size:10px;color:var(--text-muted);">${totalLitres.toFixed(1)} L</div>
                </td>
                <td style="color:#0ea5e9;">${formatCurrency(totalDriverSalary)}</td>
                <td style="color:var(--orange);font-weight:700;">${formatCurrency(totalServiceExpense)}</td>
                <td style="color:var(--text-secondary);">${formatCurrency(totalFleetExpenses)}</td>
                <td class="${totalProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(totalProfit)}</td>
                <td style="color:${totalProfit >= 0 ? 'var(--green)' : 'var(--red)'};">${totalProfit >= 0 ? '+' : ''}${totalMargin}</td>
            </tr>
        </tbody>
    </table>`;
}

// ===== PERIOD TRANSACTION DRILLDOWN LIST =====
function renderPeriodTxnList(bills, fuel, salaries, services) {
    if (!bills) {
        const dateRange = getReportDateRange(reportState.period);
        let b = getBills();
        let f = getFuelLogs();
        let s = getDriverSalaries();
        let srv = typeof getVehicleServices === 'function' ? getVehicleServices() : [];
        if (reportState.period !== 'all_time') {
            b = b.filter(item => { const d = (item.date || '').split('T')[0]; return d >= dateRange.startISO && d <= dateRange.endISO; });
            f = f.filter(item => { const d = (item.date || '').split('T')[0]; return d >= dateRange.startISO && d <= dateRange.endISO; });
            s = s.filter(item => { const d = (item.date || '').split('T')[0]; return d >= dateRange.startISO && d <= dateRange.endISO; });
            srv = srv.filter(item => { const d = (item.date || '').split('T')[0]; return d >= dateRange.startISO && d <= dateRange.endISO; });
        }
        if (reportState.vehicleId !== 'all') {
            b = b.filter(item => isVehicleMatch(item.vehicleId, reportState.vehicleId));
            f = f.filter(item => isVehicleMatch(item.vehicleId, reportState.vehicleId));
            s = s.filter(item => !item.vehicleId || isVehicleMatch(item.vehicleId, reportState.vehicleId));
            srv = srv.filter(item => !item.vehicleId || isVehicleMatch(item.vehicleId, reportState.vehicleId));
        }
        bills = b; fuel = f; salaries = s; services = srv;
    }
    if (!fuel) fuel = getFuelLogs();
    if (!salaries) salaries = getDriverSalaries();
    if (!services) services = typeof getVehicleServices === 'function' ? getVehicleServices() : [];

    switchReportTxnTab(reportState.txnTab || 'bills');

    const billsSec = document.getElementById('reportBillsSection');
    const fuelSec = document.getElementById('reportFuelSection');
    const salarySec = document.getElementById('reportSalarySection');
    const serviceSec = document.getElementById('reportServiceSection');
    const bCount = document.getElementById('periodBillsCount');
    const fCount = document.getElementById('periodFuelCount');
    const sCount = document.getElementById('periodSalaryCount');
    const srvCount = document.getElementById('periodServiceCount');

    // Build unified salary list: direct driver salary payouts + any legacy bill-linked salaries
    const legacySalaryBills = bills.filter(b => b.addToDriverSalary === true);
    const combinedSalaries = [
        ...salaries.map(s => ({
            id: s.id,
            isDirect: true,
            date: s.date,
            driverName: s.driverName || 'Kumar',
            amount: parseFloat(s.amount) || 0,
            status: s.status || 'paid',
            vehicleId: s.vehicleId,
            notes: s.notes || ''
        })),
        ...legacySalaryBills.map(b => ({
            id: b.id,
            isDirect: false,
            billNumber: b.billNumber,
            date: b.date,
            driverName: b.driverName || 'Assigned Driver',
            amount: parseFloat(b.driverSalaryAmount) || parseFloat(b.grandTotal) || 0,
            status: b.driverSalaryStatus || 'paid',
            vehicleId: b.vehicleId,
            notes: b.notes || ''
        }))
    ];

    if (bCount) bCount.textContent = bills.length;
    if (fCount) fCount.textContent = fuel.length;
    if (sCount) sCount.textContent = combinedSalaries.length;
    if (srvCount) srvCount.textContent = services.length;

    if (billsSec) {
        if (bills.length === 0) {
            billsSec.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted);"><p>No billing records found for this period</p></div>';
        } else {
            const sortedBills = [...bills].sort((a, b) => new Date(b.date) - new Date(a.date));
            billsSec.innerHTML = sortedBills.map(b => {
                const v = getVehicleById(b.vehicleId);
                const isLocal = Boolean(b.isLocalIncome || b.tripType === 'local');
                const hasSalary = Boolean(b.addToDriverSalary);
                const salaryAmt = parseFloat(b.driverSalaryAmount) || parseFloat(b.grandTotal) || 0;
                const salStatus = b.driverSalaryStatus || 'paid';

                return `
                    <div class="report-txn-item" onclick="viewBill('${b.id}')" style="cursor:pointer;" title="Click to view invoice">
                        <div class="report-txn-left">
                            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                                <span class="report-txn-main">${b.billNumber} • ${isLocal ? '⚡ Local Income Run' : (b.customerName || 'Standard Consignment')}</span>
                                ${isLocal ? `<span class="badge-tag-local">⚡ Local</span>` : ''}
                                ${hasSalary ? `<span class="badge-tag-salary">👤 Driver: ${b.driverName || 'Assigned'} (${formatCurrency(salaryAmt)}) <span class="${salStatus === 'unpaid' ? 'badge-salary-unpaid' : 'badge-salary-paid'}" style="margin-left:2px;font-size:9px;padding:1px 5px;">${salStatus.toUpperCase()}</span></span>` : ''}
                            </div>
                            <span class="report-txn-sub">${formatDate(b.date)} | ${v ? v.name + ' (' + v.number + ')' : '-'} | ${isLocal ? '⚡ Local Run' : `${b.fromLocation || ''} → ${b.toLocation || ''}`}</span>
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

    if (salarySec) {
        if (combinedSalaries.length === 0) {
            salarySec.innerHTML = `
                <div class="empty-state" style="padding:24px 20px;text-align:center;color:var(--text-muted);">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom:8px;opacity:0.6;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <p style="margin:0 0 12px 0;">No driver salary payout records found for this period</p>
                    <button type="button" class="btn-primary-app btn-sm" onclick="openDriverSalaryModal()" style="background:linear-gradient(135deg, #10B981, #059669);border-color:rgba(16,185,129,0.4);">
                        + Add Driver Salary
                    </button>
                </div>`;
        } else {
            const totalSalaryAmt = combinedSalaries.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            const paidSalaries = combinedSalaries.filter(item => item.status !== 'unpaid');
            const unpaidSalaries = combinedSalaries.filter(item => item.status === 'unpaid');
            const paidSalaryAmt = paidSalaries.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            const unpaidSalaryAmt = unpaidSalaries.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

            let filteredSalary = combinedSalaries;
            if (reportSalarySubFilter === 'paid') {
                filteredSalary = paidSalaries;
            } else if (reportSalarySubFilter === 'unpaid') {
                filteredSalary = unpaidSalaries;
            }

            if (reportSalaryDriverFilter !== 'all') {
                filteredSalary = filteredSalary.filter(item => (item.driverName || '').trim().toLowerCase() === reportSalaryDriverFilter.toLowerCase());
            }

            const sortedSalary = [...filteredSalary].sort((a, b) => new Date(b.date) - new Date(a.date));
            const periodDrivers = Array.from(new Set(combinedSalaries.map(item => (item.driverName || 'Driver').trim()))).sort();

            let html = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                    <div style="font-size:12px;color:var(--text-muted);font-weight:600;">
                        <span>Driver Salary Ledger (Operating Expenses)</span>
                    </div>
                    <button type="button" class="btn-primary-app btn-sm" onclick="openDriverSalaryModal()" style="background:linear-gradient(135deg, #10B981, #059669);font-size:11px;padding:5px 12px;border-color:rgba(16,185,129,0.4);">
                        + Add Driver Salary
                    </button>
                </div>

                <div class="salary-report-summary-bar">
                    <div class="salary-summary-box">
                        <span class="salary-summary-label">Total Salary</span>
                        <span class="salary-summary-amount">${formatCurrency(totalSalaryAmt)}</span>
                        <span style="font-size:11px;color:var(--text-muted);">${combinedSalaries.length} records</span>
                    </div>
                    <div class="salary-summary-box">
                        <span class="salary-summary-label">✓ Paid to Driver</span>
                        <span class="salary-summary-amount paid">${formatCurrency(paidSalaryAmt)}</span>
                        <span style="font-size:11px;color:#10b981;">${paidSalaries.length} disbursed</span>
                    </div>
                    <div class="salary-summary-box">
                        <span class="salary-summary-label">⏳ Unpaid (Pending)</span>
                        <span class="salary-summary-amount unpaid">${formatCurrency(unpaidSalaryAmt)}</span>
                        <span style="font-size:11px;color:#f59e0b;">${unpaidSalaries.length} pending payout</span>
                    </div>
                </div>

                <div class="salary-filter-tabs">
                    <span style="font-size:11px;font-weight:700;color:var(--text-muted);margin-right:4px;">Filter List:</span>
                    <button type="button" class="salary-filter-pill ${reportSalarySubFilter === 'all' ? 'active' : ''}" onclick="setReportSalarySubFilter('all')">
                        All (${combinedSalaries.length})
                    </button>
                    <button type="button" class="salary-filter-pill paid-pill ${reportSalarySubFilter === 'paid' ? 'active' : ''}" onclick="setReportSalarySubFilter('paid')">
                        ✓ Paid (${paidSalaries.length}) • ${formatCurrency(paidSalaryAmt)}
                    </button>
                    <button type="button" class="salary-filter-pill unpaid-pill ${reportSalarySubFilter === 'unpaid' ? 'active' : ''}" onclick="setReportSalarySubFilter('unpaid')">
                        ⏳ Unpaid (${unpaidSalaries.length}) • ${formatCurrency(unpaidSalaryAmt)}
                    </button>
                </div>

                ${periodDrivers.length > 1 ? `
                    <div class="salary-filter-tabs" style="margin-top:-4px;margin-bottom:14px;">
                        <span style="font-size:11px;font-weight:700;color:var(--text-muted);margin-right:4px;">By Driver:</span>
                        <button type="button" class="salary-filter-pill ${reportSalaryDriverFilter === 'all' ? 'active' : ''}" onclick="setReportSalaryDriverFilter('all')">
                            All Drivers
                        </button>
                        ${periodDrivers.map(d => `
                            <button type="button" class="salary-filter-pill ${reportSalaryDriverFilter.toLowerCase() === d.toLowerCase() ? 'active' : ''}" onclick="setReportSalaryDriverFilter('${d.replace(/'/g, "\\'")}')">
                                👤 ${d}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            `;

            if (sortedSalary.length === 0) {
                html += `<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted);"><p>No ${reportSalarySubFilter} driver salary records matching this filter</p></div>`;
            } else {
                html += sortedSalary.map(item => {
                    const v = getVehicleById(item.vehicleId);
                    const isPaid = (item.status || 'paid') !== 'unpaid';
                    const isDirect = item.isDirect;
                    const clickAction = isDirect ? `openDriverSalaryModal('${item.id}')` : `viewBill('${item.id}')`;
                    const togglePayAction = isDirect 
                        ? `toggleStandaloneSalaryPaidStatus('${item.id}', 'paid', event)` 
                        : `toggleSalaryPaidStatus('${item.id}', 'paid', event)`;
                    const toggleUnpayAction = isDirect 
                        ? `toggleStandaloneSalaryPaidStatus('${item.id}', 'unpaid', event)` 
                        : `toggleSalaryPaidStatus('${item.id}', 'unpaid', event)`;

                    return `
                        <div class="report-txn-item" onclick="${clickAction}" style="cursor:pointer;" title="Click to view/edit salary details">
                            <div class="report-txn-left">
                                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                                    <span class="report-txn-main">👤 ${item.driverName}</span>
                                    <span class="badge-tag-salary">${isDirect ? 'Driver Payout' : `Bill ${item.billNumber}`}</span>
                                    ${v ? `<span class="badge-tag-local">${v.name}</span>` : ''}
                                    <span class="${isPaid ? 'badge-salary-paid' : 'badge-salary-unpaid'}">
                                        ${isPaid ? '✓ PAID' : '⏳ UNPAID'}
                                    </span>
                                </div>
                                <span class="report-txn-sub">
                                    ${formatDate(item.date)} | ${v ? v.name + ' (' + v.number + ')' : 'General Fleet'} | 
                                    ${item.notes || 'Driver salary allocation'}
                                </span>
                            </div>
                            <div class="report-txn-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
                                <span class="report-txn-amount salary" style="color:#0ea5e9;">${formatCurrency(item.amount)}</span>
                                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                                    <button type="button" class="btn-toggle-salary-status" style="background:rgba(99,102,241,0.12);color:#6366f1;border-color:rgba(99,102,241,0.3);" onclick="event.stopPropagation(); ${isDirect ? `openDriverSalaryModal('${item.id}')` : `viewBill('${item.id}')`}" title="Edit this salary entry">
                                        ✏️ Edit
                                    </button>
                                    ${!isPaid ? `
                                        <button type="button" class="btn-toggle-salary-status pay" onclick="${togglePayAction}" title="Click to mark this salary as paid">
                                            ✓ Mark Paid
                                        </button>
                                    ` : `
                                        <button type="button" class="btn-toggle-salary-status unpay" onclick="${toggleUnpayAction}" title="Click to revert to unpaid">
                                            ↺ Mark Unpaid
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            salarySec.innerHTML = html;
        }
    }

    if (serviceSec) {
        if (services.length === 0) {
            serviceSec.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                    <div style="font-size:12px;color:var(--text-muted);font-weight:600;">
                        <span>Vehicle Service & Maintenance Expenses</span>
                    </div>
                    <button type="button" class="btn-primary-app btn-sm" onclick="openVehicleServiceModal()" style="font-size:11px;padding:5px 12px;">
                        + Add Service Expense
                    </button>
                </div>
                <div class="empty-state" style="padding:24px 20px;text-align:center;color:var(--text-muted);">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom:8px;opacity:0.6;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <p style="margin:0;">No vehicle service or maintenance records found for this period</p>
                </div>`;
        } else {
            const sortedServices = [...services].sort((a, b) => new Date(b.date) - new Date(a.date));
            const totalServiceAmount = sortedServices.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

            let html = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                    <div style="font-size:12px;color:var(--text-muted);font-weight:600;">
                        <span>Vehicle Service & Maintenance Ledger (${sortedServices.length} records • Total: <strong style="color:var(--orange);">${formatCurrency(totalServiceAmount)}</strong>)</span>
                    </div>
                    <button type="button" class="btn-primary-app btn-sm" onclick="openVehicleServiceModal()" style="font-size:11px;padding:5px 12px;">
                        + Add Service Expense
                    </button>
                </div>
            `;

            html += sortedServices.map(s => {
                const v = getVehicleById(s.vehicleId);
                return `
                    <div class="service-card-item">
                        <div class="service-card-left">
                            <div class="service-card-icon">🛠️</div>
                            <div class="service-card-details">
                                <div class="service-card-title">
                                    <span>${s.serviceType || 'General Service'}</span>
                                    <span class="service-tag">${v ? v.number : 'Fleet'}</span>
                                    ${v ? `<span style="font-size:11px;color:var(--text-muted);font-weight:600;">${v.name}</span>` : ''}
                                </div>
                                <div class="service-card-meta">
                                    <span>📅 ${formatDate(s.date)}</span>
                                    ${s.garage ? `<span>🏬 ${s.garage}</span>` : ''}
                                    ${s.odometer ? `<span>📍 ${Number(s.odometer).toLocaleString('en-IN')} km</span>` : ''}
                                    ${s.notes ? `<span>📝 ${s.notes}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="service-card-right">
                            <div class="service-card-price">${formatCurrency(s.amount)}</div>
                            <div class="service-card-date">${formatDate(s.date)}</div>
                            <div class="service-card-actions" style="margin-top:6px;justify-content:flex-end;">
                                <button type="button" class="btn-secondary-app sm" onclick="openVehicleServiceModal('${s.id}')" style="padding:2px 8px;font-size:11px;" title="Edit Service Record">
                                    ✏️ Edit
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            serviceSec.innerHTML = html;
        }
    }
}

// Salary filter state & toggle functions
let reportSalarySubFilter = 'all';
let reportSalaryDriverFilter = 'all';

function setReportSalarySubFilter(filter) {
    reportSalarySubFilter = filter;
    renderPeriodTxnList();
}
window.setReportSalarySubFilter = setReportSalarySubFilter;

function setReportSalaryDriverFilter(driver) {
    reportSalaryDriverFilter = driver;
    renderPeriodTxnList();
}
window.setReportSalaryDriverFilter = setReportSalaryDriverFilter;

function toggleSalaryPaidStatus(billId, newStatus, event) {
    if (event) event.stopPropagation();
    const bills = getBills();
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    bill.driverSalaryStatus = newStatus;
    saveBills(bills);

    // Sync to Supabase if connected
    if (isSupabaseConnected && supabaseClient) {
        uploadBillToSupabase(bill);
    }

    renderPeriodTxnList();
    renderBills();
    showToast(`Salary for ${bill.driverName || 'driver'} marked as ${newStatus.toUpperCase()}! ✅`, 'success');
}
window.toggleSalaryPaidStatus = toggleSalaryPaidStatus;

// ===== EXPORT PERIOD CSV =====
function exportPeriodReportCsv() {
    const dateRange = getReportDateRange(reportState.period);
    const allBills = getBills();
    const allFuel = getFuelLogs();
    const allServices = typeof getVehicleServices === 'function' ? getVehicleServices() : [];
    const allSalaries = getDriverSalaries();
    const vehicles = getVehicles();

    let bills = allBills;
    let fuel = allFuel;
    let services = allServices;
    let salaries = allSalaries;

    if (reportState.period !== 'all_time') {
        bills = allBills.filter(b => {
            const d = (b.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        fuel = allFuel.filter(f => {
            const d = (f.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        services = allServices.filter(s => {
            const d = (s.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        salaries = allSalaries.filter(s => {
            const d = (s.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
    }

    if (reportState.vehicleId !== 'all') {
        bills = bills.filter(b => isVehicleMatch(b.vehicleId, reportState.vehicleId));
        fuel = fuel.filter(f => isVehicleMatch(f.vehicleId, reportState.vehicleId));
        services = services.filter(s => isVehicleMatch(s.vehicleId, reportState.vehicleId));
        salaries = salaries.filter(s => !s.vehicleId || isVehicleMatch(s.vehicleId, reportState.vehicleId));
    }

    const stdBills = bills.filter(b => !b.isLocalIncome && b.tripType !== 'local');
    const localBills = bills.filter(b => b.isLocalIncome === true || b.tripType === 'local');
    const totalRev = bills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const localRev = localBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const totalFuel = fuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
    const totalService = services.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

    const salaryBills = bills.filter(b => b.addToDriverSalary === true);
    const legacySalaryTotal = salaryBills.reduce((s, b) => {
        const amt = parseFloat(b.driverSalaryAmount);
        return s + (!isNaN(amt) && amt > 0 ? amt : (parseFloat(b.grandTotal) || 0));
    }, 0);
    const directSalaryTotal = salaries.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
    const totalDriverSalary = legacySalaryTotal + directSalaryTotal;

    const totalExpenses = totalFuel + totalDriverSalary + totalService;
    const netProfit = totalRev - totalExpenses;

    let csv = `Sri Moorthy Transport - Fleet Financial Statement\n`;
    csv += `Period,${dateRange.label}\n`;
    csv += `Scope,${reportState.vehicleId === 'all' ? 'All Fleet Vehicles' : reportState.vehicleId}\n`;
    csv += `Generated On,${new Date().toLocaleString('en-IN')}\n\n`;

    csv += `EXECUTIVE SUMMARY\n`;
    csv += `Gross Revenue,Local Trip Income,Fuel Expense,Service Expense,Driver Salary Expense,Total Operating Expense,Net Profit,Profit Margin,Total Invoices,Local Invoices,Total Fuel Logs,Total Service Records,Total Driver Salaries\n`;
    csv += `${totalRev},${localRev},${totalFuel},${totalService},${totalDriverSalary},${totalExpenses},${netProfit},${totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) + '%' : '0%'},${bills.length},${localBills.length},${fuel.length},${services.length},${salaries.length + salaryBills.length}\n\n`;

    csv += `VEHICLE PERFORMANCE SUMMARY\n`;
    csv += `Vehicle Name,Vehicle Number,Total Trips,Local Trips,Gross Revenue,Local Revenue,Fuel Litres,Fuel Expense,Service Expense,Driver Salary,Total Expenses,Net Profit,Margin %\n`;
    
    let targetVehicles = vehicles;
    if (reportState.vehicleId !== 'all') {
        targetVehicles = vehicles.filter(v => isItemForVehicle(reportState.vehicleId, v) || isVehicleMatch(v.id, reportState.vehicleId));
        if (targetVehicles.length === 0) targetVehicles = vehicles;
    }

    targetVehicles.forEach(v => {
        const vBills = bills.filter(b => isItemForVehicle(b.vehicleId, v));
        const vFuel = fuel.filter(f => isItemForVehicle(f.vehicleId, v));
        const vServices = services.filter(s => isItemForVehicle(s.vehicleId, v));
        const vSalaries = salaries.filter(s => isItemForVehicle(s.vehicleId, v));
        const vLocal = vBills.filter(b => b.isLocalIncome === true || b.tripType === 'local');
        const rev = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const locRev = vLocal.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
        const fCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
        const ltrs = vFuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
        const servCost = vServices.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const legSal = vBills.reduce((s, b) => {
            if (b.addToDriverSalary) {
                const amt = parseFloat(b.driverSalaryAmount);
                return s + (!isNaN(amt) && amt > 0 ? amt : (parseFloat(b.grandTotal) || 0));
            }
            return s;
        }, 0);
        const dirSal = vSalaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
        const dSal = legSal + dirSal;
        const exp = fCost + servCost + dSal;
        const prof = rev - exp;
        const marg = rev > 0 ? ((prof / rev) * 100).toFixed(1) + '%' : '0%';
        csv += `"${v.name}","${v.number}",${vBills.length},${vLocal.length},${rev},${locRev},${ltrs},${fCost},${servCost},${dSal},${exp},${prof},${marg}\n`;
    });

    csv += `\nDETAILED INVOICES & BILLS\n`;
    csv += `Bill No,Date,Vehicle,Customer,Route,Trip Classification,Driver Salary Allocated,Driver Name,Driver Salary Amount,Driver Salary Status,Subtotal,GST,Grand Total,Paid,Balance,Status\n`;
    bills.forEach(b => {
        const v = getVehicleById(b.vehicleId);
        const isLoc = Boolean(b.isLocalIncome || b.tripType === 'local');
        const tripCls = isLoc ? 'Local Income Trip' : 'Standard Outstation Trip';
        const hasSal = Boolean(b.addToDriverSalary);
        const salAmt = parseFloat(b.driverSalaryAmount) || parseFloat(b.grandTotal) || 0;
        const salStatus = b.driverSalaryStatus || 'paid';
        const custDisplay = isLoc ? 'Local Run (Direct)' : (b.customerName || '');
        csv += `"${b.billNumber}","${b.date}","${v ? v.number : '-'}","${custDisplay}","${b.fromLocation || ''} -> ${b.toLocation || ''}","${tripCls}","${hasSal ? 'Yes' : 'No'}","${b.driverName || ''}",${hasSal ? salAmt : 0},"${hasSal ? salStatus : '-'}","${b.subtotal || 0}",${b.gst || 0},${b.grandTotal || 0},${b.amountPaid || 0},${b.balance || 0},"${b.paymentStatus || ''}"\n`;
    });

    csv += `\nDETAILED FUEL EXPENSES\n`;
    csv += `Date,Vehicle,Station,Litres,Rate,Total Cost,Odometer,Driver\n`;
    fuel.forEach(f => {
        const v = getVehicleById(f.vehicleId);
        csv += `"${f.date}","${v ? v.number : '-'}","${f.station || ''}",${f.litres || 0},${f.rate || 0},${f.totalAmount || 0},"${f.odometer || ''}","${f.driver || ''}"\n`;
    });

    csv += `\nDETAILED VEHICLE SERVICE & MAINTENANCE EXPENSES\n`;
    csv += `Date,Vehicle,Service Type,Garage / Vendor,Price (Amount),Odometer,Notes\n`;
    services.forEach(s => {
        const v = getVehicleById(s.vehicleId);
        csv += `"${s.date}","${v ? v.number : '-'}","${s.serviceType || 'General Service'}","${s.garage || ''}",${s.amount || 0},"${s.odometer || ''}","${(s.notes || '').replace(/"/g, '""')}"\n`;
    });

    csv += `\nDETAILED DRIVER SALARY PAYOUTS\n`;
    csv += `Date,Type,Driver Name,Vehicle,Amount,Status,Notes\n`;
    salaries.forEach(s => {
        const v = getVehicleById(s.vehicleId);
        csv += `"${s.date}","Direct Payout","${s.driverName || 'Driver'}","${v ? v.number : 'General Fleet'}",${s.amount || 0},"${(s.status || 'paid').toUpperCase()}","${(s.notes || '').replace(/"/g, '""')}"\n`;
    });
    salaryBills.forEach(b => {
        const v = getVehicleById(b.vehicleId);
        const salAmt = parseFloat(b.driverSalaryAmount) || parseFloat(b.grandTotal) || 0;
        csv += `"${b.date}","Bill-Linked (${b.billNumber})","${b.driverName || 'Driver'}","${v ? v.number : 'General Fleet'}",${salAmt},"${(b.driverSalaryStatus || 'paid').toUpperCase()}","${(b.notes || '').replace(/"/g, '""')}"\n`;
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
    const allServices = typeof getVehicleServices === 'function' ? getVehicleServices() : [];
    const allSalaries = getDriverSalaries();
    const vehicles = getVehicles();

    let bills = allBills;
    let fuel = allFuel;
    let services = allServices;
    let salaries = allSalaries;

    if (reportState.period !== 'all_time') {
        bills = allBills.filter(b => {
            const d = (b.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        fuel = allFuel.filter(f => {
            const d = (f.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        services = allServices.filter(s => {
            const d = (s.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
        salaries = allSalaries.filter(s => {
            const d = (s.date || '').split('T')[0];
            return d >= dateRange.startISO && d <= dateRange.endISO;
        });
    }

    if (reportState.vehicleId !== 'all') {
        bills = bills.filter(b => isVehicleMatch(b.vehicleId, reportState.vehicleId));
        fuel = fuel.filter(f => isVehicleMatch(f.vehicleId, reportState.vehicleId));
        services = services.filter(s => isVehicleMatch(s.vehicleId, reportState.vehicleId));
        salaries = salaries.filter(s => !s.vehicleId || isVehicleMatch(s.vehicleId, reportState.vehicleId));
    }

    const stdBills = bills.filter(b => !b.isLocalIncome && b.tripType !== 'local');
    const localBills = bills.filter(b => b.isLocalIncome === true || b.tripType === 'local');
    const totalRev = bills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const localRev = localBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
    const totalFuel = fuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
    const totalLitres = fuel.reduce((s, f) => s + (parseFloat(f.litres) || 0), 0);
    const totalService = services.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

    const salaryBills = bills.filter(b => b.addToDriverSalary === true);
    const legacySalaryTotal = salaryBills.reduce((s, b) => {
        const amt = parseFloat(b.driverSalaryAmount);
        return s + (!isNaN(amt) && amt > 0 ? amt : (parseFloat(b.grandTotal) || 0));
    }, 0);
    const directSalaryTotal = salaries.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
    const totalDriverSalary = legacySalaryTotal + directSalaryTotal;

    const totalExpenses = totalFuel + totalDriverSalary + totalService;
    const netProfit = totalRev - totalExpenses;
    const margin = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) + '%' : '0%';

    let targetVehicles = vehicles;
    const isSingleVehicle = reportState.vehicleId && reportState.vehicleId !== 'all';
    if (isSingleVehicle) {
        targetVehicles = vehicles.filter(v => isItemForVehicle(reportState.vehicleId, v) || isVehicleMatch(v.id, reportState.vehicleId));
        if (targetVehicles.length === 0) targetVehicles = vehicles;
    }

    const pWin = window.open('', '_blank');
    pWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Sri Moorthy Transport - Statement (${dateRange.label})</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Inter', sans-serif; padding:30px; color:#1e293b; max-width:960px; margin:0 auto; font-size:13px; line-height:1.5; }
            .header { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #EF5226; padding-bottom:16px; margin-bottom:20px; }
            .brand h1 { font-family:'Outfit', sans-serif; font-size:24px; color:#0f172a; }
            .brand h1 span { color:#EF5226; }
            .brand p { font-size:11px; color:#64748b; }
            .meta { text-align:right; font-size:12px; color:#475569; }
            .meta strong { color:#0f172a; }
            .period-badge { display:inline-block; background:#fff1ee; color:#EF5226; font-weight:700; padding:4px 10px; border-radius:6px; margin-top:4px; font-size:12px; }
            .kpi-grid { display:grid; grid-template-columns:repeat(6, 1fr); gap:8px; margin:20px 0; }
            .kpi-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 10px; }
            .kpi-title { font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; }
            .kpi-val { font-family:'Outfit', sans-serif; font-size:16px; font-weight:800; color:#0f172a; margin-top:4px; }
            .kpi-val.green { color:#16a34a; }
            .kpi-val.red { color:#dc2626; }
            .kpi-val.orange { color:#d97706; }
            .kpi-val.teal { color:#0ea5e9; }
            .kpi-sub { font-size:10px; color:#64748b; margin-top:2px; }
            h3 { font-family:'Outfit', sans-serif; font-size:15px; margin:22px 0 10px 0; color:#0f172a; border-left:4px solid #EF5226; padding-left:8px; }
            table { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:12px; }
            th { background:#f1f5f9; padding:8px 8px; text-align:left; font-size:11px; text-transform:uppercase; color:#475569; border:1px solid #cbd5e1; white-space:nowrap; }
            td { padding:7px 8px; border:1px solid #e2e8f0; }
            tr:nth-child(even) { background:#f8fafc; }
            .total-row { font-weight:800; background:#e2e8f0 !important; }
            .footer-sign { display:flex; justify-content:space-between; margin-top:40px; padding-top:20px; border-top:1px dashed #cbd5e1; }
            .sign-box { text-align:center; min-width:180px; }
            .sign-line { border-top:1px solid #475569; margin-top:40px; padding-top:6px; font-weight:600; font-size:11px; }
            .badge-local { background:rgba(245, 158, 11, 0.15); color:#d97706; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; }
            .badge-salary { background:rgba(14, 165, 233, 0.15); color:#0284c7; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; }
            .badge-service { background:rgba(239, 82, 38, 0.12); color:#c2410c; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; }
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
                <p><strong>MANAGEMENT P&L STATEMENT</strong></p>
                <p>Generated: ${new Date().toLocaleDateString('en-IN')}</p>
                <p>Scope: ${reportState.vehicleId === 'all' ? 'Entire Fleet' : reportState.vehicleId}</p>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-title">Gross Revenue</div>
                <div class="kpi-val green">${formatCurrency(totalRev)}</div>
                <div class="kpi-sub">Local: ${formatCurrency(localRev)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Fuel Cost</div>
                <div class="kpi-val red">${formatCurrency(totalFuel)}</div>
                <div class="kpi-sub">${totalLitres.toFixed(1)} L used</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Service & Repairs</div>
                <div class="kpi-val orange">${formatCurrency(totalService)}</div>
                <div class="kpi-sub">${services.length} services</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Driver Salary</div>
                <div class="kpi-val teal">${formatCurrency(totalDriverSalary)}</div>
                <div class="kpi-sub">${salaries.length + salaryBills.length} disbursements</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Net Profit/Loss</div>
                <div class="kpi-val ${netProfit >= 0 ? 'green' : 'red'}">${formatCurrency(netProfit)}</div>
                <div class="kpi-sub">${netProfit >= 0 ? 'Profit' : 'Loss'}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Margin %</div>
                <div class="kpi-val">${margin}</div>
                <div class="kpi-sub">Rev - Exp</div>
            </div>
        </div>

        <h3>Vehicle Profit & Loss Summary</h3>
        <table>
            <thead>
                <tr>
                    <th>Vehicle</th>
                    <th style="text-align:center;">Trips (Std/Local)</th>
                    <th>Gross Revenue</th>
                    <th>Fuel Cost</th>
                    <th>Driver Salary</th>
                    <th>Service Expense</th>
                    <th>Total Expenses</th>
                    <th>Net Profit / Loss</th>
                    <th>Margin</th>
                </tr>
            </thead>
            <tbody>
                ${targetVehicles.map(v => {
                    const vBills = bills.filter(b => isItemForVehicle(b.vehicleId, v));
                    const vFuel = fuel.filter(f => isItemForVehicle(f.vehicleId, v));
                    const vServices = services.filter(s => isItemForVehicle(s.vehicleId, v));
                    const vSalaries = salaries.filter(s => isItemForVehicle(s.vehicleId, v));
                    const vStd = vBills.filter(b => !b.isLocalIncome && b.tripType !== 'local');
                    const vLocal = vBills.filter(b => b.isLocalIncome === true || b.tripType === 'local');
                    const rev = vBills.reduce((s, b) => s + (parseFloat(b.grandTotal) || 0), 0);
                    const fCost = vFuel.reduce((s, f) => s + (parseFloat(f.totalAmount) || 0), 0);
                    const servCost = vServices.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                    const legSal = vBills.reduce((s, b) => {
                        if (b.addToDriverSalary) {
                            const amt = parseFloat(b.driverSalaryAmount);
                            return s + (!isNaN(amt) && amt > 0 ? amt : (parseFloat(b.grandTotal) || 0));
                        }
                        return s;
                    }, 0);
                    const dirSal = vSalaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                    const dSal = legSal + dirSal;
                    const exp = fCost + servCost + dSal;
                    const prof = rev - exp;
                    const marg = rev > 0 ? ((prof / rev) * 100).toFixed(1) + '%' : '0%';
                    return `<tr>
                        <td><strong>${v.name}</strong> (${v.number})</td>
                        <td style="text-align:center;">${vBills.length} <span style="color:#64748b;font-size:10px;">(${vStd.length}/${vLocal.length}L)</span></td>
                        <td style="color:#16a34a;font-weight:600;">${formatCurrency(rev)}</td>
                        <td style="color:#dc2626;">${formatCurrency(fCost)}</td>
                        <td style="color:#0284c7;">${dSal > 0 ? formatCurrency(dSal) : '—'}</td>
                        <td style="color:#d97706;font-weight:600;">${servCost > 0 ? formatCurrency(servCost) : '—'}</td>
                        <td style="color:#475569;font-weight:600;">${formatCurrency(exp)}</td>
                        <td style="font-weight:700;color:${prof >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(prof)}</td>
                        <td>${marg}</td>
                    </tr>`;
                }).join('')}
                <tr class="total-row">
                    <td>${isSingleVehicle ? `SUBTOTAL (${targetVehicles[0]?.name || ''} ${targetVehicles[0]?.number || ''})` : 'TOTAL FLEET'}</td>
                    <td style="text-align:center;">${bills.length} (${stdBills.length}/${localBills.length}L)</td>
                    <td style="color:#16a34a;">${formatCurrency(totalRev)}</td>
                    <td style="color:#dc2626;">${formatCurrency(totalFuel)}</td>
                    <td style="color:#0284c7;">${formatCurrency(totalDriverSalary)}</td>
                    <td style="color:#d97706;font-weight:700;">${formatCurrency(totalService)}</td>
                    <td style="color:#475569;">${formatCurrency(totalExpenses)}</td>
                    <td style="color:${netProfit >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(netProfit)}</td>
                    <td>${margin}</td>
                </tr>
            </tbody>
        </table>

        <h3>Invoices Issued in Period (${bills.length})</h3>
        <table>
            <thead>
                <tr>
                    <th>Bill No</th>
                    <th>Date</th>
                    <th>Vehicle</th>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Trip Type</th>
                    <th>Driver Salary</th>
                    <th style="text-align:right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${bills.length === 0 ? '<tr><td colspan="8" style="text-align:center;">No bills in this period</td></tr>' : bills.map(b => {
                    const v = getVehicleById(b.vehicleId);
                    const isLoc = Boolean(b.isLocalIncome || b.tripType === 'local');
                    const hasSal = Boolean(b.addToDriverSalary);
                    const salAmt = parseFloat(b.driverSalaryAmount) || parseFloat(b.grandTotal) || 0;
                    return `<tr>
                        <td><strong>${b.billNumber}</strong></td>
                        <td>${b.date}</td>
                        <td>${v ? v.number : '-'}</td>
                        <td>${isLoc ? '⚡ Local Income Run' : (b.customerName || '-')}</td>
                        <td>${b.fromLocation || ''} → ${b.toLocation || ''}</td>
                        <td>${isLoc ? '<span class="badge-local">⚡ Local</span>' : 'Standard'}</td>
                        <td>${hasSal ? `<span class="badge-salary">${formatCurrency(salAmt)} (${b.driverName || 'Driver'}) [${(b.driverSalaryStatus || 'paid').toUpperCase()}]</span>` : '—'}</td>
                        <td style="text-align:right;font-weight:700;">${formatCurrency(b.grandTotal)}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>

        <h3>Fuel Refills Recorded (${fuel.length})</h3>
        <table>
            <thead>
                <tr><th>Date</th><th>Vehicle</th><th>Station</th><th>Driver</th><th>Litres</th><th>Rate</th><th style="text-align:right;">Total Cost</th></tr>
            </thead>
            <tbody>
                ${fuel.length === 0 ? '<tr><td colspan="7" style="text-align:center;">No fuel entries in this period</td></tr>' : fuel.map(f => {
                    const v = getVehicleById(f.vehicleId);
                    return `<tr>
                        <td>${f.date}</td>
                        <td>${v ? v.number : '-'}</td>
                        <td>${f.station || 'Fuel Station'}</td>
                        <td>${f.driver || '—'}</td>
                        <td>${parseFloat(f.litres).toFixed(1)} L</td>
                        <td>${formatCurrency(f.rate)}</td>
                        <td style="text-align:right;font-weight:700;color:#dc2626;">${formatCurrency(f.totalAmount)}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>

        <h3>Vehicle Service & Maintenance Records (${services.length})</h3>
        <table>
            <thead>
                <tr><th>Date</th><th>Vehicle</th><th>Service Type</th><th>Garage / Vendor</th><th>Odometer</th><th>Notes</th><th style="text-align:right;">Price</th></tr>
            </thead>
            <tbody>
                ${services.length === 0 ? '<tr><td colspan="7" style="text-align:center;">No service records in this period</td></tr>' : services.map(s => {
                    const v = getVehicleById(s.vehicleId);
                    return `<tr>
                        <td>${s.date}</td>
                        <td>${v ? v.number : '-'}</td>
                        <td><span class="badge-service">${s.serviceType || 'General Service'}</span></td>
                        <td>${s.garage || '—'}</td>
                        <td>${s.odometer ? `${s.odometer} km` : '—'}</td>
                        <td>${s.notes || '—'}</td>
                        <td style="text-align:right;font-weight:700;color:#d97706;">${formatCurrency(s.amount)}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>

        <h3>Driver Salary Ledger (${salaries.length + salaryBills.length})</h3>
        <table>
            <thead>
                <tr><th>Date</th><th>Type</th><th>Driver</th><th>Vehicle</th><th>Status</th><th>Notes</th><th style="text-align:right;">Amount</th></tr>
            </thead>
            <tbody>
                ${(salaries.length + salaryBills.length) === 0 ? '<tr><td colspan="7" style="text-align:center;">No driver salary records in this period</td></tr>' : [
                    ...salaries.map(s => {
                        const v = getVehicleById(s.vehicleId);
                        return `<tr>
                            <td>${s.date}</td>
                            <td><span class="badge-salary">Direct Payout</span></td>
                            <td><strong>${s.driverName || 'Driver'}</strong></td>
                            <td>${v ? v.number : 'General Fleet'}</td>
                            <td>${(s.status || 'paid').toUpperCase()}</td>
                            <td>${s.notes || '—'}</td>
                            <td style="text-align:right;font-weight:700;color:#0284c7;">${formatCurrency(s.amount)}</td>
                        </tr>`;
                    }),
                    ...salaryBills.map(b => {
                        const v = getVehicleById(b.vehicleId);
                        const salAmt = parseFloat(b.driverSalaryAmount) || parseFloat(b.grandTotal) || 0;
                        return `<tr>
                            <td>${b.date}</td>
                            <td><span class="badge-salary">Bill ${b.billNumber}</span></td>
                            <td><strong>${b.driverName || 'Driver'}</strong></td>
                            <td>${v ? v.number : 'General Fleet'}</td>
                            <td>${(b.driverSalaryStatus || 'paid').toUpperCase()}</td>
                            <td>${b.notes || 'Trip Salary'}</td>
                            <td style="text-align:right;font-weight:700;color:#0284c7;">${formatCurrency(salAmt)}</td>
                        </tr>`;
                    })
                ].join('')}
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

// Window exports for reports & analytics
window.setReportPeriod = setReportPeriod;
window.setMonthGranularity = setMonthGranularity;
window.onReportVehicleChange = onReportVehicleChange;
window.applyCustomReportDates = applyCustomReportDates;
window.switchReportTxnTab = switchReportTxnTab;
window.renderReports = renderReports;
window.exportPeriodReportCsv = exportPeriodReportCsv;
window.printReportStatement = printReportStatement;
window.getVehicleById = getVehicleById;
window.isVehicleMatch = isVehicleMatch;
window.isItemForVehicle = isItemForVehicle;

// ===== EXPORT DATA =====
function exportAllData() {
    const data = {
        exportDate: new Date().toISOString(),
        company: 'Sri Moorthy Transport',
        vehicles: getVehicles(),
        bills: getBills(),
        fuelLogs: getFuelLogs(),
        vehicleServices: getVehicleServices(),
        driverSalaries: getDriverSalaries()
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
        is_local_income: Boolean(b.isLocalIncome || b.tripType === 'local'),
        add_to_driver_salary: Boolean(b.addToDriverSalary),
        driver_name: b.driverName || null,
        driver_salary_amount: parseFloat(b.driverSalaryAmount) || 0,
        driver_salary_status: b.driverSalaryStatus || 'paid',
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
        isLocalIncome: Boolean(row.is_local_income),
        addToDriverSalary: Boolean(row.add_to_driver_salary),
        driverName: row.driver_name || '',
        driverSalaryAmount: parseFloat(row.driver_salary_amount) || 0,
        driverSalaryStatus: row.driver_salary_status || 'paid',
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

function mapDriverSalaryToSupabase(salary) {
    const vUUID = salary.vehicleId ? getVehicleUUID(salary.vehicleId) : null;
    const row = {
        date: salary.date,
        driver_name: salary.driverName,
        amount: parseFloat(salary.amount) || 0,
        status: salary.status || 'paid',
        vehicle_id: vUUID,
        notes: salary.notes || null,
        updated_at: new Date().toISOString()
    };
    if (salary.id && isValidUUID(salary.id)) {
        row.id = salary.id;
    }
    return row;
}

function mapDriverSalaryFromSupabase(row) {
    return {
        id: row.id,
        date: row.date,
        driverName: row.driver_name,
        amount: parseFloat(row.amount) || 0,
        status: row.status || 'paid',
        vehicleId: row.vehicle_id || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function uploadDriverSalaryToSupabase(salary) {
    if (!supabaseClient || !isSupabaseConnected) return;
    if (!hasRelationalTables) return;
    try {
        const row = mapDriverSalaryToSupabase(salary);
        const { error } = await supabaseClient.from('driver_salaries').upsert(row);
        if (error) {
            console.error('Supabase driver salary upsert error:', error);
        } else {
            console.log('Driver salary synced to Supabase successfully:', salary.driverName);
        }
    } catch (err) {
        console.error('Supabase uploadDriverSalary error:', err);
    }
}

async function deleteDriverSalaryFromSupabase(id) {
    if (!supabaseClient || !isSupabaseConnected) return;
    if (!hasRelationalTables) return;
    try {
        if (isValidUUID(id)) {
            await supabaseClient.from('driver_salaries').delete().eq('id', id);
        }
    } catch (err) {
        console.error('Supabase deleteDriverSalary error:', err);
    }
}

async function uploadVehicleServiceToSupabase(service) {
    if (!supabaseClient || !isSupabaseConnected) return;
    if (!hasRelationalTables) return;
    try {
        const row = mapVehicleServiceToSupabase(service);
        const { error } = await supabaseClient.from('vehicle_services').upsert(row);
        if (error) {
            console.error('Supabase vehicle service upsert error:', error);
        } else {
            console.log('Vehicle service synced to Supabase successfully:', service.serviceType, service.amount);
        }
    } catch (err) {
        console.error('Supabase uploadVehicleService error:', err);
    }
}

async function deleteVehicleServiceFromSupabase(id) {
    if (!supabaseClient || !isSupabaseConnected) return;
    if (!hasRelationalTables) return;
    try {
        if (isValidUUID(id)) {
            await supabaseClient.from('vehicle_services').delete().eq('id', id);
        }
    } catch (err) {
        console.error('Supabase deleteVehicleService error:', err);
    }
}

async function persistFleetToSupabase() {
    if (!supabaseClient || !isSupabaseConnected) return;
    try {
        const payload = {
            vehicles: getVehicles(),
            bills: getBills(),
            fuel: getFuelLogs(),
            services: getVehicleServices(),
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_services' }, async () => {
                console.log('Realtime vehicle services update detected');
                await pullFromSupabase(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_salaries' }, async () => {
                console.log('Realtime driver salary update detected');
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
        const deletedServices = getStore('sm_deleted_services') || [];

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
                    recalibrateBillCounter();
                    pulledData = true;
                }

                const { data: fData, error: fErr } = await supabaseClient.from('fuel_logs').select('*');
                if (!fErr && fData) {
                    const validFuel = fData.map(mapFuelFromSupabase).filter(f => !deletedFuel.includes(String(f.id)));
                    setStore(STORAGE_KEYS.fuel, validFuel);
                    pulledData = true;
                }

                const { data: svData, error: svErr } = await supabaseClient.from('vehicle_services').select('*');
                if (!svErr && svData) {
                    const validServices = svData.map(mapVehicleServiceFromSupabase).filter(s => !deletedServices.includes(String(s.id)));
                    saveVehicleServices(validServices);
                    pulledData = true;
                }

                const { data: sData, error: sErr } = await supabaseClient.from('driver_salaries').select('*');
                if (!sErr && sData) {
                    const validSalaries = sData.map(mapDriverSalaryFromSupabase);
                    saveDriverSalaries(validSalaries);
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
                    if (cloudJson.services && cloudJson.services.length > 0 && (!hasRelationalTables || getVehicleServices().length === 0)) {
                        const validServices = cloudJson.services.filter(s => !deletedServices.includes(String(s.id)));
                        saveVehicleServices(validServices);
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

        // Recalibrate bill sequence after sync
        recalibrateBillCounter();

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
    const services = getVehicleServices();

    if (showSuccessToast) showToast('Syncing records to Supabase Cloud...', 'info');

    let billsSynced = 0;
    let fuelSynced = 0;
    let servicesSynced = 0;

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

        for (const s of services) {
            const row = mapVehicleServiceToSupabase(s);
            const { error } = await supabaseClient.from('vehicle_services').upsert(row);
            if (!error) servicesSynced++;
            else console.warn('Service sync item warning:', error);
        }

        const salaries = getDriverSalaries();
        let salariesSynced = 0;
        for (const sal of salaries) {
            const row = mapDriverSalaryToSupabase(sal);
            const { error } = await supabaseClient.from('driver_salaries').upsert(row);
            if (!error) salariesSynced++;
            else console.warn('Salary sync item warning:', error);
        }

        await persistFleetToSupabase();
        if (showSuccessToast) {
            showToast(`✅ Synced ${billsSynced}/${bills.length} bills, ${fuelSynced}/${fuel.length} fuel logs, ${servicesSynced}/${services.length} services & ${salariesSynced}/${salaries.length} driver salaries to Supabase! 🚀☁️`, 'success');
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
    const confirmed = confirm('⚠️ ARE YOU SURE YOU WANT TO RESET THE DATABASE?\n\nThis will permanently clear:\n• All bills and invoices\n• All fuel logs\n• All vehicle service & maintenance logs\n• All driver salaries\n• Reset bill counter to SM-0001\n• Reset vehicles to the default 3 vehicles\n\nAre you sure you want to proceed?');
    if (!confirmed) return;

    try {
        showToast('Resetting database...', 'info');

        // 1. Reset Local Storage data
        setStore(STORAGE_KEYS.bills, []);
        setStore(STORAGE_KEYS.fuel, []);
        setStore(STORAGE_KEYS.services, []);
        setStore(STORAGE_KEYS.notifications, []);
        setStore(STORAGE_KEYS.billCounter, 0);
        setStore(STORAGE_KEYS.vehicles, DEFAULT_VEHICLES);
        saveDriverSalaries([]);

        // 2. If Supabase is connected, clear cloud tables
        if (supabaseClient) {
            try {
                await supabaseClient.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabaseClient.from('fuel_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabaseClient.from('vehicle_services').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabaseClient.from('driver_salaries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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
        if (typeof renderFuelLogs === 'function') renderFuelLogs();
        if (typeof renderVehicles === 'function') renderVehicles();
        if (typeof renderReports === 'function') renderReports();
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
-- SRI MOORTHY TRANSPORT - SUPABASE DATABASE SETUP
-- Paste and run this in your Supabase SQL Editor:
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
    customer_name TEXT,
    customer_phone TEXT,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    goods_desc TEXT,
    is_local_income BOOLEAN DEFAULT false,
    add_to_driver_salary BOOLEAN DEFAULT false,
    driver_name TEXT,
    driver_salary_amount NUMERIC(12,2) DEFAULT 0,
    driver_salary_status TEXT DEFAULT 'paid' CHECK (driver_salary_status IN ('paid', 'unpaid')),
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

-- 4. DRIVER SALARIES TABLE
CREATE TABLE IF NOT EXISTS public.driver_salaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    driver_name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid')),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. VEHICLE SERVICE & MAINTENANCE EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.vehicle_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    service_type TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    garage TEXT,
    odometer NUMERIC(12,0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_bills_vehicle_id ON public.bills(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON public.bills(date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_id ON public.fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_date ON public.fuel_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_salaries_date ON public.driver_salaries(date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_salaries_driver ON public.driver_salaries(driver_name);
CREATE INDEX IF NOT EXISTS idx_vehicle_services_vehicle_id ON public.vehicle_services(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_services_date ON public.vehicle_services(date DESC);

-- 8. SEED DEFAULT FLEET VEHICLES
INSERT INTO public.vehicles (name, number, type, color, status)
VALUES 
    ('TATA ACE', 'TN68C6003', 'TATA ACE', '#EF5226', 'active'),
    ('TATA ACE', 'TN68W2419', 'TATA ACE', '#3b82f6', 'active'),
    ('DOST+', 'TN82K1945', 'DOST+', '#10b981', 'active')
ON CONFLICT (number) DO NOTHING;

-- 9. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES (FULL READ & WRITE ACCESS)
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

DROP POLICY IF EXISTS "Allow public read access to driver_salaries" ON public.driver_salaries;
DROP POLICY IF EXISTS "Allow public write access to driver_salaries" ON public.driver_salaries;
CREATE POLICY "Allow public read access to driver_salaries" ON public.driver_salaries FOR SELECT USING (true);
CREATE POLICY "Allow public write access to driver_salaries" ON public.driver_salaries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to vehicle_services" ON public.vehicle_services;
DROP POLICY IF EXISTS "Allow public write access to vehicle_services" ON public.vehicle_services;
CREATE POLICY "Allow public read access to vehicle_services" ON public.vehicle_services FOR SELECT USING (true);
CREATE POLICY "Allow public write access to vehicle_services" ON public.vehicle_services FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public write access to app_settings" ON public.app_settings;
CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public write access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- 11. SAFE REALTIME ACTIVATION
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_logs;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_salaries;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_services;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- 12. MIGRATIONS FOR EXISTING DATABASES
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_local_income BOOLEAN DEFAULT false;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS add_to_driver_salary BOOLEAN DEFAULT false;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS driver_salary_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS driver_salary_status TEXT DEFAULT 'paid';
ALTER TABLE public.bills ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS service_cost NUMERIC(12,2) DEFAULT 0;`;

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

