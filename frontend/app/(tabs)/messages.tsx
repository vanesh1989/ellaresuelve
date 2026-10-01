import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Conversation } from "@/src/api";
import { Avatar, EmptyState, Loader, Notice } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function MessagesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setConversations(await api.conversations());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Revisa tu conexión e inténtalo nuevamente");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MENSAJES</Text>
        <Text style={styles.title}>Tus conversaciones</Text>
      </View>
      {notice ? <Notice text={notice} onClose={() => setNotice("")} /> : null}
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          testID="conversations-list"
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`conversation-${item.id}`}
              style={styles.row}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: item.display_name, initials: item.display_initials, photo: item.role === "client" ? item.provider_photo ?? "" : "" } })}
            >
              <Avatar initials={item.display_initials} size={50} photoPath={item.role === "client" ? item.provider_photo : null} />
              <View style={styles.copy}>
                <View style={styles.topLine}>
                  <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
                  {item.role === "professional" ? (
                    <View style={{ backgroundColor: colors.brandTertiary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "800" }}>CLIENTA</Text>
                    </View>
                  ) : null}
                  <Text style={styles.time}>{formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: es })}</Text>
                </View>
                <Text style={styles.last} numberOfLines={1}>{item.last_message}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              testID="messages-empty-state"
              icon="chatbubbles-outline"
              title="Aún no tienes conversaciones. Contacta a una profesional desde su perfil."
              actionLabel="Explorar profesionales"
              onAction={() => router.push("/(tabs)/search")}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, gap: 2 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  list: { paddingHorizontal: 20, paddingTop: 4, gap: 10, flexGrow: 1 },
  row: { padding: 14, borderRadius: 16, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 3 },
  topLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  time: { color: colors.muted, fontSize: 11 },
  last: { color: colors.muted, fontSize: 13 },
}));
