import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_BOT_TOKEN = "8798211446:AAHLAxDhYh81qj7o39qBkkaez3vZvEJnXqw";
const DEFAULT_CHAT_ID = "538563060";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      app_name = "App Desconhecido", 
      error_message = "Sem mensagem de erro", 
      stack_trace = "", 
      user_id = "Não autenticado", 
      user_email = "", 
      url = "N/A", 
      additional_info = {} 
    } = body ?? {};

    // 1. Fetch credentials from DB if possible, fallback to defaults
    let botToken = DEFAULT_BOT_TOKEN;
    let chatId = DEFAULT_CHAT_ID;

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: tokenSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_bot_token")
        .maybeSingle();

      const { data: chatSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_chat_id")
        .maybeSingle();

      if (tokenSetting?.value) botToken = tokenSetting.value;
      if (chatSetting?.value) chatId = chatSetting.value;
    } catch (dbErr) {
      console.warn("Could not load telegram settings from db, using defaults:", dbErr);
    }

    // 2. Format the message beautiful with markdown and emojis
    const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });
    
    let messageText = `🚨 *ERRO DETECTADO NO SISTEMA* 🚨\n\n`;
    messageText += `📱 *App:* ${app_name}\n`;
    messageText += `🕒 *Hora:* ${timestamp}\n`;
    messageText += `🔗 *URL:* \`${url}\`\n\n`;
    
    messageText += `👤 *Usuário:* ${user_email || "Anônimo"} \`(${user_id})\`\n\n`;
    
    messageText += `❌ *Mensagem:* \`${error_message}\`\n\n`;

    if (stack_trace) {
      // Truncate stack trace to not exceed Telegram message limits (4096 chars)
      const cleanStack = stack_trace.substring(0, 1000);
      messageText += `📝 *Stack Trace:*\n\`\`\`javascript\n${cleanStack}\n\`\`\`\n`;
    }

    if (Object.keys(additional_info).length > 0) {
      messageText += `⚙️ *Detalhes Extras:*\n\`\`\`json\n${JSON.stringify(additional_info, null, 2)}\n\`\`\`\n`;
    }

    // 3. Send message to Telegram Bot API
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown",
      }),
    });

    const resData = await response.json();

    return new Response(JSON.stringify({ success: true, telegram: resData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in telegram-logger:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
