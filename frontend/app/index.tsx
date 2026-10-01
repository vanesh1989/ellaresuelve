import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { api } from "@/src/api";
import { clearSession, loadUser, saveSession } from "@/src/session";
import { useTheme } from "@/src/theme";

const processedSessionIds = new Set<string>();

export default function Index() {
  const { colors } = useTheme();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      // Web: Google OAuth redirects back to "/" carrying the session_id in the URL.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const match = `${window.location.search}${window.location.hash}`.match(/[?#&]session_id=([^&#]+)/);
        const sessionId = match?.[1];
        if (sessionId && !processedSessionIds.has(sessionId)) {
          processedSessionIds.add(sessionId);
          try {
            const result = await api.googleSession(sessionId);
            await saveSession(result.token, result.user);
            window.history.replaceState(window.history.state, "", window.location.pathname);
            setHasSession(true);
            return;
          } catch {
            window.history.replaceState(window.history.state, "", window.location.pathname);
          }
        }
      }
      const user = await loadUser();
      if (!user) {
        setHasSession(false);
        return;
      }
      try {
        await api.me();
        setHasSession(true);
      } catch (error) {
        if ((error as { status?: number })?.status === 401) {
          await clearSession();
          setHasSession(false);
        } else {
          setHasSession(true); // sin conexión: seguimos con la sesión local
        }
      }
    })();
  }, []);

  if (hasSession === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  return <Redirect href={hasSession ? "/(tabs)" : "/login"} />;
}
