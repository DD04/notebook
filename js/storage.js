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

let authChangeListeners = [];

async function connectSupabase(url, key) {
    try {
        // Dynamic ESM import of Supabase JS Client
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        supabase = createClient(url, key);
        
        // Register any pending auth state change listeners
        authChangeListeners.forEach(callback => {
            supabase.auth.onAuthStateChange(callback);
        });
        
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

export function onAuthStateChange(callback) {
    authChangeListeners.push(callback);
    if (supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
        return subscription;
    }
    return null;
}

export function isCloudMode() {
    return currentConfig.mode === 'supabase' && supabase !== null;
}

/* ==========================================================================
   AUTHENTICATION API
   ========================================================================== */
export async function signUp(username, password, nickname, question, answer) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    
    // 帳號統一轉小寫，不區分大小寫
    const usernameLower = username.trim().toLowerCase();
    
    // Check if username is already taken
    const existing = await findUserByUsername(usernameLower);
    if (existing) {
        throw new Error("該帳號名稱已被使用。");
    }

    const email = `${usernameLower}@notebook.local`;
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { 
                nickname, 
                username: usernameLower,
                recovery_question: question.trim(),
                recovery_answer: answer.trim().toLowerCase()  // 答案統一存小寫
            }
        }
    });
    if (error) throw error;
    return data.user;
}

export async function signIn(emailOrUsername, password) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    
    // 帳號統一轉小寫，不區分大小寫
    const usernameRaw = emailOrUsername.trim().toLowerCase();
    let email = usernameRaw;
    if (!email.includes('@')) {
        email = `${email}@notebook.local`;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        // 判斷是帳號不存在還是密碼錯誤
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
            // 查詢帳號是否存在於 profiles
            const existingUser = await findUserByUsername(usernameRaw);
            if (!existingUser) {
                const notFoundErr = new Error('查無此帳號，請先註冊。');
                notFoundErr.code = 'USER_NOT_FOUND';
                throw notFoundErr;
            } else {
                const wrongPwdErr = new Error('密碼錯誤，請重新輸入。');
                wrongPwdErr.code = 'WRONG_PASSWORD';
                throw wrongPwdErr;
            }
        }
        throw error;
    }
    return data.user;
}

export async function findUserByUsername(username) {
    if (!isCloudMode()) return null;
    // 帳號統一轉小寫再查詢
    // 注意：僅選取 anon/authenticated 被授權讀取的欄位（見 supabase_schema.sql），
    // email、recovery_question、recovery_answer_hash 一律無法透過此查詢取得。
    const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, username')
        .eq('username', username.trim().toLowerCase())
        .maybeSingle(); // Use maybeSingle to avoid PGRST116 throwing error when not found

    if (error || !data) return null;
    return data;
}

export async function getUserQuestion(username) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    // 帳號統一轉小寫
    const { data, error } = await supabase.rpc('get_user_question', {
        p_username: username.trim().toLowerCase()
    });
    if (error) throw error;
    return data;
}

export async function resetPasswordByQuestion(username, answer, newPassword) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    // 帳號與答案統一轉小寫，不區分大小寫
    const { data, error } = await supabase.rpc('reset_password_by_question', {
        p_username: username.trim().toLowerCase(),
        p_answer: answer.trim().toLowerCase(),
        p_new_password: newPassword
    });
    if (error) throw error;
    if (!data) {
        throw new Error("帳號或密保答案錯誤。");
    }
    return true;
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
    
    // Fetch custom profile details (nickname, superuser)
    const { data: profile } = await supabase
        .from('profiles')
        .select('nickname, superuser')
        .eq('id', data.user.id)
        .single();
        
    return {
        id: data.user.id,
        email: data.user.email,
        nickname: profile?.nickname || splitEmail(data.user.email),
        superuser: !!profile?.superuser
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

export async function deleteBudget(category, month) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
    const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('user_id', user.id)
        .eq('category', category)
        .eq('month', month);
    if (error) throw error;
    return true;
}

/* ==========================================================================
   GROUP LEDGER API
   ========================================================================== */
