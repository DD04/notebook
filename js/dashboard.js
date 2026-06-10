// js/dashboard.js - Personal Dashboard Ledger Module
import * as storage from './storage.js';
import { showToast } from './app.js';

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
    
    // Filtering listeners
    filterSearch.addEventListener('input', applyFiltersAndRender);
    filterType.addEventListener('change', applyFiltersAndRender);
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
        txModalTitle.textContent = 'Edit Transaction';
        txId.value = existingTx.id;
        txType.value = existingTx.type;
        txAmount.value = existingTx.amount;
        txCategory.value = existingTx.category;
        txDate.value = existingTx.date;
        txTags.value = (existingTx.tags || []).join(', ');
        txDescription.value = existingTx.description || '';
    } else {
        txModalTitle.textContent = 'Add Transaction';
        txId.value = '';
        // Pre-fill today's date
        txDate.value = new Date().toISOString().split('T')[0];
    }
    
    txModal.classList.add('active');
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
        calculateSummaryCards();
        applyFiltersAndRender();
    } catch (e) {
        console.error("Failed to load dashboard data", e);
        showToast("Error loading dashboard data: " + e.message, "error");
    }
}

function calculateSummaryCards() {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    
    localTransactions.forEach(t => {
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
    dbIncomeCount.textContent = `${incomeCount} entries`;
    dbExpenseCount.textContent = `${expenseCount} entries`;
    
    // Style balance text color
    dbNetBalance.className = 'card-amount';
    if (balance > 0) {
        dbNetBalance.classList.add('text-success');
    } else if (balance < 0) {
        dbNetBalance.classList.add('text-error');
    }
}

function populateFilterSelectors() {
    const categories = new Set(storage.DEFAULT_CATEGORIES);
    const months = new Set();
    
    localTransactions.forEach(t => {
        if (t.category) categories.add(t.category);
        if (t.date) {
            months.add(t.date.substring(0, 7)); // YYYY-MM
        }
    });
    
    // Save previous selections
    const prevCat = filterCategory.value;
    const prevMonth = filterMonth.value;
    
    // Fill categories dropdown in filters
    filterCategory.innerHTML = '<option value="all">All Categories</option>';
    Array.from(categories).sort().forEach(cat => {
        filterCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    
    // Fill months dropdown
    filterMonth.innerHTML = '<option value="all">All Months</option>';
    Array.from(months).sort().reverse().forEach(mon => {
        const dateObj = new Date(mon + '-02'); // Add buffer day to avoid TZ offset issues
        const formatted = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        filterMonth.innerHTML += `<option value="${mon}">${formatted}</option>`;
    });
    
    // Re-select previous filter options if still valid
    if (Array.from(categories).includes(prevCat)) {
        filterCategory.value = prevCat;
    }
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
                        <p>No transactions found. Add one to get started!</p>
                    </div>
                </td>
            </tr>
        `;
        lucide.replace();
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        paginationInfo.textContent = 'Page 1 of 1';
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
        
        // Tags badges HTML
        const tagsHtml = (t.tags || []).map(tag => `<span class="tag-badge">${escapeHTML(tag)}</span>`).join('');
        
        // Amount color formatting
        const isExpense = t.type === 'expense';
        const amountClass = isExpense ? 'text-error' : 'text-success';
        const amountPrefix = isExpense ? '-' : '+';
        
        row.innerHTML = `
            <td>${t.date}</td>
            <td style="font-weight: 500;">${escapeHTML(t.description || 'Untitled')}</td>
            <td><span class="tag-badge" style="background: rgba(99, 102, 241, 0.08); color: var(--primary);">${t.category}</span></td>
            <td><div style="max-width: 200px; display: flex; flex-wrap: wrap;">${tagsHtml}</div></td>
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
    lucide.replace();
    
    // Update pagination controls
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
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
        amount: parseFloat(txAmount.value),
        category: txCategory.value,
        date: txDate.value,
        tags: tagsArray,
        description: txDescription.value.trim()
    };
    
    try {
        if (id) {
            await storage.updateTransaction(id, txData);
            showToast("Transaction updated successfully!", "success");
        } else {
            await storage.addTransaction(txData);
            showToast("Transaction added successfully!", "success");
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
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    
    try {
        await storage.deleteTransaction(id);
        showToast("Transaction deleted successfully!", "success");
        await refreshDashboard();
        if (changeCallback) changeCallback();
    } catch (err) {
        console.error("Delete transaction error:", err);
        showToast("Failed to delete: " + err.message, "error");
    }
}

// Formatter utils
export function formatCurrency(amount) {
    return '$' + Math.abs(parseFloat(amount)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
