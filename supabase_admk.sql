-- ==============================================================================
-- LOGISTIK PORTAL - SKRIP SQL EDITOR KHUSUS TABEL DATABASE MENU ADMK (public.admk)
-- Duplikat 100% dari struktur tabel public.incoming (Menu Kedatangan)
-- Salin dan jalankan skrip ini di SQL Editor Supabase
-- ==============================================================================

-- 1. Pastikan fungsi trigger auto-update updated_at tersedia
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Buat Tabel public.admk (Struktur Kolom 100% Identik dengan public.incoming)
CREATE TABLE IF NOT EXISTS public.admk (
    id_incoming VARCHAR(100) PRIMARY KEY NOT NULL,
    jenis VARCHAR(100) DEFAULT 'ADMK',
    id_distributor VARCHAR(50),
    distributor VARCHAR(255),
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Finished Good',
    location VARCHAR(100) DEFAULT 'WH-A-01',
    location_type VARCHAR(50) DEFAULT 'Rack',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL01',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'DST-01',
    qc_code VARCHAR(50) DEFAULT 'QC-PASS',
    user_tally VARCHAR(100) DEFAULT 'Petugas Tally',
    shelf_life VARCHAR(50) DEFAULT '24 Bulan',
    source VARCHAR(100) DEFAULT 'Supplier',
    user_input VARCHAR(100) DEFAULT 'Operator',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status VARCHAR(100) DEFAULT 'open',
    tujuan VARCHAR(255) DEFAULT '-',
    note VARCHAR(255) DEFAULT '-',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Migrasi Aman jika Tabel public.admk Sudah Pernah Dibuat Sebelumnya
ALTER TABLE public.admk ADD COLUMN IF NOT EXISTS note VARCHAR(255) DEFAULT '-';
ALTER TABLE public.admk ADD COLUMN IF NOT EXISTS tujuan VARCHAR(255) DEFAULT '-';
ALTER TABLE public.admk ALTER COLUMN status TYPE VARCHAR(100);

-- 4. Indexing untuk Performa Pencarian & Filter Cepat
CREATE INDEX IF NOT EXISTS idx_admk_item_code ON public.admk(item_code);
CREATE INDEX IF NOT EXISTS idx_admk_distributor ON public.admk(id_distributor);
CREATE INDEX IF NOT EXISTS idx_admk_batch ON public.admk(batch);
CREATE INDEX IF NOT EXISTS idx_admk_status ON public.admk(status);
CREATE INDEX IF NOT EXISTS idx_admk_created_at ON public.admk(created_at DESC);

-- 5. Trigger Otomatis untuk Kolom updated_at
DROP TRIGGER IF EXISTS set_admk_updated_at ON public.admk;
CREATE TRIGGER set_admk_updated_at
    BEFORE UPDATE ON public.admk
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Hak Akses (Grant) & Kebijakan Row-Level Security (RLS)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.admk TO anon, authenticated, service_role;

ALTER TABLE public.admk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated full access" ON public.admk;
DROP POLICY IF EXISTS "Allow public full access" ON public.admk;
DROP POLICY IF EXISTS "Public access policy" ON public.admk;

CREATE POLICY "Allow anon and authenticated full access" ON public.admk
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 7. Aktifkan Supabase Realtime pada Tabel public.admk
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'admk'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.admk;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
