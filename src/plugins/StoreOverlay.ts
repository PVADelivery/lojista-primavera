import { registerPlugin } from "@capacitor/core";

export interface StoreOverlayPlugin {
  saveStoreContext(options: { companyId: string; userId?: string; userToken?: string }): Promise<void>;
  setStoreOpenStatus(options: { isOpen: boolean }): Promise<void>;
  stopNativeAudio(): Promise<void>;
  playNativeAudio(): Promise<void>;
  dismissOrderAlert(options: { orderId: string }): Promise<void>;
}

export const StoreOverlay = registerPlugin<StoreOverlayPlugin>("StoreOverlay", {
  web: () => ({
    saveStoreContext: async () => {},
    setStoreOpenStatus: async () => {},
    stopNativeAudio: async () => {},
    playNativeAudio: async () => {},
    dismissOrderAlert: async () => {},
  }),
});
