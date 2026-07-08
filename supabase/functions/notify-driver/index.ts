import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import admin from "npm:firebase-admin@11.11.1";

// Firebase service account JSON must be provided via env: FIREBASE_SERVICE_ACCOUNT
const firebaseSaJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
if (firebaseSaJson) {
  try {
    const serviceAccount = JSON.parse(firebaseSaJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    // Already initialized or invalid JSON
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
    // Require a webhook shared secret so only the Supabase DB webhook can invoke this
    const expectedSecret = Deno.env.get("NOTIFY_DRIVER_WEBHOOK_SECRET");
    if (!expectedSecret) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
    }
    const providedSecret = req.headers.get("x-webhook-secret") ?? "";
    if (providedSecret.length !== expectedSecret.length ||
        !crypto.subtle) {
      // fall through to constant-time compare below
    }
    // Constant-time compare
    const a = new TextEncoder().encode(providedSecret);
    const b = new TextEncoder().encode(expectedSecret);
    let ok = a.length === b.length;
    let diff = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    if (!ok || diff !== 0) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (!firebaseSaJson) {
      return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT not configured' }), { status: 500 });
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
      return new Response(JSON.stringify({ message: 'Status is not pending, ignoring' }), { status: 200 });
    }

    const { data: drivers, error } = await adminClient
      .from('delivery_drivers')
      .select('fcm_token')
      .not('fcm_token', 'is', null);
    if (error) throw error;

    const tokens = (drivers ?? []).map((d: any) => d.fcm_token).filter((t: string) => t && t.length > 10);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No valid tokens' }), { status: 200 });
    }

    const address = sanitize(record.pickup_address || record.delivery_address || 'Novo local de coleta');

    const message = {
      notification: {
        title: 'ÉpraJá - Nova corrida!',
        body: `Retirada: ${address}`
      },
      data: {
        type: 'delivery',
        deliveryId: String(record.id)
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'delivery-channel-v2',
          sound: 'ring',
          priority: 'max' as const,
          defaultSound: false,
          defaultVibrateTimings: true,
          visibility: 'public' as const
        }
      },
      tokens
    };

    const response = await admin.messaging().sendMulticast(message);

    return new Response(JSON.stringify({ success: true, response }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("Error sending push:", err?.message);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
