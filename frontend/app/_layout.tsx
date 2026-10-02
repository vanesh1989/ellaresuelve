import { QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { LogBox, Modal, Platform, Pressable, Text, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { initializeRevenueCat, SubscriptionProvider } from "@/src/revenuecat";
import { useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

// RevenueCat: init UNA vez a nivel de módulo, antes de montar componentes.
try {
  initializeRevenueCat();
} catch (err) {
  console.warn("RevenueCat unavailable:", err);
}

// Push: handler en foreground + canal Android, ambos a nivel de módulo.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

function openNotificationUrl(url: unknown, router: ReturnType<typeof useRouter>) {
  if (typeof url !== "string" || !url) return;
  if (url.startsWith("http")) {
    Linking.openURL(url);
  } else {
    router.push(url as never);
  }
}

export default function RootLayout() {
  const router = useRouter();
  const { colors } = useTheme();
  const [pushNudge, setPushNudge] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    // Tap con app abierta
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      openNotificationUrl(data.deeplink ?? data.action_url, router);
    });

    // Tap con app cerrada (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      openNotificationUrl(data.deeplink ?? data.action_url, router);
    });

    // Recordatorio semanal si el permiso quedó denegado permanentemente
    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const last = await storage.getItem<number | null>("pushNudgeAt", null);
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (last && Date.now() - last <= oneWeek) return;
      setPushNudge(true);
    })();

    return () => {
      tapSub.remove();
    };
  }, [router]);

  async function dismissNudge(openSettings: boolean) {
    await storage.setItem("pushNudgeAt", Date.now());
    setPushNudge(false);
    if (openSettings) Linking.openSettings();
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>
          <KeyboardProvider>
            <Stack screenOptions={{ headerShown: false }} />
            <Modal visible={pushNudge} transparent animationType="fade" onRequestClose={() => dismissNudge(false)}>
              <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 28 }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 22, gap: 12 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>Activa las notificaciones</Text>
                  <Text style={{ color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21 }}>
                    Entérate al instante cuando una profesional responda tus mensajes.
                  </Text>
                  <Pressable testID="push-nudge-settings" onPress={() => dismissNudge(true)} style={{ minHeight: 48, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.onBrandPrimary, fontSize: 14, fontWeight: "700" }}>Abrir configuración</Text>
                  </Pressable>
                  <Pressable testID="push-nudge-later" onPress={() => dismissNudge(false)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Ahora no</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </KeyboardProvider>
        </SubscriptionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

