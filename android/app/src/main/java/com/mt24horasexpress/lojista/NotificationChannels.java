package com.mt24horasexpress.lojista;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/**
 * Registra os canais oficiais de notificação com som personalizado (notification_sound.mp3)
 * para a Central de Notificações do Android.
 */
public final class NotificationChannels {

    public static final String LOJISTA_CHANNEL_ID = "lojista_orders_v2";

    private NotificationChannels() {}

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;

        try {
            // Remove o canal padrão antigo sem som se existir
            nm.deleteNotificationChannel("default");
        } catch (Exception ignored) {}

        Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.notification_sound);
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();

        if (nm.getNotificationChannel(LOJISTA_CHANNEL_ID) == null) {
            NotificationChannel ch = new NotificationChannel(
                    LOJISTA_CHANNEL_ID,
                    "Notificações do Lojista",
                    NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("Avisos sonoros de novos pedidos na central de notificações");
            ch.setSound(soundUri, audioAttributes);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 800, 250, 800, 250, 800});
            ch.enableLights(true);
            ch.setShowBadge(true);
            ch.setBypassDnd(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
    }
}
