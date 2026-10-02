import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminVerification, api, User } from "@/src/api";
import { GalleryTile } from "@/src/components/provider-extras";
import { EmptyState, Loader } from "@/src/components/ui";
import { loadUser } from "@/src/session";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<AdminVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setItems(await api.adminVerifications("pending"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos cargar las verificaciones");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUser().then((stored) => {
      setUser(stored);
      if (stored?.is_admin) load();
      else setLoading(false);
    });
  }, [load]);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setNotice("");
    try {
      await api.decideVerification(id, approve);
      await load(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos guardar la decisión");
    } finally {
      setBusyId("");
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="admin-back-button" onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Verificaciones pendientes</Text>
        <View style={styles.headerSpacer} />
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {loading ? (
        <Loader />
      ) : !user?.is_admin ? (
        <EmptyState testID="admin-denied" icon="lock-closed-outline" title="Esta sección es solo para la administración." />
      ) : (
        <FlatList
          testID="admin-verifications-list"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="admin-empty" icon="shield-checkmark-outline" title="No hay verificaciones pendientes. Buen trabajo." />}
          renderItem={({ item }) => (
            <View testID={`verification-${item.id}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.providerName}>{item.provider_name}</Text>
                  <Text style={styles.meta}>{item.category} · {item.commune}</Text>
                  <Text style={styles.meta}>Enviada por {item.user_name} · {new Date(item.created_at).toLocaleDateString("es-CL")}</Text>
                </View>
              </View>
              <View style={styles.docsRow}>
                <View style={styles.docBox}>
                  <GalleryTile item={{ path: item.id_path }} size={120} testID={`doc-id-${item.id}`} />
                  <Text style={styles.docLabel}>Cédula</Text>
                </View>
                <View style={styles.docBox}>
                  <GalleryTile item={{ path: item.selfie_path }} size={120} testID={`doc-selfie-${item.id}`} />
                  <Text style={styles.docLabel}>Selfie</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable testID={`reject-${item.id}`} onPress={() => decide(item.id, false)} disabled={!!busyId} style={[styles.actionButton, styles.rejectButton]}>
                  {busyId === item.id ? <ActivityIndicator size="small" color={colors.error} /> : <Text style={styles.rejectText}>Rechazar</Text>}
                </Pressable>
                <Pressable testID={`approve-${item.id}`} onPress={() => decide(item.id, true)} disabled={!!busyId} style={[styles.actionButton, styles.approveButton]}>
                  {busyId === item.id ? <ActivityIndicator size="small" color={colors.onSuccess} /> : <Text style={styles.approveText}>Aprobar</Text>}
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  headerSpacer: { width: 44 },
  notice: { color: colors.error, fontSize: 13, textAlign: "center", paddingHorizontal: 20, paddingBottom: 6 },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 14, flexGrow: 1 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardHeaderText: { flex: 1, gap: 2 },
  providerName: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12 },
  docsRow: { flexDirection: "row", gap: 14 },
  docBox: { gap: 6 },
  docLabel: { color: colors.muted, fontSize: 11, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rejectButton: { borderWidth: 1, borderColor: colors.error },
  rejectText: { color: colors.error, fontSize: 14, fontWeight: "700" },
  approveButton: { backgroundColor: colors.success },
  approveText: { color: colors.onSuccess, fontSize: 14, fontWeight: "800" },
}));
