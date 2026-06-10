// js/storage.js - Unified Data Storage Access Layer

let supabase = null;
let currentConfig = {
    mode: 'local',
    sbUrl: '',
    sbKey: ''
};

// Default personal categories
export const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Housing', 'Salary', 'Investments', 'Other'];

// Initialize Storage Config
export async function initStorage() {
    const savedConfig = localStorage.getItem('notebook_config');
    if (savedConfig) {
        try {
            currentConfig = JSON.parse(savedConfig);
        } catch (e) {
            console.error("Failed to parse storage config", e);
        }
    }
    
    if (currentConfig.mode === 'supabase' && currentConfig.sbUrl && currentConfig.sbKey) {
        try {
            await connectSupabase(currentConfig.sbUrl, currentConfig.sbKey);
        } catch (err) {
            console.error("Supabase connection failed on init, falling back to Local Mode", err);
            currentConfig.mode = 'local';
        }
    }
    return currentConfig;
}

export function getConfig() {
    return currentConfig;
}

export async function saveConfig(newConfig) {
    currentConfig = { ...currentConfig, ...newConfig };
    localStorage.setItem('notebook_config', JSON.stringify(currentConfig));
    
    if (currentConfig.mode === 'supabase' && currentConfig.sbUrl && currentConfig.sbKey) {
        return await connectSupabase(currentConfig.sbUrl, currentConfig.sbKey);
    } else {
        supabase = null;
        return true;
    }
}

async function connectSupabase(url, key) {
    try {
        // Dynamic ESM import of Supabase JS Client
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        supabase = createClient(url, key);
        
        // Quick verification ping to check credentials
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error && error.code !== 'PGRST116') { // PGRST116 just means no rows, which is fine
            throw error;
        }
        return true;
    } catch (e) {
        supabase = null;
        throw new Error("Invalid Supabase connection parameters: " + e.message);
    }
}

export function isCloudMode() {
    return currentConfig.mode === 'supabase' && supabase !== null;
}

// Helper: Get active Supabase Auth User ID
function getAuthUid() {
    if (!isCloudMode()) return null;
    const session = supabase.auth.getSession();
    return session?.data?.session?.user?.id || null;
}

/* ==========================================================================
   AUTHENTICATION API
   ========================================================================== */
export async function signUp(email, password, nickname) {
    if (isCloudMode()) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { nickname }
            }
        });
        if (error) throw error;
        return data.user;
    } else {
        // Local Mode Mock Auth
        const users = JSON.parse(localStorage.getItem('notebook_local_users') || '[]');
        if (users.some(u => u.email === email)) {
            throw new Error("User already exists locally!");
        }
        const newUser = { id: 'local-' + Date.now(), email, nickname };
        users.push(newUser);
        localStorage.setItem('notebook_local_users', JSON.stringify(users));
        localStorage.setItem('notebook_local_session', JSON.stringify(newUser));
        return newUser;
    }
}

export async function signIn(email, password) {
    if (isCloudMode()) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data.user;
    } else {
        // Local Mode Mock Auth
        const users = JSON.parse(localStorage.getItem('notebook_local_users') || '[]');
        const user = users.find(u => u.email === email);
        if (!user) {
            throw new Error("Invalid email or password.");
        }
        localStorage.setItem('notebook_local_session', JSON.stringify(user));
        return user;
    }
}

export async function signOut() {
    if (isCloudMode()) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } else {
        localStorage.removeItem('notebook_local_session');
    }
}

export async function getCurrentUser() {
    if (isCloudMode()) {
        const { data } = await supabase.auth.getUser();
        if (!data?.user) return null;
        
        // Fetch custom profile details (nickname)
        const { data: profile } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', data.user.id)
            .single();
            
        return {
            id: data.user.id,
            email: data.user.email,
            nickname: profile?.nickname || splitEmail(data.user.email)
        };
    } else {
        const session = localStorage.getItem('notebook_local_session');
        return session ? JSON.parse(session) : null;
    }
}

function splitEmail(email) {
    return email ? email.split('@')[0] : 'User';
}

/* ==========================================================================
   PERSONAL TRANSACTIONS API
   ========================================================================== */
export async function getTransactions() {
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    } else {
        const txs = localStorage.getItem('notebook_transactions');
        return txs ? JSON.parse(txs) : [];
    }
}

