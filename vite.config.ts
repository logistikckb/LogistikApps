import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function registerAppVersionMiddlewares(middlewares: any) {
  // 1. Endpoint Cek Versi PWA & Live Code Update Checker
  middlewares.use('/api/app-version', async (_req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      const fs = await import('fs');
      const versionFilePath = path.resolve(__dirname, 'public/version.json');
      if (fs.existsSync(versionFilePath)) {
        const raw = fs.readFileSync(versionFilePath, 'utf-8');
        res.statusCode = 200;
        res.end(raw);
        return;
      }
    } catch {
      // Fallback below
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      version: '2.6.0',
      buildTimestamp: 1730073600000,
      releaseDate: '28 Oktober 2026',
      name: 'LogistikApps PWA',
      changelog: [
        'Pengembalian konfigurasi role hak akses ke versi sebelum update',
        'Peniadaan penyimpanan lokal untuk data transaksi',
        'Sinkronisasi database pusat multi-perangkat real-time'
      ]
    }));
  });

  // 2. Pastikan /version.json selalu dikirim tanpa browser cache
  middlewares.use('/version.json', async (_req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
}

function appVersionPlugin(): Plugin {
  return {
    name: 'app-version-plugin',
    configureServer(server) {
      registerAppVersionMiddlewares(server.middlewares);
    },
    configurePreviewServer(server) {
      registerAppVersionMiddlewares(server.middlewares);
    }
  };
}

export default defineConfig(() => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://lvxnozabjemsvejkkwvx.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2eG5vemFiamVtc3Zlamtrd3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjI0NTcsImV4cCI6MjEwMjM5ODQ1N30.haeBn4x-QBhpTdZoJpCV39B7xPABuadcFjmtm5K3At4';
  const sharedBroadcastUrl = process.env.VITE_SHARED_BROADCAST_SUPABASE_URL || process.env.SHARED_BROADCAST_SUPABASE_URL || 'https://elwdoyfviqrhfvpqwfmx.supabase.co';
  const sharedBroadcastKey = process.env.VITE_SHARED_BROADCAST_SUPABASE_ANON_KEY || process.env.SHARED_BROADCAST_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd2RveWZ2aXFyaGZ2cHF3Zm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTQ2NjcsImV4cCI6MjA4OTk5MDY2N30.ElQJLokg0uBDfquesI085RVQlz5mhIbn6M7kahH-y9A';

  return {
    plugins: [react(), tailwindcss(), appVersionPlugin()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_SHARED_BROADCAST_SUPABASE_URL': JSON.stringify(sharedBroadcastUrl),
      'import.meta.env.VITE_SHARED_BROADCAST_SUPABASE_ANON_KEY': JSON.stringify(sharedBroadcastKey),
      'import.meta.env.SHARED_BROADCAST_SUPABASE_URL': JSON.stringify(sharedBroadcastUrl),
      'import.meta.env.SHARED_BROADCAST_SUPABASE_ANON_KEY': JSON.stringify(sharedBroadcastKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'xlsx',
        'qrcode',
        'fuse.js',
        'jszip',
        'html5-qrcode',
        '@supabase/supabase-js'
      ],
    },
    server: {
      hmr: false,
    },
  };
});
