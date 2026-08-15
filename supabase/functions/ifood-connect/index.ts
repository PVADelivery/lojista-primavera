import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { company_id, client_id, client_secret } = body;
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se a empresa pertence ao usuário
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", company_id)
      .single();

    if (companyErr || !company) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada ou sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = client_id || Deno.env.get("IFOOD_CLIENT_ID") || "fd78e2cc-9a8a-4f93-9efe-a03cc0249ab5";
    const clientSecret = client_secret || Deno.env.get("IFOOD_CLIENT_SECRET");
    const redirectUri = Deno.env.get("IFOOD_REDIRECT_URI") || `${supabaseUrl}/functions/v1/ifood-callback`;

    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          error: "Credenciais do iFood ainda não configuradas. Insira seu Client ID do Portal iFood Developer para iniciar." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Tenta obter userCode para fluxo oficial de aplicativo do Portal iFood (Distributed/Centralized OAuth)
    try {
      const userCodeRes = await fetch("https://merchant-api.ifood.com.br/authentication/v1.0/oauth/userCode", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          clientId: clientId,
        }),
      });

      if (userCodeRes.ok) {
        const userCodeData = await userCodeRes.json();
        // userCodeData: { userCode, authorizationCodeVerifier, verificationUrl, verificationUrlComplete, expiresIn }
        
        // Salva temporariamente o authorizationCodeVerifier na sessão / conexão pendente
        const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? supabaseAnonKey);
        await adminClient
          .from("ifood_connections")
          .upsert({
            company_id: company.id,
            merchant_id: "PENDING",
            access_token: "PENDING",
            token_expires_at: new Date(Date.now() + (userCodeData.expiresIn || 600) * 1000).toISOString(),
            status: "pending_authorization",
            last_sync_error: JSON.stringify({
              userCode: userCodeData.userCode,
              authorizationCodeVerifier: userCodeData.authorizationCodeVerifier,
              clientId: clientId,
              clientSecret: clientSecret || undefined,
            }),
            updated_at: new Date().toISOString(),
          }, { onConflict: "company_id" });

        return new Response(
          JSON.stringify({
            flow: "user_code",
            user_code: userCodeData.userCode,
            verification_url: userCodeData.verificationUrl,
            verification_url_complete: userCodeData.verificationUrlComplete,
            expires_in: userCodeData.expiresIn,
            url: userCodeData.verificationUrlComplete || userCodeData.verificationUrl,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (userCodeErr) {
      console.warn("userCode endpoint error, falling back to direct authorization URL:", userCodeErr);
    }

    // Fallback: URL oficial de autorização OAuth 2.0 padrão
    const statePayload = {
      company_id: company.id,
      user_id: user.id,
      client_id: clientId,
      client_secret: clientSecret || undefined,
      nonce: crypto.randomUUID(),
      ts: Date.now(),
    };
    const state = btoa(JSON.stringify(statePayload));

    const authUrl = `https://portal.ifood.com.br/apps/authorization?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

    return new Response(
      JSON.stringify({
        flow: "oauth_redirect",
        url: authUrl,
        state,
        redirect_uri: redirectUri,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
