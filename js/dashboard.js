// js/dashboard.js - Personal Dashboard Ledger Module
import * as storage from './storage.js';
import { showToast, showConfirm } from './app.js';
import { getText, getLocale } from './i18n.js';

// DOM elements
const dbNetBalance = document.getElementById('dbNetBalance');
const dbTotalIncome = document.getElementById('dbTotalIncome');
const dbTotalExpenses = document.getElementById('dbTotalExpenses');
const dbIncomeCount = document.getElementById('dbIncomeCount');
const dbExpenseCount = document.getElementById('dbExpenseCount');

const addTxBtn = document.getElementById('addTxBtn');
const txModal = document.getElementById('txModal');
const txModalTitle = document.getElementById('txModalTitle');
const txModalClose = document.getElementById('txModalClose');
const txModalCancel = document.getElementById('txModalCancel');
const txForm = document.getElementById('txForm');

const txId = document.getElementById('txId');
const txType = document.getElementById('txType');
const txAmount = document.getElementById('txAmount');
const txCategory = document.getElementById('txCategory');
const txDate = document.getElementById('txDate');
const txTags = document.getElementById('txTags');
const txDescription = document.getElementById('txDescription');

const filterSearch = document.getElementById('filterSearch');
const filterType = document.getElementById('filterType');
const filterCategory = document.getElementById('filterCategory');
const filterMonth = document.getElementById('filterMonth');

const ledgerTableBody = document.getElementById('ledgerTableBody');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const paginationInfo = document.getElementById('paginationInfo');

// Module state
let localTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 8;
let changeCallback = null;

export function updateCategoryDropdown(typeSelectEl, categorySelectEl) {
    const selectedType = typeSelectEl.value; // 'expense' or 'income'
    const expenseCats = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Housing', 'Other'];
    const incomeCats = ['Salary', 'Investments', 'Other'];
    
    const catsToFill = selectedType === 'income' ? incomeCats : expenseCats;
    const prevVal = categorySelectEl.value;
    
    categorySelectEl.innerHTML = '';
    catsToFill.forEach(cat => {
        const localizedName = getText('cat_' + cat) || cat;
        categorySelectEl.innerHTML += `<option value="${cat}">${localizedName}</option>`;
    });
    
    if (catsToFill.includes(prevVal)) {
        categorySelectEl.value = prevVal;
    } else {
        categorySelectEl.value = catsToFill[0];
    }
}

export function initDashboard(onDashboardChange) {
    changeCallback = onDashboardChange;
    
    // Add transaction button listeners
    addTxBtn.addEventListener('click', () => showTxModal());
    txModalClose.addEventListener('click', hideTxModal);
    txModalCancel.addEventListener('click', hideTxModal);
    
    // Backdrop click close modal
    txModal.addEventListener('click', (e) => {
        if (e.target === txModal) hideTxModal();
    });
    
    txForm.addEventListener('submit', handleTxSubmit);
    
    // Listen to transaction type changes to update categories dropdown
    txType.addEventListener('change', () => updateCategoryDropdown(txType, txCategory));
    
    // Filtering listeners
    filterSearch.addEventListener('input', applyFiltersAndRender);
    filterType.addEventListener('change', () => {
        updateFilterCategoryOptions();
        applyFiltersAndRender();
    });
    filterCategory.addEventListener('change', applyFiltersAndRender);
    filterMonth.addEventListener('change', applyFiltersAndRender);
    
    // Pagination listeners
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)) {
            currentPage++;
            renderTable();
        }
    });
}

// Open Modal to create or edit transaction
export function showTxModal(existingTx = null) {
    txForm.reset();
    
    if (existingTx) {
        txModalTitle.textContent = getText('modal_edit_tx');
        txId.value = existingTx.id;
        txType.value = existingTx.type;
        updateCategoryDropdown(txType, txCategory);
        txAmount.value = existingTx.amount;
        txCategory.value = existingTx.category;
        txDate.value = existingTx.date;
        txTags.value = (existingTx.tags || []).join(', ');
        txDescription.value = existingTx.description || '';
    } else {
        txModalTitle.textContent = getText('modal_add_tx');
        txId.value = '';
        txType.value = 'expense';
        updateCategoryDropdown(txType, txCategory);
        // Pre-fill today's date
        txDate.value = new Date().toISOString().split('T')[0];
    }
    
    txModal.classList.add('active');
    // Focus amount input after modal opens (rAF waits for CSS transition to begin)
    requestAnimationFrame(() => {
        txAmount.focus();
        txAmount.select();
    });
}

