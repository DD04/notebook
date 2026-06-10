// js/analytics.js - Chart.js refactored Charting and Analytics Module
import * as storage from './storage.js';
import { formatCurrency, escapeHTML } from './dashboard.js';
import { getText } from './i18n.js';

let transactions = [];
let activeFilterTag = null; // Currently active tag filter

// Chart.js instances
let donutChartInstance = null;
let barChartInstance = null;

export async function refreshAnalytics() {
    try {
        transactions = await storage.getTransactions();
        
        renderCategoryDonut();
        renderTrendBarChart();
        renderTagsAnalytics();
    } catch (e) {
        console.error("Failed to render analytics", e);
    }
}

// Color palette matching the theme variables (Vibrant Tailored Colors)
const CHART_COLORS = [
    '#6366F1', // Indigo
    '#10B981', // Emerald
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#3B82F6'  // Blue
];

/* ==========================================================================
   DONUT CHART (Category Breakdown - Expense Only)
   ========================================================================== */
function renderCategoryDonut() {
    const donutCanvas = document.getElementById('categoryDonutChart');
    const donutEmptyMessage = document.getElementById('donutEmptyMessage');
    
    // Destroy previous instance to avoid canvas reuse errors
    if (donutChartInstance) {
        donutChartInstance.destroy();
        donutChartInstance = null;
    }
    
    // Filter transactions if a tag filter is active
    const filteredTxs = activeFilterTag
        ? transactions.filter(t => t.tags && t.tags.some(tag => tag.trim() === activeFilterTag))
        : transactions;
        
    // Group expense items ONLY
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
        donutEmptyMessage.textContent = getText('analytics_no_expense') || '無支出數據';
        return;
    }
    
    donutCanvas.classList.remove('d-none');
    donutEmptyMessage.classList.add('d-none');
    
    const labels = categoriesSorted.map(([cat]) => getText('cat_' + cat) || cat);
    const data = categoriesSorted.map(([, val]) => val);
    const backgroundColors = categoriesSorted.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]);
    
    donutChartInstance = new window.Chart(donutCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 1,
                borderColor: '#1e1e2e', // Match theme card bg
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
                        font: {
                            family: "'Outfit', sans-serif",
                            size: 11
                        }
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
                            return ` ${context.label}: $${value.toFixed(2)} (${percent.toFixed(1)}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

/* ==========================================================================
   TREND BAR CHART (Monthly Cash Flow)
   ========================================================================== */
function renderTrendBarChart() {
    const barCanvas = document.getElementById('trendBarChart');
    
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }
    
    // Filter transactions if a tag filter is active
    const filteredTxs = activeFilterTag
        ? transactions.filter(t => t.tags && t.tags.some(tag => tag.trim() === activeFilterTag))
        : transactions;
        
    // Group values by month (last 6 months, starting from current month)
    const monthlySummary = {};
    const monthsArray = [];
    
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        monthsArray.push(key);
        monthlySummary[key] = { income: 0, expense: 0 };
    }
    
    filteredTxs.forEach(t => {
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
    
    const labels = monthsArray.map(mKey => {
        const parts = mKey.split('-');
        return `${parts[0]}年${parts[1]}月`;
    });
    
    const incomeData = monthsArray.map(mKey => monthlySummary[mKey].income);
    const expenseData = monthsArray.map(mKey => monthlySummary[mKey].expense);
    
    barChartInstance = new window.Chart(barCanvas, {
        type: 'bar',
        data: {
            labels: labels,
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
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)'
                    },
                    ticks: {
                        color: '#a1a1aa',
                        font: {
                            family: "'Outfit', sans-serif",
                            size: 10
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)'
                    },
                    ticks: {
                        color: '#a1a1aa',
                        font: {
                            family: "'Outfit', sans-serif",
                            size: 10
                        },
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#a1a1aa',
                        boxWidth: 12,
                        font: {
                            family: "'Outfit', sans-serif",
                            size: 11
                        }
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
                            return ` ${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

/* ==========================================================================
   TAG ANALYTICS SUMMARY
   ========================================================================== */
function renderTagsAnalytics() {
    analyticsTagsList.innerHTML = '';
    
    // Group expense amounts by tag
    const tagTotals = {};
    
    transactions.forEach(t => {
        if (t.type === 'expense' && t.tags && Array.isArray(t.tags)) {
            const val = parseFloat(t.amount);
            t.tags.forEach(tag => {
                const normalized = tag.trim();
                if (normalized) {
                    tagTotals[normalized] = (tagTotals[normalized] || 0) + val;
                }
            });
        }
    });
    
    const sortedTags = Object.entries(tagTotals)
        .sort((a, b) => b[1] - a[1]);
        
    if (sortedTags.length === 0) {
        analyticsTagsList.innerHTML = `<p class="text-muted" style="font-size: 14px;">${getText('analytics_no_tags')}</p>`;
        return;
    }
    
    sortedTags.forEach(([tag, val]) => {
        const badge = document.createElement('div');
        badge.className = 'tag-stat-badge';
        if (activeFilterTag === tag) {
            badge.classList.add('active');
        }
        badge.innerHTML = `
            <span class="tag-stat-name">#${escapeHTML(tag)}</span>
            <span class="tag-stat-val">${formatCurrency(val)}</span>
        `;
        
        // Toggle active filter tag and redraw charts
        badge.addEventListener('click', () => {
            if (activeFilterTag === tag) {
                activeFilterTag = null;
            } else {
                activeFilterTag = tag;
            }
            renderCategoryDonut();
            renderTrendBarChart();
            renderTagsAnalytics();
        });
        
        analyticsTagsList.appendChild(badge);
    });
}
