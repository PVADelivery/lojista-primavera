import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import admin from "npm:firebase-admin@11.11.1";

function initFirebase() {
  if (admin.apps && admin.apps.length > 0) return true;
  const firebaseSaJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!firebaseSaJson) {
    console.warn("FIREBASE_SERVICE_ACCOUNT env var is missing");
    return false;
  }
  try {
    const serviceAccount = JSON.parse(firebaseSaJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully");
    return true;
  } catch (e: any) {
    console.error("Firebase init failed:", e?.message);
    return false;
  }
}

function sanitize(input: unknown, max = 120): string {
  const s = String(input ?? "").replace(/[\r\n\t]+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    // Validação de segurança com o webhook secret
    const expectedSecret = Deno.env.get("NOTIFY_DRIVER_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret") ?? "";

    if (expectedSecret && providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const firebaseReady = initFirebase();
    if (!firebaseReady) {
      return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT not configured or invalid' }), { status: 500 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: 'Missing Supabase vars' }), { status: 500 });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = await req.json();
    const record = payload?.record;
    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: 'No record found' }), { status: 400 });
    }

    if (record.status !== 'pending' && record.status !== 'broadcasted') {
      return new Response(JSON.stringify({ message: 'Status is not pending/broadcasted, ignoring' }), { status: 200 });
    }

    // Busca tokens de motoristas cadastrados
    const tokenSet = new Set<string>();

    try {
      const { data: drivers } = await adminClient
        .from('delivery_drivers')
        .select('fcm_token')
        .not('fcm_token', 'is', null);

      for (const d of (drivers ?? [])) {
        if (d?.fcm_token && d.fcm_token.length > 10) {
          tokenSet.add(d.fcm_token);
        }
      }
    } catch (e: any) {
      console.warn("Could not query delivery_drivers:", e?.message);
    }

    try {
      const { data: devices } = await adminClient
        .from('device_tokens')
        .select('token')
        .not('token', 'is', null);

      for (const dev of (devices ?? [])) {
        if (dev?.token && dev.token.length > 10) {
          tokenSet.add(dev.token);
        }
      }
    } catch (e: any) {
      console.warn("Could not query device_tokens:", e?.message);
    }

    const tokens = Array.from(tokenSet);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No registered driver tokens found yet' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const address = sanitize(record.pickup_address || record.delivery_address || 'Novo local de coleta');

    const message = {
      notification: {
        title: 'MT 24 Horas Express - Nova Corrida!',
        body: `Retirada: ${address}`
      },
      data: {
        type: 'delivery',
        deliveryId: String(record.id),
        pickup: String(record.pickup_address || ''),
        dropoff: String(record.delivery_address || ''),
        fee: String(record.price || record.value || '8,80')
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'delivery-incoming-v1',
          sound: 'ring',
          priority: 'max' as const,
          defaultSound: false,
          defaultVibrateTimings: true,
          visibility: 'public' as const
        }
      },
      tokens
    };

    let response: any = null;
    if (typeof admin.messaging().sendEachForMulticast === 'function') {
      response = await admin.messaging().sendEachForMulticast(message);
    } else {
      // Fallback enviando mensagens individuais via API v1
      const sendPromises = tokens.map((token: string) =>
        admin.messaging().send({
          token,
          notification: message.notification,
          data: message.data,
          android: message.android
        }).then(() => ({ success: true })).catch((err: any) => ({ success: false, error: err?.message }))
      );
      const results = await Promise.all(sendPromises);
      const successCount = results.filter(r => r.success).length;
      response = { successCount, failureCount: results.length - successCount, responses: results };
    }

    console.log(`Push sent to ${tokens.length} drivers, success: ${response.successCount}, failure: ${response.failureCount}`);

    return new Response(JSON.stringify({ success: true, response }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("Error sending push:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), { status: 500 });
  }
});
