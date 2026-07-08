import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Escape Telegram MarkdownV1 special chars in user-controlled text to prevent injection
function escapeMd(input: unknown, max = 500): string {
  const s = String(input ?? "").replace(/[`*_\[\]]/g, "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require an authenticated Supabase user to call this logger
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      app_name = "App Desconhecido",
      error_message = "Sem mensagem de erro",
      stack_trace = "",
      url = "N/A",
      additional_info = {},
    } = body ?? {};

    // Credentials must come from env — no hardcoded fallback
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ error: "Telegram not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });
    const authedEmail = userData.user.email ?? "";
    const authedId = userData.user.id;

    let messageText = `🚨 ERRO DETECTADO 🚨\n\n`;
    messageText += `App: ${escapeMd(app_name, 60)}\n`;
    messageText += `Hora: ${timestamp}\n`;
    messageText += `URL: ${escapeMd(url, 200)}\n\n`;
    messageText += `Usuário: ${escapeMd(authedEmail, 100)} (${authedId})\n\n`;
    messageText += `Mensagem: ${escapeMd(error_message, 500)}\n\n`;

    if (stack_trace) {
      messageText += `Stack:\n${escapeMd(stack_trace, 1000)}\n`;
    }

    if (additional_info && typeof additional_info === "object" && Object.keys(additional_info).length > 0) {
      messageText += `Detalhes:\n${escapeMd(JSON.stringify(additional_info), 800)}\n`;
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: messageText }),
    });

    const resData = await response.json();
    return new Response(JSON.stringify({ success: true, telegram: resData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in telegram-logger:", err?.message);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
