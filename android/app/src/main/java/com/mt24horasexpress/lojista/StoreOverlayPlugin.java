package com.mt24horasexpress.lojista;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StoreOverlay")
public class StoreOverlayPlugin extends Plugin {

    public static StoreOverlayPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @PluginMethod
    public void saveStoreContext(PluginCall call) {
        String companyId = call.getString("companyId", "");
        String userId = call.getString("userId", "");
        String userToken = call.getString("userToken", "");

        SharedPreferences prefs = getContext().getSharedPreferences(StoreBackgroundService.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString("company_id", companyId)
                .putString("user_id", userId)
                .putString("user_token", userToken)
                .apply();

        StoreBackgroundService.startService(getContext());
        call.resolve();
    }

    @PluginMethod
    public void setStoreOpenStatus(PluginCall call) {
        Boolean isOpen = call.getBoolean("isOpen", true);
        boolean open = Boolean.TRUE.equals(isOpen);

        getContext().getSharedPreferences(StoreBackgroundService.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean("is_store_open", open)
                .apply();

        if (open) {
            StoreBackgroundService.startService(getContext());
        } else {
            StoreBackgroundService.stopService(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void stopNativeAudio(PluginCall call) {
        NativeSoundPlayer.stopSound();
        call.resolve();
    }

    @PluginMethod
    public void playNativeAudio(PluginCall call) {
        NativeSoundPlayer.playOrderAlert(getContext());
        call.resolve();
    }

    @PluginMethod
    public void dismissOrderAlert(PluginCall call) {
        String orderId = call.getString("orderId", "");
        if (orderId != null && !orderId.isEmpty()) {
            StoreBackgroundService.dismissOrderAlert(getContext(), orderId);
        }
        call.resolve();
    }
}
