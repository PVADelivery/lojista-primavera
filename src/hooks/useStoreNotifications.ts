import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useAudioAlert,
  requestNotificationPermission,
  sendNativeDeviceNotification,
  triggerDeviceVibration
} from "@/hooks/useAudioAlert";
import { useMyCompany } from "@/services/companies";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

// Set global de IDs de pedidos já notificados para prevenir qualquer duplicata no dispositivo
const processedOrders = new Set<string>();

export function useStoreNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { playAlert, startLoop, stopLoop } = useAudioAlert();
  const { data: company } = useMyCompany();
  const companyId = company?.id;

  // Solicita a permissão de notificações do celular/browser ao iniciar
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Configurar registro de Push Notifications se estiver em plataforma nativa (Android/iOS)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !companyId) return;

    let regListener: any = null;
    let errListener: any = null;
    let pushListener: any = null;
    let actionListener: any = null;

    const initPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== "granted" && (permStatus as any).display !== "granted") {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === "granted" || (permStatus as any).display === "granted") {
          await PushNotifications.register();
          console.log("[Push MT24 Lojista] Registrado no serviço de notificações nativas");
        }
      } catch (e) {
        console.warn("[Push MT24 Lojista] Erro ao inicializar push nativo:", e);
      }
    };

    initPush();

    PushNotifications.addListener("registration", async (token) => {
      console.log("[Push MT24 Lojista] Token registrado:", token.value);
      localStorage.setItem("@mt24_lojista_push_token", token.value);
      localStorage.setItem("fcm_token", token.value);

      // 1. Salva na empresa (companies.fcm_token)
      try {
        await supabase
          .from("companies")
          .update({ fcm_token: token.value } as any)
          .eq("id", companyId);
      } catch (e) {
        console.warn("[Push] Falha ao persistir em companies:", e);
      }

      // 2. Salva no perfil do usuário logado (profiles.fcm_token)
      if (user?.id) {
        try {
          await supabase
            .from("profiles")
            .update({ fcm_token: token.value, updated_at: new Date().toISOString() } as any)
            .eq("user_id", user.id);
        } catch (e) {
          console.warn("[Push] Falha ao persistir em profiles:", e);
        }
      }

      // 3. Registra na tabela device_tokens
      try {
        await supabase
          .from("device_tokens")
          .upsert(
            {
              token: token.value,
              user_id: user?.id || null,
              platform: Capacitor.getPlatform(),
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "token" }
          );
      } catch (e) {
        console.warn("[Push] Falha ao persistir em device_tokens:", e);
      }

      // 4. Registra via Edge Function send-push se existir
      try {
        await supabase.functions.invoke("send-push", {
          body: {
            action: "register_token",
            token: token.value,
            userId: user?.id,
            companyId: companyId,
            platform: Capacitor.getPlatform(),
          },
        });
      } catch {}
    }).then((listener) => { regListener = listener; });

    PushNotifications.addListener("registrationError", (error: any) => {
      console.error("[Push MT24 Lojista] Erro no registro de Push:", error);
    }).then((listener) => { errListener = listener; });

    // Ouvinte do Push quando o app está aberto/foreground
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const orderId = notification.data?.order_id || notification.data?.orderId || notification.id;
      console.log("[Push Recebido em Foreground]", orderId, notification);

      if (orderId && processedOrders.has(orderId)) {
        return;
      }

      if (orderId) {
        processedOrders.add(orderId);
      }

      playAlert();
      startLoop();

      toast.success(notification.title || "📦 Novo pedido recebido!", {
        description: notification.body || "Acesse o app para aceitar e começar a preparar.",
        duration: 10000
      });
    }).then((listener) => { pushListener = listener; });

    // Ouvinte de clique na notificação nativa
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[Push Ação/Clique]", action);
      stopLoop();
      const targetRoute = "/business/orders";
      if (typeof window !== "undefined" && window.location.pathname !== targetRoute) {
        window.location.href = targetRoute;
      }
    }).then((listener) => { actionListener = listener; });

    return () => {
      if (regListener) regListener.remove?.();
      if (errListener) errListener.remove?.();
      if (pushListener) pushListener.remove?.();
      if (actionListener) actionListener.remove?.();
    };
  }, [companyId, user?.id, playAlert, startLoop, stopLoop]);

  // Lojista Alerts - POLLING (15s): Garante que o som continue tocando até que a loja aceite o pedido
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ["orders-alert-check", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("orders")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!companyId,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const hasPending = pendingOrders.length > 0;

  useEffect(() => {
    if (!companyId) return;

    if (hasPending) {
      pendingOrders.forEach((ord: any) => {
        processedOrders.add(ord.id);
      });
      startLoop();
    } else {
      stopLoop();
    }
  }, [hasPending, pendingOrders, startLoop, stopLoop, companyId]);

  // Ouve inserções e atualizações via Supabase Realtime para tocar som e atualizar a tela instantaneamente
  useEffect(() => {
    if (!companyId) return;

    const channelName = `company-order-alerts-${companyId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        (payload) => {
          const order = payload.new as any;
          console.log("[REALTIME LOJISTA]", order?.id);

          if (order && order.status === "pending") {
            const alreadyNotified = processedOrders.has(order.id);
            processedOrders.add(order.id);

            if (!alreadyNotified) {
              if (!Capacitor.isNativePlatform()) {
                sendNativeDeviceNotification("📦 Novo pedido recebido!", {
                  body: "Acesse o app para aceitar e começar a preparar",
                  tag: `order-${order.id}`,
                });
              }

              toast.success("📦 Novo pedido recebido!", {
                description: "Acesse o app para aceitar e começar a preparar.",
                duration: 10000,
              });
            }
            startLoop();
          }
          qc.invalidateQueries({ queryKey: ["orders-alert-check", companyId] });
          qc.invalidateQueries({ queryKey: ["orders"] });
          window.dispatchEvent(new CustomEvent("mt24-order-alert-triggered"));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        async (payload) => {
          qc.invalidateQueries({ queryKey: ["orders-alert-check", companyId] });
          qc.invalidateQueries({ queryKey: ["orders"] });
          window.dispatchEvent(new CustomEvent("mt24-order-alert-triggered"));

          const updated = payload.new as any;
          if (updated && updated.status !== "pending") {
            const { count } = await supabase
              .from("orders")
              .select("*", { count: "exact", head: true })
              .eq("company_id", companyId)
              .eq("status", "pending");
            if ((count || 0) === 0) {
              stopLoop();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc, startLoop, stopLoop]);
}
