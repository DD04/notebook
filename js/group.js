// js/group.js - Group shared bookkeeping ledger logic
import * as storage from './storage.js';
import { formatCurrency, escapeHTML, updateCategoryDropdown } from './dashboard.js';
import { showToast } from './app.js';
import { getText, getLocale } from './i18n.js';

// DOM elements
const groupsList = document.getElementById('groupsList');
const createGroupBtn = document.getElementById('createGroupBtn');
const groupMembersSection = document.getElementById('groupMembersSection');
const groupMembersList = document.getElementById('groupMembersList');
const addMemberBtn = document.getElementById('addMemberBtn');

const noGroupSelected = document.getElementById('noGroupSelected');
const groupActiveDetails = document.getElementById('groupActiveDetails');
const activeGroupName = document.getElementById('activeGroupName');
const activeGroupMeta = document.getElementById('activeGroupMeta');
const addGroupTxBtn = document.getElementById('addGroupTxBtn');

const groupTxTableBody = document.getElementById('groupTxTableBody');

// Modals DOM
const groupModal = document.getElementById('groupModal');
const groupModalClose = document.getElementById('groupModalClose');
const groupModalCancel = document.getElementById('groupModalCancel');
const groupForm = document.getElementById('groupForm');
const groupNameInput = document.getElementById('groupName');

const memberModal = document.getElementById('memberModal');
const memberModalClose = document.getElementById('memberModalClose');
const memberModalCancel = document.getElementById('memberModalCancel');
const memberForm = document.getElementById('memberForm');
const memberNicknameInput = document.getElementById('memberNickname');

const groupTxModal = document.getElementById('groupTxModal');
const groupTxModalTitle = document.getElementById('groupTxModalTitle');
const groupTxModalClose = document.getElementById('groupTxModalClose');
const groupTxModalCancel = document.getElementById('groupTxModalCancel');
const groupTxForm = document.getElementById('groupTxForm');
const gtxId = document.getElementById('gtxId');
const gtxType = document.getElementById('gtxType');
const gtxAmount = document.getElementById('gtxAmount');
const gtxCategory = document.getElementById('gtxCategory');
const gtxDate = document.getElementById('gtxDate');
const gtxDescription = document.getElementById('gtxDescription');
const gtxTags = document.getElementById('gtxTags');

// State
let groups = [];
let activeGroup = null;
let activeMembers = [];
let activeTransactions = [];

// Current authenticated user
let currentUserId = null;
let currentUserNickname = null;
let isGroupCreator = false; // Is current user the creator of the active group?

// Called by app.js after login/session restore
export function setCurrentUser(user) {
    currentUserId = user ? user.id : null;
    currentUserNickname = user ? user.nickname : null;
    isGroupCreator = false; // Reset until a group is selected
}

export function initGroups() {
    // Group Modal
    createGroupBtn.addEventListener('click', () => showModal(groupModal));
    groupModalClose.addEventListener('click', () => hideModal(groupModal));
    groupModalCancel.addEventListener('click', () => hideModal(groupModal));
    groupForm.addEventListener('submit', handleCreateGroup);
    groupModal.addEventListener('click', (e) => {
        if (e.target === groupModal) hideModal(groupModal);
    });

    // Member Modal (only creator can open - button visibility controlled in renderMembersList)
    addMemberBtn.addEventListener('click', () => showModal(memberModal));
    memberModalClose.addEventListener('click', () => hideModal(memberModal));
    memberModalCancel.addEventListener('click', () => hideModal(memberModal));
    memberForm.addEventListener('submit', handleAddMember);
    memberModal.addEventListener('click', (e) => {
        if (e.target === memberModal) hideModal(memberModal);
    });

    // Group Transaction Modal (any member can open)
    addGroupTxBtn.addEventListener('click', () => showGroupTxModal());
    groupTxModalClose.addEventListener('click', () => hideModal(groupTxModal));
    groupTxModalCancel.addEventListener('click', () => hideModal(groupTxModal));
    groupTxForm.addEventListener('submit', handleGroupTxSubmit);
    groupTxModal.addEventListener('click', (e) => {
        if (e.target === groupTxModal) hideModal(groupTxModal);
    });
    
    // Type change dynamic categories update
    gtxType.addEventListener('change', () => updateCategoryDropdown(gtxType, gtxCategory));
    
    // Delete group (only creator sees this button)
    const deleteGroupBtn = document.getElementById('deleteGroupBtn');
    if (deleteGroupBtn) {
        deleteGroupBtn.addEventListener('click', handleDeleteGroup);
    }
}

function showModal(modalEl) {
    modalEl.classList.add('active');
}

