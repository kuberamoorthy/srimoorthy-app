-- ========================================================
-- SRI MOORTHY TRANSPORT - SUPABASE DATABASE SETUP
-- Paste and run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gusrwwwoammurxzwywmy/sql/new
-- ========================================================

-- 1. VEHICLES TABLE
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    color TEXT DEFAULT '#EF5226',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BILLS TABLE
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    goods_desc TEXT,
    is_local_income BOOLEAN DEFAULT false,
    add_to_driver_salary BOOLEAN DEFAULT false,
    driver_name TEXT,
    driver_salary_amount NUMERIC(12,2) DEFAULT 0,
    driver_salary_status TEXT DEFAULT 'paid' CHECK (driver_salary_status IN ('paid', 'unpaid')),
    line_items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12,2) DEFAULT 0,
    gst_percent NUMERIC(5,2) DEFAULT 0,
    gst NUMERIC(12,2) DEFAULT 0,
    grand_total NUMERIC(12,2) DEFAULT 0,
    amount_paid NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FUEL LOGS TABLE
CREATE TABLE IF NOT EXISTS public.fuel_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    station TEXT,
    fuel_type TEXT DEFAULT 'diesel' CHECK (fuel_type IN ('diesel', 'petrol')),
    litres NUMERIC(10,2) NOT NULL,
    rate NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    odometer NUMERIC(12,0),
    driver TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DRIVER SALARIES TABLE
CREATE TABLE IF NOT EXISTS public.driver_salaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    driver_name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid')),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. VEHICLE SERVICE & MAINTENANCE EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.vehicle_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    service_type TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    garage TEXT,
    odometer NUMERIC(12,0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_bills_vehicle_id ON public.bills(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON public.bills(date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_id ON public.fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_date ON public.fuel_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_salaries_date ON public.driver_salaries(date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_salaries_driver ON public.driver_salaries(driver_name);
CREATE INDEX IF NOT EXISTS idx_vehicle_services_vehicle_id ON public.vehicle_services(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_services_date ON public.vehicle_services(date DESC);

-- 8. SEED DEFAULT FLEET VEHICLES
INSERT INTO public.vehicles (name, number, type, color, status)
VALUES 
    ('TATA ACE', 'TN68C6003', 'TATA ACE', '#EF5226', 'active'),
    ('TATA ACE', 'TN68W2419', 'TATA ACE', '#3b82f6', 'active'),
    ('DOST+', 'TN82K1945', 'DOST+', '#10b981', 'active')
ON CONFLICT (number) DO NOTHING;

-- 9. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES (FULL READ & WRITE ACCESS)
DROP POLICY IF EXISTS "Allow public read access to vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow public write access to vehicles" ON public.vehicles;
CREATE POLICY "Allow public read access to vehicles" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Allow public write access to vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to bills" ON public.bills;
DROP POLICY IF EXISTS "Allow public write access to bills" ON public.bills;
CREATE POLICY "Allow public read access to bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Allow public write access to bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to fuel_logs" ON public.fuel_logs;
DROP POLICY IF EXISTS "Allow public write access to fuel_logs" ON public.fuel_logs;
CREATE POLICY "Allow public read access to fuel_logs" ON public.fuel_logs FOR SELECT USING (true);
CREATE POLICY "Allow public write access to fuel_logs" ON public.fuel_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to driver_salaries" ON public.driver_salaries;
DROP POLICY IF EXISTS "Allow public write access to driver_salaries" ON public.driver_salaries;
CREATE POLICY "Allow public read access to driver_salaries" ON public.driver_salaries FOR SELECT USING (true);
CREATE POLICY "Allow public write access to driver_salaries" ON public.driver_salaries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to vehicle_services" ON public.vehicle_services;
DROP POLICY IF EXISTS "Allow public write access to vehicle_services" ON public.vehicle_services;
CREATE POLICY "Allow public read access to vehicle_services" ON public.vehicle_services FOR SELECT USING (true);
CREATE POLICY "Allow public write access to vehicle_services" ON public.vehicle_services FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public write access to app_settings" ON public.app_settings;
CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public write access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- 11. SAFE REALTIME ACTIVATION
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_logs;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_salaries;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_services;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- 12. MIGRATIONS FOR EXISTING DATABASES
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_local_income BOOLEAN DEFAULT false;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS add_to_driver_salary BOOLEAN DEFAULT false;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS driver_salary_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS driver_salary_status TEXT DEFAULT 'paid';
ALTER TABLE public.bills ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS service_cost NUMERIC(12,2) DEFAULT 0;
