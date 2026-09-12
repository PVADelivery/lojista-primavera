package com.mt24horasexpress.lojista;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : "null";
        Log.d(TAG, "BootReceiver recebido no Lojista: " + action);
        if (context != null) {
            boolean isStoreOpen = context.getSharedPreferences(StoreBackgroundService.PREFS_NAME, Context.MODE_PRIVATE)
                    .getBoolean("is_store_open", true);
            if (isStoreOpen) {
                Log.d(TAG, "Reiniciando StoreBackgroundService após boot do aparelho...");
                StoreBackgroundService.startService(context);
            }
        }
    }
}
