// js/exportPdf.js - Shared PDF ledger export (categorized cash-flow-statement style),
// rendered off-screen with the browser's own CJK font rendering, then rasterized via
// html2canvas + jsPDF. This trades selectable text for zero font-embedding complexity.
import { getText } from './i18n.js';

const COLOR_PRIMARY = '#4F46E5';
const COLOR_INCOME = '#059669';
const COLOR_EXPENSE = '#DC2626';
const COLOR_TEXT = '#1E293B';
const COLOR_MUTED = '#64748B';
const COLOR_BORDER = '#E2E8F0';

function formatAmount(n) {
    return '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
}

function categoryLabel(cat) {
    return (cat && (getText('cat_' + cat) || cat)) || getText('cat_other') || '其他';
}

function memberLabel(tx) {
    return (tx.profiles && tx.profiles.nickname) || tx.member_nickname || '';
}

function sanitizeFilename(name) {
    return (name || '').replace(/[\\/:*?"<>|]/g, '_');
}

function groupByCategory(rows) {
    const map = new Map();
    rows.forEach(t => {
        const cat = t.category || 'other';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push(t);
    });
    const groups = Array.from(map.entries()).map(([cat, items]) => {
        const total = items.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const sorted = items.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        return { category: cat, items: sorted, total };
    });
    groups.sort((a, b) => b.total - a.total);
    return groups;
}

function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (key === 'style') Object.assign(node.style, value);
        else if (key === 'text') node.textContent = value;
        else node.setAttribute(key, value);
    });
    children.forEach(child => child && node.appendChild(child));
    return node;
}

function buildSection(typeLabel, rows, accentColor, includeMember) {
    const groups = groupByCategory(rows);
    const sectionTotal = rows.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const section = el('div', { style: { marginBottom: '18px' } });

    section.appendChild(el('div', {
        text: typeLabel,
        style: {
            fontSize: '14px', fontWeight: '700', color: '#ffffff',
            background: accentColor, padding: '6px 12px', borderRadius: '4px',
            marginBottom: '8px'
        }
    }));

    groups.forEach(group => {
        const groupBox = el('div', { style: { marginBottom: '8px' } });
        groupBox.appendChild(el('div', {
            text: categoryLabel(group.category),
            style: { fontSize: '12px', fontWeight: '700', color: COLOR_TEXT, margin: '4px 0 2px' }
        }));

        group.items.forEach(tx => {
            const row = el('div', {
                style: {
                    display: 'flex', alignItems: 'baseline', fontSize: '11px',
                    color: COLOR_TEXT, padding: '2px 0 2px 12px', gap: '8px'
                }
            });
            row.appendChild(el('span', { text: tx.date || '', style: { width: '90px', color: COLOR_MUTED, flexShrink: '0' } }));
            row.appendChild(el('span', {
                text: tx.description || '',
                style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
            }));
            if (includeMember) {
                row.appendChild(el('span', {
                    text: memberLabel(tx),
                    style: { width: '70px', color: COLOR_MUTED, textAlign: 'right', flexShrink: '0' }
                }));
            }
            row.appendChild(el('span', {
                text: formatAmount(tx.amount),
                style: { width: '90px', textAlign: 'right', flexShrink: '0' }
            }));
            groupBox.appendChild(row);
        });

        const subtotalRow = el('div', {
            style: {
                display: 'flex', fontSize: '11px', fontWeight: '600', color: COLOR_TEXT,
                padding: '4px 0 4px 12px', borderTop: `1px solid ${COLOR_BORDER}`, marginTop: '2px', gap: '8px'
            }
        });
        subtotalRow.appendChild(el('span', { text: '小計', style: { flex: '1' } }));
        subtotalRow.appendChild(el('span', { text: formatAmount(group.total), style: { width: '90px', textAlign: 'right', flexShrink: '0' } }));
        groupBox.appendChild(subtotalRow);

        section.appendChild(groupBox);
    });

    if (groups.length === 0) {
        section.appendChild(el('div', {
            text: '無資料',
            style: { fontSize: '11px', color: COLOR_MUTED, padding: '4px 0 4px 12px' }
        }));
    }

    const totalRow = el('div', {
        style: {
            display: 'flex', fontSize: '13px', fontWeight: '700', color: accentColor,
            padding: '6px 0', borderTop: `2px solid ${accentColor}`, marginTop: '4px', gap: '8px'
        }
    });
    totalRow.appendChild(el('span', { text: `${typeLabel}合計`, style: { flex: '1' } }));
    totalRow.appendChild(el('span', { text: formatAmount(sectionTotal), style: { width: '90px', textAlign: 'right', flexShrink: '0' } }));
    section.appendChild(totalRow);

    return { section, sectionTotal };
}

