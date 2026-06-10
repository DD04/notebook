// js/app.js - Main Application Orchestrator and SPA Router (Pure Supabase Mode)
import * as storage from './storage.js';
import * as auth from './auth.js';
import * as dashboard from './dashboard.js';
import * as group from './group.js';
import * as budgeting from './budgeting.js';
import * as analytics from './analytics.js';
import * as settings from './settings.js';

// Lucide API compatibility polyfill
if (window.lucide && !window.lucide.replace) {
    window.lucide.replace = window.lucide.createIcons;
}

// i18n localization
import { translateUI, toggleLocale, getLocale, getText } from './i18n.js';

// DOM elements
const sidebar = document.getElementById('sidebar');
const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const sidebarAuthBtn = document.getElementById('sidebarAuthBtn');

const profileNickname = document.getElementById('profileNickname');
const profileStatus = document.getElementById('profileStatus');
const userAvatar = document.getElementById('userAvatar');

const modeBadge = document.getElementById('modeBadge');
const modeBadgeText = document.getElementById('modeBadgeText');
const pageTitle = document.getElementById('pageTitle');
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');
const toastContainer = document.getElementById('toastContainer');

// State
let currentUser = null;

// Initialize App Function
async function initApp() {
    // 0. Pre-apply view from hash immediately to prevent flash
    const initialHash = window.location.hash.replace('#', '');
    const validViews = ['dashboard', 'groups', 'analytics'];
    if (initialHash && validViews.includes(initialHash)) {
        // Immediately switch view sections without data loading
        viewSections.forEach(section => {
            if (section.id === `view-${initialHash}`) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
        navItems.forEach(nav => {
            if (nav.getAttribute('data-view') === initialHash) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });
    }

    // 1. Initialize Theme
    initTheme();

    // 1.5. Apply language settings
    translateUI();
    const langToggleBtn = document.getElementById('langToggleBtn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            toggleLocale();
            translateUI();
            refreshAppState();
        });
    }

    // 2. Initialize Core Storage and Configuration
    await storage.initStorage();
    
    // Listen for auth state changes (especially PASSWORD_RECOVERY)
    storage.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            console.log('PASSWORD_RECOVERY event triggered');
            auth.showResetPanel();
        }
    });
    
    // 3. Initialize Auth Panel
    auth.initAuth(handleAuthSuccess);
    sidebarAuthBtn.addEventListener('click', handleAuthBtnClick);

    // 4. Setup Gateway Form Listeners
    initGateway();

    // 5. Initialize Child Modules
    dashboard.initDashboard(onLedgerDataChange);
    group.initGroups();
    budgeting.initBudgeting();
    settings.initSettings();

    // 6. Setup SPA Navigation
    initRouter();

    // 7. Setup Mobile Responsive Navigation toggles
    sidebarOpenBtn.addEventListener('click', () => sidebar.classList.add('active'));
    sidebarCloseBtn.addEventListener('click', () => sidebar.classList.remove('active'));

    // 8. Gateway Status Gatekeeper
    const ready = await checkGatewayStatus();
    if (ready) {
        await refreshAppState();
    }
    
    // Replace Lucide Icons initially
    lucide.replace();
}

// Safe App Bootstrapping
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

/* ==========================================================================
   SPA ROUTER
   ========================================================================== */
function initRouter() {
    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            // Block navigation if not fully configured/logged in
            const ready = await checkGatewayStatus();
            if (!ready) return;

            const viewName = item.getAttribute('data-view');
            switchView(viewName);
            
            // Auto close mobile sidebar
            sidebar.classList.remove('active');
        });
    });
}

