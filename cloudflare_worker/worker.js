/**
 * ==============================================================================
 * CLOUDFLARE WORKER: GOOGLE SHEETS PROXY & INTEGRATION
 * ==============================================================================
 * Worker ini berfungsi sebagai backend gateway / proxy antara LogistikApps 
 * dan Google Sheets (Apps Script Webhook / Google Sheets API).
 *
 * Keunggulan:
 * 1. Mengatasi isu CORS dari browser secara instan.
 * 2. Menyediakan proteksi API Key / Secret Token.
 * 3. Logging request dan payload validation.
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Tangani Pre-flight CORS (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Secret-Token",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);

    // Health Check Endpoint
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        JSON.stringify({
          status: "online",
          service: "LogistikApps Cloudflare Worker to Google Sheets Gateway",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ status: "error", message: "Hanya metode POST yang diizinkan." }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    try {
      const payload = await request.json();

      // 2. Validasi Secret Token (jika dikonfigurasikan di Environment Variables Worker)
      const expectedSecret = env.SECRET_TOKEN;
      if (expectedSecret && payload.secretToken !== expectedSecret) {
        return new Response(
          JSON.stringify({ status: "error", message: "Secret Token tidak valid." }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // 3. Tentukan Target Webhook Google Apps Script
      // Bisa diambil dari Environment Variable GOOGLE_SCRIPT_URL atau dari payload
      const targetGoogleScriptUrl = env.GOOGLE_SCRIPT_URL || payload.googleScriptUrl;

      if (!targetGoogleScriptUrl) {
        return new Response(
          JSON.stringify({
            status: "error",
            message: "GOOGLE_SCRIPT_URL belum disetting di Cloudflare Worker env variables.",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // 4. Teruskan Request ke Google Apps Script Webhook (dengan follow redirect)
      const gscriptResponse = await fetch(targetGoogleScriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        redirect: "follow",
      });

      const responseText = await gscriptResponse.text();
      let responseData;

      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = {
          status: gscriptResponse.ok ? "success" : "error",
          raw: responseText,
        };
      }

      // 5. Kembalikan Response ke Browser Frontend dengan Header CORS lengkap
      return new Response(JSON.stringify(responseData), {
        status: gscriptResponse.status || 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Internal Worker Error: " + err.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
