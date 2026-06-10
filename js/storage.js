// js/storage.js - Unified Data Storage Access Layer (Pure Supabase Mode)
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let supabase = null;
let currentConfig = {
    mode: 'unconfigured', // 'unconfigured' or 'supabase'
    sbUrl: '',
    sbKey: ''
};

// Default personal categories
export const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Housing', 'Salary', 'Investments', 'Other'];

// Initialize Storage Config
export async function initStorage() {
    // 1. Try to read from config.js first
    if (SUPABASE_URL && SUPABASE_KEY) {
        currentConfig.sbUrl = SUPABASE_URL;
        currentConfig.sbKey = SUPABASE_KEY;
        currentConfig.mode = 'supabase';
    } else {
        // 2. Fall back to localStorage configuration
        const savedConfig = localStorage.getItem('notebook_config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                currentConfig.sbUrl = parsed.sbUrl || '';
                currentConfig.sbKey = parsed.sbKey || '';
                currentConfig.mode = parsed.sbUrl && parsed.sbKey ? 'supabase' : 'unconfigured';
            } catch (e) {
                console.error("Failed to parse storage config", e);
            }
        }
    }
    
    if (currentConfig.mode === 'supabase' && currentConfig.sbUrl && currentConfig.sbKey) {
        try {
            await connectSupabase(currentConfig.sbUrl, currentConfig.sbKey);
        } catch (err) {
            console.error("Supabase connection failed on init", err);
            currentConfig.mode = 'unconfigured';
            supabase = null;
        }
    }
    return currentConfig;
}

export function getConfig() {
    return currentConfig;
}

export async function saveConfig(newConfig) {
    // Save to current config
    currentConfig = { ...currentConfig, ...newConfig };
    
    // Save to localStorage so it persists in client
    localStorage.setItem('notebook_config', JSON.stringify({
        sbUrl: currentConfig.sbUrl,
        sbKey: currentConfig.sbKey
    }));
    
    if (currentConfig.sbUrl && currentConfig.sbKey) {
        currentConfig.mode = 'supabase';
        return await connectSupabase(currentConfig.sbUrl, currentConfig.sbKey);
    } else {
        currentConfig.mode = 'unconfigured';
        supabase = null;
        return false;
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
        currentConfig.mode = 'unconfigured';
        throw new Error("Invalid Supabase connection parameters: " + e.message);
    }
}

export function isCloudMode() {
    return currentConfig.mode === 'supabase' && supabase !== null;
}

/* ==========================================================================
   AUTHENTICATION API
   ========================================================================== */
export async function signUp(email, password, nickname) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { nickname }
        }
    });
    if (error) throw error;
    return data.user;
}

export async function signIn(email, password) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return data.user;
}

export async function signOut() {
    if (!isCloudMode()) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getCurrentUser() {
    if (!isCloudMode()) return null;
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
}

function splitEmail(email) {
    return email ? email.split('@')[0] : 'User';
}

/* ==========================================================================
   PERSONAL TRANSACTIONS API
   ========================================================================== */
export async function getTransactions() {
    if (!isCloudMode()) return [];
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function addTransaction(tx) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
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
}

export async function updateTransaction(id, updatedTx) {
    if (!isCloudMode()) throw new Error("Database connection required.");
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
}

export async function deleteTransaction(id) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}

/* ==========================================================================
   BUDGETS API
   ========================================================================== */
export async function getBudgets(month) { // month: YYYY-MM
    if (!isCloudMode()) return [];
    const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('month', month);
    if (error) throw error;
    return data;
}

export async function setBudget(category, amount, month) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
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
}

/* ==========================================================================
   GROUP LEDGER API
   ========================================================================== */
export async function getGroups() {
    if (!isCloudMode()) return [];
    const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function createGroup(name) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
    // 1. Insert Group
    const { data: group, error: gError } = await supabase
        .from('groups')
        .insert([{ name, created_by: user.id }])
        .select()
        .single();
    if (gError) throw gError;
    
    // 2. Automatically add creator as member (with their real user_id and nickname)
    const { error: mError } = await supabase
        .from('group_members')
        .insert([{
            group_id: group.id,
            user_id: user.id,
            nickname: user.nickname || splitEmail(user.email)
        }]);
    if (mError) throw mError;
    
    return group;
}

export async function getGroupMembers(groupId) {
    if (!isCloudMode()) return [];
    const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });
    if (error) throw error;
    return data;
}

// Look up a registered user by their profile nickname
export async function findUserByNickname(nickname) {
    if (!isCloudMode()) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, email')
        .eq('nickname', nickname)
        .single();
    if (error || !data) return null;
    return data;
}

