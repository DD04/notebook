// js/app.js - Main Application Orchestrator and SPA Router (Pure Supabase Mode)
import * as storage from './storage.js';
import * as auth from './auth.js';
import * as dashboard from './dashboard.js';
import * as group from './group.js';
import * as budgeting from './budgeting.js';
import * as analytics from './analytics.js';
import * as settings from './settings.js';
import { exportLedgerToExcel } from './exportExcel.js';

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
const headerDownloadBtn = document.getElementById('headerDownloadBtn');

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

    // 3. Auth Panel / Gateway forms are mounted lazily (see mountGatewayOverlay()),
    // only when actually needed, so they aren't wired up here.
    sidebarAuthBtn.addEventListener('click', handleAuthBtnClick);

    // 4. Initialize Child Modules
    dashboard.initDashboard(onLedgerDataChange);
    group.initGroups();
    budgeting.initBudgeting();
    analytics.initAnalytics();
    settings.initSettings();

    // Profile Edit Modal Setup — mounted lazily (see mountProfileModal()) so its password
    // input isn't sitting in the DOM (and tripping iOS AutoFill) until the user actually
    // opens "Edit Profile".
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.addEventListener('click', () => {
            if (!currentUser) return;
            mountProfileModal();

            const profileModal = document.getElementById('profileModal');
            const profileNicknameInput = document.getElementById('profileNicknameInput');
            const profilePasswordInput = document.getElementById('profilePasswordInput');
            const profileError = document.getElementById('profileError');

            if (profileNicknameInput) {
                profileNicknameInput.value = currentUser.nickname || '';
            }
            if (profilePasswordInput) {
                profilePasswordInput.value = '';
            }
            if (profileError) {
                profileError.classList.add('d-none');
                profileError.textContent = '';
            }
            if (profileModal) {
                profileModal.classList.add('active');
            }
        });
    }

    // 6. Setup SPA Navigation
    initRouter();

    // 6.5. Ledger Excel download (works from both the Dashboard and Groups views)
    if (headerDownloadBtn) {
        headerDownloadBtn.addEventListener('click', handleHeaderDownload);
    }

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
function getActiveView() {
    const hash = window.location.hash.replace('#', '');
    const validViews = ['dashboard', 'groups', 'analytics'];

    if (hash && validViews.includes(hash)) {
        return hash;
    }
    const activeNav = document.querySelector('.nav-item.active');
    return activeNav ? activeNav.getAttribute('data-view') : 'dashboard';
}

export async function refreshAppState() {
    updateModeBadge();

    // Check connection/login status
    const ready = await checkGatewayStatus();
    if (!ready) return;

    switchView(getActiveView());
}