export async function getGroups() {
    if (!isCloudMode()) return [];
    const user = await getCurrentUser();
    if (!user) return [];

    // Derive membership from group_members (not the groups table's own RLS) so a group
    // never shows up unless the current user actually has a membership row in it.
    const { data, error } = await supabase
        .from('group_members')
        .select('groups(*)')
        .eq('user_id', user.id);
    if (error) throw error;

    return data
        .map(row => row.groups)
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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

export async function getPastGroupMembers(currentGroupId, currentUserId) {
    if (!isCloudMode()) return [];
    const { data, error } = await supabase
        .from('group_members')
        .select('nickname, user_id, group_id, profiles(username)')
        .order('joined_at', { ascending: false });
    if (error) return [];

    const currentGroupMemberIds = new Set(
        data.filter(m => m.group_id === currentGroupId).map(m => m.user_id)
    );

    const seen = new Set();
    return data.filter(m => {
        if (m.user_id === currentUserId) return false;
        if (currentGroupMemberIds.has(m.user_id)) return false;
        if (seen.has(m.user_id || m.nickname)) return false;
        seen.add(m.user_id || m.nickname);
        return true;
    });
}



export async function addGroupMember(groupId, username) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    
    // Require the target to be a real registered user
    const targetUser = await findUserByUsername(username);
    if (!targetUser) {
        throw new Error(`USER_NOT_FOUND:${username}`);
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

export async function removeGroupMember(groupId, memberId) {
    if (!isCloudMode()) throw new Error("Database connection required.");

    const { error, count } = await supabase
        .from('group_members')
        .delete({ count: 'exact' })
        .eq('id', memberId)
        .eq('group_id', groupId);

    if (error) throw error;
    if (!count) throw new Error("找不到成員資格，或權限不足導致無法移除。");
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
        .select('*, profiles(username, nickname)')
        .eq('group_id', groupId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function addGroupTransaction(groupId, tx) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const user = await getCurrentUser();
    if (!user) throw new Error("Authentication required.");
    
    // tx = { type: 'income'|'expense', amount: number, category: string, date: string, description: string, tags: string[] }
    const { data, error } = await supabase
        .from('group_transactions')
        .insert([{
            group_id: groupId,
            user_id: user.id,
            member_nickname: user.nickname,
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

export async function deleteGroupTransaction(groupId, txId) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    const { error } = await supabase
        .from('group_transactions')
        .delete()
        .eq('id', txId);
    if (error) throw error;
    return true;
}

export async function updateGroupTransaction(groupId, txId, updatedTx) {
    if (!isCloudMode()) throw new Error("Database connection required.");
    // updatedTx = { type: 'income'|'expense', amount: number, category: string, date: string, description: string, tags: string[] }
    const { data, error } = await supabase
        .from('group_transactions')
        .update({
            type: updatedTx.type,
            amount: parseFloat(updatedTx.amount),
            category: updatedTx.category,
            date: updatedTx.date,
            description: updatedTx.description || '',
            tags: updatedTx.tags || []
        })
        .eq('id', txId)
        .eq('group_id', groupId)
        .select();
    if (error) throw error;
    return data[0];
}

/* ==========================================================================
   BACKUP & RESET FUNCTIONS (Pure Supabase Cloud Sync)
   ========================================================================== */
export async function exportStateAsJSON() {
    if (!isCloudMode()) throw new Error("Database connection required.");
    
    // Fetch profiles - limited to the columns anon/authenticated are granted
    // (see supabase_schema.sql); email/recovery_question/recovery_answer_hash are
    // intentionally excluded from client-readable columns and won't appear here.
    const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, nickname, superuser, created_at');
    if (pErr) throw pErr;
    
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
        profiles: profiles,
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
        
        // 1. Import Profiles (One-to-One increment, no overwrite)
        if (data.profiles && Array.isArray(data.profiles)) {
            const { data: currentProfiles, error: pErr } = await supabase
                .from('profiles')
                .select('id');
            if (pErr) throw pErr;
            const currentProfileIds = new Set(currentProfiles.map(p => p.id));
            
            const newProfiles = data.profiles
                .filter(p => p.id && !currentProfileIds.has(p.id))
                .map(p => ({
                    id: p.id,
                    email: p.email || 'imported@local.user',
                    nickname: p.nickname || 'Imported User',
                    superuser: !!p.superuser,
                    created_at: p.created_at || new Date().toISOString()
                }));
                
            if (newProfiles.length > 0) {
                const { error: insErr } = await supabase
                    .from('profiles')
                    .insert(newProfiles);
                if (insErr) throw insErr;
            }
        }
        
        // Load profiles again to get all valid user IDs (including newly inserted ones)
        const { data: allProfiles, error: apErr } = await supabase
            .from('profiles')
            .select('id');
        if (apErr) throw apErr;
        const validUserIds = new Set(allProfiles.map(p => p.id));
        
        // Helper to get fallback/valid user_id
        const getValidUserId = (originalId) => {
            return (originalId && validUserIds.has(originalId)) ? originalId : user.id;
        };

        // 2. Import Personal Transactions (Increment, no overwrite)
        if (data.transactions && Array.isArray(data.transactions)) {
            const { data: currentTxs, error: tErr } = await supabase
                .from('transactions')
                .select('id');
            if (tErr) throw tErr;
            const currentTxIds = new Set(currentTxs.map(t => t.id));
            
            const newTxs = data.transactions
                .filter(t => t.id && !currentTxIds.has(t.id))
                .map(t => ({
                    id: t.id,
                    user_id: getValidUserId(t.user_id),
                    type: t.type,
                    amount: parseFloat(t.amount),
                    category: t.category,
                    date: t.date || new Date().toISOString().split('T')[0],
                    description: t.description || '',
                    tags: t.tags || [],
                    created_at: t.created_at || new Date().toISOString()
                }));
                
            if (newTxs.length > 0) {
                const { error: insErr } = await supabase
                    .from('transactions')
                    .insert(newTxs);
                if (insErr) throw insErr;
            }
        }
        
        // 3. Import Budgets (Increment, no overwrite)
        if (data.budgets && Array.isArray(data.budgets)) {
            const { data: currentBudgets, error: bErr } = await supabase
                .from('budgets')
                .select('user_id, category, month');
            if (bErr) throw bErr;
            
            const budgetKeys = new Set(currentBudgets.map(b => `${b.user_id}_${b.category}_${b.month}`));
            
            const newBudgets = data.budgets
                .filter(b => {
                    const targetUid = getValidUserId(b.user_id);
                    const key = `${targetUid}_${b.category}_${b.month}`;
                    return !budgetKeys.has(key);
                })
                .map(b => ({
                    user_id: getValidUserId(b.user_id),
                    category: b.category,
                    amount: parseFloat(b.amount),
                    month: b.month,
                    created_at: b.created_at || new Date().toISOString()
                }));
                
            if (newBudgets.length > 0) {
                const { error: insErr } = await supabase
                    .from('budgets')
                    .insert(newBudgets);
                if (insErr) throw insErr;
            }
        }
        
        // 4. Import Groups (Increment, no overwrite)
        if (data.groups && Array.isArray(data.groups)) {
            const { data: currentGroups, error: gErr } = await supabase
                .from('groups')
                .select('id');
            if (gErr) throw gErr;
            const currentGroupIds = new Set(currentGroups.map(g => g.id));
            
            for (const g of data.groups) {
                const isGroupExists = currentGroupIds.has(g.id);
                
                let targetGroupId = g.id;
                if (!isGroupExists) {
                    // Create group with original g.id
                    const { error: insGErr } = await supabase
                        .from('groups')
                        .insert([{
                            id: g.id,
                            name: g.name,
                            created_by: getValidUserId(g.created_by),
                            created_at: g.created_at || new Date().toISOString()
                        }]);
                    if (insGErr) throw insGErr;
                }
                
                // 4.1. Import Group Members
                if (g.members && Array.isArray(g.members)) {
                    const currentMembers = await getGroupMembers(targetGroupId);
                    // Match by user_id, or if null, nickname
                    const newMembers = g.members.filter(m => {
                        const targetUid = m.user_id ? getValidUserId(m.user_id) : null;
                        const isMatch = currentMembers.some(cm => {
                            if (targetUid && cm.user_id === targetUid) return true;
                            return cm.nickname.toLowerCase() === m.nickname.toLowerCase();
                        });
                        return !isMatch;
                    }).map(m => ({
                        group_id: targetGroupId,
                        user_id: m.user_id ? getValidUserId(m.user_id) : null,
                        nickname: m.nickname,
                        joined_at: m.joined_at || new Date().toISOString()
                    }));
                    
                    if (newMembers.length > 0) {
                        const { error: insMErr } = await supabase
                            .from('group_members')
                            .insert(newMembers);
                        if (insMErr) throw insMErr;
                    }
                }
                
                // 4.2. Import Group Transactions
                if (g.transactions && Array.isArray(g.transactions)) {
                    const currentGTxs = await getGroupTransactions(targetGroupId);
                    const currentGTxIds = new Set(currentGTxs.map(gt => gt.id));
                    
                    const newGTxs = g.transactions
                        .filter(gt => gt.id && !currentGTxIds.has(gt.id))
                        .map(gt => ({
                            id: gt.id,
                            group_id: targetGroupId,
                            user_id: gt.user_id ? getValidUserId(gt.user_id) : null,
                            member_nickname: gt.member_nickname,
                            type: gt.type,
                            amount: parseFloat(gt.amount),
                            category: gt.category,
                            date: gt.date || new Date().toISOString().split('T')[0],
                            description: gt.description || '',
                            tags: gt.tags || [],
                            created_at: gt.created_at || new Date().toISOString()
                        }));
                        
                    if (newGTxs.length > 0) {
                        const { error: insGTErr } = await supabase
                            .from('group_transactions')
                            .insert(newGTxs);
                        if (insGTErr) throw insGTErr;
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

export async function leaveGroup(groupId) {
    if (!supabase) throw new Error("Database not connected");
    const user = supabase.auth.user ? supabase.auth.user() : (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("User not logged in");

    const { error, count } = await supabase
        .from('group_members')
        .delete({ count: 'exact' })
        .eq('group_id', groupId)
        .eq('user_id', user.id);

    if (error) throw error;
    if (!count) throw new Error("找不到成員資格，或權限不足導致無法移除。");
}

export async function updateProfile(newNickname, newPassword) {
    if (!supabase) throw new Error("Database not connected");
    const user = supabase.auth.user ? supabase.auth.user() : (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("User not logged in");

    if (newPassword) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwdError) throw pwdError;
    }

    if (newNickname) {
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ nickname: newNickname })
            .eq('id', user.id);
            
        if (profileError) throw profileError;

        const { error: authError } = await supabase.auth.updateUser({
            data: { nickname: newNickname }
        });
        if (authError) throw authError;
    }
}