export function hideTxModal() {
    txModal.classList.remove('active');
}

// Refresh transactions data from storage
export async function refreshDashboard() {
    try {
        localTransactions = await storage.getTransactions();
        
        // Dynamic options populate
        populateFilterSelectors();
        
        // Recalculate cards and render table
        applyFiltersAndRender();
    } catch (e) {
        console.error("Failed to load dashboard data", e);
        showToast("Error loading dashboard data: " + e.message, "error");
    }
}

function calculateSummaryCards(txList = localTransactions) {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    
    txList.forEach(t => {
        const val = parseFloat(t.amount);
        if (t.type === 'income') {
            income += val;
            incomeCount++;
        } else {
            expense += val;
            expenseCount++;
        }
    });
    
    const balance = income - expense;
    
    dbNetBalance.textContent = formatCurrency(balance);
    dbTotalIncome.textContent = formatCurrency(income);
    dbTotalExpenses.textContent = formatCurrency(expense);
    dbIncomeCount.textContent = `${incomeCount} ${getText('db_income_count')}`;
    dbExpenseCount.textContent = `${expenseCount} ${getText('db_expense_count')}`;
    
    // Style balance text color
    dbNetBalance.className = 'card-amount';
    if (balance > 0) {
        dbNetBalance.classList.add('text-success');
    } else if (balance < 0) {
        dbNetBalance.classList.add('text-error');
    }
}

function updateFilterCategoryOptions() {
    const typeVal = filterType.value;
    const expenseCats = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Housing', 'Other'];
    const incomeCats = ['Salary', 'Investments', 'Other'];
    
    const categories = new Set(storage.DEFAULT_CATEGORIES);
    localTransactions.forEach(t => {
        if (t.category) categories.add(t.category);
    });
    
    let catsToFill = [];
    if (typeVal === 'all') {
        catsToFill = Array.from(categories);
    } else if (typeVal === 'income') {
        catsToFill = Array.from(categories).filter(cat => incomeCats.includes(cat) || cat === 'Other');
    } else { // expense
        catsToFill = Array.from(categories).filter(cat => expenseCats.includes(cat) || cat === 'Other');
    }
    
    catsToFill = Array.from(new Set(catsToFill)).sort();
    
    const prevCat = filterCategory.value;
    filterCategory.innerHTML = `<option value="all">${getText('db_all_cats')}</option>`;
    catsToFill.forEach(cat => {
        filterCategory.innerHTML += `<option value="${cat}">${getText('cat_' + cat) || cat}</option>`;
    });
    
    if (catsToFill.includes(prevCat)) {
        filterCategory.value = prevCat;
    } else {
        filterCategory.value = 'all';
    }
}

function populateFilterSelectors() {
    const months = new Set();
    
    localTransactions.forEach(t => {
        if (t.date) {
            months.add(t.date.substring(0, 7)); // YYYY-MM
        }
    });
    
    const prevMonth = filterMonth.value;
    
    updateFilterCategoryOptions();
    
    // Fill months dropdown
    const locale = getLocale() === 'zh' ? 'zh-TW' : 'en-US';
    filterMonth.innerHTML = `<option value="all">${getText('db_all_months')}</option>`;
    Array.from(months).sort().reverse().forEach(mon => {
        const dateObj = new Date(mon + '-02'); // Add buffer day to avoid TZ offset issues
        const formatted = dateObj.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
        filterMonth.innerHTML += `<option value="${mon}">${formatted}</option>`;
    });
    
    if (Array.from(months).includes(prevMonth)) {
        filterMonth.value = prevMonth;
    }
}

function applyFiltersAndRender() {
    const searchVal = filterSearch.value.trim().toLowerCase();
    const typeVal = filterType.value;
    const catVal = filterCategory.value;
    const monthVal = filterMonth.value;
    
    filteredTransactions = localTransactions.filter(t => {
        const matchesSearch = !searchVal || 
            (t.description && t.description.toLowerCase().includes(searchVal)) ||
            (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchVal)));
        const matchesType = typeVal === 'all' || t.type === typeVal;
        const matchesCat = catVal === 'all' || t.category === catVal;
        const matchesMonth = monthVal === 'all' || (t.date && t.date.startsWith(monthVal));
        
        return matchesSearch && matchesType && matchesCat && matchesMonth;
    });
    
    currentPage = 1;
    calculateSummaryCards(filteredTransactions);
    renderTable();
}

