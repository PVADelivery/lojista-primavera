// @ts-nocheck
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { toast } from "sonner";

import { useAudioAlert } from "./useAudioAlert";

export function useStoreNotifications() {
  const { user } = useAuth();
  const { playAlert } = useAudioAlert();
  const channelsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    // Configuração Nativa Capacitor (FCM)
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.isPluginAvailable("LocalNotifications")) {
        LocalNotifications.requestPermissions().then((res) => {
          if (res.display === "granted" && Capacitor.getPlatform() === "android") {
            LocalNotifications.createChannel({
              id: "store-order-incoming-v1",
              name: "Novos Pedidos do Estabelecimento",
              description: "Alerta sonoro e visual para novos pedidos",
              importance: 5,
              visibility: 1,
              sound: "ring.mp3",
              vibration: true,
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      if (Capacitor.isPluginAvailable("PushNotifications")) {
        const syncFcmToken = async (tokenVal: string) => {
          if (!tokenVal) return;
          localStorage.setItem("store_fcm_token", tokenVal);
          try {
            await supabase
              .from("companies")
              .update({ fcm_token: tokenVal } as any)
              .eq("user_id", user.id);
          } catch (e) {
            console.warn("[FCM Lojista] Erro ao salvar token:", e);
          }
        };

        PushNotifications.addListener("registration", (token) => {
          syncFcmToken(token.value);
        }).catch(() => {});

        const cachedToken = localStorage.getItem("store_fcm_token");
        if (cachedToken) {
          syncFcmToken(cachedToken);
        }

        PushNotifications.requestPermissions().then((res) => {
          if (res.receive === "granted") {
            PushNotifications.register().catch(() => {});
          }
        }).catch(() => {});

        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          const title = notification.title || "🔔 Novo Pedido Recebido!";
          const body = notification.body || notification.data?.message || "Novo pedido chegou para preparo!";
          toast.success(title, { description: body });
          playAlert(true);
        }).catch(() => {});

        PushNotifications.addListener("pushNotificationActionPerformed", () => {
          if (typeof window !== "undefined") {
            window.location.href = "/business/orders";
          }
        }).catch(() => {});
      }
    }


    // Escuta em tempo real novos pedidos da loja
    const setupRealtime = async () => {
      let companyId: string | null = null;
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company?.id) {
        companyId = company.id;
      } else {
        // Fallback de administrador ou proprietário
        const { data: firstComp } = await supabase
          .from("companies")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstComp?.id) companyId = firstComp.id;
      }

      if (!companyId) return;

      // Confere se já há pedidos pendentes aguardando aceite ao abrir a tela
      try {
        const { data: pendings } = await supabase
          .from("orders")
          .select("id")
          .eq("company_id", companyId)
          .eq("status", "pending")
          .limit(1);

        if (pendings && pendings.length > 0) {
          playAlert(true);
        }
      } catch {}

      const storeChannel = supabase
        .channel(`store-orders-${companyId}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `company_id=eq.${companyId}`,
          },
          (payload) => {
            const ord = payload.new as any;
            if (ord && ord.status === "pending") {
              const title = "🔔 NOVO PEDIDO RECEBIDO!";
              const totalVal = Number(ord.total ?? ord.total_amount ?? 0);
              const desc = `Pedido #${ord.id?.slice(0, 6)?.toUpperCase() || ""} recebido! Total: R$ ${totalVal.toFixed(2)}`;

              toast.success(title, { description: desc });
              playAlert(true);

              if (Capacitor.isNativePlatform()) {
                LocalNotifications.schedule({
                  notifications: [
                    {
                      title,
                      body: desc,
                      id: Math.floor(Math.random() * 100000),
                      channelId: "store-order-incoming-v1",
                      sound: "ring.mp3",
                      extra: { orderId: ord.id },
                    },
                  ],
                }).catch(() => {});
              }
            }
          }
        )
        .subscribe();

      channelsRef.current.push(storeChannel);
    };

    setupRealtime();

    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [user?.id]);
}
