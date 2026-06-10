// js/i18n.js - Localization & Internationalization Module
export const translations = {
    'zh': {
        // Sidebar Navigation
        'nav_dashboard': '主頁主控台',
        'nav_groups': '群組記帳分帳',
        'nav_analytics': '收支數據分析',
        'nav_budgeting': '消費預算管理',
        'nav_settings': '資料庫與設定',
        'sidebar_offline_user': '訪客用戶',
        'sidebar_disconnected': '未配置連線',
        
        // Mode badge
        'badge_cloud_sync': '雲端同步中',
        'badge_db_required': '請配置資料庫',
        
        // Dashboard View
        'db_title': '主頁主控台',
        'db_balance': '淨資產餘額',
        'db_balance_desc': '目前個人淨收支統計',
        'db_income': '總收入金額',
        'db_income_count': '筆收入交易',
        'db_expense': '總支出金額',
        'db_expense_count': '筆支出交易',
        'db_ledger': '個人收支明細',
        'db_add_tx': '新增交易紀錄',
        'db_search': '搜尋說明或標籤...',
        'db_all_types': '所有收支類型',
        'db_income_type': '收入類型',
        'db_expense_type': '支出類型',
        'db_all_cats': '所有交易分類',
        'db_all_months': '所有記帳月份',
        'db_empty_state': '尚未有任何記帳資料，新增一筆試試吧！',
        'db_prev_page': '上一頁',
        'db_next_page': '下一頁',
        'db_page_info': '第 {current} 頁，共 {total} 頁',
        
        // Table headers
        'th_date': '日期',
        'th_desc': '說明',
        'th_cat': '分類',
        'th_tags': '標籤',
        'th_amount': '金額',
        'th_actions': '操作',
        
        // Groups View
        'group_title': '群組記帳分帳',
        'group_list_title': '我的分帳群組',
        'group_members_title': '群組成員名單',
        'group_no_selection_title': '尚未選取群組',
        'group_no_selection_desc': '請從左側列表選擇一個分帳群組，或建立一個新群組來開始分攤帳目。',
        'group_settle_btn': '記錄債務結清',
        'group_add_bill_btn': '新增群組開銷',
        'group_analysis_title': '最優結算分析 (誰該給誰多少錢)',
        'group_all_settled': '太棒了！目前所有人帳目皆已結清！',
        'group_ledger_title': '群組費用明細',
        'th_paid_by': '付款人',
        'th_split_desc': '分攤摘要',
        'group_empty_ledger': '此群組目前沒有任何費用紀錄。',
        'group_owes': '應給付給',
        'group_owes_text': '應付',
        
        // Analytics View
        'analytics_title': '收支數據分析',
        'analytics_cat_dist': '分類支出比例',
        'analytics_cash_flow': '近半年收支趨勢',
        'analytics_tags': '標籤支出分析',
        'analytics_no_expense': '無支出數據',
        'analytics_no_tags': '交易中尚未發現任何標籤。',
        
        // Budgeting View
        'budget_title': '消費預算管理',
        'budget_subtitle': '預算設定上限',
        'budget_desc': '設定每個月每個分類的最高消費金額，系統會即時統計您的預算剩餘與進度。',
        'budget_set_limit': '設定額度：',
        'budget_no_limit': '無預算上限',
        
        // Settings View
        'settings_title': '資料庫與設定',
        'settings_db_title': 'Supabase 資料庫配置',
        'settings_connected': '資料庫連線已成功建立',
        'settings_disconnected': '資料庫目前未連線，請配置參數',
        'settings_sb_url': 'Supabase API 網址 (URL)',
        'settings_sb_key': 'Supabase Anon 金鑰 (Key)',
        'settings_btn_connect': '連線 Supabase',
        'settings_btn_disconnect': '中斷資料庫連線',
        'settings_backup_title': '備份與還原',
        'settings_backup_desc': '您可以將所有儲存在 Supabase 的資料（收支、預算、群組）匯出為 JSON，或在下方還原備份。',
        'settings_btn_export': '匯出 JSON 備份',
        'settings_btn_import': '導入 JSON 備份',
        
        // Gateway overlay
        'gw_db_req': '需要配置資料庫連線',
        'gw_db_desc': '本應用使用純雲端儲存，請輸入您的 Supabase API 參數以繼續。',
        'gw_auth_signin': '使用者登入',
        'gw_auth_signin_desc': '請輸入您的帳號密碼以登入帳戶。',
        'gw_auth_signup': '使用者註冊',
        'gw_auth_signup_desc': '歡迎使用！請設定您的帳號密碼來建立一個雲端帳戶。',
        'gw_label_url': 'Supabase API 網址 (URL)',
        'gw_label_key': 'Supabase Anon 金鑰 (Key)',
        'gw_label_username': '使用者帳號 (Username)',
        'gw_label_password': '密碼 (Password)',
        'gw_label_nickname': '顯示名稱 / 暱稱',
        'gw_btn_connect': '連線資料庫',
        'gw_btn_signin': '立即登入',
        'gw_btn_signup': '建立帳戶並登入',
        'gw_switch_to_signup': '沒有帳戶？立即註冊',
        'gw_switch_to_signin': '已有帳戶？立即登入',
        
        // Modals
        'modal_add_tx': '新增交易紀錄',
        'modal_edit_tx': '編輯交易紀錄',
        'modal_tx_type': '收支類型',
        'modal_tx_amount': '金額',
        'modal_tx_cat': '分類',
        'modal_tx_date': '日期',
        'modal_tx_tags': '標籤 (使用半形逗號分隔)',
        'modal_tx_desc': '詳細說明',
        'modal_tx_save': '儲存交易',
        'modal_cancel': '取消',
        
        'modal_new_group': '建立新分帳群組',
        'modal_group_name': '群組名稱',
        'modal_group_create': '建立群組',
        
        'modal_new_member': '新增群組成員',
        'modal_member_name': '成員名稱 / 暱稱',
        'modal_member_add': '加入成員',
        
        'modal_group_tx': '新增群組費用',
        'modal_gtx_amount': '費用金額',
        'modal_gtx_payer': '誰付的錢？',
        'modal_gtx_cat': '費用分類',
        'modal_gtx_date': '消費日期',
        'modal_gtx_desc': '費用說明',
        'modal_gtx_split': '分攤對象成員 (均分機制)',
        'modal_gtx_save': '記錄費用'
    },
    'en': {
        // Sidebar Navigation
        'nav_dashboard': 'Dashboard',
        'nav_groups': 'Group Ledger',
        'nav_analytics': 'Analytics & Trends',
        'nav_budgeting': 'Monthly Budgeting',
        'nav_settings': 'Configuration Settings',
        'sidebar_offline_user': 'Guest User',
        'sidebar_disconnected': 'Disconnected',
        
        // Mode badge
        'badge_cloud_sync': 'Cloud Sync',
        'badge_db_required': 'Database Required',
        
        // Dashboard View
        'db_title': 'Dashboard',
        'db_balance': 'Net Balance',
        'db_balance_desc': 'Total financial summary',
        'db_income': 'Total Income',
        'db_income_count': 'entries',
        'db_expense': 'Total Expenses',
        'db_expense_count': 'entries',
        'db_ledger': 'Transaction Ledger',
        'db_add_tx': 'Add Transaction',
        'db_search': 'Search description or tags...',
        'db_all_types': 'All Types',
        'db_income_type': 'Income',
        'db_expense_type': 'Expense',
        'db_all_cats': 'All Categories',
        'db_all_months': 'All Months',
        'db_empty_state': 'No transactions found. Add one to get started!',
        'db_prev_page': 'Prev',
        'db_next_page': 'Next',
        'db_page_info': 'Page {current} of {total}',
        
        // Table headers
        'th_date': 'Date',
        'th_desc': 'Description',
        'th_cat': 'Category',
        'th_tags': 'Tags',
        'th_amount': 'Amount',
        'th_actions': 'Actions',
        
        // Groups View
        'group_title': 'Group Ledger',
        'group_list_title': 'My Groups',
        'group_members_title': 'Group Members',
        'group_no_selection_title': 'No Group Selected',
        'group_no_selection_desc': 'Select an existing group from the list or create a new one to start tracking splits.',
        'group_settle_btn': 'Settle Up',
        'group_add_bill_btn': 'Add Group Bill',
        'group_analysis_title': 'Settlement Analysis',
        'group_all_settled': 'Everyone is settled up!',
        'group_ledger_title': 'Group Ledger',
        'th_paid_by': 'Paid By',
        'th_split_desc': 'Split Summary',
        'group_empty_ledger': 'No bills added to this group yet.',
        'group_owes': 'owes',
        'group_owes_text': 'owes',
        
        // Analytics View
        'analytics_title': 'Analytics & Trends',
        'analytics_cat_dist': 'Category Distribution',
        'analytics_cash_flow': 'Monthly Cash Flow',
        'analytics_tags': 'Spending by Tags',
        'analytics_no_expense': 'No expense data',
        'analytics_no_tags': 'No tags found in expenses.',
        
        // Budgeting View
        'budget_title': 'Monthly Budgeting',
        'budget_subtitle': 'Budget Settings',
        'budget_desc': 'Set monthly spending limits for each category. We will track your spending progress in real-time.',
        'budget_set_limit': 'Set Limit:',
        'budget_no_limit': 'No Limit',
        
        // Settings View
        'settings_title': 'Configuration Settings',
        'settings_db_title': 'Supabase Configuration',
        'settings_connected': 'Database Connected',
        'settings_disconnected': 'Database Disconnected',
        'settings_sb_url': 'Supabase API URL',
        'settings_sb_key': 'Supabase Anon Key',
        'settings_btn_connect': 'Connect Database',
        'settings_btn_disconnect': 'Disconnect',
        'settings_backup_title': 'Backup & Operations',
        'settings_backup_desc': 'Export your Supabase transactions, budgets, and groups to a JSON file, or restore from a previous JSON backup into the database.',
        'settings_btn_export': 'Export JSON',
        'settings_btn_import': 'Import JSON',
        
        // Gateway overlay
        'gw_db_req': 'Database Connection Required',
        'gw_db_desc': 'Connect to your Supabase instance to begin.',
        'gw_auth_signin': 'Sign In',
        'gw_auth_signin_desc': 'Please sign in to sync your ledger.',
        'gw_auth_signup': 'Create Account',
        'gw_auth_signup_desc': 'Sign up for a cloud account to sync your ledger.',
        'gw_label_url': 'Supabase API URL',
        'gw_label_key': 'Supabase Anon Key',
        'gw_label_username': 'Username',
        'gw_label_password': 'Password',
        'gw_label_nickname': 'Nickname',
        'gw_btn_connect': 'Connect Database',
        'gw_btn_signin': 'Sign In',
        'gw_btn_signup': 'Sign Up',
        'gw_switch_to_signup': "Don't have an account? Sign Up",
        'gw_switch_to_signin': 'Already have an account? Sign In',
        
        // Modals
        'modal_add_tx': 'Add Transaction',
        'modal_edit_tx': 'Edit Transaction',
        'modal_tx_type': 'Transaction Type',
        'modal_tx_amount': 'Amount',
        'modal_tx_cat': 'Category',
        'modal_tx_date': 'Date',
        'modal_tx_tags': 'Tags (Comma-separated)',
        'modal_tx_desc': 'Description',
        'modal_tx_save': 'Save Transaction',
        'modal_cancel': 'Cancel',
        
        'modal_new_group': 'Create New Group',
        'modal_group_name': 'Group Name',
        'modal_group_create': 'Create Group',
        
        'modal_new_member': 'Add Group Member',
        'modal_member_name': 'Nickname / Name',
        'modal_member_add': 'Add Member',
        
        'modal_group_tx': 'Add Group Expense',
        'modal_gtx_amount': 'Amount',
        'modal_gtx_payer': 'Paid By',
        'modal_gtx_cat': 'Category',
        'modal_gtx_date': 'Date',
        'modal_gtx_desc': 'Description',
        'modal_gtx_split': 'Split Between Members (Equally)',
        'modal_gtx_save': 'Save Bill'
    }
};

let currentLocale = 'zh'; // Default to Traditional Chinese

export function getLocale() {
    const saved = localStorage.getItem('notebook_locale');
    if (saved === 'en' || saved === 'zh') {
        currentLocale = saved;
    }
    return currentLocale;
}

export function toggleLocale() {
    currentLocale = currentLocale === 'zh' ? 'en' : 'zh';
    localStorage.setItem('notebook_locale', currentLocale);
    return currentLocale;
}

export function getText(key) {
    const locale = getLocale();
    const dict = translations[locale] || translations['zh'];
    return dict[key] || key;
}

export function translateUI() {
    const locale = getLocale();
    const dict = translations[locale] || translations['zh'];

    // 1. Elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.textContent = dict[key];
        }
    });

    // 2. Form placeholders with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) {
            el.setAttribute('placeholder', dict[key]);
        }
    });
}
