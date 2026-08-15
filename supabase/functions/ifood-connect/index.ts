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

    const { company_id } = await req.json();
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

    const clientId = Deno.env.get("IFOOD_CLIENT_ID") || "IFOOD_CLIENT_ID_PLACEHOLDER";
    const redirectUri = Deno.env.get("IFOOD_REDIRECT_URI") || `${supabaseUrl}/functions/v1/ifood-callback`;

    // State codificado de forma segura (company_id + timestamp + user_id)
    const statePayload = {
      company_id: company.id,
      user_id: user.id,
      ts: Date.now(),
    };
    const state = btoa(JSON.stringify(statePayload));

    // URL oficial de autorização OAuth 2.0 do Portal iFood
    const authUrl = `https://portal.ifood.com.br/apps/authorization?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

    return new Response(
      JSON.stringify({
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
