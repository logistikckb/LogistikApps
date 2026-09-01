-- ==============================================================================
-- LOGISTIK PORTAL - APLIKASI RR V1.0 DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- SKEMA LENGKAP SEMUA TABEL DAN DATA RESOURCES APLIKASI RR
-- KONFIGURASI: TANPA RLS (ROW LEVEL SECURITY DISABLED)
-- ==============================================================================

-- Aktifkan ekstensi UUID dan pgcrypto jika diperlukan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- TRIGGER FUNCTION: AUTO UPDATE UPDATED_AT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 1. TABEL USERS (Autentikasi Pengguna, Operator & Hak Akses)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    pin VARCHAR(20) NOT NULL,
    avatar TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'Pelaksana', -- 'Admin' | 'Pelaksana'
    status VARCHAR(50) NOT NULL DEFAULT 'Aktif',   -- 'Aktif' | 'Nonaktif'
    email_google VARCHAR(255) DEFAULT '',
    permissions JSONB NOT NULL DEFAULT '{
        "canInputIncoming": true,
        "canTally": true,
        "canEditMasterBarang": false,
        "canManageUsers": false,
        "canApproveQC": false,
        "canAccessDatabase": false
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 2. TABEL BROADCAST / BROADCASTS (Pesan Siaran & Notifikasi Pengumuman Gudang)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.broadcast (
    id TEXT PRIMARY KEY,
    sender_name VARCHAR(255) NOT NULL DEFAULT 'Pos Logistik',
    author_name VARCHAR(255) DEFAULT 'Pos Logistik',
    message TEXT NOT NULL,
    content TEXT,
    title VARCHAR(255),
    category VARCHAR(50) NOT NULL DEFAULT 'info', -- 'info' | 'urgent' | 'warning' | 'announcement'
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal', -- 'Normal' | 'Penting' | 'Urgent'
    device_info VARCHAR(100) DEFAULT 'Browser Web',
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_broadcast_created_at ON public.broadcast(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_sender ON public.broadcast(sender_name);

DROP TRIGGER IF EXISTS set_broadcast_updated_at ON public.broadcast;
CREATE TRIGGER set_broadcast_updated_at
    BEFORE UPDATE ON public.broadcast
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.broadcasts (
    id TEXT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Pengumuman', -- 'Pengumuman' | 'Peringatan' | 'Inbound' | 'Maintenance' | 'Operasional'
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal',     -- 'Normal' | 'Penting' | 'Urgent'
    author_id TEXT,
    author_name VARCHAR(255) NOT NULL DEFAULT 'Admin Gudang',
    author_role VARCHAR(50) NOT NULL DEFAULT 'Admin',
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    target_audience VARCHAR(100) NOT NULL DEFAULT 'Semua Tim Gudang',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON public.broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_priority ON public.broadcasts(priority);
CREATE INDEX IF NOT EXISTS idx_broadcasts_pinned ON public.broadcasts(is_pinned);
CREATE INDEX IF NOT EXISTS idx_broadcasts_active ON public.broadcasts(is_active);

DROP TRIGGER IF EXISTS set_broadcasts_updated_at ON public.broadcasts;
CREATE TRIGGER set_broadcasts_updated_at
    BEFORE UPDATE ON public.broadcasts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 3. TABEL DATA_BARANG (Master Data SKU, Barcode & Produk)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_barang (
    item_code VARCHAR(100) PRIMARY KEY NOT NULL,
    barcode VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Aktif', -- 'Aktif' | 'Nonaktif'
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_barang_barcode ON public.data_barang(barcode);
CREATE INDEX IF NOT EXISTS idx_data_barang_status ON public.data_barang(status);

DROP TRIGGER IF EXISTS set_data_barang_updated_at ON public.data_barang;
CREATE TRIGGER set_data_barang_updated_at
    BEFORE UPDATE ON public.data_barang
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 4. TABEL DATA_DISTRIBUTOR (Master Data Distributor & Kode LD)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_distributor (
    kode_ld VARCHAR(50) PRIMARY KEY NOT NULL,
    nama_distributor VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Aktif', -- 'Aktif' | 'Nonaktif'
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_distributor_nama ON public.data_distributor(nama_distributor);
CREATE INDEX IF NOT EXISTS idx_data_distributor_status ON public.data_distributor(status);

DROP TRIGGER IF EXISTS set_data_distributor_updated_at ON public.data_distributor;
CREATE TRIGGER set_data_distributor_updated_at
    BEFORE UPDATE ON public.data_distributor
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 5. TABEL INCOMING (Transaksi Inbound & Penerimaan Barang)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.incoming (
    id_incoming VARCHAR(100) PRIMARY KEY NOT NULL,
    jenis VARCHAR(100) DEFAULT 'Reguler',
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
    user_tally VARCHAR(100) DEFAULT 'Tally 1',
    shelf_life VARCHAR(50) DEFAULT '24 Bulan',
    source VARCHAR(100) DEFAULT 'Supplier',
    user_input VARCHAR(100) DEFAULT 'Admin',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status VARCHAR(50) DEFAULT 'Received',
    tujuan VARCHAR(255) DEFAULT 'Warehouse Utama',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incoming_item_code ON public.incoming(item_code);
CREATE INDEX IF NOT EXISTS idx_incoming_distributor ON public.incoming(id_distributor);
CREATE INDEX IF NOT EXISTS idx_incoming_batch ON public.incoming(batch);
CREATE INDEX IF NOT EXISTS idx_incoming_status ON public.incoming(status);
CREATE INDEX IF NOT EXISTS idx_incoming_created_at ON public.incoming(created_at DESC);

DROP TRIGGER IF EXISTS set_incoming_updated_at ON public.incoming;
CREATE TRIGGER set_incoming_updated_at
    BEFORE UPDATE ON public.incoming
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 6. TABEL DATA_PENYIAPAN (Transaksi Penyiapan Barang Outbound)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_penyiapan (
    id_penyiapan VARCHAR(100) PRIMARY KEY NOT NULL,
    tujuan VARCHAR(255) DEFAULT 'Pengiriman Cabang',
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Finished Good',
    location VARCHAR(100) DEFAULT 'WH-B-01',
    location_type VARCHAR(50) DEFAULT 'Floor',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL02',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'DST-02',
    qc_code VARCHAR(50) DEFAULT 'QC-PASS',
    user_tally VARCHAR(100) DEFAULT 'Tally 2',
    shelf_life VARCHAR(50) DEFAULT '24 Bulan',
    source VARCHAR(100) DEFAULT 'Stok Gudang',
    user_input VARCHAR(100) DEFAULT 'Admin',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status TEXT DEFAULT 'Ready',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_penyiapan_item_code ON public.data_penyiapan(item_code);
CREATE INDEX IF NOT EXISTS idx_data_penyiapan_status ON public.data_penyiapan(status);
CREATE INDEX IF NOT EXISTS idx_data_penyiapan_batch ON public.data_penyiapan(batch);

DROP TRIGGER IF EXISTS set_data_penyiapan_updated_at ON public.data_penyiapan;
CREATE TRIGGER set_data_penyiapan_updated_at
    BEFORE UPDATE ON public.data_penyiapan
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. TABEL DATA_CEK_FISIK_PEMUSNAHAN (Transaksi Cek Fisik / Penyiapan Pemusnahan)
-- Penjelasan: Logika & Struktur sama persis 100% dengan data_penyiapan untuk
-- proses check fisik sebelum dipindahkan secara massal ke data_pemusnahan final
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_cek_fisik_pemusnahan (
    id_cek_fisik VARCHAR(100) PRIMARY KEY NOT NULL,
    tujuan VARCHAR(255) DEFAULT 'Check Fisik Pemusnahan',
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Damaged',
    location VARCHAR(100) DEFAULT 'WH-REJECT-01',
    location_type VARCHAR(50) DEFAULT 'Quarantine',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL99',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'INCINERATOR',
    qc_code VARCHAR(50) DEFAULT 'QC-REJECT',
    user_tally VARCHAR(100) DEFAULT 'Tally QC',
    shelf_life VARCHAR(50) DEFAULT 'Expired',
    source VARCHAR(100) DEFAULT 'Retur Customer',
    user_input VARCHAR(100) DEFAULT 'QA Officer',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status TEXT DEFAULT 'Siap Check Fisik',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_cek_fisik_pemusnahan_item_code ON public.data_cek_fisik_pemusnahan(item_code);
CREATE INDEX IF NOT EXISTS idx_data_cek_fisik_pemusnahan_status ON public.data_cek_fisik_pemusnahan(status);
CREATE INDEX IF NOT EXISTS idx_data_cek_fisik_pemusnahan_batch ON public.data_cek_fisik_pemusnahan(batch);
CREATE INDEX IF NOT EXISTS idx_data_cek_fisik_pemusnahan_created_at ON public.data_cek_fisik_pemusnahan(created_at DESC);

DROP TRIGGER IF EXISTS set_data_cek_fisik_pemusnahan_updated_at ON public.data_cek_fisik_pemusnahan;
CREATE TRIGGER set_data_cek_fisik_pemusnahan_updated_at
    BEFORE UPDATE ON public.data_cek_fisik_pemusnahan
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 8. TABEL DATA_PEMUSNAHAN (Transaksi Pemusnahan / Scrap / Disposal Final)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_pemusnahan (
    id_pemusnahan VARCHAR(100) PRIMARY KEY NOT NULL,
    tujuan VARCHAR(255) DEFAULT 'Pemusnahan Limbah Terkontrol',
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Damaged',
    location VARCHAR(100) DEFAULT 'WH-REJECT-01',
    location_type VARCHAR(50) DEFAULT 'Quarantine',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL99',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'INCINERATOR',
    qc_code VARCHAR(50) DEFAULT 'QC-REJECT',
    user_tally VARCHAR(100) DEFAULT 'Tally QC',
    shelf_life VARCHAR(50) DEFAULT 'Expired',
    source VARCHAR(100) DEFAULT 'Retur Customer',
    user_input VARCHAR(100) DEFAULT 'QA Officer',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status TEXT DEFAULT 'Disposed',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_pemusnahan_item_code ON public.data_pemusnahan(item_code);
CREATE INDEX IF NOT EXISTS idx_data_pemusnahan_status ON public.data_pemusnahan(status);

DROP TRIGGER IF EXISTS set_data_pemusnahan_updated_at ON public.data_pemusnahan;
CREATE TRIGGER set_data_pemusnahan_updated_at
    BEFORE UPDATE ON public.data_pemusnahan
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 8. TABEL DATA_RECO (Transaksi Reco / Permintaan Barang - Disinkronkan Dari Penyiapan)
-- Penjelasan: Reco adalah untuk Permintaan Barang
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_reco (
    id_reco VARCHAR(100) PRIMARY KEY NOT NULL,
    tujuan VARCHAR(255) DEFAULT 'Permintaan Barang',
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Finished Good',
    location VARCHAR(100) DEFAULT 'WH-RECO-01',
    location_type VARCHAR(50) DEFAULT 'Floor',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL03',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'DST-RECO',
    qc_code VARCHAR(50) DEFAULT 'QC-PASS',
    user_tally VARCHAR(100) DEFAULT 'Tally Reco',
    shelf_life VARCHAR(50) DEFAULT '24 Bulan',
    source VARCHAR(100) DEFAULT 'Penyiapan',
    user_input VARCHAR(100) DEFAULT 'Admin',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status VARCHAR(50) DEFAULT 'Permintaan Reco',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_reco_item_code ON public.data_reco(item_code);
CREATE INDEX IF NOT EXISTS idx_data_reco_status ON public.data_reco(status);
CREATE INDEX IF NOT EXISTS idx_data_reco_batch ON public.data_reco(batch);
CREATE INDEX IF NOT EXISTS idx_data_reco_created_at ON public.data_reco(created_at DESC);

DROP TRIGGER IF EXISTS set_data_reco_updated_at ON public.data_reco;
CREATE TRIGGER set_data_reco_updated_at
    BEFORE UPDATE ON public.data_reco
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 9. TABEL DATA_REPACK (Transaksi Repacking / Bundling Produk)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_repack (
    id_repack VARCHAR(100) PRIMARY KEY NOT NULL,
    tujuan VARCHAR(255) DEFAULT 'Repacking Promo Bundle 2in1',
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Repack',
    location VARCHAR(100) DEFAULT 'WH-REPACK-01',
    location_type VARCHAR(50) DEFAULT 'Rack',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL04',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'PROMO-BUNDLING',
    qc_code VARCHAR(50) DEFAULT 'QC-PASS',
    user_tally VARCHAR(100) DEFAULT 'Tally Repack',
    shelf_life VARCHAR(50) DEFAULT '24 Bulan',
    source VARCHAR(100) DEFAULT 'Stok Gudang',
    user_input VARCHAR(100) DEFAULT 'Team Promo',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status VARCHAR(50) DEFAULT 'Completed',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_repack_item_code ON public.data_repack(item_code);
CREATE INDEX IF NOT EXISTS idx_data_repack_status ON public.data_repack(status);

DROP TRIGGER IF EXISTS set_data_repack_updated_at ON public.data_repack;
CREATE TRIGGER set_data_repack_updated_at
    BEFORE UPDATE ON public.data_repack
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 10. TABEL DATA_INVENTORY (Struktur Sama Persis dengan data_penyiapan Tanpa tanggal_update)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_inventory (
    id_inventory VARCHAR(100) PRIMARY KEY NOT NULL,
    tujuan VARCHAR(255) DEFAULT 'Stok Inventory Gudang',
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Finished Good',
    location VARCHAR(100) DEFAULT 'WH-INV-01',
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
    destination_code VARCHAR(100) DEFAULT 'DST-INV',
    qc_code VARCHAR(50) DEFAULT 'QC-PASS',
    user_tally VARCHAR(100) DEFAULT 'Tally Inventory',
    shelf_life VARCHAR(50) DEFAULT '24 Bulan',
    source VARCHAR(100) DEFAULT 'Stok Gudang',
    user_input VARCHAR(100) DEFAULT 'Admin',
    status VARCHAR(50) DEFAULT 'Ada',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_inventory_item_code ON public.data_inventory(item_code);
CREATE INDEX IF NOT EXISTS idx_data_inventory_status ON public.data_inventory(status);
CREATE INDEX IF NOT EXISTS idx_data_inventory_batch ON public.data_inventory(batch);
CREATE INDEX IF NOT EXISTS idx_data_inventory_location ON public.data_inventory(location);
CREATE INDEX IF NOT EXISTS idx_data_inventory_created_at ON public.data_inventory(created_at DESC);

DROP TRIGGER IF EXISTS set_data_inventory_updated_at ON public.data_inventory;
CREATE TRIGGER set_data_inventory_updated_at
    BEFORE UPDATE ON public.data_inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 11. NONAKTIFKAN ROW LEVEL SECURITY (RLS) & IZINKAN AKSES PENUH
-- ==============================================================================
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_barang DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_distributor DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_penyiapan DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_pemusnahan DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_reco DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_repack DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_inventory DISABLE ROW LEVEL SECURITY;

-- Berikan Hak Akses Penuh (CRUD) ke peranan anon, authenticated, & service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- ==============================================================================
-- 12. SUPABASE REALTIME REPLICATION
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'broadcast') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'broadcasts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'data_barang') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.data_barang;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'data_distributor') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.data_distributor;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'incoming') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.incoming;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'data_penyiapan') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.data_penyiapan;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'data_pemusnahan') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.data_pemusnahan;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'data_reco') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.data_reco;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'data_repack') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.data_repack;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'data_inventory') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.data_inventory;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 12. COMPATIBILITY VIEWS (Alias Header Google Sheets & PascalCase)
-- ==============================================================================
CREATE OR REPLACE VIEW public."DataBarang" AS
SELECT
    barcode AS "Barcode",
    item_code AS "Item Code",
    item_name AS "Item Name",
    status AS "Status"
FROM public.data_barang;

CREATE OR REPLACE VIEW public."DataDistributor" AS
SELECT
    kode_ld AS "KodeLD",
    nama_distributor AS "Nama Distributor",
    status AS "Status"
FROM public.data_distributor;

-- ==============================================================================
-- 13. SEED DATA USERS OPERATOR & ADMIN
-- ==============================================================================
INSERT INTO public.users (id, username, nama, pin, avatar, role, status, email_google, permissions)
VALUES
    (
        'usr_admin_01',
        'admin',
        'Super Administrator',
        '1234',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        'Admin',
        'Aktif',
        'wcikembar111@gmail.com',
        '{
            "canInputIncoming": true,
            "canTally": true,
            "canEditMasterBarang": true,
            "canManageUsers": true,
            "canApproveQC": true,
            "canAccessDatabase": true
        }'::jsonb
    ),
    (
        'usr_tally_01',
        'budi_tally',
        'Budi Santoso (Tally Inbound)',
        '2233',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        'Pelaksana',
        'Aktif',
        'budi.logistik@gmail.com',
        '{
            "canInputIncoming": true,
            "canTally": true,
            "canEditMasterBarang": false,
            "canManageUsers": false,
            "canApproveQC": false,
            "canAccessDatabase": false
        }'::jsonb
    ),
    (
        'usr_qc_01',
        'siti_qc',
        'Siti Rahma (Inspector QC)',
        '4455',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        'Pelaksana',
        'Aktif',
        'siti.qc@gmail.com',
        '{
            "canInputIncoming": true,
            "canTally": true,
            "canEditMasterBarang": false,
            "canManageUsers": false,
            "canApproveQC": true,
            "canAccessDatabase": false
        }'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama,
    pin = EXCLUDED.pin,
    avatar = EXCLUDED.avatar,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    email_google = EXCLUDED.email_google,
    permissions = EXCLUDED.permissions;
