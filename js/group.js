// js/group.js - Group splitting ledger and debt settlement algorithm
import * as storage from './storage.js';
import { formatCurrency, escapeHTML } from './dashboard.js';
import { showToast } from './app.js';

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
const settleUpBtn = document.getElementById('settleUpBtn');
const addGroupTxBtn = document.getElementById('addGroupTxBtn');

const debtsSummaryList = document.getElementById('debtsSummaryList');
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
const groupTxModalClose = document.getElementById('groupTxModalClose');
const groupTxModalCancel = document.getElementById('groupTxModalCancel');
const groupTxForm = document.getElementById('groupTxForm');
const gtxAmount = document.getElementById('gtxAmount');
const gtxPayer = document.getElementById('gtxPayer');
const gtxCategory = document.getElementById('gtxCategory');
const gtxDate = document.getElementById('gtxDate');
const gtxDescription = document.getElementById('gtxDescription');
const gtxSplitMembers = document.getElementById('gtxSplitMembers');

// State
let groups = [];
let activeGroup = null;
let activeMembers = [];
let activeTransactions = [];
let calculatedDebts = []; // Array of { debtor, creditor, amount }

export function initGroups() {
    // Group Modal
    createGroupBtn.addEventListener('click', () => showModal(groupModal));
    groupModalClose.addEventListener('click', () => hideModal(groupModal));
    groupModalCancel.addEventListener('click', () => hideModal(groupModal));
    groupForm.addEventListener('submit', handleCreateGroup);
    groupModal.addEventListener('click', (e) => {
        if (e.target === groupModal) hideModal(groupModal);
    });

    // Member Modal
    addMemberBtn.addEventListener('click', () => showModal(memberModal));
    memberModalClose.addEventListener('click', () => hideModal(memberModal));
    memberModalCancel.addEventListener('click', () => hideModal(memberModal));
    memberForm.addEventListener('submit', handleAddMember);
    memberModal.addEventListener('click', (e) => {
        if (e.target === memberModal) hideModal(memberModal);
    });

    // Group Transaction Modal
    addGroupTxBtn.addEventListener('click', () => showGroupTxModal());
    groupTxModalClose.addEventListener('click', () => hideModal(groupTxModal));
    groupTxModalCancel.addEventListener('click', () => hideModal(groupTxModal));
    groupTxForm.addEventListener('submit', handleGroupTxSubmit);
    groupTxModal.addEventListener('click', (e) => {
        if (e.target === groupTxModal) hideModal(groupTxModal);
    });

    // Settle up click
    settleUpBtn.addEventListener('click', handleSettleUpPrompt);
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
        groupsList.innerHTML = '<p class="text-muted" style="font-size: 13px; text-align: center; padding: 12px 0;">No groups yet.</p>';
        return;
    }
    
    groups.forEach(g => {
        const item = document.createElement('div');
        item.className = 'group-item';
        if (activeGroup && g.id === activeGroup.id) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <span class="group-item-name">${escapeHTML(g.name)}</span>
            <span class="group-item-count"><i data-lucide="chevron-right" style="width:12px; height:12px;"></i></span>
        `;
        
        item.addEventListener('click', () => selectGroup(g));
        groupsList.appendChild(item);
    });
    
    lucide.replace();
}

async function selectGroup(group) {
    activeGroup = group;
    renderGroupsList(); // Re-render to highlight active
    
    noGroupSelected.classList.add('d-none');
    groupActiveDetails.classList.remove('d-none');
    groupMembersSection.classList.remove('d-none');
    
    activeGroupName.textContent = group.name;
    const dateStr = new Date(group.created_at).toLocaleDateString();
    activeGroupMeta.textContent = `Created on ${dateStr}`;
    
    // Fetch members and transactions
    activeMembers = await storage.getGroupMembers(group.id);
    activeTransactions = await storage.getGroupTransactions(group.id);
    
    renderMembersList();
    calculateGroupSettlements();
    renderGroupTransactions();
}

function renderMembersList() {
    groupMembersList.innerHTML = '';
    
    activeMembers.forEach(m => {
        const item = document.createElement('div');
        item.className = 'member-item';
        item.innerHTML = `
            <span><i data-lucide="user" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: middle; color:var(--text-muted);"></i>${escapeHTML(m.nickname)}</span>
        `;
        groupMembersList.appendChild(item);
    });
    
    lucide.replace();
}

/* ==========================================================================
   DEBT SIMPLIFICATION ALGORITHM (Splitwise Core)
   ========================================================================== */
function calculateGroupSettlements() {
    // 1. Initialize balances map for all group members
    const balances = {};
    activeMembers.forEach(m => {
        balances[m.nickname] = 0.00;
    });
    
    // 2. Accumulate payouts and split debts
    activeTransactions.forEach(tx => {
        const paidBy = tx.paid_by;
        const total = parseFloat(tx.amount);
        
        // Payer gets credited full amount
        if (balances[paidBy] !== undefined) {
            balances[paidBy] += total;
        }
        
        // Split shares are debited from members specified in the split array
        const splits = tx.splits || []; // array of { nickname, amount }
        splits.forEach(s => {
            if (balances[s.nickname] !== undefined) {
                balances[s.nickname] -= parseFloat(s.amount);
            }
        });
    });
    
    // 3. Separate Debtors (net < 0) and Creditors (net > 0)
    const debtors = [];
    const creditors = [];
    
    Object.entries(balances).forEach(([name, bal]) => {
        // Round to 2 decimals to prevent floating-point mismatch
        const roundedBal = Math.round(bal * 100) / 100;
        if (roundedBal < -0.01) {
            debtors.push({ name, amount: -roundedBal });
        } else if (roundedBal > 0.01) {
            creditors.push({ name, amount: roundedBal });
        }
    });
    
    // 4. Match Debtors and Creditors greedily
    calculatedDebts = [];
    
    // Sort descending by amount to resolve largest transactions first
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    
    let dIdx = 0;
    let cIdx = 0;
    
    while (dIdx < debtors.length && cIdx < creditors.length) {
        const debtor = debtors[dIdx];
        const creditor = creditors[cIdx];
        
        const settledAmount = Math.min(debtor.amount, creditor.amount);
        
        calculatedDebts.push({
            debtor: debtor.name,
            creditor: creditor.name,
            amount: settledAmount
        });
        
        debtor.amount -= settledAmount;
        creditor.amount -= settledAmount;
        
        if (debtor.amount < 0.01) dIdx++;
        if (creditor.amount < 0.01) cIdx++;
    }
    
    // 5. Render Settlement Panel
    renderSettlementPanel();
}

function renderSettlementPanel() {
    debtsSummaryList.innerHTML = '';
    
    if (calculatedDebts.length === 0) {
        debtsSummaryList.innerHTML = `
            <div class="all-settled-message">
                <i data-lucide="sparkles" class="text-success"></i> 
                <span>All caught up! Everyone is settled.</span>
            </div>
        `;
        lucide.replace();
        return;
    }
    
    calculatedDebts.forEach(d => {
        const line = document.createElement('div');
        line.className = 'debt-line';
        line.innerHTML = `
            <i data-lucide="arrow-right-circle"></i>
            <span class="debt-giver">${escapeHTML(d.debtor)}</span>
            <span class="debt-arrow">owes</span>
            <span class="debt-receiver">${escapeHTML(d.creditor)}</span>
            <span class="debt-val">${formatCurrency(d.amount)}</span>
        `;
        debtsSummaryList.appendChild(line);
    });
    
    lucide.replace();
}

function renderGroupTransactions() {
    groupTxTableBody.innerHTML = '';
    
    if (activeTransactions.length === 0) {
        groupTxTableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="7">
                    <div class="empty-state" style="padding: 24px 0;">
                        <i data-lucide="receipt"></i>
                        <p>No bills added to this group yet.</p>
                    </div>
                </td>
            </tr>
        `;
        lucide.replace();
        return;
    }
    
    activeTransactions.forEach(t => {
        const row = document.createElement('tr');
        row.style.animation = 'fadeIn 0.25s ease-out';
        
        // Split details label (e.g. "Split between 3 members" or details)
        const splitsCount = (t.splits || []).length;
        const splitText = t.category === 'Settle' 
            ? `Transferred to ${escapeHTML(t.splits[0]?.nickname)}` 
            : `Split with ${splitsCount} member${splitsCount > 1 ? 's' : ''}`;
            
        const rowClass = t.category === 'Settle' ? 'style="opacity: 0.85; background: rgba(16, 185, 129, 0.02);"' : '';
        const catBadgeStyle = t.category === 'Settle' 
            ? 'background: rgba(16, 185, 129, 0.1); color: var(--success);'
            : 'background: rgba(99, 102, 241, 0.08); color: var(--primary);';
            
        row.innerHTML = `
            <tr ${rowClass}>
                <td>${t.date}</td>
                <td style="font-weight:600;">${escapeHTML(t.paid_by)}</td>
                <td>${escapeHTML(t.description)}</td>
                <td><span class="tag-badge" style="${catBadgeStyle}">${t.category}</span></td>
                <td class="text-muted" style="font-size:12px;">${splitText}</td>
                <td class="text-right" style="font-weight:700; font-family: 'Outfit'; color: var(--text-primary);">
                    ${formatCurrency(t.amount)}
                </td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn action-btn-delete" data-id="${t.id}" title="Delete Bill"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            </tr>
        `;
        
        row.querySelector('.action-btn-delete').addEventListener('click', () => handleGroupTxDelete(t.id));
        groupTxTableBody.appendChild(row);
    });
    
    lucide.replace();
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
        showToast(`Group "${name}" created successfully!`, "success");
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
    
    try {
        await storage.addGroupMember(activeGroup.id, nickname);
        showToast(`Added ${nickname} to group!`, "success");
        hideModal(memberModal);
        
        // Refresh active details
        if (activeGroup) {
            const updated = (await storage.getGroups()).find(g => g.id === activeGroup.id);
            await selectGroup(updated);
        }
    } catch (err) {
        showToast("Failed to add member: " + err.message, "error");
    }
}