export async function addTransaction(tx) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('transactions')
            .insert([{
                user_id: user.id,
                type: tx.type,
                amount: parseFloat(tx.amount),
                category: tx.category,
                date: tx.date,
                description: tx.description || '',
                tags: tx.tags || []
            }])
            .select();
        if (error) throw error;
        return data[0];
    } else {
        const txs = await getTransactions();
        const newTx = {
            id: 'tx-' + Date.now() + Math.random().toString(36).substr(2, 4),
            user_id: user.id,
            type: tx.type,
            amount: parseFloat(tx.amount),
            category: tx.category,
            date: tx.date,
            description: tx.description || '',
            tags: tx.tags || [],
            created_at: new Date().toISOString()
        };
        txs.unshift(newTx);
        localStorage.setItem('notebook_transactions', JSON.stringify(txs));
        return newTx;
    }
}

export async function updateTransaction(id, updatedTx) {
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('transactions')
            .update({
                type: updatedTx.type,
                amount: parseFloat(updatedTx.amount),
                category: updatedTx.category,
                date: updatedTx.date,
                description: updatedTx.description || '',
                tags: updatedTx.tags || []
            })
            .eq('id', id)
            .select();
        if (error) throw error;
        return data[0];
    } else {
        const txs = await getTransactions();
        const index = txs.findIndex(t => t.id === id);
        if (index === -1) throw new Error("Transaction not found.");
        
        txs[index] = {
            ...txs[index],
            type: updatedTx.type,
            amount: parseFloat(updatedTx.amount),
            category: updatedTx.category,
            date: updatedTx.date,
            description: updatedTx.description || '',
            tags: updatedTx.tags || []
        };
        localStorage.setItem('notebook_transactions', JSON.stringify(txs));
        return txs[index];
    }
}

export async function deleteTransaction(id) {
    if (isCloudMode()) {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    } else {
        let txs = await getTransactions();
        txs = txs.filter(t => t.id !== id);
        localStorage.setItem('notebook_transactions', JSON.stringify(txs));
        return true;
    }
}

/* ==========================================================================
   BUDGETS API
   ========================================================================== */
export async function getBudgets(month) { // month: YYYY-MM
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('budgets')
            .select('*')
            .eq('month', month);
        if (error) throw error;
        return data;
    } else {
        const allBudgets = JSON.parse(localStorage.getItem('notebook_budgets') || '[]');
        return allBudgets.filter(b => b.month === month);
    }
}

export async function setBudget(category, amount, month) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
    if (isCloudMode()) {
        // Upsert budget limit in Supabase
        const { data, error } = await supabase
            .from('budgets')
            .upsert({
                user_id: user.id,
                category,
                amount: parseFloat(amount),
                month
            }, { onConflict: 'user_id,category,month' })
            .select();
        if (error) throw error;
        return data[0];
    } else {
        const allBudgets = JSON.parse(localStorage.getItem('notebook_budgets') || '[]');
        const index = allBudgets.findIndex(b => b.category === category && b.month === month);
        
        const newBudget = {
            id: 'b-' + Date.now(),
            user_id: user.id,
            category,
            amount: parseFloat(amount),
            month
        };
        
        if (index > -1) {
            allBudgets[index] = newBudget;
        } else {
            allBudgets.push(newBudget);
        }
        localStorage.setItem('notebook_budgets', JSON.stringify(allBudgets));
        return newBudget;
    }
}

/* ==========================================================================
   GROUP LEDGER API
   ========================================================================== */
export async function getGroups() {
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('groups')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    } else {
        const groups = localStorage.getItem('notebook_groups');
        return groups ? JSON.parse(groups) : [];
    }
}

export async function createGroup(name) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
    if (isCloudMode()) {
        // 1. Insert Group
        const { data: group, error: gError } = await supabase
            .from('groups')
            .insert([{ name, created_by: user.id }])
            .select()
            .single();
        if (gError) throw gError;
        
        // 2. Automatically add creator as member
        const { error: mError } = await supabase
            .from('group_members')
            .insert([{
                group_id: group.id,
                user_id: user.id,
                nickname: user.nickname || splitEmail(user.email)
            }]);
        if (mError) throw mError;
        
        return group;
    } else {
        const groups = await getGroups();
        const newGroup = {
            id: 'group-' + Date.now(),
            name,
            created_by: user.id,
            created_at: new Date().toISOString(),
            members: [{ id: 'gm-creator', nickname: user.nickname || 'You' }],
            transactions: []
        };
        groups.unshift(newGroup);
        localStorage.setItem('notebook_groups', JSON.stringify(groups));
        return newGroup;
    }
}

