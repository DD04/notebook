// js/group.js - Group shared bookkeeping ledger logic
import * as storage from './storage.js';
import { formatCurrency, escapeHTML, updateCategoryDropdown } from './dashboard.js';
import { showToast, showConfirm } from './app.js';
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
const refreshGroupTxBtn = document.getElementById('refreshGroupTxBtn');

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
const memberSuggestions = document.getElementById('memberSuggestions');
const memberSuggestionsChips = document.getElementById('memberSuggestionsChips');

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

// Pagination state (group transactions)
const GROUP_ITEMS_PER_PAGE = 8;
let groupCurrentPage = 1;
let groupFilteredTransactions = [];

// Chart.js instances for group
let groupDonutChartInstance = null;
let groupBarChartInstance = null;

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
    addMemberBtn.addEventListener('click', () => {
        showModal(memberModal);
        loadMemberSuggestions();
    });
    memberModalClose.addEventListener('click', () => { hideModal(memberModal); memberNicknameInput.value = ''; clearMemberSuggestions(); });
    memberModalCancel.addEventListener('click', () => { hideModal(memberModal); memberNicknameInput.value = ''; clearMemberSuggestions(); });
    memberForm.addEventListener('submit', handleAddMember);
    memberModal.addEventListener('click', (e) => {
        if (e.target === memberModal) { hideModal(memberModal); memberNicknameInput.value = ''; clearMemberSuggestions(); }
    });

    // Group Transaction Modal (any member can open)
    addGroupTxBtn.addEventListener('click', () => showGroupTxModal());
    if (refreshGroupTxBtn) {
        refreshGroupTxBtn.addEventListener('click', refreshGroupTransactions);
    }
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
    
    // Leave group (only guest members see this button)
    const leaveGroupBtn = document.getElementById('leaveGroupBtn');
    if (leaveGroupBtn) {
        leaveGroupBtn.addEventListener('click', handleLeaveGroup);
    }

    // Group Filter Listeners
    const groupFilterSearch = document.getElementById('groupFilterSearch');
    const groupFilterType = document.getElementById('groupFilterType');
    const groupFilterCategory = document.getElementById('groupFilterCategory');
    const groupFilterMonth = document.getElementById('groupFilterMonth');
    
    groupFilterSearch.addEventListener('input', applyGroupFiltersAndRender);
    groupFilterType.addEventListener('change', () => {
        updateGroupFilterCategoryOptions();
        applyGroupFiltersAndRender();
    });
    groupFilterCategory.addEventListener('change', applyGroupFiltersAndRender);
    groupFilterMonth.addEventListener('change', applyGroupFiltersAndRender);

    // Group Pagination Listeners
    const groupPrevPageBtn = document.getElementById('groupPrevPageBtn');
    const groupNextPageBtn = document.getElementById('groupNextPageBtn');
    if (groupPrevPageBtn) {
        groupPrevPageBtn.addEventListener('click', () => {
            if (groupCurrentPage > 1) {
                groupCurrentPage--;
                renderGroupTransactions();
            }
        });
    }
    if (groupNextPageBtn) {
        groupNextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(groupFilteredTransactions.length / GROUP_ITEMS_PER_PAGE);
            if (groupCurrentPage < totalPages) {
                groupCurrentPage++;
                renderGroupTransactions();
            }
        });
    }
    
    // Group Analytics Button & Modal
    const groupAnalyticsBtn = document.getElementById('groupAnalyticsBtn');
    const groupAnalyticsModal = document.getElementById('groupAnalyticsModal');
    const groupAnalyticsModalClose = document.getElementById('groupAnalyticsModalClose');
    const groupAnalyticsModalCloseBtn = document.getElementById('groupAnalyticsModalCloseBtn');
    
    const groupAnalyticsMonthSelect = document.getElementById('groupAnalyticsMonthSelect');
    const groupAnalyticsTrendMonthPicker = document.getElementById('groupAnalyticsTrendMonthPicker');
    
    if (groupAnalyticsMonthSelect) {
        groupAnalyticsMonthSelect.addEventListener('change', () => {
            renderGroupCategoryDonutChart();
        });
    }
    if (groupAnalyticsTrendMonthPicker) {
        groupAnalyticsTrendMonthPicker.addEventListener('change', () => {
            renderGroupTrendBarChart();
        });
    }
    
    groupAnalyticsBtn.addEventListener('click', () => {
        if (groupAnalyticsTrendMonthPicker && !groupAnalyticsTrendMonthPicker.value) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            groupAnalyticsTrendMonthPicker.value = `${year}-${month}`;
        }
        showModal(groupAnalyticsModal);
        populateGroupAnalyticsMonthSelect();
        renderGroupCategoryDonutChart();
        renderGroupTrendBarChart();
    });
    const hideGroupAnalytics = () => hideModal(groupAnalyticsModal);
    groupAnalyticsModalClose.addEventListener('click', hideGroupAnalytics);
    groupAnalyticsModalCloseBtn.addEventListener('click', hideGroupAnalytics);
    groupAnalyticsModal.addEventListener('click', (e) => {
        if (e.target === groupAnalyticsModal) hideGroupAnalytics();
    });
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
    const groupAnalyticsBtn = document.getElementById('groupAnalyticsBtn');
    if (groupAnalyticsBtn) {
        groupAnalyticsBtn.style.display = 'none';
    }
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
    
    // Show leave group button only for invited members
    const leaveGroupBtn = document.getElementById('leaveGroupBtn');
    if (leaveGroupBtn) {
        leaveGroupBtn.style.display = isGroupCreator ? 'none' : '';
    }
    
    // Fetch members and transactions
    activeMembers = await storage.getGroupMembers(group.id);
    activeTransactions = await storage.getGroupTransactions(group.id);
    
    renderMembersList();
    
    // Show the analytics button for selected group
    const groupAnalyticsBtn = document.getElementById('groupAnalyticsBtn');
    if (groupAnalyticsBtn) {
        groupAnalyticsBtn.style.display = 'inline-flex';
    }
    
    populateGroupFilters();
    applyGroupFiltersAndRender();
}

