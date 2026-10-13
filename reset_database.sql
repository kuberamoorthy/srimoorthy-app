-- =============================================
-- SRI MOORTHY TRANSPORT - RESET DATABASE SCRIPT
-- Paste and run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gusrwwwoammurxzwywmy/sql
-- =============================================

-- 1. DELETE ALL BILLS AND INVOICES
TRUNCATE TABLE public.bills CASCADE;

-- 2. DELETE ALL FUEL LOGS
TRUNCATE TABLE public.fuel_logs CASCADE;

-- 3. RESET VEHICLES TO DEFAULT FLEET
DELETE FROM public.vehicles WHERE number NOT IN ('TN68C6003', 'TN68W2419', 'TN82K1945');

INSERT INTO public.vehicles (name, number, type, color, status)
VALUES 
    ('TATA ACE', 'TN68C6003', 'TATA ACE', '#EF5226', 'active'),
    ('TATA ACE', 'TN68W2419', 'TATA ACE', '#3b82f6', 'active'),
    ('DOST+', 'TN82K1945', 'DOST+', '#10b981', 'active')
ON CONFLICT (number) DO NOTHING;

-- 4. RESET APP SETTINGS COUNTER
DELETE FROM public.app_settings WHERE key = 'bill_counter';

-- Verification Query:
SELECT 'bills count' AS table_name, count(*) FROM public.bills
UNION ALL
SELECT 'fuel_logs count', count(*) FROM public.fuel_logs
UNION ALL
SELECT 'vehicles count', count(*) FROM public.vehicles;
