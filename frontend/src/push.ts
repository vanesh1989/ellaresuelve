import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/src/api";

// Registra el token nativo de push (FCM/APNs) en el backend.
// Se llama tras el login y en cada apertura de la app (los tokens rotan).
// En web y Expo Go falla en silencio: el push solo vive en builds reales.
export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const token = await Notifications.getDevicePushTokenAsync();
    await api.registerPush({ user_id: userId, platform: Platform.OS, device_token: token.data });
  } catch {
    // push no disponible en este entorno (Expo Go / sin google-services.json)
  }
}
