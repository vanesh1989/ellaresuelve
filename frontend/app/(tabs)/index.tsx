import Ionicons from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ProvidersResult, User } from "@/src/api";
import { PhotoPicker } from "@/src/components/photo-picker";
import { CATEGORIES, CategoryCard, Chip, ChipRow, EmptyState, FreeBanner, Loader, Notice, ProviderCard, SectionHeader } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { clearSession, loadUser, saveUser } from "@/src/session";
import { makeStyles, useTheme } from "@/src/theme";

const COMMUNES = ["Providencia", "Ñuñoa", "La Reina", "Las Condes", "Santiago Centro", "Macul", "Vitacura", "Peñalolén"];

export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [user, setUser] = useState<User | null>(null);
  const [result, setResult] = useState<ProvidersResult>({ providers: [], limited: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState("Providencia, Santiago");
  const [locationModal, setLocationModal] = useState(false);
  const [notice, setNotice] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function onUserPhoto(asset: ImagePicker.ImagePickerAsset) {
    setPhotoBusy(true);
    try {
      const uploaded = await api.uploadPhoto(asset);
      const updated = await api.setMyPhoto(uploaded.path);
      await saveUser(updated);
      setUser(updated);
      setNotice("Tu foto de perfil fue actualizada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos actualizar tu foto");
    } finally {
      setPhotoBusy(false);
    }
  }

  const commune = location.split(",")[0].trim();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setResult(await api.providers(`?commune=${encodeURIComponent(commune)}`));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Revisa tu conexión e inténtalo nuevamente");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [commune]);

  useFocusEffect(useCallback(() => {
    loadUser().then(setUser);
    load();
  }, [load]));

  async function upgrade() {
    setUpgrading(true);
    try {
      const updated = await api.upgrade();
      await saveUser(updated);
      setUser(updated);
      await load(true);
      setNotice("¡Ahora eres Premium! Ves a todas las profesionales.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos actualizar tu plan");
    } finally {
      setUpgrading(false);
    }
  }

  async function logout() {
    await clearSession();
    router.replace("/login");
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PhotoPicker testID="user-photo-picker" size={46} uploading={photoBusy} onPick={onUserPhoto} photoPath={user?.photo_path} photoUrl={user?.photo_url} />
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>MAESTRAS RED</Text>
          <Text style={styles.greeting}>Hola{user ? `, ${user.name.split(" ")[0]}` : ""}</Text>
        </View>
        <Pressable testID="logout-button" onPress={logout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>
      {notice ? <Notice text={notice} onClose={() => setNotice("")} /> : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.brandPrimary} />}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomChrome + 24 }]}
      >
        <Pressable testID="location-pill" onPress={() => setLocationModal(true)} style={styles.locationPill}>
          <Ionicons name="location-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.muted} />
        </Pressable>

        {user?.plan === "free" ? <FreeBanner onUpgrade={upgrade} busy={upgrading} /> : null}

        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="sparkles-outline" size={24} color={colors.onBrandPrimary} /></View>
          <Text style={styles.heroTitle}>Expertas de confianza, cerca de ti</Text>
          <Text style={styles.heroBody}>Niñeras, gasfiteras, jardineras y profesoras evaluadas por la comunidad.</Text>
          <Pressable testID="hero-explore-button" onPress={() => router.push("/(tabs)/search")} style={styles.heroButton}>
            <Text style={styles.heroButtonText}>Explorar profesionales</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.onBrandSecondary} />
          </Pressable>
        </View>

        <SectionHeader title="Especialidades" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
          {CATEGORIES.map((category) => (
            <CategoryCard key={category.key} category={category.key} onPress={() => router.push({ pathname: "/(tabs)/search", params: { category: category.key } })} />
          ))}
          <Pressable testID="offer-services-card" onPress={() => router.push("/(tabs)/register")} style={styles.offerCard}>
            <Ionicons name="add-circle-outline" size={24} color={colors.brandSecondary} />
            <Text style={styles.offerText}>Ofrece tus servicios</Text>
          </Pressable>
        </ScrollView>

        <SectionHeader title="Mejor evaluadas" action="Ver todas" onPress={() => router.push("/(tabs)/search")} />
        {loading ? (
          <Loader />
        ) : result.providers.length ? (
          <View style={styles.list}>
            {result.providers.slice(0, 5).map((provider) => (
              <ProviderCard key={provider.id} provider={provider} onPress={() => router.push({ pathname: "/provider/[id]", params: { id: provider.id } })} />
            ))}
          </View>
        ) : (
          <EmptyState
            testID="home-empty-state"
            icon="search-outline"
            title={`No hay profesionales disponibles en ${commune} todavía.`}
            actionLabel="Ampliar búsqueda"
            onAction={() => router.push("/(tabs)/search")}
          />
        )}
      </ScrollView>
      <LocationModal visible={locationModal} current={commune} onClose={() => setLocationModal(false)} onSave={(value) => { setLocation(`${value}, Santiago`); setLocationModal(false); }} />
    </View>
  );
}