export async function getGroupMembers(groupId) {
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('group_members')
            .select('*')
            .eq('group_id', groupId)
            .order('joined_at', { ascending: true });
        if (error) throw error;
        return data;
    } else {
        const groups = await getGroups();
        const group = groups.find(g => g.id === groupId);
        return group ? group.members : [];
    }
}

export async function addGroupMember(groupId, nickname) {
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('group_members')
            .insert([{ group_id: groupId, nickname }])
            .select();
        if (error) throw error;
        return data[0];
    } else {
        const groups = await getGroups();
        const index = groups.findIndex(g => g.id === groupId);
        if (index === -1) throw new Error("Group not found.");
        
        if (groups[index].members.some(m => m.nickname.toLowerCase() === nickname.toLowerCase())) {
            throw new Error("Member nickname already exists in group.");
        }
        
        const newMember = {
            id: 'gm-' + Date.now(),
            nickname
        };
        groups[index].members.push(newMember);
        localStorage.setItem('notebook_groups', JSON.stringify(groups));
        return newMember;
    }
}

export async function getGroupTransactions(groupId) {
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('group_transactions')
            .select('*')
            .eq('group_id', groupId)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    } else {
        const groups = await getGroups();
        const group = groups.find(g => g.id === groupId);
        return group ? group.transactions || [] : [];
    }
}

export async function addGroupTransaction(groupId, tx) {
    // tx = { paid_by: string, amount: num, category: string, date: YYYY-MM-DD, description: string, splits: [ { nickname, amount } ] }
    if (isCloudMode()) {
        const { data, error } = await supabase
            .from('group_transactions')
            .insert([{
                group_id: groupId,
                paid_by: tx.paid_by,
                amount: parseFloat(tx.amount),
                category: tx.category,
                date: tx.date,
                description: tx.description,
                splits: tx.splits // array of { nickname, amount }
            }])
            .select();
        if (error) throw error;
        return data[0];
    } else {
        const groups = await getGroups();
        const index = groups.findIndex(g => g.id === groupId);
        if (index === -1) throw new Error("Group not found.");
        
        const newTx = {
            id: 'gtx-' + Date.now(),
            group_id: groupId,
            paid_by: tx.paid_by,
            amount: parseFloat(tx.amount),
            category: tx.category,
            date: tx.date,
            description: tx.description,
            splits: tx.splits,
            created_at: new Date().toISOString()
        };
        
        if (!groups[index].transactions) groups[index].transactions = [];
        groups[index].transactions.unshift(newTx);
        localStorage.setItem('notebook_groups', JSON.stringify(groups));
        return newTx;
    }
}

export async function deleteGroupTransaction(groupId, txId) {
    if (isCloudMode()) {
        const { error } = await supabase
            .from('group_transactions')
            .delete()
            .eq('id', txId);
        if (error) throw error;
        return true;
    } else {
        const groups = await getGroups();
        const gIndex = groups.findIndex(g => g.id === groupId);
        if (gIndex === -1) throw new Error("Group not found.");
        
        groups[gIndex].transactions = (groups[gIndex].transactions || []).filter(t => t.id !== txId);
        localStorage.setItem('notebook_groups', JSON.stringify(groups));
        return true;
    }
}

/* ==========================================================================
   BACKUP & RESET FUNCTIONS
   ========================================================================== */
export function exportStateAsJSON() {
    const data = {
        transactions: JSON.parse(localStorage.getItem('notebook_transactions') || '[]'),
        budgets: JSON.parse(localStorage.getItem('notebook_budgets') || '[]'),
        groups: JSON.parse(localStorage.getItem('notebook_groups') || '[]'),
        categories: DEFAULT_CATEGORIES
    };
    return JSON.stringify(data, null, 2);
}

export function importStateFromJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.transactions && Array.isArray(data.transactions)) {
            localStorage.setItem('notebook_transactions', JSON.stringify(data.transactions));
        }
        if (data.budgets && Array.isArray(data.budgets)) {
            localStorage.setItem('notebook_budgets', JSON.stringify(data.budgets));
        }
        if (data.groups && Array.isArray(data.groups)) {
            localStorage.setItem('notebook_groups', JSON.stringify(data.groups));
        }
        return true;
    } catch (e) {
        throw new Error("Invalid backup JSON structure: " + e.message);
    }
}

export function clearLocalStorageState() {
    localStorage.removeItem('notebook_transactions');
    localStorage.removeItem('notebook_budgets');
    localStorage.removeItem('notebook_groups');
    localStorage.removeItem('notebook_local_users');
    localStorage.removeItem('notebook_local_session');
}
