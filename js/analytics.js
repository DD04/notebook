// js/analytics.js - Dynamic SVG Charting and Analytics Module
import * as storage from './storage.js';
import { formatCurrency, escapeHTML } from './dashboard.js';
import { getText } from './i18n.js';

// DOM elements
const categoryDonutChart = document.getElementById('categoryDonutChart');
const categoryLegend = document.getElementById('categoryLegend');
const donutTooltip = document.getElementById('donutTooltip');

const trendBarChart = document.getElementById('trendBarChart');
const trendTooltip = document.getElementById('trendTooltip');

const analyticsTagsList = document.getElementById('analyticsTagsList');

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

let transactions = [];

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

/* ==========================================================================
   DONUT CHART (Category Breakdown)
   ========================================================================== */
function renderCategoryDonut() {
    categoryDonutChart.innerHTML = '';
    categoryLegend.innerHTML = '';
    
    // Group expense items
    const catTotals = {};
    let totalExpense = 0;
    
    transactions.forEach(t => {
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
        categoryDonutChart.innerHTML = `
            <text x="100" y="100" text-anchor="middle" fill="var(--text-muted)" font-size="12">
                ${getText('analytics_no_expense')}
            </text>
        `;
        return;
    }
    
    // Draw SVG Donut
    const r = 55;
    const cx = 100;
    const cy = 100;
    const circ = 2 * Math.PI * r;
    let accumulatedAngle = 0;
    
    // Background track
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', cx);
    bgCircle.setAttribute('cy', cy);
    bgCircle.setAttribute('r', r);
    bgCircle.setAttribute('fill', 'transparent');
    bgCircle.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
    bgCircle.setAttribute('stroke-width', '18');
    categoryDonutChart.appendChild(bgCircle);
    
    categoriesSorted.forEach(([cat, val], idx) => {
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        const percent = val / totalExpense;
        const strokeLength = percent * circ;
        const strokeOffset = circ - accumulatedAngle;
        
        // Add chart segment
        const slice = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        slice.setAttribute('cx', cx);
        slice.setAttribute('cy', cy);
        slice.setAttribute('r', r);
        slice.setAttribute('fill', 'transparent');
        slice.setAttribute('stroke', color);
        slice.setAttribute('stroke-width', '18');
        slice.setAttribute('stroke-dasharray', `${strokeLength} ${circ}`);
        slice.setAttribute('stroke-dashoffset', strokeOffset.toString());
        slice.setAttribute('transform', 'rotate(-90 100 100)'); // Start at top
        slice.setAttribute('class', 'chart-slice');
        
        // Tooltip listeners
        slice.addEventListener('mouseenter', (e) => {
            donutTooltip.style.opacity = '1';
            donutTooltip.innerHTML = `
                <strong>${cat}</strong><br>
                ${formatCurrency(val)} (${(percent * 100).toFixed(1)}%)
            `;
            updateTooltipPos(donutTooltip, e, categoryDonutChart);
        });
        
        slice.addEventListener('mousemove', (e) => {
            updateTooltipPos(donutTooltip, e, categoryDonutChart);
        });
        
        slice.addEventListener('mouseleave', () => {
            donutTooltip.style.opacity = '0';
        });
        
        categoryDonutChart.appendChild(slice);
        
        // Accumulate segment angle
        accumulatedAngle += strokeLength;
        
        // Add Legend Element
        const legendItem = document.createElement('span');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <span class="legend-color" style="background-color: ${color}"></span>
            ${cat} (${(percent * 100).toFixed(0)}%)
        `;
        categoryLegend.appendChild(legendItem);
    });
    
    // Add Center Summary Text
    const centerTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerTitle.setAttribute('x', cx.toString());
    centerTitle.setAttribute('y', (cy - 6).toString());
    centerTitle.setAttribute('text-anchor', 'middle');
    centerTitle.setAttribute('fill', 'var(--text-muted)');
    centerTitle.setAttribute('font-size', '10');
    centerTitle.setAttribute('font-weight', '500');
    centerTitle.textContent = getText('analytics_total_exp') || 'TOTAL EXPENSES';
    categoryDonutChart.appendChild(centerTitle);
    
    const centerVal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerVal.setAttribute('x', cx.toString());
    centerVal.setAttribute('y', (cy + 12).toString());
    centerVal.setAttribute('text-anchor', 'middle');
    centerVal.setAttribute('fill', 'var(--text-primary)');
    centerVal.setAttribute('font-size', '14');
    centerVal.setAttribute('font-weight', '700');
    centerVal.setAttribute('font-family', 'Outfit');
    centerVal.textContent = formatCurrency(totalExpense);
    categoryDonutChart.appendChild(centerVal);
}

/* ==========================================================================
   TREND BAR CHART (Monthly Cash Flow)
   ========================================================================== */
function renderTrendBarChart() {
    trendBarChart.innerHTML = '';
    
    // 1. Group transaction values by month (last 6 months)
    const monthlySummary = {};
    const monthsArray = [];
    
    // Build array of last 6 months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toISOString().substring(0, 7); // YYYY-MM
        monthsArray.push(key);
        monthlySummary[key] = { income: 0, expense: 0 };
    }
    
    // Populate summaries
    transactions.forEach(t => {
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
    
    // Find max value for scaling heights
    let maxVal = 100; // Minimum default ceiling scale
    monthsArray.forEach(m => {
        maxVal = Math.max(maxVal, monthlySummary[m].income, monthlySummary[m].expense);
    });
    
    // Draw SVG Bar Elements
    const chartHeight = 150;
    const chartWidth = 340;
    const paddingLeft = 35;
    const paddingBottom = 30;
    const colSpacing = (chartWidth - paddingLeft) / 6;
    
    // Draw Y gridlines and Axis labels
    const gridLinesCount = 4;
    for (let i = 0; i <= gridLinesCount; i++) {
        const gridVal = (maxVal / gridLinesCount) * i;
        const yPos = chartHeight - ((gridVal / maxVal) * (chartHeight - 10));
        
        // Grid Line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', paddingLeft.toString());
        line.setAttribute('y1', yPos.toString());
        line.setAttribute('x2', chartWidth.toString());
        line.setAttribute('y2', yPos.toString());
        line.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
        line.setAttribute('stroke-dasharray', '3,3');
        trendBarChart.appendChild(line);
        
        // Grid Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (paddingLeft - 8).toString());
        text.setAttribute('y', (yPos + 4).toString());
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('fill', 'var(--text-muted)');
        text.setAttribute('font-size', '9');
        text.textContent = formatAxisValue(gridVal);
        trendBarChart.appendChild(text);
    }
    
    // Draw monthly side-by-side bars
    monthsArray.forEach((mKey, idx) => {
        const stats = monthlySummary[mKey];
        const xCenter = paddingLeft + (idx * colSpacing) + (colSpacing / 2);
        
        const dateObj = new Date(mKey + '-02');
        const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'short' });
        
        // Income Bar (Emerald)
        const inHeight = (stats.income / maxVal) * (chartHeight - 10);
        const inRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        inRect.setAttribute('x', (xCenter - 14).toString());
        inRect.setAttribute('y', (chartHeight - inHeight).toString());
        inRect.setAttribute('width', '11');
        inRect.setAttribute('height', Math.max(inHeight, 1).toString());
        inRect.setAttribute('fill', 'var(--success)');
        inRect.setAttribute('rx', '3');
        inRect.setAttribute('class', 'chart-bar');
        
        // Expense Bar (Red)
        const exHeight = (stats.expense / maxVal) * (chartHeight - 10);
        const exRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        exRect.setAttribute('x', (xCenter + 1).toString());
        exRect.setAttribute('y', (chartHeight - exHeight).toString());
        exRect.setAttribute('width', '11');
        exRect.setAttribute('height', Math.max(exHeight, 1).toString());
        exRect.setAttribute('fill', 'var(--error)');
        exRect.setAttribute('rx', '3');
        exRect.setAttribute('class', 'chart-bar');
        
        // Setup hover details for bars
        [ { el: inRect, val: stats.income, label: getText('db_income_type') }, 
          { el: exRect, val: stats.expense, label: getText('db_expense_type') } ].forEach(item => {
            item.el.addEventListener('mouseenter', (e) => {
                trendTooltip.style.opacity = '1';
                trendTooltip.innerHTML = `
                    <strong>${monthLabel} ${dateObj.getFullYear()}</strong><br>
                    ${item.label}: ${formatCurrency(item.val)}
                `;
                updateTooltipPos(trendTooltip, e, trendBarChart);
            });
            item.el.addEventListener('mousemove', (e) => {
                updateTooltipPos(trendTooltip, e, trendBarChart);
            });
            item.el.addEventListener('mouseleave', () => {
                trendTooltip.style.opacity = '0';
            });
        });
        
        trendBarChart.appendChild(inRect);
        trendBarChart.appendChild(exRect);
        
        // Month X Label
        const xText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        xText.setAttribute('x', xCenter.toString());
        xText.setAttribute('y', (chartHeight + 20).toString());
        xText.setAttribute('text-anchor', 'middle');
        xText.setAttribute('fill', 'var(--text-secondary)');
        xText.setAttribute('font-size', '10');
        xText.setAttribute('font-weight', '500');
        xText.textContent = monthLabel;
        trendBarChart.appendChild(xText);
    });
}

// Helpers for tooltip coordinate offsets
function updateTooltipPos(tooltipEl, event, relativeToSvg) {
    const rect = relativeToSvg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Display tooltip slightly above and to the right of the mouse pointer
    tooltipEl.style.left = (x + 12) + 'px';
    tooltipEl.style.top = (y - 42) + 'px';
}

function formatAxisValue(val) {
    if (val >= 1000) {
        return '$' + (val / 1000).toFixed(1) + 'k';
    }
    return '$' + val.toFixed(0);
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
        badge.innerHTML = `
            <span class="tag-stat-name">#${escapeHTML(tag)}</span>
            <span class="tag-stat-val">${formatCurrency(val)}</span>
        `;
        analyticsTagsList.appendChild(badge);
    });
}
