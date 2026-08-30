// Edge Function: create-order
// Recalcula preços, frete e desconto no servidor para evitar manipulação client-side.
// Deploy: supabase functions deploy create-order --project-ref <REF>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
};

interface CartItemInput {
  product_id: string;
  quantity: number;
  notes?: string | null;
  options?: any[] | null;
}

interface CreateOrderBody {
  items: CartItemInput[];
  company_id?: string;
  store_id?: string; // alias para company_id
  customer_id?: string | null;
  address_id?: string | null;
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state?: string;
    zip_code?: string;
    complement?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  payment_method: 'money' | 'pix' | 'card' | 'credits';
  coupon_code?: string | null;
  notes?: string | null;
  needs_change?: boolean;
  change_for?: number | null;
  idempotency_key: string;
  fulfillment_mode?: 'delivery' | 'pickup';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function newRequestId() {
  try {
    return (crypto as any).randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANON = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) {
    return json({ error: 'Server misconfigured: missing Supabase env vars.' }, 500);
  }

  // Auth: validar JWT do cliente.
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing Authorization bearer token.' }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'Invalid session.' }, 401);
  }
  const user = userData.user;

  // Service role para operações no banco com privilégios de sistema
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const requestId = newRequestId();
  const t0 = Date.now();
  let body: CreateOrderBody | undefined;

  const audit = async (
    event: string,
    extra: Record<string, unknown> = {},
    httpStatus: number | null = null,
  ) => {
    try {
      await adminClient.from('audit_logs').insert({
        request_id: requestId,
        user_id: user?.id ?? null,
        event,
        source: 'edge.create-order',
        http_status: httpStatus,
        error_code: (extra as any).error_code ?? null,
        error_message: (extra as any).error_message ?? null,
        payload: (extra as any).payload ?? null,
        context: { idempotency_key: body?.idempotency_key ?? null, ...((extra as any).context ?? {}) },
      });
    } catch (e) {
      console.warn('[create-order][audit] failed', (e as Error).message);
    }
  };