function buildStatementDom({ title, transactions, includeMember }) {
    const incomeRows = transactions.filter(t => t.type === 'income');
    const expenseRows = transactions.filter(t => t.type === 'expense');

    const dates = transactions.map(t => t.date).filter(Boolean).sort();
    const periodLabel = dates.length
        ? `統計期間：${dates[0]} ～ ${dates[dates.length - 1]}`
        : '統計期間：無資料';
    const generatedLabel = `製表日期：${new Date().toLocaleDateString('zh-TW')}`;

    const root = el('div', {
        style: {
            width: '698px', padding: '48px', background: '#ffffff', boxSizing: 'content-box',
            fontFamily: "'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', sans-serif",
            color: COLOR_TEXT
        }
    });

    root.appendChild(el('div', {
        text: title,
        style: { fontSize: '22px', fontWeight: '700', textAlign: 'center', color: COLOR_PRIMARY, marginBottom: '6px' }
    }));
    root.appendChild(el('div', {
        style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: COLOR_MUTED, marginBottom: '4px' }
    }, [
        el('span', { text: periodLabel }),
        el('span', { text: generatedLabel })
    ]));
    root.appendChild(el('div', { style: { borderTop: `2px solid ${COLOR_PRIMARY}`, marginBottom: '16px' } }));

    const { section: incomeSection, sectionTotal: incomeTotal } =
        buildSection(getText('db_income_type') || '收入', incomeRows, COLOR_INCOME, includeMember);
    const { section: expenseSection, sectionTotal: expenseTotal } =
        buildSection(getText('db_expense_type') || '支出', expenseRows, COLOR_EXPENSE, includeMember);
    root.appendChild(incomeSection);
    root.appendChild(expenseSection);

    const net = incomeTotal - expenseTotal;
    const netRow = el('div', {
        style: {
            display: 'flex', fontSize: '15px', fontWeight: '700', color: '#ffffff',
            background: net < 0 ? COLOR_EXPENSE : COLOR_PRIMARY,
            padding: '10px 12px', borderRadius: '4px', marginTop: '12px', gap: '8px'
        }
    });
    netRow.appendChild(el('span', { text: '本期淨額', style: { flex: '1' } }));
    netRow.appendChild(el('span', {
        text: (net < 0 ? '-' : '') + formatAmount(net),
        style: { width: '90px', textAlign: 'right', flexShrink: '0' }
    }));
    root.appendChild(netRow);

    return root;
}

/**
 * Renders a categorized income/expense statement off-screen and downloads it as a paginated A4 PDF.
 * @param {Object} opts
 * @param {string} opts.title - Statement title, e.g. "個人收支明細表".
 * @param {Array} opts.transactions - Transactions to export (already filtered by the caller).
 * @param {string} opts.filenamePrefix - Used to build the downloaded file's name.
 * @param {boolean} [opts.includeMember] - Shows a "記帳人" column per line (for group ledgers).
 */
export async function exportLedgerToPdf({ title, transactions, filenamePrefix, includeMember = false }) {
    if (!window.html2canvas || !window.jspdf) {
        throw new Error('PDF 匯出套件尚未載入完成，請稍後再試一次。');
    }

    const node = buildStatementDom({ title, transactions, includeMember });
    const wrapper = el('div', { style: { position: 'fixed', top: '0', left: '-10000px', zIndex: '-1' } }, [node]);
    document.body.appendChild(wrapper);

    try {
        const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidthMm = 210;
        const pageHeightMm = 297;
        const imgWidthMm = pageWidthMm;
        const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
        const imgData = canvas.toDataURL('image/png');

        let heightLeft = imgHeightMm;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm);
        heightLeft -= pageHeightMm;

        while (heightLeft > 0) {
            position -= pageHeightMm;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm);
            heightLeft -= pageHeightMm;
        }

        const timestamp = new Date().toISOString().substring(0, 10);
        pdf.save(`${sanitizeFilename(filenamePrefix)}_${timestamp}.pdf`);
    } finally {
        document.body.removeChild(wrapper);
    }
}
