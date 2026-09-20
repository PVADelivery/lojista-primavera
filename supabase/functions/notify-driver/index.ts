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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-application-name',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

function sanitize(input: unknown, max = 120): string {
  const s = String(input ?? "").replace(/[\r\n\t]+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // Validação de segurança com o webhook secret ou token de autorização
    const expectedSecret = Deno.env.get("NOTIFY_DRIVER_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret") ?? "";
    const authHeader = req.headers.get("authorization") ?? "";

    if (expectedSecret && providedSecret !== expectedSecret && !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
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

    const status = String(record.status || '').toLowerCase();
    if (status !== 'pending' && status !== 'broadcasted') {
      return new Response(JSON.stringify({ message: 'Status is not pending/broadcasted, ignoring' }), { status: 200 });
    }

    // REGRA: Dispara notificação push FCM IMEDIATAMENTE no momento da criação para todos os motoristas online!

    // Busca tokens
    const tokenSet = new Set<string>();

    if (record.driver_id) {
      // 1. Se o Admin DIRECIONOU para um motorista específico, notifica SOMENTE ELE (se estiver online)!
      try {
        const { data: driver } = await adminClient
          .from('delivery_drivers')
          .select('fcm_token, user_id, is_online')
          .or(`id.eq.${record.driver_id},user_id.eq.${record.driver_id}`)
          .maybeSingle();

        if (driver?.fcm_token && driver.fcm_token.length > 10 && driver?.is_online === true) {
          tokenSet.add(driver.fcm_token);
        }
      } catch (e: any) {
        console.warn("Could not query assigned driver:", e?.message);
      }
    } else {
      // 2. Transmissão geral: APENAS para motoristas estritamente ONLINE (is_online = true)
      try {
        const { data: drivers } = await adminClient
          .from('delivery_drivers')
          .select('fcm_token, is_online')
          .eq('is_online', true)
          .not('fcm_token', 'is', null);

        for (const d of (drivers ?? [])) {
          if (d?.fcm_token && d.fcm_token.length > 10) {
            tokenSet.add(d.fcm_token);
          }
        }
      } catch (e: any) {
        console.warn("Could not query delivery_drivers:", e?.message);
      }
    }

    const tokens = Array.from(tokenSet);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No registered driver tokens found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isRide = payload?.table === 'ride_requests' ||
      record.vehicle_type === 'mototaxi' ||
      record.vehicle_type === 'taxi' ||
      record.type === 'ride' ||
      record.type === 'mototaxi' ||
      record.type === 'taxi' ||
      (!record.company_id && record.pickup_address && record.dropoff_address && !record.order_id);

    const isTaxi = record.vehicle_type === 'taxi' || record.type === 'taxi';

    let storeName = sanitize(record.company_name || record.store_name || '');
    let pickup = sanitize(record.pickup_address || record.origin_address || '');
    let dropoff = sanitize(record.delivery_address || record.address || record.dropoff_address || '');

    if (!isRide && (!storeName || !pickup) && record.company_id) {
      try {
        const { data: comp } = await adminClient
          .from('companies')
          .select('name, address')
          .eq('id', record.company_id)
          .maybeSingle();
        if (comp) {
          if (!storeName && comp.name) storeName = sanitize(comp.name);
          if (!pickup && comp.address) pickup = sanitize(comp.address);
        }
      } catch (e: any) {
        console.warn("Could not query company:", e?.message);
      }
    }

    let notifTitle = '';
    let notifBody = '';

    if (isRide) {
      notifTitle = isTaxi ? '🚕 Nova Corrida de Táxi!' : '🏍️ Nova Corrida de Moto Táxi!';
      if (pickup && dropoff) {
        notifBody = `Embarque: ${pickup} ➔ Destino: ${dropoff}`;
      } else if (pickup) {
        notifBody = `Embarque: ${pickup}`;
      } else if (dropoff) {
        notifBody = `Destino: ${dropoff}`;
      } else {
        notifBody = isTaxi ? 'Nova corrida de táxi disponível' : 'Nova corrida de moto táxi disponível';
      }
    } else {
      notifTitle = storeName ? `🏬 ${storeName}` : 'MT 24 Horas Express - Nova Entrega!';
      if (pickup && dropoff) {
        notifBody = `Retirada: ${pickup} ➔ Entrega: ${dropoff}`;
      } else if (pickup) {
        notifBody = `Retirada: ${pickup}`;
      } else if (dropoff) {
        notifBody = `Entrega: ${dropoff}`;
      } else {
        notifBody = 'Nova entrega disponível';
      }
    }

    const deliveryTag = isRide ? `ride_${record.id}` : `delivery_${record.id}`;

    const message = {
      notification: {
        title: notifTitle,
        body: notifBody
      },
      data: {
        type: isRide ? (isTaxi ? 'taxi' : 'mototaxi') : 'delivery',
        deliveryId: String(record.id),
        rideId: String(record.id),
        storeName: String(storeName || (isRide ? (isTaxi ? 'Táxi Express' : 'Moto Táxi Express') : '')),
        pickup: String(pickup || ''),
        dropoff: String(dropoff || ''),
        fee: String(record.price || record.value || record.delivery_fee || (isRide ? (isTaxi ? '15,00' : '10,00') : '8,80'))
      },
      android: {
        priority: 'high' as const,
        collapseKey: deliveryTag, // Garante que o Firebase não entregue duplicatas
        notification: {
          channelId: 'mt24_delivery_alerts_v35', // CANAL OFICIAL CRIADO NO ANDROID!
          sound: 'ring',
          priority: 'max' as const,
          defaultSound: false,
          defaultVibrateTimings: true,
          visibility: 'public' as const,
          tag: deliveryTag // Garante que o Android atualize a notificação em vez de criar uma segunda
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("Error sending push:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