async function refreshGroupTransactions() {
    if (!activeGroup) return;
    
    const icon = refreshGroupTxBtn ? refreshGroupTxBtn.querySelector('i') : null;
    if (icon) {
        icon.classList.add('spin-animation');
    }
    if (refreshGroupTxBtn) {
        refreshGroupTxBtn.disabled = true;
    }
    
    try {
        activeMembers = await storage.getGroupMembers(activeGroup.id);
        activeTransactions = await storage.getGroupTransactions(activeGroup.id);
        renderMembersList();
        applyGroupFiltersAndRender();
    } catch (error) {
        console.error('Failed to refresh group transactions:', error);
        showToast('無法重新整理群組明細', 'error');
    } finally {
        if (icon) {
            icon.classList.remove('spin-animation');
        }
        if (refreshGroupTxBtn) {
            refreshGroupTxBtn.disabled = false;
        }
    }
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
        const canRemove = isGroupCreator && !isCreatorMember;
        const removeBtn = canRemove
            ? `<button class="action-btn action-btn-delete" data-member-id="${m.id}" title="${getText('group_remove_member') || '移除成員'}"><i data-lucide="user-x"></i></button>`
            : '';
        item.innerHTML = `
            <span>
                <i data-lucide="user" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: middle; color:var(--text-muted);"></i>
                ${escapeHTML(m.nickname)}
                ${isCreatorMember ? `<span style="font-size:10px; color:var(--primary); margin-left:4px;">(${getText('group_creator_badge')})</span>` : ''}
            </span>
            ${removeBtn}
        `;
        if (canRemove) {
            item.querySelector('.action-btn-delete').addEventListener('click', () => handleRemoveMember(m));
        }
        groupMembersList.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

function renderGroupSummaryCards(txList = activeTransactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    txList.forEach(t => {
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
        groupNetBalanceEl.className = 'card-amount';
        if (netBalance > 0) {
            groupNetBalanceEl.classList.add('text-success');
        } else if (netBalance < 0) {
            groupNetBalanceEl.classList.add('text-error');
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
    const txsList = groupFilteredTransactions;
    const groupPrevPageBtn = document.getElementById('groupPrevPageBtn');
    const groupNextPageBtn = document.getElementById('groupNextPageBtn');
    const groupPaginationInfo = document.getElementById('groupPaginationInfo');

    groupTxTableBody.innerHTML = '';
    
    if (txsList.length === 0) {
        groupTxTableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="7">
                    <div class="empty-state" style="padding: 24px 0;">
                        <i data-lucide="receipt"></i>
                        <p>${getText('group_empty_ledger')}</p>
                    </div>
                </td>
            </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        if (groupPrevPageBtn) groupPrevPageBtn.disabled = true;
        if (groupNextPageBtn) groupNextPageBtn.disabled = true;
        if (groupPaginationInfo) groupPaginationInfo.textContent = getText('db_page_info').replace('{current}', '1').replace('{total}', '1');
        return;
    }
    
    // Pagination math
    const totalPages = Math.ceil(txsList.length / GROUP_ITEMS_PER_PAGE);
    if (groupCurrentPage > totalPages) groupCurrentPage = totalPages || 1;
    
    const startIndex = (groupCurrentPage - 1) * GROUP_ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + GROUP_ITEMS_PER_PAGE, txsList.length);
    const pageItems = txsList.slice(startIndex, endIndex);
    
    pageItems.forEach(t => {
        const row = document.createElement('tr');
        row.style.animation = 'fadeIn 0.25s ease-out';
        
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
            
        // 建立者只顯示暱稱
        const displayName = (t.profiles && t.profiles.nickname) || t.member_nickname || 'User';

        row.innerHTML = `
            <tr>
                <td>${t.date}</td>
                <td style="font-weight:600;">${escapeHTML(displayName)}</td>
                <td><span class="tag-badge" style="${typeBadgeStyle}">${typeLabel}</span></td>
                <td><span class="tag-badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted);">${getText('cat_' + t.category) || t.category}</span></td>
                <td>${escapeHTML(t.description)}</td>
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

    // Update pagination controls
    if (groupPrevPageBtn) groupPrevPageBtn.disabled = groupCurrentPage === 1;
    if (groupNextPageBtn) groupNextPageBtn.disabled = groupCurrentPage === totalPages;
    if (groupPaginationInfo) {
        groupPaginationInfo.textContent = getText('db_page_info')
            .replace('{current}', groupCurrentPage)
            .replace('{total}', totalPages);
    }
}

/* ==========================================================================
   EVENT HANDLERS
   ========================================================================== */
let isCreatingGroup = false;
async function handleCreateGroup(e) {
    e.preventDefault();
    if (isCreatingGroup) return;
    const name = groupNameInput.value.trim();
    if (!name) return;

    isCreatingGroup = true;
    const submitBtn = groupForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const newGroup = await storage.createGroup(name);
        showToast(`${getText('toast_group_created') || '記帳群組建立成功！'} "${name}"`, 'success');
        hideModal(groupModal);

        await refreshGroups();
        await selectGroup(newGroup);
    } catch (err) {
        showToast("Failed to create group: " + err.message, "error");
    } finally {
        isCreatingGroup = false;
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function loadMemberSuggestions() {
    if (!activeGroup) return;
    try {
        const past = await storage.getPastGroupMembers(activeGroup.id, currentUserId);
        memberSuggestionsChips.innerHTML = '';
        if (past.length === 0) {
            memberSuggestions.style.display = 'none';
            return;
        }
        past.forEach(m => {
            const username = m.profiles && m.profiles.username;
            if (!username) return;
            const chip = document.createElement('span');
            chip.className = 'member-suggestion-chip';
            chip.textContent = m.nickname;
            chip.addEventListener('click', () => {
                memberNicknameInput.value = username;
                memberNicknameInput.focus();
            });
            memberSuggestionsChips.appendChild(chip);
        });
        memberSuggestions.style.display = 'block';
    } catch {
        memberSuggestions.style.display = 'none';
    }
}

function clearMemberSuggestions() {
    memberSuggestionsChips.innerHTML = '';
    memberSuggestions.style.display = 'none';
}

async function handleAddMember(e) {
    e.preventDefault();
    const username = memberNicknameInput.value.trim();
    if (!username || !activeGroup) return;
    
    if (!isGroupCreator) {
        showToast(getText('group_creator_only') || '只有群組建立者才能執行此操作。', 'warning');
        return;
    }
    
    try {
        await storage.addGroupMember(activeGroup.id, username);
        showToast(`${getText('toast_member_added') || '已新增成員'} ${username}`, 'success');
        hideModal(memberModal);
        memberNicknameInput.value = '';
        clearMemberSuggestions();
        
        // Refresh active details
        if (activeGroup) {
            const updated = (await storage.getGroups()).find(g => g.id === activeGroup.id);
            await selectGroup(updated);
        }
    } catch (err) {
        if (err.message && err.message.startsWith('USER_NOT_FOUND:')) {
            const name = err.message.split(':')[1];
            showToast(
                (getText('group_user_not_found') || '找不到此帳號的使用者：') + name,
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
    const isConfirmed = await showConfirm(confirmMsg);
    if (!isConfirmed) return;
    
    try {
        await storage.deleteGroup(activeGroup.id);
        showToast(getText('toast_group_deleted') || '群組已刪除。', 'success');
        deselectGroup();
        await refreshGroups();
    } catch (err) {
        showToast('Failed to delete group: ' + err.message, 'error');
    }
}

async function handleRemoveMember(member) {
    if (!isGroupCreator || !activeGroup) return;

    const confirmMsg = (getText('confirm_remove_member') || `確定要將成員「${member.nickname}」移出群組嗎？`).replace('{name}', member.nickname);
    const isConfirmed = await showConfirm(confirmMsg);
    if (!isConfirmed) return;

    try {
        await storage.removeGroupMember(activeGroup.id, member.id);
        showToast(getText('toast_member_removed') || '已移除成員。', 'success');

        activeMembers = await storage.getGroupMembers(activeGroup.id);
        renderMembersList();
    } catch (err) {
        showToast('移除成員失敗: ' + err.message, 'error');
    }
}

async function handleLeaveGroup() {
    if (!activeGroup) return;
    
    const confirmMsg = `確定要退出群組「${activeGroup.name}」嗎？退出後您將無法再查看此群組的任何交易紀錄。`;
    const isConfirmed = await showConfirm(confirmMsg);
    if (!isConfirmed) return;
    
    try {
        await storage.leaveGroup(activeGroup.id);
        showToast("已成功退出群組。", "success");
        deselectGroup();
        await refreshGroups();
    } catch (err) {
        showToast("退出群組失敗: " + err.message, "error");
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
    // Focus amount input after modal opens
    requestAnimationFrame(() => {
        gtxAmount.focus();
        gtxAmount.select();
    });
}

async function handleGroupTxSubmit(e) {
    e.preventDefault();
    
    const txId = gtxId.value;
    const type = gtxType.value;
    const amount = parseInt(gtxAmount.value, 10);
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
    const isConfirmed = await showConfirm(getText('confirm_delete_bill') || '確定要刪除這筆群組交易紀錄嗎？');
    if (!isConfirmed) return;
    
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

/* ==========================================================================
   FILTERING & ANALYTICS HELPER FUNCTIONS
   ========================================================================== */
function updateGroupFilterCategoryOptions() {
    const groupFilterType = document.getElementById('groupFilterType');
    const groupFilterCategory = document.getElementById('groupFilterCategory');
    if (!groupFilterCategory || !groupFilterType) return;
    
    const typeVal = groupFilterType.value;
    const expenseCats = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Housing', 'Other'];
    const incomeCats = ['Salary', 'Investments', 'Other'];
    
    const categories = new Set();
    activeTransactions.forEach(t => {
        if (t.category) categories.add(t.category);
    });
    
    if (categories.size === 0) {
        ['Food', 'Transport', 'Entertainment', 'Shopping', 'Housing', 'Salary', 'Investments', 'Other'].forEach(c => categories.add(c));
    }
    
    let catsToFill = [];
    if (typeVal === 'all') {
        catsToFill = Array.from(categories);
    } else if (typeVal === 'income') {
        catsToFill = Array.from(categories).filter(cat => incomeCats.includes(cat) || cat === 'Other');
    } else { // expense
        catsToFill = Array.from(categories).filter(cat => expenseCats.includes(cat) || cat === 'Other');
    }
    
    catsToFill = Array.from(new Set(catsToFill)).sort();
    
    const prevCat = groupFilterCategory.value;
    groupFilterCategory.innerHTML = `<option value="all">${getText('db_all_cats')}</option>`;
    catsToFill.forEach(cat => {
        groupFilterCategory.innerHTML += `<option value="${cat}">${getText('cat_' + cat) || cat}</option>`;
    });
    
    if (catsToFill.includes(prevCat)) {
        groupFilterCategory.value = prevCat;
    } else {
        groupFilterCategory.value = 'all';
    }
}

function populateGroupFilters() {
    const groupFilterMonth = document.getElementById('groupFilterMonth');
    const months = new Set();
    
    activeTransactions.forEach(t => {
        if (t.date) {
            const monthKey = t.date.substring(0, 7); // YYYY-MM
            months.add(monthKey);
        }
    });
    
    const prevMonth = groupFilterMonth.value;
    
    updateGroupFilterCategoryOptions();
    
    // Fill months
    const locale = getLocale() === 'zh' ? 'zh-TW' : 'en-US';
    groupFilterMonth.innerHTML = `<option value="all">${getText('db_all_months')}</option>`;
    Array.from(months).sort().reverse().forEach(mon => {
        const dateObj = new Date(mon + '-02'); // Buffer day
        const formatted = dateObj.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
        groupFilterMonth.innerHTML += `<option value="${mon}">${formatted}</option>`;
    });
    
    if (Array.from(months).includes(prevMonth)) {
        groupFilterMonth.value = prevMonth;
    }
}

function applyGroupFiltersAndRender() {
    const groupFilterSearch = document.getElementById('groupFilterSearch');
    const groupFilterType = document.getElementById('groupFilterType');
    const groupFilterCategory = document.getElementById('groupFilterCategory');
    const groupFilterMonth = document.getElementById('groupFilterMonth');

    const searchVal = groupFilterSearch.value.trim().toLowerCase();
    const typeVal = groupFilterType.value;
    const catVal = groupFilterCategory.value;
    const monthVal = groupFilterMonth.value;
    
    groupFilteredTransactions = activeTransactions.filter(t => {
        const matchesSearch = !searchVal || 
            (t.description && t.description.toLowerCase().includes(searchVal)) ||
            (t.member_nickname && t.member_nickname.toLowerCase().includes(searchVal));
        const matchesType = typeVal === 'all' || t.type === typeVal;
        const matchesCat = catVal === 'all' || t.category === catVal;
        const matchesMonth = monthVal === 'all' || (t.date && t.date.startsWith(monthVal));
        
        return matchesSearch && matchesType && matchesCat && matchesMonth;
    });

    // Reset to page 1 whenever filters change
    groupCurrentPage = 1;
    renderGroupSummaryCards(groupFilteredTransactions);
    renderGroupTransactions();
}

function populateGroupAnalyticsMonthSelect() {
    const groupAnalyticsMonthSelect = document.getElementById('groupAnalyticsMonthSelect');
    if (!groupAnalyticsMonthSelect) return;

    const months = new Set();
    activeTransactions.forEach(t => {
        if (t.date) {
            months.add(t.date.substring(0, 7)); // YYYY-MM
        }
    });

    const prevMonth = groupAnalyticsMonthSelect.value;
    
    groupAnalyticsMonthSelect.innerHTML = `<option value="all">${getText('db_all_months') || '所有月份'}</option>`;
    
    Array.from(months).sort().reverse().forEach(mon => {
        const dateObj = new Date(mon + '-02'); // Buffer day
        const formatted = dateObj.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });
        groupAnalyticsMonthSelect.innerHTML += `<option value="${mon}">${formatted}</option>`;
    });

    // Restore previous selection if still valid
    if (Array.from(months).includes(prevMonth) || prevMonth === 'all') {
        groupAnalyticsMonthSelect.value = prevMonth;
    } else {
        groupAnalyticsMonthSelect.value = 'all';
    }
}

function renderGroupCategoryDonutChart() {
    const donutCanvas = document.getElementById('groupCategoryDonutChart');
    const donutEmptyMessage = document.getElementById('groupDonutEmptyMessage');
    
    if (groupDonutChartInstance) {
        groupDonutChartInstance.destroy();
        groupDonutChartInstance = null;
    }
    
    const groupAnalyticsMonthSelect = document.getElementById('groupAnalyticsMonthSelect');
    const selectedMonth = groupAnalyticsMonthSelect ? groupAnalyticsMonthSelect.value : 'all';

    const filteredTxs = activeTransactions.filter(t => {
        if (selectedMonth === 'all') return true;
        return t.date && t.date.startsWith(selectedMonth);
    });
    
    // 1. Group expenses for Category Donut Chart
    const catTotals = {};
    let totalExpense = 0;
    
    filteredTxs.forEach(t => {
        if (t.type === 'expense') {
            const cat = t.category || 'Other';
            const val = parseFloat(t.amount);
            catTotals[cat] = (catTotals[cat] || 0) + val;
            totalExpense += val;
        }
    });
    
    const categoriesSorted = Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1]);
        
    if (totalExpense === 0 || categoriesSorted.length === 0) {
        donutCanvas.classList.add('d-none');
        donutEmptyMessage.classList.remove('d-none');
    } else {
        donutCanvas.classList.remove('d-none');
        donutEmptyMessage.classList.add('d-none');
        
        const labels = categoriesSorted.map(([cat]) => getText('cat_' + cat) || cat);
        const data = categoriesSorted.map(([, val]) => val);
        const CHART_COLORS = [
            '#6366F1', '#10B981', '#EF4444', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#3B82F6'
        ];
        const backgroundColors = categoriesSorted.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]);
        
        groupDonutChartInstance = new window.Chart(donutCanvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1,
                    borderColor: '#1e1e2e',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#a1a1aa',
                            boxWidth: 12,
                            font: { family: "'Outfit', sans-serif", size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#27273a',
                        titleColor: '#ffffff',
                        bodyColor: '#e4e4e7',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const percent = (value / totalExpense) * 100;
                                return ` ${context.label}: $${Math.round(value)} (${percent.toFixed(1)}%)`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

function renderGroupTrendBarChart() {
    const barCanvas = document.getElementById('groupTrendBarChart');
    
    if (groupBarChartInstance) {
        groupBarChartInstance.destroy();
        groupBarChartInstance = null;
    }
    
    const groupAnalyticsTrendMonthPicker = document.getElementById('groupAnalyticsTrendMonthPicker');
    let baseDate = new Date();
    if (groupAnalyticsTrendMonthPicker && groupAnalyticsTrendMonthPicker.value) {
        const [year, month] = groupAnalyticsTrendMonthPicker.value.split('-');
        baseDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    }
    
    // 2. Group values by month for Monthly Cash Flow (Bar Chart)
    const monthlySummary = {};
    const monthsArray = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        monthsArray.push(key);
        monthlySummary[key] = { income: 0, expense: 0 };
    }
    
    activeTransactions.forEach(t => {
        if (!t.date) return;
        const mKey = t.date.substring(0, 7);
        if (monthlySummary[mKey]) {
            const val = parseFloat(t.amount);
            if (t.type === 'income') {
                monthlySummary[mKey].income += val;
            } else {
                monthlySummary[mKey].expense += val;
            }
        }
    });
    
    const barLabels = monthsArray.map(mKey => {
        const parts = mKey.split('-');
        return `${parts[0]}年${parts[1]}月`;
    });
    
    const incomeData = monthsArray.map(mKey => monthlySummary[mKey].income);
    const expenseData = monthsArray.map(mKey => monthlySummary[mKey].expense);
    
    groupBarChartInstance = new window.Chart(barCanvas, {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [
                {
                    label: getText('db_income_type') || '收入',
                    data: incomeData,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    hoverBackgroundColor: '#10B981',
                    borderRadius: 4,
                    borderWidth: 0
                },
                {
                    label: getText('db_expense_type') || '支出',
                    data: expenseData,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)',
                    hoverBackgroundColor: '#EF4444',
                    borderRadius: 4,
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: { color: '#a1a1aa', font: { family: "'Outfit', sans-serif", size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: {
                        color: '#a1a1aa',
                        font: { family: "'Outfit', sans-serif", size: 10 },
                        callback: function(value) { return '$' + Math.round(value); }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#a1a1aa',
                        font: { family: "'Outfit', sans-serif", size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#27273a',
                    titleColor: '#ffffff',
                    bodyColor: '#e4e4e7',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: $${Math.round(context.parsed.y)}`;
                        }
                    }
                }
            }
        }
    });
}

