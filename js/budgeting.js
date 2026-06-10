// js/budgeting.js - Budget Management Dashboard Module
import * as storage from './storage.js';
import { formatCurrency, showToast } from './app.js';
import { getText } from './i18n.js';

// DOM elements
const budgetMonthPicker = document.getElementById('budgetMonthPicker');
const budgetSlidersGrid = document.getElementById('budgetSlidersGrid');

// State
let activeMonth = '';
let activeBudgets = [];
let transactions = [];

export function initBudgeting() {
    // Default to current month YYYY-MM
    const today = new Date();
    activeMonth = today.toISOString().substring(0, 7);
    budgetMonthPicker.value = activeMonth;
    
    budgetMonthPicker.addEventListener('change', (e) => {
        activeMonth = e.target.value;
        refreshBudgeting();
    });
}

export async function refreshBudgeting() {
    try {
        // Fetch budget configuration and transactions for this month
        activeBudgets = await storage.getBudgets(activeMonth);
        transactions = await storage.getTransactions();
        
        renderBudgetDashboard();
    } catch (e) {
        console.error("Failed to load budgeting views", e);
        showToast("Error loading budgets: " + e.message, "error");
    }
}

function renderBudgetDashboard() {
    budgetSlidersGrid.innerHTML = '';
    
    // 1. Group transaction expenses by category for this month
    const expensesByCategory = {};
    storage.DEFAULT_CATEGORIES.forEach(cat => {
        expensesByCategory[cat] = 0;
    });
    
    transactions.forEach(t => {
        if (t.type === 'expense' && t.date && t.date.startsWith(activeMonth)) {
            const cat = t.category || 'Other';
            if (!expensesByCategory[cat]) expensesByCategory[cat] = 0;
            expensesByCategory[cat] += parseFloat(t.amount);
        }
    });
    
    // 2. Iterate through categories and draw sliders/progress bars
    storage.DEFAULT_CATEGORIES.forEach(cat => {
        // Exclude income categories from budget settings
        if (cat === 'Salary' || cat === 'Investments') return;
        
        // Find existing budget limits
        const budgetObj = activeBudgets.find(b => b.category === cat);
        const budgetLimit = budgetObj ? parseFloat(budgetObj.amount) : 0.00;
        const totalSpent = expensesByCategory[cat] || 0.00;
        
        // Progress percentage calculation
        const percent = budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;
        const percentClamped = Math.min(percent, 100);
        
        // Status color class choice
        let statusClass = 'status-green';
        if (percent >= 100) {
            statusClass = 'status-red';
        } else if (percent >= 80) {
            statusClass = 'status-yellow';
        }
        
        // Remaining balance calculation
        const remaining = budgetLimit - totalSpent;
        let limitText = '';
        if (budgetLimit > 0) {
            if (remaining >= 0) {
                limitText = `剩餘 ${formatCurrency(remaining)}`;
            } else {
                limitText = `<span class="text-error" style="font-weight:600;">超支 ${formatCurrency(Math.abs(remaining))}</span>`;
            }
        } else {
            limitText = '無上限';
        }
        
        // Tooltip text for progress track hover
        const tooltipText = budgetLimit > 0
            ? `已消費 ${formatCurrency(totalSpent)} (${percent.toFixed(1)}%)`
            : `已消費 ${formatCurrency(totalSpent)} (無預算上限)`;
            
        const row = document.createElement('div');
        row.className = 'budget-item-row card-box bg-glass';
        row.style.animation = 'fadeIn 0.3s ease-out';
        
        row.innerHTML = `
            <div class="budget-row-meta">
                <span class="budget-cat-name">${getText('cat_' + cat) || cat}</span>
                <div class="budget-limits">
                    <span class="budget-limit-val">${limitText}</span>
                </div>
            </div>
            
            <div class="budget-progress-track" title="${tooltipText}">
                <div class="budget-progress-fill ${statusClass}" style="width: ${percentClamped}%"></div>
            </div>
            
            <div class="budget-input-wrapper">
                <label for="slider-${cat}">${getText('budget_set_limit')}</label>
                <input type="range" class="budget-slider" id="slider-${cat}" min="0" max="3000" step="50" value="${budgetLimit}">
                <span style="font-family: 'Outfit'; font-size: 13px; font-weight:600; min-width:50px; text-align:right;" id="slider-val-${cat}">
                    $${budgetLimit}
                </span>
            </div>
        `;
        
        // Slider change events
        const slider = row.querySelector(`#slider-${cat}`);
        const sliderLabel = row.querySelector(`#slider-val-${cat}`);
        
        // Dynamic drag display update
        slider.addEventListener('input', (e) => {
            sliderLabel.textContent = `$${e.target.value}`;
        });
        
        // Save to storage on drag release (change)
        slider.addEventListener('change', async (e) => {
            const newLimit = parseFloat(e.target.value);
            try {
                if (newLimit === 0) {
                    await storage.deleteBudget(cat, activeMonth);
                    showToast(`${getText('cat_' + cat) || cat} 預算已移除上限`, 'success');
                } else {
                    await storage.setBudget(cat, newLimit, activeMonth);
                    showToast(`${getText('cat_' + cat) || cat} 預算已設定 $${newLimit}`, 'success');
                }
                
                // Reload data
                await refreshBudgeting();
            } catch (err) {
                console.error('Set budget limit error:', err);
                showToast((getText('toast_budget_fail') || '預算儲存失敗：') + err.message, 'error');
            }
        });
        
        budgetSlidersGrid.appendChild(row);
    });
}