function renderTable() {
    ledgerTableBody.innerHTML = '';
    
    if (filteredTransactions.length === 0) {
        ledgerTableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="6">
                    <div class="empty-state">
                        <i data-lucide="file-text"></i>
                        <p>${getText('db_empty_state')}</p>
                    </div>
                </td>
            </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        paginationInfo.textContent = getText('db_page_info').replace('{current}', '1').replace('{total}', '1');
        return;
    }
    
    // Pagination math
    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredTransactions.length);
    const pageItems = filteredTransactions.slice(startIndex, endIndex);
    
    pageItems.forEach(t => {
        const row = document.createElement('tr');
        row.style.animation = 'fadeIn 0.25s ease-out';
        
        // Amount and Type formatting
        const isExpense = t.type === 'expense';
        const amountClass = isExpense ? 'text-error' : 'text-success';
        const amountPrefix = isExpense ? '-' : '+';
        
        const typeLabel = isExpense ? getText('db_expense_type') : getText('db_income_type');
        const typeBadgeStyle = isExpense
            ? 'background: rgba(239, 68, 68, 0.1); color: var(--error);'
            : 'background: rgba(16, 185, 129, 0.1); color: var(--success);';
        
        row.innerHTML = `
            <td>${t.date}</td>
            <td><span class="tag-badge" style="${typeBadgeStyle}">${typeLabel}</span></td>
            <td><span class="tag-badge" style="background: rgba(99, 102, 241, 0.08); color: var(--primary);">${getText('cat_' + t.category) || t.category}</span></td>
            <td style="font-weight: 500;">${escapeHTML(t.description || 'Untitled')}</td>
            <td class="text-right ${amountClass}" style="font-weight: 600; font-family: 'Outfit';">
                ${amountPrefix}${formatCurrency(t.amount)}
            </td>
            <td>
                <div class="action-btns">
                    <button class="action-btn action-btn-edit" data-id="${t.id}" title="Edit"><i data-lucide="edit-2"></i></button>
                    <button class="action-btn action-btn-delete" data-id="${t.id}" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        `;
        
        // Hook edit/delete actions
        row.querySelector('.action-btn-edit').addEventListener('click', () => showTxModal(t));
        row.querySelector('.action-btn-delete').addEventListener('click', () => handleTxDelete(t.id));
        
        ledgerTableBody.appendChild(row);
    });
    
    // Replace Lucide Icons
    if (window.lucide) window.lucide.createIcons();
    
    // Update pagination controls
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    paginationInfo.textContent = getText('db_page_info').replace('{current}', currentPage).replace('{total}', totalPages);
}

async function handleTxSubmit(e) {
    e.preventDefault();
    
    const id = txId.value;
    const tagsArray = txTags.value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
        
    const txData = {
        type: txType.value,
        amount: parseInt(txAmount.value, 10),
        category: txCategory.value,
        date: txDate.value,
        tags: tagsArray,
        description: txDescription.value.trim()
    };
    
    try {
        if (id) {
            await storage.updateTransaction(id, txData);
            showToast(getText('toast_tx_updated') || '交易紀錄已更新！', 'success');
        } else {
            await storage.addTransaction(txData);
            showToast(getText('toast_tx_added') || '交易紀錄已新增！', 'success');
        }
        
        hideTxModal();
        await refreshDashboard();
        
        // Notify app shell of data changes (to sync other views)
        if (changeCallback) changeCallback();
    } catch (err) {
        console.error("Save transaction error:", err);
        showToast("Failed to save transaction: " + err.message, "error");
    }
}

async function handleTxDelete(id) {
    const isConfirmed = await showConfirm(getText('confirm_delete_tx') || '確定要刪除這筆交易紀錄嗎？');
    if (!isConfirmed) return;
    
    try {
        await storage.deleteTransaction(id);
        showToast(getText('toast_tx_deleted') || '交易紀錄已刪除！', 'success');
        await refreshDashboard();
        if (changeCallback) changeCallback();
    } catch (err) {
        console.error("Delete transaction error:", err);
        showToast("Failed to delete: " + err.message, "error");
    }
}

// Formatter utils
export function formatCurrency(amount) {
    return '$' + Math.round(Math.abs(parseFloat(amount))).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
