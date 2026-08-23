// js/exportExcel.js - Shared Excel (.xlsx) ledger export, styled with the app's brand colors.
import { getText } from './i18n.js';

const COLOR_PRIMARY = 'FF6366F1';
const COLOR_INCOME = 'FF10B981';
const COLOR_EXPENSE = 'FFEF4444';
const COLOR_HEADER_TEXT = 'FFFFFFFF';
const COLOR_COL_HEADER_BG = 'FFF1F5F9';
const COLOR_TOTAL_BG = 'FFF8FAFC';
const COLOR_BORDER = 'FFE2E8F0';
const COLOR_TEXT = 'FF1E293B';

function thinBorder() {
    return {
        top: { style: 'thin', color: { argb: COLOR_BORDER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } }
    };
}

function categoryLabel(cat) {
    return (cat && (getText('cat_' + cat) || cat)) || '';
}

function memberLabel(tx) {
    return (tx.profiles && tx.profiles.nickname) || tx.member_nickname || '';
}

function buildColumns(includeMember) {
    const cols = [
        { label: '序號', width: 6, align: 'center', getValue: (tx, seq) => seq }
    ];
    if (includeMember) {
        cols.push({ label: '日期', width: 12, align: 'left', getValue: tx => tx.date || '' });
        cols.push({ label: '記帳人', width: 10, align: 'left', getValue: memberLabel });
    } else {
        cols.push({ label: '日期', width: 12, align: 'left', getValue: tx => tx.date || '' });
    }
    cols.push({ label: '分類', width: 10, align: 'left', getValue: tx => categoryLabel(tx.category) });
    cols.push({ label: '說明', width: 22, align: 'left', getValue: tx => tx.description || '' });
    cols.push({ label: '金額', width: 12, align: 'right', numFmt: '#,##0', getValue: tx => parseFloat(tx.amount) || 0 });
    return cols;
}

