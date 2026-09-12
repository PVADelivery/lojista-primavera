package com.mt24horasexpress.lojista;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

public final class NotificationChannels {

    public static final String ORDER_CHANNEL_ID = "mt24_store_orders_v35";
    public static final String SERVICE_CHANNEL_ID = "mt24_store_service_channel";

    private NotificationChannels() {}

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;

        Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.ring);
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();

        // 1) Canal de Alertas de Pedidos na Central
        if (nm.getNotificationChannel(ORDER_CHANNEL_ID) == null) {
            NotificationChannel ch = new NotificationChannel(
                    ORDER_CHANNEL_ID, "Novos Pedidos MT 24 Horas", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Alerta sonoro com som oficial para novos pedidos do estabelecimento");
            ch.setSound(soundUri, audioAttributes);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 800, 250, 800, 250, 800});
            ch.enableLights(true);
            ch.setShowBadge(true);
            ch.setBypassDnd(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }

        // 2) Canal de Serviço Contínuo em Segundo Plano
        if (nm.getNotificationChannel(SERVICE_CHANNEL_ID) == null) {
            NotificationChannel sCh = new NotificationChannel(
                    SERVICE_CHANNEL_ID, "Monitoramento de Pedidos (Segundo Plano)", NotificationManager.IMPORTANCE_LOW);
            sCh.setDescription("Mantém a loja ativa e conectada para receber novos pedidos na central");
            sCh.setShowBadge(false);
            nm.createNotificationChannel(sCh);
        }
    }
}
