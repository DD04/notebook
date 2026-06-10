// js/i18n.js - Localization & Internationalization Module
export const translations = {
    'zh': {
        // Sidebar Navigation
        'nav_dashboard': '個人帳本',
        'nav_groups': '群組共同記帳',
        'nav_analytics': '收支數據分析',
        'nav_budgeting': '消費預算管理',
        'nav_settings': '資料庫與設定',
        'sidebar_offline_user': '訪客用戶',
        'sidebar_disconnected': '未配置連線',

        // Mode badge
        'badge_cloud_sync': '雲端同步中',
        'badge_db_required': '請配置資料庫',

        // Dashboard View
        'db_title': '個人帳本',
        'db_balance': '淨結餘',
        'db_balance_desc': '目前個人淨收支統計',
        'db_income': '總收入',
        'db_income_count': '筆收入交易',
        'db_expense': '總支出',
        'db_expense_count': '筆支出交易',
        'db_ledger': '個人收支明細',
        'db_add_tx': '新增交易紀錄',
        'db_search': '搜尋說明...',
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
        'th_cat': '交易分類',
        'th_tags': '標籤',
        'th_amount': '金額',
        'th_actions': '操作',

        // Groups View
        'group_title': '群組共同記帳',
        'group_list_title': '我的記帳群組',
        'group_members_title': '群組成員名單',
        'group_no_selection_title': '尚未選取群組',
        'group_no_selection_desc': '請從左側列表選擇一個記帳群組，或建立一個新群組來開始共同記帳。',
        'group_settle_btn': '記錄債務結清',
        'group_add_bill_btn': '新增群組交易',
        'group_analysis_title': '群組財務分析',
        'group_all_settled': '此群組尚未有交易紀錄。',
        'group_ledger_title': '群組記帳明細',
        'th_paid_by': '付款人',
        'th_split_desc': '分攤摘要',
        'group_empty_ledger': '此群組目前沒有任何交易紀錄。',
        'group_owes': '應給付給',
        'group_owes_text': '應付',
        'group_balance': '群組淨結餘',
        'group_balance_desc': '此群組之累計收支結餘',
        'group_income': '群組總收入',
        'group_income_count': '筆收入交易',
        'group_expense': '群組總支出',
        'group_expense_count': '筆支出交易',
        'th_member': '記帳者',
        'th_type': '類型',

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
        'modal_tx_cat': '交易分類',
        'modal_tx_date': '日期',
        'modal_tx_tags': '標籤 (使用半形逗號分隔)',
        'modal_tx_desc': '詳細說明',
        'modal_tx_save': '儲存交易',
        'modal_cancel': '取消',

        'modal_new_group': '建立新記帳群組',
        'modal_group_name': '群組名稱',
        'modal_group_create': '建立群組',

        'modal_new_member': '新增群組成員',
        'modal_member_name': '成員帳號',
        'modal_member_add': '加入成員',

        'modal_group_tx': '新增群組交易',
        'modal_gtx_amount': '交易金額',
        'modal_gtx_payer': '誰付的錢？',
        'modal_gtx_cat': '交易分類',
        'modal_gtx_date': '交易日期',
        'modal_gtx_desc': '交易說明',
        'modal_gtx_split': '分攤對象成員 (均分機制)',
        'modal_gtx_save': '記錄交易',

        // Categories
        'cat_Food': '餐飲',
        'cat_Transport': '交通',
        'cat_Entertainment': '娛樂',
        'cat_Shopping': '購物',
        'cat_Housing': '住房',
        'cat_Salary': '薪資收入',
        'cat_Investments': '投資收入',
        'cat_Other': '其他',

        // Toast messages
        'toast_tx_added': '交易紀錄已新增！',
        'toast_tx_updated': '交易紀錄已更新！',
        'toast_tx_deleted': '交易紀錄已刪除！',
        'toast_group_created': '記帳群組建立成功！',
        'toast_member_added': '已新增成員',
        'toast_bill_added': '交易已記錄成功！',
        'toast_bill_deleted': '交易已刪除成功。',
        'toast_settled': '結清成功！',
        'toast_budget_set': '預算已設定',
        'toast_budget_fail': '預算儲存失敗：',

        // Confirm dialogs
        'confirm_delete_tx': '確定要刪除這筆交易紀錄嗎？',
        'confirm_delete_bill': '確定要刪除這筆群組交易紀錄嗎？',
        'confirm_disconnect': '確定要中斷資料庫連線嗎？這將登出帳號並返回連線設定頁面。',

        // Warnings
        'warn_min_2_members': '請至少新增 2 位成員再進行記帳。',
        'warn_check_one_member': '請確認交易資訊是否正確。',

        // Group dynamic text
        'group_empty_list': '尚未建立任何記帳群組。',
        'group_created_on': '建立於',
        'group_transferred_to': '轉帳給',
        'group_split_with': '與',
        'group_split_member': '位成員均分',

        // Group admin / member management
        'group_creator_badge': '建立者',
        'group_creator_only': '只有群組建立者才能執行此操作。',
        'group_user_not_found': '找不到此帳號的已註冊使用者：',
        'group_already_member': '此使用者已是群組成員。',
        'group_delete_group': '刪除群組',
        'confirm_delete_group': '確定要刪除此群組？所有群組資料將永久刪除且無法復原。',
        'toast_group_deleted': '群組已成功刪除。',

        // Add member modal
        'modal_member_hint': '請輸入要新增成員的已註冊帳號。',
        'modal_member_placeholder': '輸入帳號…',

        // Settlement modal
        'settle_record_title': '記錄債務結清',
        'settle_select_label': '選擇要結清的債務',
        'settle_record_btn': '確認結清',

        // Analytics
        'analytics_total_exp': '總支出',

        // Settings
        'settings_session_title': '帳號與連線狀態',
        'budget_month': '月份：'
    },
    'en': {
        // Sidebar Navigation
        'nav_dashboard': 'Dashboard',
        'nav_groups': 'Group Shared Ledger',
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
        'group_title': 'Group Shared Ledger',
        'group_list_title': 'My Ledger Groups',
        'group_members_title': 'Group Members',
        'group_no_selection_title': 'No Group Selected',
        'group_no_selection_desc': 'Select an existing group from the list or create a new one to start shared bookkeeping.',
        'group_settle_btn': 'Settle Up',
        'group_add_bill_btn': 'Add Group Transaction',
        'group_analysis_title': 'Group Financial Analysis',
        'group_all_settled': 'No transactions recorded yet in this group.',
        'group_ledger_title': 'Group Ledger',
        'th_paid_by': 'Paid By',
        'th_split_desc': 'Split Summary',
        'group_empty_ledger': 'No transactions added to this group yet.',
        'group_owes': 'owes',
        'group_owes_text': 'owes',
        'group_balance': 'Group Net Balance',
        'group_balance_desc': 'Total group financial summary',
        'group_income': 'Group Total Income',
        'group_income_count': 'income entries',
        'group_expense': 'Group Total Expenses',
        'group_expense_count': 'expense entries',
        'th_member': 'Recorded By',
        'th_type': 'Type',

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

        'modal_new_group': 'Create New Ledger Group',
        'modal_group_name': 'Group Name',
        'modal_group_create': 'Create Group',

        'modal_new_member': 'Add Group Member',
        'modal_member_name': 'Username',
        'modal_member_add': 'Add Member',

        'modal_group_tx': 'Add Group Transaction',
        'modal_gtx_amount': 'Amount',
        'modal_gtx_payer': 'Paid By',
        'modal_gtx_cat': 'Category',
        'modal_gtx_date': 'Date',
        'modal_gtx_desc': 'Description',
        'modal_gtx_split': 'Split Between Members (Equally)',
        'modal_gtx_save': 'Save Transaction',

        // Categories
        'cat_Food': 'Food',
        'cat_Transport': 'Transport',
        'cat_Entertainment': 'Entertainment',
        'cat_Shopping': 'Shopping',
        'cat_Housing': 'Housing',
        'cat_Salary': 'Salary (Income)',
        'cat_Investments': 'Investments (Income)',
        'cat_Other': 'Other',

        // Toast messages
        'toast_tx_added': 'Transaction added successfully!',
        'toast_tx_updated': 'Transaction updated successfully!',
        'toast_tx_deleted': 'Transaction deleted successfully!',
        'toast_group_created': 'Ledger group created successfully!',
        'toast_member_added': 'Added member',
        'toast_bill_added': 'Transaction recorded successfully!',
        'toast_bill_deleted': 'Transaction deleted successfully.',
        'toast_settled': 'Settlement recorded!',
        'toast_budget_set': 'budget set to',
        'toast_budget_fail': 'Failed to save budget: ',

        // Confirm dialogs
        'confirm_delete_tx': 'Are you sure you want to delete this transaction?',
        'confirm_delete_bill': 'Are you sure you want to delete this group transaction?',
        'confirm_disconnect': 'Are you sure you want to disconnect? This will log you out and return to the connection page.',

        // Warnings
        'warn_min_2_members': 'Please add members to start tracking.',
        'warn_check_one_member': 'Please verify transaction details.',

        // Group dynamic text
        'group_empty_list': 'No groups yet.',
        'group_created_on': 'Created on',
        'group_transferred_to': 'Transferred to',
        'group_split_with': 'Split with',
        'group_split_member': 'members',

        // Group admin / member management
        'group_creator_badge': 'Creator',
        'group_creator_only': 'Only the group creator can perform this action.',
        'group_user_not_found': 'No registered user found with username: ',
        'group_already_member': 'This user is already a member of the group.',
        'group_delete_group': 'Delete Group',
        'confirm_delete_group': 'Are you sure you want to delete this group? All group data will be permanently deleted.',
        'toast_group_deleted': 'Group deleted successfully.',

        // Add member modal
        'modal_member_hint': 'Enter the registered username of the user you want to add.',
        'modal_member_placeholder': 'Enter username...',

        // Settlement modal
        'settle_record_title': 'Record Settlement',
        'settle_select_label': 'Select Debt to Clear',
        'settle_record_btn': 'Record Payment',

        // Analytics
        'analytics_total_exp': 'TOTAL EXPENSES',

        // Settings
        'settings_session_title': 'Account & Connection Status',
        'budget_month': 'Month:'
    }
};

let currentLocale = 'zh'; // Default to Traditional Chinese

export function getLocale() {
    return 'zh';
}

export function toggleLocale() {
    return 'zh';
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