function sanitizeFilename(name) {
    return (name || '').replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * Builds and downloads a two-column (income vs expense) ledger as a styled .xlsx file.
 * @param {Object} opts
 * @param {string} opts.title - Big banner title shown at the top of the sheet, e.g. "個人收支明細表".
 * @param {Array} opts.transactions - Transactions to export (already filtered by the caller).
 * @param {string} opts.filenamePrefix - Used to build the downloaded file's name.
 * @param {boolean} [opts.includeMember] - Adds a "記帳人" column (for group ledgers).
 */
export async function exportLedgerToExcel({ title, transactions, filenamePrefix, includeMember = false }) {
    if (!window.ExcelJS) {
        throw new Error('Excel 匯出套件尚未載入完成，請稍後再試一次。');
    }

    const incomeRows = transactions
        .filter(t => t.type === 'income')
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const expenseRows = transactions
        .filter(t => t.type === 'expense')
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const cols = buildColumns(includeMember);
    const n = cols.length;
    const expenseStartCol = n + 2; // one spacer column between the two blocks
    const totalCols = expenseStartCol + n - 1;

    const workbook = new window.ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('收支明細表');

    const columnWidths = [];
    for (let i = 0; i < totalCols; i++) {
        if (i === n) {
            columnWidths.push({ width: 3 }); // spacer
        } else {
            const col = i < n ? cols[i] : cols[i - expenseStartCol + 1];
            columnWidths.push({ width: col.width });
        }
    }
    sheet.columns = columnWidths;

    // Row 1: main title banner
    sheet.mergeCells(1, 1, 1, totalCols);
    const titleCell = sheet.getRow(1).getCell(1);
    titleCell.value = title;
    titleCell.font = { name: 'Microsoft JhengHei', size: 16, bold: true, color: { argb: COLOR_HEADER_TEXT } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } };
    sheet.getRow(1).height = 32;

    // Row 2: income / expense section bands
    sheet.mergeCells(2, 1, 2, n);
    sheet.mergeCells(2, expenseStartCol, 2, totalCols);
    const incomeBand = sheet.getRow(2).getCell(1);
    incomeBand.value = `${getText('db_income_type') || '收入'}明細`;
    const expenseBand = sheet.getRow(2).getCell(expenseStartCol);
    expenseBand.value = `${getText('db_expense_type') || '支出'}明細`;
    [[incomeBand, COLOR_INCOME], [expenseBand, COLOR_EXPENSE]].forEach(([cell, color]) => {
        cell.font = { bold: true, size: 12, color: { argb: COLOR_HEADER_TEXT } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    });
    sheet.getRow(2).height = 24;

    // Row 3: column headers
    [1, expenseStartCol].forEach(startCol => {
        cols.forEach((col, idx) => {
            const cell = sheet.getRow(3).getCell(startCol + idx);
            cell.value = col.label;
            cell.font = { bold: true, color: { argb: COLOR_TEXT } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_COL_HEADER_BG } };
            cell.border = thinBorder();
        });
    });

    // Data rows (padded so both blocks reach the same bottom row)
    const maxRows = Math.max(incomeRows.length, expenseRows.length, 1);
    let incomeTotal = 0;
    let expenseTotal = 0;

    for (let i = 0; i < maxRows; i++) {
        const rowNum = 4 + i;
        const inc = incomeRows[i];
        const exp = expenseRows[i];

        cols.forEach((col, idx) => {
            const cell = sheet.getRow(rowNum).getCell(1 + idx);
            if (inc) cell.value = col.getValue(inc, i + 1);
            cell.border = thinBorder();
            cell.alignment = { vertical: 'middle', horizontal: col.align };
            if (col.numFmt && inc) cell.numFmt = col.numFmt;
        });
        if (inc) incomeTotal += parseFloat(inc.amount) || 0;

        cols.forEach((col, idx) => {
            const cell = sheet.getRow(rowNum).getCell(expenseStartCol + idx);
            if (exp) cell.value = col.getValue(exp, i + 1);
            cell.border = thinBorder();
            cell.alignment = { vertical: 'middle', horizontal: col.align };
            if (col.numFmt && exp) cell.numFmt = col.numFmt;
        });
        if (exp) expenseTotal += parseFloat(exp.amount) || 0;
    }

    // Totals row
    const totalRowNum = 4 + maxRows;
    sheet.mergeCells(totalRowNum, 1, totalRowNum, n - 1);
    sheet.mergeCells(totalRowNum, expenseStartCol, totalRowNum, totalCols - 1);
    const incomeTotalLabel = sheet.getRow(totalRowNum).getCell(1);
    const incomeTotalValue = sheet.getRow(totalRowNum).getCell(n);
    const expenseTotalLabel = sheet.getRow(totalRowNum).getCell(expenseStartCol);
    const expenseTotalValue = sheet.getRow(totalRowNum).getCell(totalCols);

    incomeTotalLabel.value = '合計';
    incomeTotalValue.value = incomeTotal;
    expenseTotalLabel.value = '合計';
    expenseTotalValue.value = expenseTotal;

    [incomeTotalLabel, incomeTotalValue, expenseTotalLabel, expenseTotalValue].forEach(cell => {
        cell.font = { bold: true, color: { argb: COLOR_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
        cell.border = thinBorder();
        cell.alignment = { vertical: 'middle' };
    });
    incomeTotalLabel.alignment = { vertical: 'middle', horizontal: 'right' };
    expenseTotalLabel.alignment = { vertical: 'middle', horizontal: 'right' };
    incomeTotalValue.alignment = { vertical: 'middle', horizontal: 'right' };
    expenseTotalValue.alignment = { vertical: 'middle', horizontal: 'right' };
    incomeTotalValue.numFmt = '#,##0';
    expenseTotalValue.numFmt = '#,##0';

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().substring(0, 10);
    a.href = url;
    a.download = `${sanitizeFilename(filenamePrefix)}_${timestamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
