import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mt24horasexpress.lojista',
  appName: 'MT 24 Horas Express - Lojista',
  webDir: 'dist/client',
  server: {
    url: 'https://lojista.mt24horasexpress.com/business',
    allowNavigation: [
      'mt24horasexpress.com',
      '*.mt24horasexpress.com',
      'owlbzwsdcognrgolvnzg.supabase.co'
    ],
    errorPath: 'error.html',
    cleartext: false,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      sound: "ring.wav"
    }
  }
};

export default config;
