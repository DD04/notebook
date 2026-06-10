// js/app.js - Main Application Orchestrator and SPA Router
import * as storage from './storage.js';
import * as auth from './auth.js';
import * as dashboard from './dashboard.js';
import * as group from './group.js';
import * as budgeting from './budgeting.js';
import * as analytics from './analytics.js';
import * as settings from './settings.js';

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

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Theme
    initTheme();

    // 2. Initialize Core Storage and Configuration
    await storage.initStorage();
    updateModeBadge();

    // 3. Initialize Auth and Session
    auth.initAuth(handleAuthSuccess);
    sidebarAuthBtn.addEventListener('click', handleAuthBtnClick);
    await refreshUserSession();

    // 4. Initialize Child Modules
    dashboard.initDashboard(onLedgerDataChange);
    group.initGroups();
    budgeting.initBudgeting();
    settings.initSettings();

    // 5. Setup SPA Navigation
    initRouter();

    // 6. Setup Mobile Responsive Navigation toggles
    sidebarOpenBtn.addEventListener('click', () => sidebar.classList.add('active'));
    sidebarCloseBtn.addEventListener('click', () => sidebar.classList.remove('active'));

    // 7. Initial Load Views
    await refreshAppState();
    
    // Replace Lucide Icons initially
    lucide.replace();
});

/* ==========================================================================
   SPA ROUTER
   ========================================================================== */
function initRouter() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
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
        dashboard: 'Dashboard',
        groups: 'Group Ledger',
        analytics: 'Analytics & Trends',
        budgeting: 'Monthly Budgeting',
        settings: 'Configuration Settings'
    };
    pageTitle.textContent = titles[viewName] || 'Notebook';
    
    // Refresh view specific data on display
    triggerViewRefresh(viewName);
}

function triggerViewRefresh(viewName) {
    switch(viewName) {
        case 'dashboard':
            dashboard.refreshDashboard();
            break;
        case 'groups':
            group.refreshGroups();
            break;
        case 'budgeting':
            budgeting.refreshBudgeting();
            break;
        case 'analytics':
            analytics.refreshAnalytics();
            break;
    }
}

/* ==========================================================================
   STATE ORCHESTRATION & SYNC
   ========================================================================== */
export async function refreshAppState() {
    updateModeBadge();
    
    // Get active view and refresh it
    const activeNav = document.querySelector('.nav-item.active');
    const activeView = activeNav ? activeNav.getAttribute('data-view') : 'dashboard';
    
    triggerViewRefresh(activeView);
}

// Event triggered when dashboard transaction is updated/deleted/added
function onLedgerDataChange() {
    // If we make changes in dashboard, we need to sync charts and budgets too
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
    // Replaced dynamically by lucide triggers
    lucide.replace();
}

/* ==========================================================================
   SESSION CONTROLLER
   ========================================================================== */
async function refreshUserSession() {
    currentUser = await storage.getCurrentUser();
    
    if (currentUser) {
        profileNickname.textContent = currentUser.nickname || 'Active User';
        profileStatus.textContent = storage.isCloudMode() ? 'Cloud Sync Active' : 'Local Account';
        
        // Logged in icon status
        sidebarAuthBtn.innerHTML = '<i data-lucide="log-out"></i>';
        sidebarAuthBtn.setAttribute('title', 'Log Out');
        userAvatar.innerHTML = `<span style="font-weight:700; font-size:14px; font-family:'Outfit';">${currentUser.nickname[0].toUpperCase()}</span>`;
    } else {
        profileNickname.textContent = 'Guest User';
        profileStatus.textContent = 'Local Mode';
        
        sidebarAuthBtn.innerHTML = '<i data-lucide="log-in"></i>';
        sidebarAuthBtn.setAttribute('title', 'Log In / Sign Up');
        userAvatar.innerHTML = '<i data-lucide="user"></i>';
    }
    lucide.replace();
}

async function handleAuthBtnClick() {
    if (currentUser) {
        // Sign Out action
        if (confirm("Log out of your active session?")) {
            try {
                await storage.signOut();
                showToast("Logged out successfully.", "success");
                await refreshUserSession();
                await refreshAppState();
            } catch (err) {
                showToast("Sign out failed: " + err.message, "error");
            }
        }
    } else {
        // Show Auth Modal
        auth.showAuthModal();
    }
}

function handleAuthSuccess(user) {
    showToast(`Welcome back, ${user.nickname || 'User'}!`, "success");
    refreshUserSession().then(() => {
        refreshAppState();
    });
}

function updateModeBadge() {
    const isCloud = storage.isCloudMode();
    modeBadge.className = 'mode-badge';
    
    if (isCloud) {
        modeBadge.classList.add('bg-glass');
        modeBadgeText.textContent = 'Supabase Sync';
        modeBadge.querySelector('.badge-dot').style.background = 'var(--success)';
        modeBadge.querySelector('.badge-dot').style.boxShadow = '0 0 8px var(--success)';
    } else {
        modeBadgeText.textContent = 'Local Storage';
        modeBadge.querySelector('.badge-dot').style.background = 'var(--primary)';
        modeBadge.querySelector('.badge-dot').style.boxShadow = '0 0 8px var(--primary)';
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
    
    // Auto remove from DOM after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

export { formatCurrency } from './dashboard.js';
