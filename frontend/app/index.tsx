import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { loadUser } from "@/src/session";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { colors } = useTheme();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    loadUser().then((user) => setHasSession(!!user));
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