function switchView(viewName) {
    // Update active nav link
    navItems.forEach(nav => {
        if (nav.getAttribute('data-view') === viewName) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    // Update visible view section
    viewSections.forEach(section => {
        if (section.id === `view-${viewName}`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    // Update Page Header Title
    const titles = {
        dashboard: getText('nav_dashboard'),
        groups: getText('nav_groups'),
        analytics: getText('nav_analytics')
    };
    pageTitle.textContent = titles[viewName] || 'Notebook';
    
    // Refresh view specific data on display
    triggerViewRefresh(viewName);

    // Update URL hash to persist active view on refresh
    window.location.hash = viewName;
}

function triggerViewRefresh(viewName) {
    if (!storage.isCloudMode() || !currentUser) return;

    switch(viewName) {
        case 'dashboard':
            dashboard.refreshDashboard();
            break;
        case 'groups':
            group.refreshGroups();
            break;
        case 'analytics':
            analytics.refreshAnalytics();
            budgeting.refreshBudgeting();
            break;
        // 'settings' case removed
    }
}

/* ==========================================================================
   STATE ORCHESTRATION & SYNC
   ========================================================================== */
export async function refreshAppState() {
    updateModeBadge();
    
    // Check connection/login status
    const ready = await checkGatewayStatus();
    if (!ready) return;

    // Get active view based on hash or fallback
    let activeView = 'dashboard';
    const hash = window.location.hash.replace('#', '');
    const validViews = ['dashboard', 'groups', 'analytics'];
    
    if (hash && validViews.includes(hash)) {
        activeView = hash;
    } else {
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            activeView = activeNav.getAttribute('data-view');
        }
    }
    
    switchView(activeView);
}

// Event triggered when dashboard transaction is updated/deleted/added
function onLedgerDataChange() {
    budgeting.refreshBudgeting();
    analytics.refreshAnalytics();
}

/* ==========================================================================
   THEME MANAGER
   ========================================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('notebook_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('notebook_theme', nextTheme);
        updateThemeIcon(nextTheme);
    });
}

function updateThemeIcon(theme) {
    lucide.replace();
}

/* ==========================================================================
   GATEWAY GATEKEEPER & CONTROLLER
   ========================================================================== */
export async function checkGatewayStatus() {
    const isDbConnected = storage.isCloudMode();
    
    const gatewayOverlay = document.getElementById('gatewayOverlay');
    const gatewayTitle = document.getElementById('gatewayTitle');
    const gatewaySubtitle = document.getElementById('gatewaySubtitle');
    const gatewayDbForm = document.getElementById('gatewayDbForm');
    const gatewayAuthForm = document.getElementById('gatewayAuthForm');
    
    // 1. Database connection is required first
    if (!isDbConnected) {
        if (gatewayOverlay) gatewayOverlay.classList.add('active');
        if (gatewayTitle) gatewayTitle.textContent = "Database Connection Required";
        if (gatewaySubtitle) gatewaySubtitle.textContent = "Connect to your Supabase instance to begin.";
        if (gatewayDbForm) gatewayDbForm.classList.remove('d-none');
        if (gatewayAuthForm) gatewayAuthForm.classList.add('d-none');
        updateModeBadge();
        return false;
    }
    
    // 2. User authentication is required
    currentUser = await storage.getCurrentUser();
    if (!currentUser) {
        if (gatewayOverlay) gatewayOverlay.classList.add('active');
        if (gatewayDbForm) gatewayDbForm.classList.add('d-none');
        if (gatewayAuthForm) gatewayAuthForm.classList.remove('d-none');
        auth.showAuthPanel();
        updateModeBadge();
        return false;
    }
    
    // 3. Both connected and authenticated
    if (gatewayOverlay) gatewayOverlay.classList.remove('active');
    await refreshUserSession();
    updateModeBadge();
    return true;
}

function initGateway() {
    const gatewayDbForm = document.getElementById('gatewayDbForm');
    const gwSbUrl = document.getElementById('gwSbUrl');
    const gwSbKey = document.getElementById('gwSbKey');
    const gatewayDbError = document.getElementById('gatewayDbError');
    const gatewayDbSubmitBtn = document.getElementById('gatewayDbSubmitBtn');
    
    if (gatewayDbForm) {
        gatewayDbForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (gatewayDbError) gatewayDbError.classList.add('d-none');
            
            const url = gwSbUrl.value.trim();
            const key = gwSbKey.value.trim();
            
            if (gatewayDbSubmitBtn) {
                gatewayDbSubmitBtn.disabled = true;
                gatewayDbSubmitBtn.textContent = "Connecting...";
            }
            
            try {
                const success = await storage.saveConfig({ sbUrl: url, sbKey: key });
                if (success) {
                    showToast("Supabase Database Connected!", "success");
                    // Sync views with connected DB (no settings page to refresh)
                    const ready = await checkGatewayStatus();
                    if (ready) {
                        await refreshAppState();
                    }
                } else {
                    throw new Error("Could not verify connection.");
                }
            } catch (err) {
                console.error(err);
                if (gatewayDbError) {
                    gatewayDbError.textContent = err.message || "Connection failed.";
                    gatewayDbError.classList.remove('d-none');
                }
            } finally {
                if (gatewayDbSubmitBtn) {
                    gatewayDbSubmitBtn.disabled = false;
                    gatewayDbSubmitBtn.textContent = "Connect Database";
                }
            }
        });
    }
}

/* ==========================================================================
   SESSION CONTROLLER
   ========================================================================== */
async function refreshUserSession() {
    currentUser = await storage.getCurrentUser();
    
    // Notify group module about current user (for creator-only access control)
    group.setCurrentUser(currentUser);
    
    if (currentUser) {
        profileNickname.textContent = currentUser.nickname || 'Active User';
        profileStatus.textContent = getText('badge_cloud_sync');
        
        sidebarAuthBtn.innerHTML = '<i data-lucide="log-out"></i>';
        sidebarAuthBtn.setAttribute('title', 'Log Out');
        if (currentUser.nickname && currentUser.nickname.length > 0) {
            userAvatar.innerHTML = `<span style="font-weight:700; font-size:14px; font-family:'Outfit';">${currentUser.nickname[0].toUpperCase()}</span>`;
        } else {
            userAvatar.innerHTML = '<i data-lucide="user"></i>';
        }
    } else {
        profileNickname.textContent = getText('sidebar_offline_user');
        profileStatus.textContent = getText('sidebar_disconnected');
        
        sidebarAuthBtn.innerHTML = '<i data-lucide="log-in"></i>';
        sidebarAuthBtn.setAttribute('title', 'Log In / Sign Up');
        userAvatar.innerHTML = '<i data-lucide="user"></i>';
    }
    lucide.replace();
}

async function handleAuthBtnClick() {
    if (currentUser) {
        if (confirm("Log out of your active session?")) {
            try {
                await storage.signOut();
                showToast("Logged out successfully.", "success");
                currentUser = null;
                await refreshUserSession();
                await checkGatewayStatus();
            } catch (err) {
                showToast("Sign out failed: " + err.message, "error");
            }
        }
    } else {
        await checkGatewayStatus();
    }
}

function handleAuthSuccess(user) {
    showToast(`Welcome, ${user.nickname || 'User'}!`, "success");
    refreshUserSession().then(() => {
        // Update group module with new user after login
        group.setCurrentUser(currentUser);
        refreshAppState();
    });
}

function updateModeBadge() {
    const isCloud = storage.isCloudMode();
    modeBadge.className = 'mode-badge';
    
    if (isCloud) {
        modeBadge.classList.add('bg-glass');
        const text = getText('badge_cloud_sync');
        modeBadgeText.textContent = text;
        modeBadge.title = text;
        modeBadge.querySelector('.badge-dot').style.background = 'var(--success)';
        modeBadge.querySelector('.badge-dot').style.boxShadow = '0 0 8px var(--success)';
    } else {
        const text = getText('badge_db_required');
        modeBadgeText.textContent = text;
        modeBadge.title = text;
        modeBadge.querySelector('.badge-dot').style.background = 'var(--error)';
        modeBadge.querySelector('.badge-dot').style.boxShadow = '0 0 8px var(--error)';
    }

    // Update Superuser UI Backup elements
    const superuserBackupSection = document.getElementById('superuserBackupSection');
    if (superuserBackupSection) {
        if (isCloud && currentUser && currentUser.superuser) {
            superuserBackupSection.style.display = 'flex';
        } else {
            superuserBackupSection.style.display = 'none';
        }
    }
}

/* ==========================================================================
   GLOBAL NOTIFICATION SYSTEM
   ========================================================================== */
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'warning') iconName = 'alert-circle';
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${escapeHTML(message)}</span>
    `;
    
    toastContainer.appendChild(toast);
    lucide.replace();
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

export async function showConfirm(titleText, text = '') {
    if (!window.Swal) {
        return confirm(titleText + (text ? '\n' + text : ''));
    }
    const result = await Swal.fire({
        title: titleText,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        cancelButtonColor: '#374151',
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        background: '#1e1e2e',
        color: '#f3f4f6'
    });
    return result.isConfirmed;
}

export async function showAlert(titleText, text = '', icon = 'info') {
    if (!window.Swal) {
        alert(titleText + (text ? '\n' + text : ''));
        return;
    }
    await Swal.fire({
        title: titleText,
        text: text,
        icon: icon,
        confirmButtonColor: '#6366f1',
        confirmButtonText: '確定',
        background: '#1e1e2e',
        color: '#f3f4f6'
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

export { formatCurrency } from './dashboard.js';
