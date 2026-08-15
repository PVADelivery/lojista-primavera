import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || url.searchParams.get("authorizationCode");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const frontendAppUrl = Deno.env.get("FRONTEND_LOJISTA_URL") || "https://lojista.mt24horasexpress.com";

  if (errorParam) {
    return Response.redirect(`${frontendAppUrl}/business/integrations?error=${encodeURIComponent(errorParam)}`, 302);
  }

  if (!code || !stateRaw) {
    return Response.redirect(`${frontendAppUrl}/business/integrations?error=missing_params`, 302);
  }

  try {
    const state = JSON.parse(atob(stateRaw));
    const companyId = state.company_id;

    if (!companyId) {
      return Response.redirect(`${frontendAppUrl}/business/integrations?error=invalid_state`, 302);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientId = state.client_id || Deno.env.get("IFOOD_CLIENT_ID") || "9e845849-a0e7-4645-87f0-b7a5b9b36b58";
    const clientSecret = state.client_secret || Deno.env.get("IFOOD_CLIENT_SECRET") || "wzz94902vae79kw6cvr1m0c85f52upjphfg9zftansn6cuanlw7ruxodbswg5o3yvx2yj2qm6p1ypv5w1yxgzzunmaopetbfnc7";
    const redirectUri = Deno.env.get("IFOOD_REDIRECT_URI") || `${supabaseUrl}/functions/v1/ifood-callback`;

    // Busca se existe authorizationCodeVerifier gravado na sessão pendente
    let codeVerifier = "";
    const { data: pendingConn } = await supabase
      .from("ifood_connections")
      .select("last_sync_error")
      .eq("company_id", companyId)
      .single();

    if (pendingConn?.last_sync_error) {
      try {
        const parsed = JSON.parse(pendingConn.last_sync_error);
        if (parsed.authorizationCodeVerifier) {
          codeVerifier = parsed.authorizationCodeVerifier;
        }
      } catch {}
    }

    // 1. Troca code por access token e refresh token na API Oficial do iFood
    const tokenRes = await fetch("https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grantType: "authorization_code",
        clientId: clientId,
        clientSecret: clientSecret,
        authorizationCode: code,
        authorizationCodeVerifier: codeVerifier,
        redirectUri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("iFood Token Exchange Error:", errBody);
      return Response.redirect(`${frontendAppUrl}/business/integrations?error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.accessToken || tokenData.access_token;
    const refreshToken = tokenData.refreshToken || tokenData.refresh_token;
    const expiresIn = Number(tokenData.expiresIn || tokenData.expires_in || 21600); // default 6h
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 2. Busca dados do merchant autorizado
    let merchantId = "unknown";
    let merchantName = "Restaurante iFood";

    try {
      const merchantsRes = await fetch("https://merchant-api.ifood.com.br/merchant/v1.0/merchants", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (merchantsRes.ok) {
        const merchants = await merchantsRes.json();
        if (Array.isArray(merchants) && merchants.length > 0) {
          merchantId = merchants[0].id;
          merchantName = merchants[0].name || merchants[0].corporateName || merchantName;
        }
      }
    } catch (mErr) {
      console.error("Error fetching merchants:", mErr);
    }

    // 3. Grava conexão de forma segura na tabela ifood_connections (UPSERT por company_id)
    const { error: upsertError } = await supabase
      .from("ifood_connections")
      .upsert(
        {
          company_id: companyId,
          merchant_id: merchantId,
          merchant_name: merchantName,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt,
          status: "connected",
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_sync_error: null,
        },
        { onConflict: "company_id" }
      );

    if (upsertError) {
      console.error("DB Upsert Connection Error:", upsertError);
      return Response.redirect(`${frontendAppUrl}/business/integrations?error=db_save_failed`, 302);
    }

    return Response.redirect(`${frontendAppUrl}/business/integrations?success=connected&merchant=${encodeURIComponent(merchantName)}`, 302);
  } catch (err: any) {
    console.error("Callback Exception:", err);
    return Response.redirect(`${frontendAppUrl}/business/integrations?error=internal_error`, 302);
  }
});
