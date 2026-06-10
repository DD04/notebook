-- Supabase 密碼手動重設輔助指令
-- 當您忘記帳號密碼，或是忘記密保問題答案時，可以使用此指令進行強制重設。
-- 請在您的 Supabase SQL Editor 中貼上並執行此指令。

-- 請將 '您要設定的新密碼' 與 '您的帳號' 替換為您的實際內容：
UPDATE auth.users
SET encrypted_password = crypt('您要設定的新密碼', gen_salt('bf'))
WHERE email = '您的帳號@notebook.local';
