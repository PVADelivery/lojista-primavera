import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ErrorPayload {
  error_message: string;
  stack_trace?: string;
  url?: string;
  additional_info?: Record<string, any>;
}

const TELEGRAM_BOT_TOKEN = "8408781765:AAEoxY7J9VrNeagGNFu1yHpW3HQlq103gmM";
const TELEGRAM_CHAT_ID = "-5333281601";

// In-memory deduplication cache: messageHash -> timestamp
const recentErrors = new Map<string, number>();
const DEDUPE_WINDOW_MS = 15000; // 15 seconds

let isReporting = false;

function escapeHtml(input: unknown, max = 1500): string {
  const s = String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export async function reportErrorToTelegram(payload: ErrorPayload, appName = "MT 24 Horas Express") {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const errorKey = `${appName}:${payload.error_message}:${payload.url || ""}`;
  const lastSent = recentErrors.get(errorKey);
  if (lastSent && now - lastSent < DEDUPE_WINDOW_MS) {
    return; // Ignore duplicate within cooldown
  }
  recentErrors.set(errorKey, now);

  // Clean old deduplication entries
  if (recentErrors.size > 100) {
    for (const [k, v] of recentErrors.entries()) {
      if (now - v > DEDUPE_WINDOW_MS) recentErrors.delete(k);
    }
  }

  if (isReporting) return;
  isReporting = true;

  try {
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    
    const requestBody = {
      app_name: appName,
      error_message: payload.error_message,
      stack_trace: payload.stack_trace || new Error().stack || "",
      user_id: user?.id || "Não autenticado",
      user_email: user?.email || "Anônimo",
      url: payload.url || window.location.href,
      additional_info: {
        userAgent: navigator.userAgent,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`,
        time: new Date().toISOString(),
        ...payload.additional_info
      }
    };

    // 1. Try Supabase Edge Function
    let edgeSuccess = false;
    try {
      const { data, error } = await supabase.functions.invoke("telegram-logger", {
        body: requestBody
      });
      if (!error && (data as any)?.success) {
        edgeSuccess = true;
      }
    } catch {
      edgeSuccess = false;
    }

    // 2. Direct Fallback if Edge function failed or is unconfigured
    if (!edgeSuccess) {
      const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });
      let messageText = `🚨 <b>ERRO NO SISTEMA / TELA (Direct)</b> 🚨\n\n`;
      messageText += `📱 <b>App:</b> ${escapeHtml(appName, 80)}\n`;
      messageText += `🕒 <b>Hora:</b> ${escapeHtml(timestamp, 50)}\n`;
      messageText += `🔗 <b>URL:</b> <code>${escapeHtml(requestBody.url, 250)}</code>\n`;
      messageText += `👤 <b>Usuário:</b> ${escapeHtml(requestBody.user_email, 100)} (<code>${escapeHtml(requestBody.user_id, 60)}</code>)\n\n`;
      messageText += `⚠️ <b>Mensagem:</b>\n<b>${escapeHtml(requestBody.error_message, 800)}</b>\n\n`;

      if (requestBody.stack_trace) {
        messageText += `📜 <b>Stack Trace:</b>\n<pre>${escapeHtml(requestBody.stack_trace, 1200)}</pre>\n\n`;
      }

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: messageText,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Failed to report error to Telegram:", err);
  } finally {
    isReporting = false;
  }
}

export function translateErrorMessage(rawMsg: string): string {
  if (!rawMsg || typeof rawMsg !== "string") return "Ocorreu um erro. Tente novamente.";

  const lower = rawMsg.toLowerCase();

  if (lower.includes("user already registered") || lower.includes("already been registered") || lower.includes("email address has already been registered")) {
    return "Este endereço de e-mail já está cadastrado no sistema. Por favor, faça login com sua senha.";
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "E-mail ou senha incorretos. Verifique os dados digitados.";
  }
  if (lower.includes("email not confirmed")) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  }
  if (lower.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (lower.includes("signup disabled")) {
    return "Novos cadastros estão temporariamente suspensos.";
  }
  if (lower.includes("network error") || lower.includes("failed to fetch")) {
    return "Falha de conexão com a internet. Verifique sua rede e tente novamente.";
  }
  if (lower.includes("jwt expired") || lower.includes("token expired") || lower.includes("session expired")) {
    return "Sua sessão expirou. Por favor, faça login novamente.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.";
  }
  if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("unauthorized")) {
    return "Você não tem permissão para realizar esta operação.";
  }

  return rawMsg;
}

// Global error handlers + Toast error interceptor
export function initializeGlobalErrorHandlers(appName: string) {
  if (typeof window === "undefined") return;

  // Intercept Sonner toast.error calls to immediately log on-screen errors & translate english messages
  try {
    const rawToast = toast as any;
    if (rawToast && typeof rawToast.error === "function" && !rawToast.__telegram_patched) {
      const originalToastError = rawToast.error;
      rawToast.error = function (message: any, options?: any) {
        let translatedMessage = message;
        try {
          const msgStr = typeof message === "string" ? message : (message?.message || message?.toString?.() || JSON.stringify(message));
          const ptMsg = translateErrorMessage(msgStr);
          if (typeof message === "string") {
            translatedMessage = ptMsg;
          } else if (message && typeof message === "object" && message.message) {
            message.message = ptMsg;
            translatedMessage = message;
          } else {
            translatedMessage = ptMsg;
          }

          if (msgStr && typeof msgStr === "string" && !msgStr.includes("cancelada pelo usuário")) {
            reportErrorToTelegram({
              error_message: `[Erro na Tela] ${ptMsg}`,
              url: window.location.href,
              additional_info: { type: "toast_error", rawMessage: msgStr, options }
            }, appName);
          }
        } catch {}
        return originalToastError.apply(rawToast, [translatedMessage, options]);
      };
      rawToast.__telegram_patched = true;
    }
  } catch {}

  // 1. Unhandled exceptions
  window.onerror = (message, source, lineno, colno, error) => {
    reportErrorToTelegram({
      error_message: String(message),
      stack_trace: error?.stack || `At ${source}:${lineno}:${colno}`,
      url: window.location.href,
      additional_info: {
        source,
        lineno,
        colno
      }
    }, appName);
    return false;
  };

  // 2. Unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    const msg = reason?.message || (typeof reason === "object" ? JSON.stringify(reason) : String(reason));
    reportErrorToTelegram({
      error_message: `Unhandled Rejection: ${msg}`,
      stack_trace: reason?.stack || "No stack trace available",
      url: window.location.href,
      additional_info: {
        reason: typeof reason === "object" ? JSON.stringify(reason) : String(reason)
      }
    }, appName);
  };
}
