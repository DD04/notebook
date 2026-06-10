-- Supabase Database Schema for Bookkeeping Web App (notebook)
-- Run this in your Supabase SQL Editor.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    nickname TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nickname)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)));
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

CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id);

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

CREATE POLICY "Users can view their own budgets"
ON public.budgets FOR SELECT
USING (auth.uid() = user_id);

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
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Can be null for simulated members
    nickname TEXT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, nickname)
);

-- Enable RLS for Group Members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;


-- Policies for Groups and Group Members
-- Allow read/write to groups if user is a member of that group

CREATE POLICY "Users can view groups they are in"
ON public.groups FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_members.group_id = groups.id 
        AND group_members.user_id = auth.uid()
    )
);

CREATE POLICY "Any authenticated user can create a group"
ON public.groups FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group creator can update/delete group"
ON public.groups FOR ALL
USING (created_by = auth.uid());


CREATE POLICY "Users can view members of their groups"
ON public.group_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.group_members AS m
        WHERE m.group_id = group_members.group_id
        AND m.user_id = auth.uid()
    )
);

CREATE POLICY "Group members can add other members"
ON public.group_members FOR INSERT
WITH CHECK (
    -- Allow initial insert when creating group
    NOT EXISTS (
        SELECT 1 FROM public.group_members AS m 
        WHERE m.group_id = group_members.group_id
    )
    OR
    EXISTS (
        SELECT 1 FROM public.group_members AS m
        WHERE m.group_id = group_members.group_id
        AND m.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update group member nicknames in their groups"
ON public.group_members FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.group_members AS m
        WHERE m.group_id = group_members.group_id
        AND m.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete group members in their groups"
ON public.group_members FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.group_members AS m
        WHERE m.group_id = group_members.group_id
        AND m.user_id = auth.uid()
    )
);


-- 6. Group Transactions Table
CREATE TABLE IF NOT EXISTS public.group_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    paid_by TEXT NOT NULL, -- Member nickname who paid
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    description TEXT,
    splits JSONB NOT NULL, -- JSON array of splits, e.g. [{"nickname": "Alice", "amount": 10}, {"nickname": "Bob", "amount": 10}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Group Transactions
ALTER TABLE public.group_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions in their groups"
ON public.group_transactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = group_transactions.group_id
        AND group_members.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert transactions in their groups"
ON public.group_transactions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = group_transactions.group_id
        AND group_members.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update/delete transactions in their groups"
ON public.group_transactions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = group_transactions.group_id
        AND group_members.user_id = auth.uid()
    )
);
