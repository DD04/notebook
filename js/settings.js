// js/settings.js - Settings & Backup Controller Module (Pure Supabase Mode)
import * as storage from './storage.js';
import { showToast, refreshAppState, checkGatewayStatus } from './app.js';
import { getText } from './i18n.js';

// DOM elements
const dbConnectedStatus = document.getElementById('dbConnectedStatus');
const dbDisconnectedStatus = document.getElementById('dbDisconnectedStatus');
const sbUrlInput = document.getElementById('sbUrl');
const sbKeyInput = document.getElementById('sbKey');
const saveSupabaseConfigBtn = document.getElementById('saveSupabaseConfigBtn');
const disconnectSupabaseBtn = document.getElementById('disconnectSupabaseBtn');

const exportBackupBtn = document.getElementById('exportBackupBtn');
const importBackupBtn = document.getElementById('importBackupBtn');
const headerExportBtn = document.getElementById('headerExportBtn');
const headerImportBtn = document.getElementById('headerImportBtn');
const importFileSelector = document.getElementById('importFileSelector');

export function initSettings() {
    // 1. Initial State Load
    refreshSettingsView();

    // 2. Supabase Credentials Save
    if (saveSupabaseConfigBtn) {
        saveSupabaseConfigBtn.addEventListener('click', saveSupabaseConfig);
    }

    // 3. Disconnect Supabase
    if (disconnectSupabaseBtn) {
        disconnectSupabaseBtn.addEventListener('click', handleDisconnect);
    }

    // 4. Export JSON backup
    if (exportBackupBtn) {
        exportBackupBtn.addEventListener('click', handleExportBackup);
    }
    if (headerExportBtn) {
        headerExportBtn.addEventListener('click', handleExportBackup);
    }

    // 5. Import JSON backup
    if (importBackupBtn) {
        importBackupBtn.addEventListener('click', () => {
            if (importFileSelector) importFileSelector.click();
        });
    }
    if (headerImportBtn) {
        headerImportBtn.addEventListener('click', () => {
            if (importFileSelector) importFileSelector.click();
        });
    }
    
    if (importFileSelector) {
        importFileSelector.addEventListener('change', handleImportBackup);
    }
}

export function refreshSettingsView() {
    const config = storage.getConfig();
    const isConnected = storage.isCloudMode();

    if (sbUrlInput) sbUrlInput.value = config.sbUrl || '';
    if (sbKeyInput) sbKeyInput.value = config.sbKey || '';

    if (isConnected) {
        if (dbConnectedStatus) dbConnectedStatus.classList.remove('d-none');
        if (dbDisconnectedStatus) dbDisconnectedStatus.classList.add('d-none');
        
        if (sbUrlInput) sbUrlInput.disabled = true;
        if (sbKeyInput) sbKeyInput.disabled = true;
        
        if (saveSupabaseConfigBtn) saveSupabaseConfigBtn.classList.add('d-none');
        if (disconnectSupabaseBtn) disconnectSupabaseBtn.classList.remove('d-none');
    } else {
        if (dbConnectedStatus) dbConnectedStatus.classList.add('d-none');
        if (dbDisconnectedStatus) dbDisconnectedStatus.classList.remove('d-none');
        
        if (sbUrlInput) sbUrlInput.disabled = false;
        if (sbKeyInput) sbKeyInput.disabled = false;
        
        if (saveSupabaseConfigBtn) saveSupabaseConfigBtn.classList.remove('d-none');
        if (disconnectSupabaseBtn) disconnectSupabaseBtn.classList.add('d-none');
    }
    // Refresh icons
    if (window.lucide) window.lucide.replace();
}

async function saveSupabaseConfig() {
    const url = sbUrlInput.value.trim();
    const key = sbKeyInput.value.trim();
    
    if (!url || !key) {
        showToast("Please enter both Supabase URL and Anon Key.", "warning");
        return;
    }
    
    if (saveSupabaseConfigBtn) {
        saveSupabaseConfigBtn.disabled = true;
        saveSupabaseConfigBtn.textContent = 'Connecting...';
    }
    
    try {
        await storage.saveConfig({
            sbUrl: url,
            sbKey: key
        });
        showToast("Supabase connected and verified!", "success");
        refreshSettingsView();
        await refreshAppState();
    } catch (err) {
        console.error("Supabase config save error:", err);
        showToast(err.message, "error");
        
        // Reset DB settings
        storage.clearLocalStorageState();
        refreshSettingsView();
        await checkGatewayStatus();
    } finally {
        if (saveSupabaseConfigBtn) {
            saveSupabaseConfigBtn.disabled = false;
            saveSupabaseConfigBtn.textContent = 'Connect Database';
        }
    }
}

async function handleDisconnect() {
    if (!confirm(getText('confirm_disconnect') || '確定要中斷資料庫連線嗎？這將登出帳號並返回連線設定頁面。')) {
        return;
    }
    
    try {
        await storage.signOut(); // Log out from Supabase Auth
    } catch (e) {
        console.warn("Error signing out during disconnect", e);
    }
    
    storage.clearLocalStorageState(); // Clear config from localStorage
    showToast("Supabase database disconnected.", "success");
    
    // Refresh page state and trigger gateway blocker
    refreshSettingsView();
    await checkGatewayStatus();
}

async function handleExportBackup() {
    const exportBtns = [exportBackupBtn, headerExportBtn].filter(Boolean);
    exportBtns.forEach(btn => {
        btn.disabled = true;
        if (btn === headerExportBtn) {
            btn.innerHTML = `<i data-lucide="loader"></i>`;
        } else {
            btn.innerHTML = `<i data-lucide="loader"></i> ${getText('settings_btn_export')}...`;
        }
    });
    if (window.lucide) window.lucide.createIcons();

    try {
        const jsonStr = await storage.exportStateAsJSON();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().substring(0, 10);
        a.href = url;
        a.download = `notebook_cloud_backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast("JSON backup downloaded successfully!", "success");
    } catch (err) {
        showToast("Export failed: " + err.message, "error");
    } finally {
        exportBtns.forEach(btn => {
            btn.disabled = false;
            if (btn === headerExportBtn) {
                btn.innerHTML = `<i data-lucide="download-cloud"></i>`;
            } else {
                btn.innerHTML = `<i data-lucide="download-cloud"></i> ${getText('settings_btn_export')}`;
            }
        });
        if (window.lucide) window.lucide.createIcons();
    }
}

function handleImportBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const importBtns = [importBackupBtn, headerImportBtn].filter(Boolean);
    importBtns.forEach(btn => {
        btn.disabled = true;
        if (btn === headerImportBtn) {
            btn.innerHTML = `<i data-lucide="loader"></i>`;
        } else {
            btn.innerHTML = `<i data-lucide="loader"></i> ${getText('settings_btn_import')}...`;
        }
    });
    if (window.lucide) window.lucide.createIcons();

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const success = await storage.importStateFromJSON(event.target.result);
            if (success) {
                showToast("Backup restored to Supabase successfully!", "success");
                await refreshAppState();
            }
        } catch (err) {
            showToast("Import failed: " + err.message, "error");
        } finally {
            // Reset file selection
            importFileSelector.value = '';
            importBtns.forEach(btn => {
                btn.disabled = false;
                if (btn === headerImportBtn) {
                    btn.innerHTML = `<i data-lucide="upload-cloud"></i>`;
                } else {
                    btn.innerHTML = `<i data-lucide="upload-cloud"></i> ${getText('settings_btn_import')}`;
                }
            });
            if (window.lucide) window.lucide.createIcons();
        }
    };
    reader.readAsText(file);
}