// Display Bill Modal
function showGroupTxModal() {
    if (activeMembers.length < 2) {
        showToast("Please add at least 2 members to the group before splitting bills.", "warning");
        return;
    }
    
    groupTxForm.reset();
    
    // Fill paid by options
    gtxPayer.innerHTML = '';
    activeMembers.forEach(m => {
        gtxPayer.innerHTML += `<option value="${m.nickname}">${m.nickname}</option>`;
    });
    
    // Fill split members checkboxes list
    gtxSplitMembers.innerHTML = '';
    activeMembers.forEach(m => {
        gtxSplitMembers.innerHTML += `
            <label class="checkbox-label">
                <input type="checkbox" name="splitMember" value="${m.nickname}" checked>
                <span>${escapeHTML(m.nickname)}</span>
            </label>
        `;
    });
    
    gtxDate.value = new Date().toISOString().split('T')[0];
    showModal(groupTxModal);
}

async function handleGroupTxSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(gtxAmount.value);
    const paidBy = gtxPayer.value;
    const category = gtxCategory.value;
    const date = gtxDate.value;
    const description = gtxDescription.value.trim();
    
    // Collect split members checked
    const checkedCheckboxes = Array.from(document.querySelectorAll('input[name="splitMember"]:checked'));
    if (checkedCheckboxes.length === 0) {
        showToast("Please check at least one member to split the bill.", "warning");
        return;
    }
    
    // Equal split calculation
    const splitAmount = amount / checkedCheckboxes.length;
    const splits = checkedCheckboxes.map(cb => ({
        nickname: cb.value,
        amount: splitAmount
    }));
    
    const txData = {
        paid_by: paidBy,
        amount,
        category,
        date,
        description,
        splits
    };
    
    try {
        await storage.addGroupTransaction(activeGroup.id, txData);
        showToast("Bill recorded successfully!", "success");
        hideModal(groupTxModal);
        
        // Reload details
        const updated = (await storage.getGroups()).find(g => g.id === activeGroup.id);
        await selectGroup(updated);
    } catch (err) {
        showToast("Failed to record bill: " + err.message, "error");
    }
}

