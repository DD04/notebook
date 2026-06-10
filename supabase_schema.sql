-- Supabase Database Schema for Bookkeeping Web App (notebook)
-- Run this in your Supabase SQL Editor.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT UNIQUE,
    nickname TEXT,
    superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- For existing databases, ensure username and superuser columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS superuser BOOLEAN DEFAULT FALSE;

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

-- Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username, nickname)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


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

-- Only the group creator can remove members
DROP POLICY IF EXISTS "Only creator can remove group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can delete group members in their groups" ON public.group_members;
CREATE POLICY "Only creator can remove group members"
ON public.group_members FOR DELETE
USING (
    EXISTS(SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
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
