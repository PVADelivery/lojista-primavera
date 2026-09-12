package com.mt24horasexpress.lojista;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class StoreBackgroundService extends Service {

    private static final String TAG = "StoreBackgroundService";
    public static final String PREFS_NAME = "mt24horas_lojista";
    private static final int FOREGROUND_NOTIFICATION_ID = 77777;
    private static final long POLL_INTERVAL_MS = 2500L;

    private static final String SUPABASE_URL = "https://owlbzwsdcognrgolvnzg.supabase.co";
    private static final String SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bGJ6d3NkY29nbnJnb2x2bnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTQ1NTMsImV4cCI6MjA5NTU3MDU1M30.R6-FUqubIr3uABzv1CS7jiS5cwygrNiIqk4oNbq7O44";

    public static volatile boolean isRunning = false;
    private ScheduledExecutorService executorService;
    private final Set<String> alertedOrders = Collections.synchronizedSet(new HashSet<>());
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void startService(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, StoreBackgroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao iniciar StoreBackgroundService: " + e.getMessage());
        }
    }

    public static void stopService(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, StoreBackgroundService.class);
            context.stopService(intent);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao parar StoreBackgroundService: " + e.getMessage());
        }
    }

    public static void dismissOrderAlert(Context context, String orderId) {
        if (context == null || orderId == null || orderId.isEmpty()) return;
        NativeSoundPlayer.stopSound();
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(hashId(orderId));
        }
    }

    private static int hashId(String str) {
        if (str == null) return 0;
        int hash = 0;
        for (int i = 0; i < str.length(); i++) {
            hash = ((hash << 5) - hash) + str.charAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        isRunning = true;
        Log.i(TAG, "StoreBackgroundService criado. Iniciando serviço em primeiro plano...");

        NotificationChannels.ensureChannels(this);
        startAsForeground();
        startPolling();
    }

    private void startAsForeground() {
        try {
            Intent appIntent = new Intent(this, MainActivity.class);
            appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getActivity(this, 0, appIntent, piFlags);

            Notification notification = new NotificationCompat.Builder(this, NotificationChannels.SERVICE_CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("MT 24 Horas Express - Lojista")
                    .setContentText("Loja Aberta • Monitorando novos pedidos na central")
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setCategory(NotificationCompat.CATEGORY_SERVICE)
                    .setOngoing(true)
                    .setContentIntent(pi)
                    .build();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(FOREGROUND_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(FOREGROUND_NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao configurar startForeground no lojista: " + e.getMessage());
        }
    }

    private void startPolling() {
        if (executorService != null && !executorService.isShutdown()) {
            return;
        }
        executorService = Executors.newSingleThreadScheduledExecutor();
        executorService.scheduleWithFixedDelay(this::pollOrders, 1000L, POLL_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    private void pollOrders() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean isStoreOpen = prefs.getBoolean("is_store_open", true);
            if (!isStoreOpen) {
                return;
            }

            String companyId = prefs.getString("company_id", "");
            String userToken = prefs.getString("user_token", "");

            String authHeader = (userToken != null && !userToken.isEmpty())
                    ? "Bearer " + userToken
                    : "Bearer " + SUPABASE_ANON_KEY;

            StringBuilder endpoint = new StringBuilder(SUPABASE_URL + "/rest/v1/orders?status=eq.pending");
            if (companyId != null && !companyId.isEmpty()) {
                endpoint.append("&company_id=eq.").append(companyId);
            }
            endpoint.append("&select=id,status,customer_name,total,total_amount,delivery_address,created_at&order=created_at.desc&limit=5");

            URL url = new URL(endpoint.toString());
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", authHeader);
            conn.setRequestProperty("Accept", "application/json");

            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                conn.disconnect();
                return;
            }

            InputStream is = conn.getInputStream();
            BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();
            conn.disconnect();

            JSONArray array = new JSONArray(sb.toString());
            Set<String> currentPendingIds = new HashSet<>();

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                String id = obj.optString("id");
                if (id == null || id.isEmpty()) continue;

                currentPendingIds.add(id);

                if (alertedOrders.contains(id)) {
                    continue;
                }

                alertedOrders.add(id);

                final String finalId = id;
                final String customerName = obj.optString("customer_name", "Cliente");
                double val = obj.optDouble("total", 0.0);
                if (val <= 0) val = obj.optDouble("total_amount", 0.0);
                final double finalTotal = val;
                final String address = obj.optString("delivery_address", "Retirada no local");

                final String shortId = finalId.length() >= 6 ? finalId.substring(0, 6).toUpperCase() : finalId;
                final String title = "🔔 NOVO PEDIDO RECEBIDO! #" + shortId;
                final String bodyText = "Cliente: " + customerName + " • Total: R$ " + String.format(Locale.US, "%.2f", finalTotal).replace(".", ",");
                final String bigText = "📦 Pedido #" + shortId + "\n👤 " + customerName + "\n📍 " + address + "\n💰 Total: R$ " + String.format(Locale.US, "%.2f", finalTotal).replace(".", ",");

                Log.i(TAG, "NOVO PEDIDO DO LOJISTA DETECTADO! ID: " + finalId + " - Disparando notificação na central...");

                mainHandler.post(() -> {
                    postOrderNotification(finalId, title, bodyText, bigText);
                });
            }

            // Remove alertas de pedidos que não estão mais pendentes (aceitos ou cancelados)
            Set<String> finished = new HashSet<>(alertedOrders);
            finished.removeAll(currentPendingIds);
            for (String finishedId : finished) {
                dismissOrderAlert(getApplicationContext(), finishedId);
            }
            alertedOrders.retainAll(currentPendingIds);

        } catch (Exception e) {
            // Falha silenciosa de rede momentânea
        }
    }

    private void postOrderNotification(String orderId, String title, String bodyText, String bigText) {
        try {
            NotificationChannels.ensureChannels(this);

            int notificationId = hashId(orderId);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.putExtra("orderId", orderId);
            mainIntent.putExtra("route", "/business/orders");
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent contentPI = PendingIntent.getActivity(this, notificationId, mainIntent, piFlags);

            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.ring);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationChannels.ORDER_CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(bodyText)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText))
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setOngoing(false)
                    .setSound(soundUri)
                    .setContentIntent(contentPI)
                    .addAction(R.mipmap.ic_launcher, "ABRIR PEDIDO", contentPI);

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(notificationId, builder.build());
            }

            // Acorda a tela
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    PowerManager.WakeLock wl = pm.newWakeLock(
                            PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                            "mt24:StoreOrderWakeLock"
                    );
                    wl.acquire(3000);
                }
            } catch (Exception ignored) {}

            // Toca o som oficial ring.mp3
            NativeSoundPlayer.playOrderAlert(this);

        } catch (Exception e) {
            Log.e(TAG, "Erro ao postar notificação de pedido: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startAsForeground();
        startPolling();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        Log.i(TAG, "StoreBackgroundService destruído.");
        if (executorService != null) {
            executorService.shutdownNow();
            executorService = null;
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