  const fail = async (status: number, event: string, message: string, extra: Record<string, unknown> = {}) => {
    await audit(event, { error_message: message, ...extra }, status);
    return json({ error: message, message, request_id: requestId, ...extra }, status);
  };

  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    return fail(400, 'create_order.bad_json', 'Invalid JSON body.', { field: 'body' });
  }

  // --- ANTI-SPAM / RATE LIMITING ---
  const { count: recentOrdersCount } = await adminClient
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gt('created_at', new Date(Date.now() - 60000).toISOString());

  if (recentOrdersCount !== null && recentOrdersCount >= 5) {
    return fail(429, 'create_order.rate_limit', 'Você está fazendo pedidos muito rápido. Por favor, aguarde alguns instantes.');
  }

  const companyId = body.company_id || body.store_id;
  const fulfillmentMode = body.fulfillment_mode === 'pickup' ? 'pickup' : 'delivery';

  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return fail(400, 'create_order.validation', 'items is required and must be non-empty.', { field: 'items' });
  }
  if (!companyId) {
    return fail(400, 'create_order.validation', 'company_id (ou store_id) is required.', { field: 'company_id' });
  }
  if (fulfillmentMode === 'delivery' && !body.address_id && !body.address) {
    return fail(400, 'create_order.validation', 'address_id ou address é obrigatório para entrega.', { field: 'address_id' });
  }
  if (!['money', 'pix', 'card', 'credits'].includes(body.payment_method)) {
    return fail(400, 'create_order.validation', 'payment_method must be money|pix|card|credits.', { field: 'payment_method' });
  }
  if (!body.idempotency_key || typeof body.idempotency_key !== 'string') {
    return fail(400, 'create_order.validation', 'idempotency_key is required.', { field: 'idempotency_key' });
  }
  for (const it of body.items) {
    if (!it.product_id || typeof it.product_id !== 'string') {
      return fail(400, 'create_order.validation', 'each item must have a valid product_id.', { field: 'items.product_id' });
    }
    if (!it.quantity || !Number.isInteger(it.quantity) || it.quantity <= 0) {
      return fail(400, 'create_order.validation', 'each item must have integer quantity > 0.', { field: 'items.quantity' });
    }
  }

  // Garante / localiza o customer_id seguro do usuário autenticado
  let customerId: string | null = null;
  const { data: existingCustomer } = await adminClient
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingCustomer?.id) {
    customerId = existingCustomer.id;
  } else {
    // Provisiona customer caso ainda não exista
    const { data: newCustomer, error: newCustErr } = await adminClient
      .from('customers')
      .insert({
        user_id: user.id,
        name: (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || 'Cliente',
        phone: (user.user_metadata as any)?.phone || null,
      })
      .select('id')
      .single();

    if (!newCustErr && newCustomer?.id) {
      customerId = newCustomer.id;
    } else {
      return fail(500, 'create_order.customer_failed', 'Failed to resolve customer profile.');
    }
  }

  // Se o frontend passou customer_id, valida que pertence ao usuário
  if (body.customer_id && body.customer_id !== customerId) {
    const { data: custMatch } = await adminClient
      .from('customers')
      .select('id')
      .eq('id', body.customer_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!custMatch) {
      return fail(403, 'create_order.customer_forbidden', 'customer_id does not belong to authenticated user.', { field: 'customer_id' });
    }
    customerId = custMatch.id;
  }

  await audit('create_order.attempt', {
    payload: { company_id: companyId, address_id: body.address_id, items: body.items, coupon: body.coupon_code ?? null, payment_method: body.payment_method },
  });

  // 1) Validação de Endereço (se entrega)
  let address: any = null;
  let deliveryAddress = '[RETIRADA NO LOCAL]';

  if (fulfillmentMode === 'delivery') {
    if (body.address_id) {
      const { data: addrData, error: addrErr } = await adminClient
        .from('addresses')
        .select('id, user_id, customer_id, street, number, neighborhood, city, state, zip_code, complement, latitude, longitude')
        .eq('id', body.address_id)
        .maybeSingle();

      if (addrErr || !addrData) {
        return fail(404, 'create_order.address_not_found', 'Address not found for this user.', { field: 'address_id' });
      }

      const isOwner = addrData.user_id === user.id || addrData.customer_id === customerId;
      if (!isOwner) {
        const { data: custCheck } = await adminClient
          .from('customers')
          .select('id')
          .eq('id', addrData.customer_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!custCheck) {
          return fail(403, 'create_order.address_forbidden', 'Address not found for this user.', { field: 'address_id' });
        }
      }
      address = addrData;
    } else if (body.address) {
      address = body.address;
    }

    if (!address || !address.street || !address.number || !address.neighborhood || !address.city) {
      return fail(400, 'create_order.address_incomplete', 'Dados de endereço incompletos (Rua, Número, Bairro e Cidade são obrigatórios).', { field: 'address' });
    }

    deliveryAddress = `${address.street}, ${address.number}${address.complement ? ` (${address.complement})` : ''} - ${address.neighborhood}, ${address.city}`;
  }

  // 2) Company existe
  const { data: company, error: compErr } = await adminClient
    .from('companies')
    .select('id, name, address, latitude, longitude, delivery_fee')
    .eq('id', companyId)
    .maybeSingle();
  if (compErr || !company) return fail(400, 'create_order.company_missing', 'Company not found.', { field: 'company_id' });

  // 3) Re-fetch produtos canonicamente da tabela public.products (apenas colunas existentes no schema)
  const productIds = Array.from(new Set(body.items.map((i) => i.product_id)));
  const { data: products, error: prodErr } = await adminClient
    .from('products')
    .select('id, name, price, company_id, is_active')
    .in('id', productIds);

  if (prodErr || !products) {
    return fail(500, 'create_order.products_load_failed', `Failed to load products: ${prodErr?.message || 'Database error'}`, {
      field: 'items',
      db_error: prodErr?.message,
      db_code: prodErr?.code,
      requested_product_ids: productIds,
    });
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  for (const it of body.items) {
    const p = byId.get(it.product_id);
    if (!p) return fail(400, 'create_order.product_missing', `Product ${it.product_id} not found.`, { field: 'items.product_id', product_id: it.product_id });
    if (p.company_id !== company.id) return fail(400, 'create_order.product_wrong_company', 'Item does not belong to the company.', { field: 'items.product_id' });
    if (p.is_active === false) return fail(400, 'create_order.product_unavailable', `Product ${p.name} is unavailable.`, { field: 'items.product_id' });
  }

  // 4) Subtotal canônico
  const enrichedItems = body.items.map((it) => {
    const p = byId.get(it.product_id)!;
    return {
      product_id: p.id,
      product_name: p.name,
      unit_price: Number(p.price) || 0,
      quantity: it.quantity,
      line_total: (Number(p.price) || 0) * it.quantity,
      notes: it.notes ?? null,
      options: it.options ?? [],
    };
  });
  const subtotal = enrichedItems.reduce((acc, x) => acc + x.line_total, 0);

  // 5) Cupom (server-side)
  let appliedCoupon: any = null;
  let discount = 0;
  if (body.coupon_code && body.coupon_code.trim()) {
    const code = body.coupon_code.trim().toUpperCase();
    const { data: coupon } = await adminClient
      .from('coupons')
      .select('*')
      .eq('code', code)
      .eq('active', true)
      .maybeSingle();
    if (!coupon) return fail(400, 'create_order.coupon_invalid', 'Invalid or inactive coupon.', { field: 'coupon_code' });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return fail(400, 'create_order.coupon_expired', 'Coupon expired.', { field: 'coupon_code' });
    }
    if (coupon.min_order_value && subtotal < Number(coupon.min_order_value)) {
      return fail(400, 'create_order.coupon_below_min', 'Order below coupon minimum.', { field: 'coupon_code' });
    }
    if (coupon.company_id && coupon.company_id !== company.id) {
      return fail(400, 'create_order.coupon_other_store', 'Coupon belongs to another store.', { field: 'coupon_code' });
    }
    const { data: links } = await adminClient
      .from('coupon_products')
      .select('product_id')
      .eq('coupon_id', coupon.id);
    const restrictIds = (links ?? []).map((l: any) => l.product_id);
    const eligible = restrictIds.length
      ? enrichedItems.filter((i) => restrictIds.includes(i.product_id))
      : enrichedItems;
    const eligibleSubtotal = eligible.reduce((a, x) => a + x.line_total, 0);
    if (eligibleSubtotal > 0) {
      if (coupon.discount_type === 'percentage') {
        discount = (eligibleSubtotal * Number(coupon.discount_value)) / 100;
        if (coupon.max_discount_value) {
          discount = Math.min(discount, Number(coupon.max_discount_value));
        }
      } else {
        discount = Math.min(eligibleSubtotal, Number(coupon.discount_value));
      }
    }
    appliedCoupon = coupon;
  }

  // 6) Frete
  let deliveryFee = 0;
  let regionId: string | null = null;
  let regionName: string | null = null;
  let outOfRegion = false;

  if (fulfillmentMode === 'pickup') {
    deliveryFee = 0;
  } else if (company.delivery_fee !== null && company.delivery_fee !== undefined) {
    deliveryFee = Number(company.delivery_fee) || 0;
  } else if (address?.latitude && address?.longitude) {
    const { data: regions } = await adminClient
      .from('regions')
      .select('id, name, price, delivery_fee, geometry');
    if (regions && regions.length > 0) {
      const inside = pickRegion(regions, Number(address.latitude), Number(address.longitude));
      if (inside) {
        deliveryFee = Number(inside.price ?? inside.delivery_fee ?? 0);
        regionId = inside.id;
        regionName = inside.name;
      } else {
        outOfRegion = true;
      }
    }
  }
  if (outOfRegion) {
    return fail(400, 'create_order.out_of_region', 'Delivery unavailable for this address (out of region).', { field: 'address' });
  }

  const total = Math.max(0, subtotal - discount) + deliveryFee;

  // 7) Idempotência
  const { data: existing } = await adminClient
    .from('orders')
    .select('id')
    .eq('idempotency_key', body.idempotency_key)
    .maybeSingle();
  if (existing?.id) {
    await audit('create_order.idempotent_hit', { context: { order_id: existing.id } }, 200);
    return json({ order_id: existing.id, idempotent: true });
  }

  // 8) Notas (inclui troco)
  let finalNotes = body.notes?.trim() || null;
  if (body.payment_method === 'money' && body.needs_change && body.change_for) {
    const note = `Troco para R$ ${Number(body.change_for).toFixed(2)}`;
    finalNotes = finalNotes ? `${finalNotes} • ${note}` : note;
  }

  const customerFullName = (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || 'Cliente';

  // 9) Insert order
  const { data: order, error: orderErr } = await adminClient
    .from('orders')
    .insert({
      customer_id: customerId,
      user_id: user.id,
      company_id: company.id,
      customer_name: customerFullName,
      delivery_address: deliveryAddress,
      status: 'pending',
      total,
      delivery_fee: deliveryFee,
      payment_method: body.payment_method,
      notes: finalNotes,
      idempotency_key: body.idempotency_key,
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    if ((orderErr as any)?.code === '23505') {
      const { data: dup } = await adminClient
        .from('orders')
        .select('id')
        .eq('idempotency_key', body.idempotency_key)
        .maybeSingle();
      if (dup?.id) {
        await audit('create_order.idempotent_hit', { context: { order_id: dup.id, via: '23505' } }, 200);
        return json({ order_id: dup.id, idempotent: true });
      }
    }
    return fail(500, 'create_order.insert_failed', orderErr?.message || 'Failed to create order.', {
      error_code: (orderErr as any)?.code ?? null,
      details: orderErr?.details ?? null,
    });
  }

  // 10) Insert items (apenas colunas existentes na tabela public.order_items)
  const itemsRow = enrichedItems.map((i) => ({
    order_id: order.id,
    product_id: i.product_id,
    product_name: i.product_name,
    quantity: i.quantity,
    price: i.unit_price,
  }));
  const { error: itemsErr } = await adminClient.from('order_items').insert(itemsRow);
  if (itemsErr) {
    return fail(500, 'create_order.items_insert_failed', itemsErr.message, {
      context: { order_id: order.id },
      details: itemsErr.details,
    });
  }

  // 11) Cupom usado
  if (appliedCoupon) {
    await adminClient.from('user_coupons').insert({
      user_id: user.id,
      coupon_id: appliedCoupon.id,
      order_id: order.id,
      used_at: new Date().toISOString(),
    });
  }

  // 12) Delivery (apenas para entrega; colunas compatíveis com public.deliveries)
  if (fulfillmentMode === 'delivery') {
    await adminClient.from('deliveries').insert({
      order_id: order.id,
      company_id: company.id,
      customer_name: customerFullName,
      address: deliveryAddress,
      status: 'pending',
      value: total,
      region_id: regionId,
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
    });
  }

  await audit(
    'create_order.success',
    {
      context: {
        order_id: order.id,
        subtotal,
        discount,
        delivery_fee: deliveryFee,
        total,
        region_id: regionId,
        region_name: regionName,
        items: enrichedItems.length,
        duration_ms: Date.now() - t0,
      },
    },
    200,
  );

  return json({
    order_id: order.id,
    request_id: requestId,
    total,
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    region: regionName,
  });
});

// Point-in-polygon ray casting
function pickRegion(regions: any[], lat: number, lng: number) {
  for (const r of regions) {
    const poly = normalizePolygon(r.geometry);
    if (poly && pointInPolygon(lng, lat, poly)) return r;
  }
  return null;
}
function normalizePolygon(p: any): [number, number][] | null {
  if (!p) return null;
  try {
    if (p.type === 'Polygon' && Array.isArray(p.coordinates?.[0])) {
      return p.coordinates[0].map((c: number[]) => [c[0], c[1]] as [number, number]);
    }
    if (Array.isArray(p) && p[0]?.lat !== undefined) {
      return p.map((pt: any) => [pt.lng, pt.lat] as [number, number]);
    }
  } catch {
    return null;
  }
  return null;
}
function pointInPolygon(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}