function LocationModal({ visible, current, onClose, onSave }: { visible: boolean; current: string; onClose: () => void; onSave: (commune: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [manual, setManual] = useState(current);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setManual(current);
      setDenied(false);
      setError("");
    }
  }, [visible, current]);

  async function locateMe() {
    setLocating(true);
    setDenied(false);
    setError("");
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== "granted" && existing.canAskAgain) {
        status = (await Location.requestForegroundPermissionsAsync()).status;
      }
      if (status !== "granted") {
        setDenied(true);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const places = await Location.reverseGeocodeAsync(position.coords);
      const place = places[0];
      const detected = place?.district ?? place?.subregion ?? place?.city ?? "";
      if (detected) {
        onSave(detected);
      } else {
        setError("No pudimos identificar tu comuna. Elige una manualmente.");
      }
    } catch {
      setError("No pudimos detectar tu ubicación. Elige una comuna manualmente.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismiss} onPress={onClose} />
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.modalTitle}>Tu ubicación</Text>
          <Text style={styles.modalSubtitle}>Te mostraremos profesionales cerca de tu comuna.</Text>
          <Pressable testID="use-my-location-button" onPress={locateMe} disabled={locating} style={styles.locationButton}>
            {locating ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="navigate-outline" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.locationButtonText}>Usar mi ubicación actual</Text>
              </>
            )}
          </Pressable>
          {denied ? (
            <View style={styles.deniedBox}>
              <Text style={styles.deniedText}>El permiso de ubicación está desactivado. Actívalo en la configuración o elige tu comuna manualmente.</Text>
              <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={styles.deniedButton}>
                <Text style={styles.deniedButtonText}>Abrir configuración</Text>
              </Pressable>
            </View>
          ) : null}
          {error ? <Text testID="location-error-text" style={styles.modalError}>{error}</Text> : null}
          <Text style={styles.modalLabel}>O elige tu comuna</Text>
          <ChipRow noPadding>
            {COMMUNES.map((item) => (
              <Chip key={item} testID={`commune-${item}`} label={item} active={manual === item} onPress={() => setManual(item)} />
            ))}
          </ChipRow>
          <View style={styles.modalActions}>
            <Pressable testID="location-cancel-button" onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable testID="location-save-button" onPress={() => manual.trim() && onSave(manual.trim())} style={styles.modalSave}>
              <Text style={styles.modalSaveText}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  greeting: { color: colors.onSurface, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  logoutButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  locationPill: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 },
  locationText: { color: colors.onSurfaceSecondary, fontSize: 13, flex: 1 },
  hero: { backgroundColor: colors.brandPrimary, borderRadius: 20, padding: 22, gap: 6 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  heroTitle: { color: colors.onBrandPrimary, fontSize: 20, fontWeight: "700" },
  heroBody: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 21 },
  heroButton: { alignSelf: "flex-start", marginTop: 12, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: colors.brandSecondary, flexDirection: "row", alignItems: "center", gap: 8 },
  heroButtonText: { color: colors.onBrandSecondary, fontWeight: "700", fontSize: 13 },
  categoriesRow: { gap: 12 },
  offerCard: { width: 118, height: 96, borderRadius: 16, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", gap: 8, padding: 10 },
  offerText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700", textAlign: "center" },
  list: { gap: 12 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" },
  modalDismiss: { flex: 1 },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  modalTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  modalSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -8 },
  locationButton: { minHeight: 50, borderRadius: 14, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  locationButtonText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "700" },
  deniedBox: { backgroundColor: colors.surfaceTertiary, borderRadius: 14, padding: 14, gap: 10 },
  deniedText: { color: colors.onSurfaceTertiary, fontSize: 13, lineHeight: 19 },
  deniedButton: { alignSelf: "flex-start", minHeight: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  deniedButtonText: { color: colors.onBrandSecondary, fontSize: 12, fontWeight: "800" },
  modalError: { color: colors.error, fontSize: 12, lineHeight: 18 },
  modalLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancel: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  modalCancelText: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  modalSave: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  modalSaveText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "700" },
}));
