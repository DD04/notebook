// js/analytics.js - Chart.js refactored Charting and Analytics Module
import * as storage from './storage.js';
import { formatCurrency, escapeHTML } from './dashboard.js';
import { getText } from './i18n.js';

let transactions = [];

// Chart.js instances
let donutChartInstance = null;
let barChartInstance = null;

export function initAnalytics() {
    const analyticsMonthSelect = document.getElementById('analyticsMonthSelect');
    const analyticsRangeSelect = document.getElementById('analyticsRangeSelect');

    if (analyticsMonthSelect) {
        analyticsMonthSelect.addEventListener('change', () => {
            renderCategoryDonut();
        });
    }

    if (analyticsRangeSelect) {
        analyticsRangeSelect.addEventListener('change', () => {
            renderTrendBarChart();
        });
    }
}

export async function refreshAnalytics() {
    try {
        transactions = await storage.getTransactions();
        
        populateAnalyticsMonthSelect();
        renderCategoryDonut();
        renderTrendBarChart();
    } catch (e) {
        console.error("Failed to render analytics", e);
    }
}

function populateAnalyticsMonthSelect() {
    const analyticsMonthSelect = document.getElementById('analyticsMonthSelect');
    if (!analyticsMonthSelect) return;

    const months = new Set();
    transactions.forEach(t => {
        if (t.date) {
            months.add(t.date.substring(0, 7)); // YYYY-MM
        }
    });

    const prevMonth = analyticsMonthSelect.value;
    
    analyticsMonthSelect.innerHTML = `<option value="all">${getText('db_all_months') || '所有月份'}</option>`;
    
    Array.from(months).sort().reverse().forEach(mon => {
        const dateObj = new Date(mon + '-02'); // Buffer day
        const formatted = dateObj.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });
        analyticsMonthSelect.innerHTML += `<option value="${mon}">${formatted}</option>`;
    });

    // Restore previous selection if still valid
    if (Array.from(months).includes(prevMonth) || prevMonth === 'all') {
        analyticsMonthSelect.value = prevMonth;
    } else {
        analyticsMonthSelect.value = 'all';
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
    
    const analyticsMonthSelect = document.getElementById('analyticsMonthSelect');
    const selectedMonth = analyticsMonthSelect ? analyticsMonthSelect.value : 'all';

    const filteredTxs = transactions.filter(t => {
        if (selectedMonth === 'all') return true;
        return t.date && t.date.startsWith(selectedMonth);
    });
        
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
    
    const filteredTxs = transactions;
    
    const analyticsRangeSelect = document.getElementById('analyticsRangeSelect');
    const monthsToDisplay = analyticsRangeSelect ? parseInt(analyticsRangeSelect.value, 10) : 6;
        
    // Group values by month
    const monthlySummary = {};
    const monthsArray = [];
    
    const today = new Date();
    for (let i = monthsToDisplay - 1; i >= 0; i--) {
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