async function handleGroupTxDelete(txId) {
    if (!confirm("Remove this group bill?")) return;
    
    try {
        await storage.deleteGroupTransaction(activeGroup.id, txId);
        showToast("Bill deleted successfully", "success");
        
        // Reload details
        const updated = (await storage.getGroups()).find(g => g.id === activeGroup.id);
        await selectGroup(updated);
    } catch (err) {
        showToast("Failed to delete bill: " + err.message, "error");
    }
}

/* ==========================================================================
   SETTLEMENT SELECTION
   ========================================================================== */
function handleSettleUpPrompt() {
    if (calculatedDebts.length === 0) {
        showToast("Everyone is already settled up!", "success");
        return;
    }
    
    // Create an inline form or prompt to select which debt to settle
    let optionsHtml = '';
    calculatedDebts.forEach((d, idx) => {
        optionsHtml += `
            <option value="${idx}">${d.debtor} pays ${d.creditor} -> ${formatCurrency(d.amount)}</option>
        `;
    });
    
    // Set up a simple dynamic choice box inside a settle modal or direct prompt
    const settleContainer = document.createElement('div');
    settleContainer.className = 'modal-overlay active';
    settleContainer.innerHTML = `
        <div class="modal-container modal-sm">
            <div class="modal-header">
                <h3>Record Settlement</h3>
                <button class="modal-close-btn" id="settleCancelBtn1"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-form">
                <div class="form-group">
                    <label for="settleSelect">Select Debt to Clear</label>
                    <select id="settleSelect" style="width:100%;">
                        ${optionsHtml}
                    </select>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="settleCancelBtn2">Cancel</button>
                    <button class="btn btn-primary" id="settleSubmitBtn">Record Payment</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(settleContainer);
    lucide.replace();
    
    const closeOverlay = () => {
        settleContainer.remove();
    };
    
    settleContainer.querySelector('#settleCancelBtn1').addEventListener('click', closeOverlay);
    settleContainer.querySelector('#settleCancelBtn2').addEventListener('click', closeOverlay);
    
    settleContainer.querySelector('#settleSubmitBtn').addEventListener('click', async () => {
        const choiceIdx = parseInt(settleContainer.querySelector('#settleSelect').value);
        const debt = calculatedDebts[choiceIdx];
        if (!debt) return;
        
        // Record a transaction: Giver pays Receiver
        const txData = {
            paid_by: debt.debtor,
            amount: debt.amount,
            category: 'Settle',
            date: new Date().toISOString().split('T')[0],
            description: `${debt.debtor} settled up with ${debt.creditor}`,
            splits: [{
                nickname: debt.creditor,
                amount: debt.amount
            }]
        };
        
        try {
            await storage.addGroupTransaction(activeGroup.id, txData);
            showToast(`Settlement payment of ${formatCurrency(debt.amount)} recorded!`, "success");
            closeOverlay();
            
            // Reload group details
            const updated = (await storage.getGroups()).find(g => g.id === activeGroup.id);
            await selectGroup(updated);
        } catch (err) {
            showToast("Failed to settle: " + err.message, "error");
        }
    });
}