function hideModal(modalEl) {
    modalEl.classList.remove('active');
}

export async function refreshGroups() {
    try {
        groups = await storage.getGroups();
        renderGroupsList();
        
        if (activeGroup) {
            // Find updated reference
            const updated = groups.find(g => g.id === activeGroup.id);
            if (updated) {
                await selectGroup(updated);
            } else {
                deselectGroup();
            }
        } else {
            deselectGroup();
        }
    } catch (e) {
        console.error("Failed to load groups list", e);
    }
}

function deselectGroup() {
    activeGroup = null;
    noGroupSelected.classList.remove('d-none');
    groupActiveDetails.classList.add('d-none');
    groupMembersSection.classList.add('d-none');
}

function renderGroupsList() {
    groupsList.innerHTML = '';
    
    if (groups.length === 0) {
        groupsList.innerHTML = `<p class="text-muted" style="font-size: 13px; text-align: center; padding: 12px 0;">${getText('group_empty_list')}</p>`;
        return;
    }
    
    groups.forEach(g => {
        const item = document.createElement('div');
        item.className = 'group-item';
        if (activeGroup && g.id === activeGroup.id) {
            item.classList.add('active');
        }
        
        const isCreator = g.created_by === currentUserId;
        const creatorBadge = isCreator 
            ? `<span class="group-creator-badge">${getText('group_creator_badge')}</span>` 
            : '';
        
        item.innerHTML = `
            <div class="group-item-info">
                <span class="group-item-name">${escapeHTML(g.name)}</span>
                ${creatorBadge}
            </div>
            <span class="group-item-count"><i data-lucide="chevron-right" style="width:12px; height:12px;"></i></span>
        `;
        
        item.addEventListener('click', () => selectGroup(g));
        groupsList.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

async function selectGroup(group) {
    activeGroup = group;
    isGroupCreator = currentUserId && group.created_by === currentUserId;
    
    renderGroupsList(); // Re-render to highlight active
    
    noGroupSelected.classList.add('d-none');
    groupActiveDetails.classList.remove('d-none');
    groupMembersSection.classList.remove('d-none');
    
    activeGroupName.textContent = group.name;
    const locale = getLocale() === 'zh' ? 'zh-TW' : 'en-US';
    const dateStr = new Date(group.created_at).toLocaleDateString(locale);
    const createdLabel = getText('group_created_on') || '建立於';
    activeGroupMeta.textContent = `${createdLabel} ${dateStr}`;
    
    // Show delete group button only for creator
    const deleteGroupBtn = document.getElementById('deleteGroupBtn');
    if (deleteGroupBtn) {
        deleteGroupBtn.style.display = isGroupCreator ? '' : 'none';
    }
    
    // Fetch members and transactions
    activeMembers = await storage.getGroupMembers(group.id);
    activeTransactions = await storage.getGroupTransactions(group.id);
    
    renderMembersList();
    renderGroupSummaryCards();
    renderGroupTransactions();
}

function renderMembersList() {
    groupMembersList.innerHTML = '';
    
    // Only show the add member button if current user is the group creator
    if (addMemberBtn) {
        addMemberBtn.style.display = isGroupCreator ? '' : 'none';
    }
    
    activeMembers.forEach(m => {
        const item = document.createElement('div');
        item.className = 'member-item';
        const isCreatorMember = m.user_id === activeGroup?.created_by;
        item.innerHTML = `
            <span>
                <i data-lucide="user" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: middle; color:var(--text-muted);"></i>
                ${escapeHTML(m.nickname)}
                ${isCreatorMember ? `<span style="font-size:10px; color:var(--primary); margin-left:4px;">(${getText('group_creator_badge')})</span>` : ''}
            </span>
        `;
        groupMembersList.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

function renderGroupSummaryCards() {
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    activeTransactions.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'income') {
            totalIncome += amount;
            incomeCount++;
        } else {
            totalExpense += amount;
            expenseCount++;
        }
    });

    const netBalance = totalIncome - totalExpense;

    const groupNetBalanceEl = document.getElementById('groupNetBalance');
    const groupTotalIncomeEl = document.getElementById('groupTotalIncome');
    const groupTotalExpensesEl = document.getElementById('groupTotalExpenses');
    const groupIncomeCountEl = document.getElementById('groupIncomeCount');
    const groupExpenseCountEl = document.getElementById('groupExpenseCount');

    if (groupNetBalanceEl) {
        groupNetBalanceEl.textContent = formatCurrency(netBalance);
        if (netBalance >= 0) {
            groupNetBalanceEl.className = 'card-amount';
        } else {
            groupNetBalanceEl.className = 'card-amount text-error';
        }
    }
    if (groupTotalIncomeEl) groupTotalIncomeEl.textContent = formatCurrency(totalIncome);
    if (groupTotalExpensesEl) groupTotalExpensesEl.textContent = formatCurrency(totalExpense);
    
    if (groupIncomeCountEl) {
        groupIncomeCountEl.textContent = `${incomeCount} ${getText('group_income_count') || '筆收入交易'}`;
    }
    if (groupExpenseCountEl) {
        groupExpenseCountEl.textContent = `${expenseCount} ${getText('group_expense_count') || '筆支出交易'}`;
    }
}

function renderGroupTransactions() {
    groupTxTableBody.innerHTML = '';
    
    if (activeTransactions.length === 0) {
        groupTxTableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="8">
                    <div class="empty-state" style="padding: 24px 0;">
                        <i data-lucide="receipt"></i>
                        <p>${getText('group_empty_ledger')}</p>
                    </div>
                </td>
            </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }
    
    activeTransactions.forEach(t => {
        const row = document.createElement('tr');
        row.style.animation = 'fadeIn 0.25s ease-out';
        
        // Tags rendering
        let tagsHtml = '';
        if (t.tags && Array.isArray(t.tags) && t.tags.length > 0) {
            t.tags.forEach(tag => {
                tagsHtml += `<span class="tag-badge" style="background: rgba(99, 102, 241, 0.08); color: var(--primary); margin-right: 4px; font-size: 11px;">${escapeHTML(tag)}</span>`;
            });
        }
        
        const isIncome = t.type === 'income';
        const typeLabel = isIncome ? getText('db_income_type') : getText('db_expense_type');
        const typeBadgeStyle = isIncome
            ? 'background: rgba(16, 185, 129, 0.1); color: var(--success);'
            : 'background: rgba(239, 68, 68, 0.1); color: var(--error);';
            
        const amountDisplay = isIncome ? `+${formatCurrency(t.amount)}` : `-${formatCurrency(t.amount)}`;
        const amountStyle = isIncome ? 'color: var(--success);' : 'color: var(--text-primary);';

        // Check permission to modify / delete (Group Creator or Transaction Owner)
        const isCreatorOrOwner = isGroupCreator || (currentUserId && t.user_id === currentUserId);
        
        const editBtn = isCreatorOrOwner
            ? `<button class="action-btn action-btn-edit" data-id="${t.id}" title="${getText('modal_edit_tx')}"><i data-lucide="edit-3"></i></button>`
            : `<button class="action-btn action-btn-edit" style="opacity: 0.2; cursor: not-allowed;" disabled><i data-lucide="edit-3"></i></button>`;
            
        const deleteBtn = isCreatorOrOwner 
            ? `<button class="action-btn action-btn-delete" data-id="${t.id}" title="${getText('confirm_delete_bill')}"><i data-lucide="trash-2"></i></button>`
            : `<button class="action-btn action-btn-delete" style="opacity: 0.2; cursor: not-allowed;" disabled><i data-lucide="trash-2"></i></button>`;
            
        row.innerHTML = `
            <tr>
                <td>${t.date}</td>
                <td style="font-weight:600;">${escapeHTML(t.member_nickname || 'User')}</td>
                <td><span class="tag-badge" style="${typeBadgeStyle}">${typeLabel}</span></td>
                <td>${escapeHTML(t.description)}</td>
                <td><span class="tag-badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted);">${getText('cat_' + t.category)}</span></td>
                <td>${tagsHtml}</td>
                <td class="text-right" style="font-weight:700; font-family: 'Outfit'; ${amountStyle}">
                    ${amountDisplay}
                </td>
                <td>
                    <div class="action-btns">
                        ${editBtn}
                        ${deleteBtn}
                    </div>
                </td>
            </tr>
        `;
        
        if (isCreatorOrOwner) {
            row.querySelector('.action-btn-edit').addEventListener('click', () => showGroupTxModal(t));
            row.querySelector('.action-btn-delete').addEventListener('click', () => handleGroupTxDelete(t.id));
        }
        groupTxTableBody.appendChild(row);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

/* ==========================================================================
   EVENT HANDLERS
   ========================================================================== */
async function handleCreateGroup(e) {
    e.preventDefault();
    const name = groupNameInput.value.trim();
    if (!name) return;
    
    try {
        const newGroup = await storage.createGroup(name);
        showToast(`${getText('toast_group_created') || '記帳群組建立成功！'} "${name}"`, 'success');
        hideModal(groupModal);
        
        await refreshGroups();
        await selectGroup(newGroup);
    } catch (err) {
        showToast("Failed to create group: " + err.message, "error");
    }
}

async function handleAddMember(e) {
    e.preventDefault();
    const nickname = memberNicknameInput.value.trim();
    if (!nickname || !activeGroup) return;
    
    if (!isGroupCreator) {
        showToast(getText('group_creator_only') || '只有群組建立者才能執行此操作。', 'warning');
        return;
    }
    
    try {
        await storage.addGroupMember(activeGroup.id, nickname);
        showToast(`${getText('toast_member_added') || '已新增成員'} ${nickname}`, 'success');
        hideModal(memberModal);
        memberNicknameInput.value = '';
        
        // Refresh active details
        if (activeGroup) {
            const updated = (await storage.getGroups()).find(g => g.id === activeGroup.id);
            await selectGroup(updated);
        }
    } catch (err) {
        if (err.message && err.message.startsWith('USER_NOT_FOUND:')) {
            const name = err.message.split(':')[1];
            showToast(
                (getText('group_user_not_found') || '找不到此暱稱的使用者：') + name,
                'error'
            );
        } else if (err.message === 'ALREADY_MEMBER') {
            showToast(getText('group_already_member') || '此使用者已是群組成員。', 'warning');
        } else {
            showToast('Failed to add member: ' + err.message, 'error');
        }
    }
}

async function handleDeleteGroup() {
    if (!isGroupCreator || !activeGroup) return;
    
    const confirmMsg = getText('confirm_delete_group') || `確定要刪除群組「${activeGroup.name}」嗎？所有群組資料將永久刪除。`;
    if (!confirm(confirmMsg)) return;
    
    try {
        await storage.deleteGroup(activeGroup.id);
        showToast(getText('toast_group_deleted') || '群組已刪除。', 'success');
        deselectGroup();
        await refreshGroups();
    } catch (err) {
        showToast('Failed to delete group: ' + err.message, 'error');
    }
}

// Display Bill Modal
function showGroupTxModal(existingTx = null) {
    groupTxForm.reset();
    
    if (existingTx) {
        groupTxModalTitle.textContent = getText('modal_edit_tx');
        gtxId.value = existingTx.id;
        gtxType.value = existingTx.type;
        updateCategoryDropdown(gtxType, gtxCategory);
        gtxAmount.value = existingTx.amount;
        gtxCategory.value = existingTx.category;
        gtxDate.value = existingTx.date;
        gtxTags.value = (existingTx.tags || []).join(', ');
        gtxDescription.value = existingTx.description || '';
    } else {
        groupTxModalTitle.textContent = getText('modal_group_tx');
        gtxId.value = '';
        gtxType.value = 'expense';
        updateCategoryDropdown(gtxType, gtxCategory);
        gtxDate.value = new Date().toISOString().split('T')[0];
    }
    
    showModal(groupTxModal);
}

async function handleGroupTxSubmit(e) {
    e.preventDefault();
    
    const txId = gtxId.value;
    const type = gtxType.value;
    const amount = parseFloat(gtxAmount.value);
    const category = gtxCategory.value;
    const date = gtxDate.value;
    const description = gtxDescription.value.trim();
    
    const tagsVal = gtxTags ? gtxTags.value.trim() : '';
    const tags = tagsVal
        ? tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : [];
        
    const txData = {
        type,
        amount,
        category,
        date,
        description,
        tags
    };
    
    try {
        if (txId) {
            await storage.updateGroupTransaction(activeGroup.id, txId, txData);
            showToast(getText('toast_tx_updated') || '交易紀錄已更新！', 'success');
        } else {
            await storage.addGroupTransaction(activeGroup.id, txData);
            showToast(getText('toast_bill_added') || '交易已記錄成功！', 'success');
        }
        hideModal(groupTxModal);
        
        // Reload details
        const updated = (await storage.getGroups()).find(g => g.id === activeGroup.id);
        await selectGroup(updated);
    } catch (err) {
        showToast("Failed to save transaction: " + err.message, "error");
    }
}

async function handleGroupTxDelete(txId) {
    if (!confirm(getText('confirm_delete_bill') || '確定要刪除這筆群組交易紀錄嗎？')) return;
    
    try {
        await storage.deleteGroupTransaction(activeGroup.id, txId);
        showToast(getText('toast_bill_deleted') || '交易已刪除成功。', 'success');
        
        // Reload details
        const updated = (await storage.getGroups()).find(g => g.id === activeGroup.id);
        await selectGroup(updated);
    } catch (err) {
        showToast("Failed to delete transaction: " + err.message, "error");
    }
}