export async function addGroupMember(groupId, nickname) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    
    // Require the target to be a real registered user
    const targetUser = await findUserByNickname(nickname);
    if (!targetUser) {
        throw new Error(`USER_NOT_FOUND:${nickname}`);
    }
    
    // Check if already a member (by user_id)
    const members = await getGroupMembers(groupId);
    if (members.some(m => m.user_id === targetUser.id)) {
        throw new Error('ALREADY_MEMBER');
    }
    
    const { data, error } = await supabase
        .from('group_members')
        .insert([{ group_id: groupId, user_id: targetUser.id, nickname: targetUser.nickname }])
        .select();
    if (error) throw error;
    return data[0];
}

export async function deleteGroup(groupId) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);
    if (error) throw error;
    return true;
}

export async function getGroupTransactions(groupId) {
    if (!isCloudMode()) return [];
    const { data, error } = await supabase
        .from('group_transactions')
        .select('*')
        .eq('group_id', groupId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function addGroupTransaction(groupId, tx) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    // tx = { paid_by: string, amount: num, category: string, date: YYYY-MM-DD, description: string, splits: [ { nickname, amount } ] }
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
}

export async function deleteGroupTransaction(groupId, txId) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const { error } = await supabase
        .from('group_transactions')
        .delete()
        .eq('id', txId);
    if (error) throw error;
    return true;
}

/* ==========================================================================
   BACKUP & RESET FUNCTIONS (Pure Supabase Cloud Sync)
   ========================================================================== */
export async function exportStateAsJSON() {
    if (!isCloudMode()) throw new Error("Database connection required.");
    
    const txs = await getTransactions();
    
    // Fetch all budgets
    const { data: budgets, error: bErr } = await supabase
        .from('budgets')
        .select('*');
    if (bErr) throw bErr;
    
    // Fetch all groups with their members and transactions
    const groupsList = await getGroups();
    const fullGroups = [];
    
    for (const g of groupsList) {
        const members = await getGroupMembers(g.id);
        const transactions = await getGroupTransactions(g.id);
        fullGroups.push({
            ...g,
            members,
            transactions
        });
    }
    
    const data = {
        transactions: txs,
        budgets: budgets,
        groups: fullGroups,
        categories: DEFAULT_CATEGORIES
    };
    return JSON.stringify(data, null, 2);
}

export async function importStateFromJSON(jsonString) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
    try {
        const data = JSON.parse(jsonString);
        
        // 1. Import Personal Transactions
        if (data.transactions && Array.isArray(data.transactions)) {
            const dbTxs = data.transactions.map(t => ({
                user_id: user.id,
                type: t.type,
                amount: parseFloat(t.amount),
                category: t.category,
                date: t.date || new Date().toISOString().split('T')[0],
                description: t.description || '',
                tags: t.tags || []
            }));
            
            if (dbTxs.length > 0) {
                const { error } = await supabase.from('transactions').insert(dbTxs);
                if (error) throw error;
            }
        }
        
        // 2. Import Budgets
        if (data.budgets && Array.isArray(data.budgets)) {
            for (const b of data.budgets) {
                const { error } = await supabase.from('budgets').upsert({
                    user_id: user.id,
                    category: b.category,
                    amount: parseFloat(b.amount),
                    month: b.month
                }, { onConflict: 'user_id,category,month' });
                if (error) throw error;
            }
        }
        
        // 3. Import Groups
        if (data.groups && Array.isArray(data.groups)) {
            for (const g of data.groups) {
                // Insert group
                const { data: newGroup, error: gError } = await supabase
                    .from('groups')
                    .insert([{ name: g.name, created_by: user.id }])
                    .select()
                    .single();
                if (gError) throw gError;
                
                // Add members (find unique nicknames)
                const nicknames = Array.from(new Set(g.members.map(m => m.nickname)));
                const memberInsert = nicknames.map(nick => {
                    const isSelf = nick.toLowerCase() === user.nickname.toLowerCase();
                    return {
                        group_id: newGroup.id,
                        user_id: isSelf ? user.id : null,
                        nickname: nick
                    };
                });
                
                if (memberInsert.length > 0) {
                    const { error: mError } = await supabase
                        .from('group_members')
                        .insert(memberInsert);
                    if (mError) throw mError;
                }
                
                // Add group transactions
                if (g.transactions && Array.isArray(g.transactions)) {
                    const groupTxs = g.transactions.map(gt => {
                        const splits = gt.splits || [];
                        return {
                            group_id: newGroup.id,
                            paid_by: gt.paid_by,
                            amount: parseFloat(gt.amount),
                            category: gt.category || 'Other',
                            date: gt.date || new Date().toISOString().split('T')[0],
                            description: gt.description || '',
                            splits: splits
                        };
                    });
                    
                    if (groupTxs.length > 0) {
                        const { error: gtError } = await supabase
                            .from('group_transactions')
                            .insert(groupTxs);
                        if (gtError) throw gtError;
                    }
                }
            }
        }
        return true;
    } catch (e) {
        throw new Error("Invalid backup JSON structure or import failed: " + e.message);
    }
}

export function clearLocalStorageState() {
    localStorage.removeItem('notebook_config');
}
