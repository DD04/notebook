// js/settings.js - Settings & Backup Controller Module
import * as storage from './storage.js';
import { showToast, refreshAppState } from './app.js';

// DOM elements
const storageModeRadios = document.querySelectorAll('input[name="storageMode"]');
const supabaseConfigForm = document.getElementById('supabaseConfigForm');
const sbUrlInput = document.getElementById('sbUrl');
const sbKeyInput = document.getElementById('sbKey');
const saveSupabaseConfigBtn = document.getElementById('saveSupabaseConfigBtn');

const exportBackupBtn = document.getElementById('exportBackupBtn');
const importBackupBtn = document.getElementById('importBackupBtn');
const importFileSelector = document.getElementById('importFileSelector');
const clearLocalDataBtn = document.getElementById('clearLocalDataBtn');

export function initSettings() {
    // 1. Initial State Load
    const config = storage.getConfig();
    setRadioValue('storageMode', config.mode);
    sbUrlInput.value = config.sbUrl || '';
    sbKeyInput.value = config.sbKey || '';
    
    toggleSupabaseFormDisplay(config.mode === 'supabase');

    // 2. Storage Mode Radio Switch
    storageModeRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const mode = e.target.value;
            toggleSupabaseFormDisplay(mode === 'supabase');
            
            if (mode === 'local') {
                try {
                    await storage.saveConfig({ mode: 'local' });
                    showToast("Switched to Local Mode (Offline)", "success");
                    await refreshAppState();
                } catch (err) {
                    showToast("Failed to switch mode: " + err.message, "error");
                }
            } else if (mode === 'supabase') {
                // If we don't have config yet, show form and toast
                const current = storage.getConfig();
                if (!current.sbUrl || !current.sbKey) {
                    showToast("Please enter your Supabase connection parameters.", "warning");
                } else {
                    // Try to connect using existing config
                    saveSupabaseConfig();
                }
            }
        });
    });

    // 3. Supabase Credentials Save
    saveSupabaseConfigBtn.addEventListener('click', saveSupabaseConfig);

    // 4. Export JSON backup
    exportBackupBtn.addEventListener('click', handleExportBackup);

    // 5. Import JSON backup
    importBackupBtn.addEventListener('click', () => {
        importFileSelector.click();
    });
    
    importFileSelector.addEventListener('change', handleImportBackup);

    // 6. Clear Local Storage
    clearLocalDataBtn.addEventListener('click', handleClearLocalData);
}

function toggleSupabaseFormDisplay(show) {
    if (show) {
        supabaseConfigForm.classList.remove('d-none');
    } else {
        supabaseConfigForm.classList.add('d-none');
    }
}

async function saveSupabaseConfig() {
    const url = sbUrlInput.value.trim();
    const key = sbKeyInput.value.trim();
    
    if (!url || !key) {
        showToast("Please enter both Supabase URL and Anon Key.", "warning");
        return;
    }
    
    saveSupabaseConfigBtn.disabled = true;
    saveSupabaseConfigBtn.textContent = 'Connecting...';
    
    try {
        await storage.saveConfig({
            mode: 'supabase',
            sbUrl: url,
            sbKey: key
        });
        showToast("Supabase connected and verified!", "success");
        await refreshAppState();
    } catch (err) {
        console.error("Supabase config save error:", err);
        showToast(err.message, "error");
        
        // Revert radio selection to local
        setRadioValue('storageMode', 'local');
        toggleSupabaseFormDisplay(false);
        await storage.saveConfig({ mode: 'local' });
    } finally {
        saveSupabaseConfigBtn.disabled = false;
        saveSupabaseConfigBtn.textContent = 'Connect Supabase';
    }
}

function handleExportBackup() {
    try {
        const jsonStr = storage.exportStateAsJSON();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().substring(0, 10);
        a.href = url;
        a.download = `notebook_backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast("JSON backup downloaded successfully!", "success");
    } catch (err) {
        showToast("Export failed: " + err.message, "error");
    }
}

function handleImportBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const success = storage.importStateFromJSON(event.target.result);
            if (success) {
                showToast("Backup restored successfully!", "success");
                await refreshAppState();
            }
        } catch (err) {
            showToast("Import failed: " + err.message, "error");
        }
        // Reset file selection
        importFileSelector.value = '';
    };
    reader.readAsText(file);
}

function handleClearLocalData() {
    if (!confirm("Are you absolutely sure you want to delete all local transactions, budgets, groups, and mock sessions?")) {
        return;
    }
    if (!confirm("This is your second warning. This action CANNOT BE UNDONE. Confirm delete?")) {
        return;
    }
    
    try {
        storage.clearLocalStorageState();
        showToast("Local storage state cleared.", "success");
        window.location.reload();
    } catch (err) {
        showToast("Clear failed: " + err.message, "error");
    }
}

// Helpers
function setRadioValue(name, val) {
    const radios = document.getElementsByName(name);
    radios.forEach(r => {
        if (r.value === val) {
            r.checked = true;
        }
    });
}
