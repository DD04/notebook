// js/budgeting.js - Budget Management Dashboard Module
import * as storage from './storage.js';
import { formatCurrency, showToast } from './app.js';

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
        
        const row = document.createElement('div');
        row.className = 'budget-item-row card-box bg-glass';
        row.style.animation = 'fadeIn 0.3s ease-out';
        
        row.innerHTML = `
            <div class="budget-row-meta">
                <span class="budget-cat-name">${cat}</span>
                <div class="budget-limits">
                    <span class="budget-spent ${totalSpent > budgetLimit && budgetLimit > 0 ? 'text-error' : ''}">
                        ${formatCurrency(totalSpent)}
                    </span>
                    <span class="budget-limit-val"> / ${budgetLimit > 0 ? formatCurrency(budgetLimit) : 'No Limit'}</span>
                </div>
            </div>
            
            <div class="budget-progress-track">
                <div class="budget-progress-fill ${statusClass}" style="width: ${percentClamped}%"></div>
            </div>
            
            <div class="budget-input-wrapper">
                <label for="slider-${cat}">Set Limit:</label>
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
                await storage.setBudget(cat, newLimit, activeMonth);
                showToast(`Budget for ${cat} set to $${newLimit}`, "success");
                
                // Reload data
                await refreshBudgeting();
            } catch (err) {
                console.error("Set budget limit error:", err);
                showToast("Failed to save budget: " + err.message, "error");
            }
        });
        
        budgetSlidersGrid.appendChild(row);
    });
}
