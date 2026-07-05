-- Supabase Database Schema for Bookkeeping Web App (notebook)
-- Run this in your Supabase SQL Editor.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT UNIQUE,
    nickname TEXT,
    superuser BOOLEAN DEFAULT FALSE,
    recovery_question TEXT,
    recovery_answer_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- For existing databases, ensure required columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS superuser BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_question TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_answer_hash TEXT;

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;
CREATE POLICY "Users can read all profiles" 
ON public.profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- SECURITY: the SELECT policy above makes every row visible (this is required so
-- signup/login can check whether a username already exists before the caller is
-- authenticated). Column-level grants restrict WHICH columns those rows expose.
-- recovery_question / recovery_answer_hash / email must never be readable directly
-- by anon/authenticated clients - they are only ever touched by the SECURITY DEFINER
-- functions below, which run as the table owner and are unaffected by these grants.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, nickname) ON public.profiles TO anon;
GRANT SELECT (id, username, nickname, superuser, created_at) ON public.profiles TO authenticated;

-- Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username, nickname, recovery_question, recovery_answer_hash)
    VALUES (
        new.id, 
        new.email, 
        -- 帳號統一小寫存入
        LOWER(COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
        COALESCE(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'recovery_question',
        CASE 
            WHEN new.raw_user_meta_data->>'recovery_answer' IS NOT NULL 
            -- 答案統一轉小寫再雜湊存入，不區分大小寫
            THEN crypt(LOWER(new.raw_user_meta_data->>'recovery_answer'), gen_salt('bf'))
            ELSE NULL
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security question lookup helper RPC
CREATE OR REPLACE FUNCTION public.get_user_question(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
    v_question TEXT;
BEGIN
    -- 帳號統一小寫再查詢，不區分大小寫
    SELECT recovery_question INTO v_question
    FROM public.profiles
    WHERE username = LOWER(p_username);
    
    RETURN v_question;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Rate limiting store for password reset attempts (security-question guesses).
-- RLS is enabled with NO policies defined: anon/authenticated get zero direct
-- access either way, only the SECURITY DEFINER functions below (running as the
-- table owner) can read or write it.
CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
    username TEXT PRIMARY KEY,
    fail_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_reset_failure(p_username TEXT)
RETURNS VOID AS $$
DECLARE
    v_max_attempts CONSTANT INTEGER := 5;
    v_lockout_duration CONSTANT INTERVAL := '15 minutes';
BEGIN
    INSERT INTO public.password_reset_attempts (username, fail_count, locked_until)
    VALUES (p_username, 1, NULL)
    ON CONFLICT (username) DO UPDATE
    SET fail_count = password_reset_attempts.fail_count + 1,
        locked_until = CASE
            WHEN password_reset_attempts.fail_count + 1 >= v_max_attempts
            THEN timezone('utc'::text, now()) + v_lockout_duration
            ELSE password_reset_attempts.locked_until
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Reset password via security question verification RPC
CREATE OR REPLACE FUNCTION public.reset_password_by_question(
    p_username TEXT,
    p_answer TEXT,
    p_new_password TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_expected_hash TEXT;
    v_username TEXT := LOWER(p_username);
    v_locked_until TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 0. 若此帳號因多次嘗試錯誤被鎖定，直接拒絕（不再進行答案比對）
    SELECT locked_until INTO v_locked_until
    FROM public.password_reset_attempts
    WHERE username = v_username;

    IF v_locked_until IS NOT NULL AND v_locked_until > timezone('utc'::text, now()) THEN
        RETURN FALSE;
    END IF;

    -- 1. 帳號統一小寫再查詢，不區分大小寫
    SELECT id, recovery_answer_hash INTO v_user_id, v_expected_hash
    FROM public.profiles
    WHERE username = v_username;

    IF v_user_id IS NULL OR v_expected_hash IS NULL THEN
        PERFORM public.record_reset_failure(v_username);
        RETURN FALSE;
    END IF;

    -- 2. 答案統一轉小寫再進行 bcrypt 雜湊比對
    IF v_expected_hash <> crypt(LOWER(p_answer), v_expected_hash) THEN
        PERFORM public.record_reset_failure(v_username);
        RETURN FALSE;
    END IF;

    -- 3. 驗證成功：清除失敗紀錄，更新密碼
    DELETE FROM public.password_reset_attempts WHERE username = v_username;

    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
    WHERE id = v_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- 2. Personal Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
CREATE POLICY "Users can insert their own transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
CREATE POLICY "Users can delete their own transactions"
ON public.transactions FOR DELETE
USING (auth.uid() = user_id);


-- 3. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    month TEXT NOT NULL, -- Format: YYYY-MM
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, category, month)
);

-- Enable RLS for Budgets
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own budgets" ON public.budgets;
CREATE POLICY "Users can view their own budgets"
ON public.budgets FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own budgets" ON public.budgets;
CREATE POLICY "Users can insert/update their own budgets"
ON public.budgets FOR ALL
USING (auth.uid() = user_id);


-- 4. Groups Table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;


-- 5. Group Members Table
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    nickname TEXT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, nickname)
);

-- Enable RLS for Group Members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;


-- 5.5. Security Definer helper functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Check if the current user can add a member to a group.
-- ONLY the group creator can add members.
-- This SECURITY DEFINER function bypasses RLS to avoid infinite recursion.
CREATE OR REPLACE FUNCTION public.can_add_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_created_by UUID;
BEGIN
    SELECT created_by INTO v_created_by FROM public.groups WHERE id = p_group_id;
    -- Only the group creator can add members (initial self-add + subsequent member adds)
    RETURN v_created_by = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for Groups and Group Members
DROP POLICY IF EXISTS "Users can view groups they are in" ON public.groups;
CREATE POLICY "Users can view groups they are in"
ON public.groups FOR SELECT
USING (public.is_group_member(id, auth.uid()));

DROP POLICY IF EXISTS "Any authenticated user can create a group" ON public.groups;
CREATE POLICY "Any authenticated user can create a group"
ON public.groups FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Group creator can update/delete group" ON public.groups;
CREATE POLICY "Group creator can update/delete group"
ON public.groups FOR ALL
USING (created_by = auth.uid());


DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;
CREATE POLICY "Users can view members of their groups"
ON public.group_members FOR SELECT
USING (public.is_group_member(group_id, auth.uid()));

-- FIX: Use can_add_member() SECURITY DEFINER function to avoid
-- "infinite recursion detected in policy for relation group_members" error.
DROP POLICY IF EXISTS "Only creator can add group members" ON public.group_members;
DROP POLICY IF EXISTS "Group members can add other members" ON public.group_members;
CREATE POLICY "Only creator can add group members"
ON public.group_members FOR INSERT
WITH CHECK (
    public.can_add_member(group_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can update group member nicknames in their groups" ON public.group_members;
CREATE POLICY "Users can update group member nicknames in their groups"
ON public.group_members FOR UPDATE
USING (
    public.is_group_member(group_id, auth.uid())
);

-- Creator can remove members, or members can remove themselves (leave group)
DROP POLICY IF EXISTS "Only creator can remove group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can delete group members in their groups" ON public.group_members;
DROP POLICY IF EXISTS "Creator can remove members, or members can remove themselves" ON public.group_members;
CREATE POLICY "Creator can remove members, or members can remove themselves"
ON public.group_members FOR DELETE
USING (
    EXISTS(SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
    OR user_id = auth.uid()
);


-- 6. Group Transactions Table
DROP TABLE IF EXISTS public.group_transactions CASCADE;
CREATE TABLE IF NOT EXISTS public.group_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    member_nickname TEXT NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Group Transactions
ALTER TABLE public.group_transactions ENABLE ROW LEVEL SECURITY;

-- Helper to check if a user can delete a group transaction (creator of group or owner of transaction)
CREATE OR REPLACE FUNCTION public.can_delete_group_transaction(
    p_group_id UUID,
    p_tx_user_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_created_by UUID;
BEGIN
    -- Owner of the transaction can delete it
    IF p_tx_user_id = p_user_id THEN
        RETURN TRUE;
    END IF;
    
    -- Group creator can delete any transaction in the group
    SELECT created_by INTO v_created_by FROM public.groups WHERE id = p_group_id;
    RETURN v_created_by = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can view transactions in their groups" ON public.group_transactions;
CREATE POLICY "Users can view transactions in their groups"
ON public.group_transactions FOR SELECT
USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert transactions in their groups" ON public.group_transactions;
CREATE POLICY "Users can insert transactions in their groups"
ON public.group_transactions FOR INSERT
WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can update group transactions" ON public.group_transactions;
CREATE POLICY "Users can update group transactions"
ON public.group_transactions FOR UPDATE
USING (
    public.can_delete_group_transaction(group_id, user_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can delete group transactions" ON public.group_transactions;
CREATE POLICY "Users can delete group transactions"
ON public.group_transactions FOR DELETE
USING (
    public.can_delete_group_transaction(group_id, user_id, auth.uid())
);