// Downloads the ledger currently on screen (Dashboard or Groups view) as a styled .xlsx file
async function handleHeaderDownload() {
    const activeView = getActiveView();

    let title;
    let filenamePrefix;
    let transactions;
    let includeMember = false;

    if (activeView === 'dashboard') {
        title = '個人收支明細表';
        filenamePrefix = '個人收支明細表';
        transactions = dashboard.getFilteredTransactions();
    } else if (activeView === 'groups') {
        const groupName = group.getActiveGroupName();
        if (!groupName) {
            showToast('請先選擇一個群組', 'warning');
            return;
        }
        title = `${groupName}收支明細表`;
        filenamePrefix = title;
        transactions = group.getFilteredGroupTransactions();
        includeMember = true;
    } else {
        showToast('此頁面沒有可下載的明細', 'info');
        return;
    }

    if (!transactions || transactions.length === 0) {
        showToast('目前沒有可下載的資料', 'warning');
        return;
    }

    headerDownloadBtn.disabled = true;
    headerDownloadBtn.innerHTML = '<i data-lucide="loader" class="spin-animation"></i>';
    lucide.replace();

    try {
        await exportLedgerToExcel({ title, transactions, filenamePrefix, includeMember });
        showToast('明細表下載成功！', 'success');
    } catch (err) {
        console.error('Excel export failed:', err);
        showToast('下載失敗: ' + err.message, 'error');
    } finally {
        headerDownloadBtn.disabled = false;
        headerDownloadBtn.innerHTML = '<i data-lucide="file-spreadsheet"></i>';
        lucide.replace();
    }
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
// The gateway overlay (DB connection + login/signup/forgot-password forms) lives in a
// <template> in index.html instead of the live DOM. It's only cloned in and wired up the
// first time it's actually needed (not connected, or not signed in). This keeps the
// password inputs out of the DOM entirely for an already-logged-in visit, which is what
// was causing iOS Safari to offer to AutoFill/save a password on every page load even
// though the app itself was already authenticated.
let gatewayMounted = false;
function mountGatewayOverlay() {
    if (gatewayMounted) return;
    const tpl = document.getElementById('gatewayOverlayTemplate');
    if (!tpl) return;
    document.body.appendChild(tpl.content.cloneNode(true));
    gatewayMounted = true;
    auth.initAuth(handleAuthSuccess);
    initGateway();
}

export async function checkGatewayStatus() {
    const isDbConnected = storage.isCloudMode();

    // 1. Database connection is required first
    if (!isDbConnected) {
        mountGatewayOverlay();
        const gatewayOverlay = document.getElementById('gatewayOverlay');
        const gatewayTitle = document.getElementById('gatewayTitle');
        const gatewaySubtitle = document.getElementById('gatewaySubtitle');
        const gatewayDbForm = document.getElementById('gatewayDbForm');
        const gatewayAuthForm = document.getElementById('gatewayAuthForm');
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
        mountGatewayOverlay();
        const gatewayOverlay = document.getElementById('gatewayOverlay');
        const gatewayDbForm = document.getElementById('gatewayDbForm');
        const gatewayAuthForm = document.getElementById('gatewayAuthForm');
        if (gatewayOverlay) gatewayOverlay.classList.add('active');
        if (gatewayDbForm) gatewayDbForm.classList.add('d-none');
        if (gatewayAuthForm) gatewayAuthForm.classList.remove('d-none');
        auth.showAuthPanel();
        updateModeBadge();
        return false;
    }

    // 3. Both connected and authenticated — gateway stays unmounted (or hidden, if it was
    // mounted earlier this session e.g. after a fresh sign-in)
    if (gatewayMounted) {
        const gatewayOverlay = document.getElementById('gatewayOverlay');
        if (gatewayOverlay) gatewayOverlay.classList.remove('active');
    }
    await refreshUserSession();
    updateModeBadge();
    return true;
}

// Same lazy-mount treatment for the "Edit Profile" modal — its password input stays out
// of the DOM until the user opens the modal at least once this session.
let profileModalMounted = false;
function mountProfileModal() {
    if (profileModalMounted) return;
    const tpl = document.getElementById('profileModalTemplate');
    if (!tpl) return;
    document.body.appendChild(tpl.content.cloneNode(true));
    profileModalMounted = true;

    const profileModal = document.getElementById('profileModal');
    const profileModalClose = document.getElementById('profileModalClose');
    const profileModalCancel = document.getElementById('profileModalCancel');
    const profileForm = document.getElementById('profileForm');
    const profileNicknameInput = document.getElementById('profileNicknameInput');
    const profilePasswordInput = document.getElementById('profilePasswordInput');
    const profileError = document.getElementById('profileError');

    if (profileModalClose) {
        profileModalClose.addEventListener('click', () => {
            if (profileModal) profileModal.classList.remove('active');
        });
    }
    if (profileModalCancel) {
        profileModalCancel.addEventListener('click', () => {
            if (profileModal) profileModal.classList.remove('active');
        });
    }
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) profileModal.classList.remove('active');
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (profileError) {
                profileError.classList.add('d-none');
                profileError.textContent = '';
            }

            const nickname = profileNicknameInput.value.trim();
            const password = profilePasswordInput.value;

            if (!nickname) {
                if (profileError) {
                    profileError.textContent = "暱稱不能留空";
                    profileError.classList.remove('d-none');
                }
                return;
            }

            try {
                await storage.updateProfile(nickname, password);
                showToast("個人資料更新成功！", "success");
                if (profileModal) profileModal.classList.remove('active');
                await refreshUserSession();
            } catch (err) {
                console.error("更新個人資料失敗", err);
                if (profileError) {
                    profileError.textContent = "更新失敗: " + err.message;
                    profileError.classList.remove('d-none');
                }
            }
        });
    }
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
