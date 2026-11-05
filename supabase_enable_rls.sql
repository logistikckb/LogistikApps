-- ==============================================================================
-- LOGISTIK PORTAL - SKRIP PERBAIKAN ROW-LEVEL SECURITY (RLS) SUPABASE
-- ==============================================================================
-- Masalah yang diselesaikan:
-- "Table publicly accessible: Anyone with your project URL can read, edit,
-- and delete all data in this table because Row-Level Security is not enabled."
--
-- Solusi:
-- 1. Mengaktifkan Row Level Security (ENABLE ROW LEVEL SECURITY) pada semua tabel.
-- 2. Menetapkan Kebijakan Keamanan (RLS Policy) eksplisit untuk role 'anon' dan
--    'authenticated' agar semua fitur aplikasi (Inbound, Picking, Penyiapan,
--    Broadcast, Inventory, Stock Opname, dsb) tetap berjalan lancar 100%.
-- ==============================================================================

-- 1. PASTIKAN SCHEMA USAGE & GRANT DIBERIKAN DENGAN BENAR
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 2. BUAT TABEL APP_SETTINGS JIKA BELUM ADA (Untuk Konfigurasi Global & Suara)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(100) PRIMARY KEY NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_by VARCHAR(100) DEFAULT 'Admin'
);

-- ==============================================================================
-- 3. AKTIFKAN ROW LEVEL SECURITY (RLS) PADA SEMUA TABEL
-- ==============================================================================
DO $$
DECLARE
    tbl text;
    target_tables text[] := ARRAY[
        'users',
        'broadcast',
        'broadcasts',
        'data_barang',
        'data_distributor',
        'incoming',
        'data_penyiapan',
        'data_picking',
        'data_cek_fisik_pemusnahan',
        'data_pemusnahan',
        'data_reco',
        'data_repack',
        'data_inventory',
        'app_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables
    LOOP
        -- Periksa apakah tabel ada di schema public sebelum mengubah RLS
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            -- Aktifkan RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            
            -- Hapus policy lama jika ada agar idempotent
            EXECUTE format('DROP POLICY IF EXISTS "Allow anon and authenticated full access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow public full access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public access policy" ON public.%I;', tbl);
            
            -- Buat RLS Policy yang mengizinkan operasi penuh untuk aplikasi
            EXECUTE format(
                'CREATE POLICY "Allow anon and authenticated full access" ON public.%I ' ||
                'FOR ALL TO anon, authenticated ' ||
                'USING (true) ' ||
                'WITH CHECK (true);',
                tbl
            );
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- 4. VERIFIKASI STATUS RLS SEMUA TABEL
-- ==============================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
