import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function registerSpreadsheetMiddlewares(middlewares: any) {
  // 1. Endpoint Sinkronisasi POST
  middlewares.use('/api/spreadsheet-sync', async (req: any, res: any) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const { webhookUrl, payload } = JSON.parse(body || '{}');
        if (!webhookUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'error', error: 'URL Webhook wajib diisi.' }));
          return;
        }

        // Node.js native fetch handles Google Apps Script 302 redirects seamlessly
        const targetRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'follow',
        });

        const text = await targetRes.text();

        // Deteksi jika Google Apps Script mengembalikan halaman HTML (Login/Auth Block/Error)
        const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');
        if (isHtml) {
          let errorHelp = 'Webhook mengembalikan halaman HTML (bukan data JSON).';
          if (text.includes('Sign in') || text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
            errorHelp = 'Webhook Google Apps Script memerlukan login Google! Pastikan saat Deploy Web App: pilih "Execute as: Me" dan "Who has access: Anyone (Siapa saja)".';
          } else if (text.includes('ScriptError') || text.includes('Authorization is required')) {
            errorHelp = 'Izin Apps Script belum disetujui. Buka Apps Script di Google Sheets, jalankan fungsi sekali, dan klik Review Permissions > Allow.';
          }

          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'error',
            error: errorHelp,
            message: errorHelp,
            isHtml: true
          }));
          return;
        }

        let parsedJson: any = null;
        try {
          parsedJson = JSON.parse(text);
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'error',
            error: 'Gagal membaca format JSON dari Webhook. Respons server: ' + text.substring(0, 150),
            raw: text
          }));
          return;
        }

        // Jika Google Apps Script mengembalikan { status: 'error' }
        if (parsedJson && parsedJson.status === 'error') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'error',
            error: parsedJson.message || 'Error dilaporkan oleh Google Apps Script.',
            message: parsedJson.message || 'Error dilaporkan oleh Google Apps Script.',
            ...parsedJson
          }));
          return;
        }

        res.statusCode = targetRes.ok ? 200 : (targetRes.status || 500);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(parsedJson || { status: 'success' }));
      } catch (err: any) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          error: err?.message || 'Gagal menghubungi Google Apps Script Webhook',
          status: 'error',
          message: err?.message || 'Gagal menghubungi Google Apps Script Webhook'
        }));
      }
    });
  });

  // 2. Endpoint Uji Koneksi Webhook (Ping/Test)
  middlewares.use('/api/spreadsheet-test', async (req: any, res: any) => {
    try {
      const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const webhookUrl = urlObj.searchParams.get('webhookUrl');
      const spreadsheetId = urlObj.searchParams.get('spreadsheetId') || '';

      if (!webhookUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: 'URL Webhook wajib diisi.' }));
        return;
      }

      // Kirim ping test via POST
      const testRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'ping',
          spreadsheetId: spreadsheetId,
          timestamp: new Date().toISOString()
        }),
        redirect: 'follow',
      });

      const text = await testRes.text();
      const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');

      if (isHtml) {
        let help = 'Webhook membutuhkan izin Google Login. Buka Apps Script > Deploy > New Deployment > Web app > Atur "Who has access: Anyone".';
        if (text.includes('Sign in') || text.includes('accounts.google.com')) {
          help = 'Akses ditolak: Google meminta login. Harap ubah hak akses deployment menjadi "Anyone (Siapa saja)" bukan "Only myself".';
        }
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: help, isHtml: true }));
        return;
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Coba GET jika POST ditolak
        parsed = { status: 'success', raw: text };
      }

      if (parsed.status === 'error') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: parsed.message || 'Script mengembalikan pesan error.' }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'success',
        message: parsed.message || 'Webhook aktif dan terhubung ke Spreadsheet!',
        spreadsheetTitle: parsed.spreadsheetTitle,
        spreadsheetUrl: parsed.spreadsheetUrl
      }));
    } catch (err: any) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', message: 'Koneksi gagal: ' + (err?.message || 'Server timeout') }));
    }
  });

  // 3. Endpoint Tarik Data GET
  middlewares.use('/api/spreadsheet-read', async (req: any, res: any) => {
    try {
      const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const webhookUrl = urlObj.searchParams.get('webhookUrl');
      const sheetName = urlObj.searchParams.get('sheetName') || 'Picking';
      const spreadsheetId = urlObj.searchParams.get('spreadsheetId') || '';

      if (!webhookUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'URL Webhook wajib diisi.' }));
        return;
      }

      const targetUrl = new URL(webhookUrl);
      targetUrl.searchParams.set('action', 'read');
      targetUrl.searchParams.set('sheetName', sheetName);
      if (spreadsheetId) targetUrl.searchParams.set('spreadsheetId', spreadsheetId);

      const targetRes = await fetch(targetUrl.toString(), { redirect: 'follow' });
      const text = await targetRes.text();
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        parsedJson = { status: 'success', raw: text };
      }

      res.statusCode = targetRes.ok ? 200 : (targetRes.status || 500);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(parsedJson));
    } catch (err: any) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: err?.message || 'Gagal membaca data dari Webhook',
        status: 'error'
      }));
    }
  });

  // 4. Endpoint Cek Versi PWA & Live Code Update Checker
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
    } catch (e) {
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

  // 5. Pastikan /version.json selalu dikirim tanpa browser cache
  middlewares.use('/version.json', async (_req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
}

function spreadsheetProxyPlugin(): Plugin {
  return {
    name: 'spreadsheet-proxy-plugin',
    configureServer(server) {
      registerSpreadsheetMiddlewares(server.middlewares);
    },
    configurePreviewServer(server) {
      registerSpreadsheetMiddlewares(server.middlewares);
    }
  };
}

export default defineConfig(() => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://lvxnozabjemsvejkkwvx.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2eG5vemFiamVtc3Zlamtrd3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjI0NTcsImV4cCI6MjEwMjM5ODQ1N30.haeBn4x-QBhpTdZoJpCV39B7xPABuadcFjmtm5K3At4';
  const sharedBroadcastUrl = process.env.VITE_SHARED_BROADCAST_SUPABASE_URL || process.env.SHARED_BROADCAST_SUPABASE_URL || 'https://elwdoyfviqrhfvpqwfmx.supabase.co';
  const sharedBroadcastKey = process.env.VITE_SHARED_BROADCAST_SUPABASE_ANON_KEY || process.env.SHARED_BROADCAST_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd2RveWZ2aXFyaGZ2cHF3Zm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTQ2NjcsImV4cCI6MjA4OTk5MDY2N30.ElQJLokg0uBDfquesI085RVQlz5mhIbn6M7kahH-y9A';
  const gsheetWebhookUrl = process.env.VITE_GSHEET_WEBHOOK_URL || 'https://logistikapps.cikembar.workers.dev/';
  const gsheetSpreadsheetId = process.env.VITE_GSHEET_SPREADSHEET_ID || '1o8hWUAK6DO1rmggbiRaRNfT7On4c9RhrHR6X07nqZm4';
  const gsheetSheetName = process.env.VITE_GSHEET_SHEET_NAME || 'Incoming';

  return {
    plugins: [react(), tailwindcss(), spreadsheetProxyPlugin()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_SHARED_BROADCAST_SUPABASE_URL': JSON.stringify(sharedBroadcastUrl),
      'import.meta.env.VITE_SHARED_BROADCAST_SUPABASE_ANON_KEY': JSON.stringify(sharedBroadcastKey),
      'import.meta.env.SHARED_BROADCAST_SUPABASE_URL': JSON.stringify(sharedBroadcastUrl),
      'import.meta.env.SHARED_BROADCAST_SUPABASE_ANON_KEY': JSON.stringify(sharedBroadcastKey),
      'import.meta.env.VITE_GSHEET_WEBHOOK_URL': JSON.stringify(gsheetWebhookUrl),
      'import.meta.env.VITE_GSHEET_SPREADSHEET_ID': JSON.stringify(gsheetSpreadsheetId),
      'import.meta.env.VITE_GSHEET_SHEET_NAME': JSON.stringify(gsheetSheetName),
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
