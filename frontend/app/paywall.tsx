import Ionicons from "@react-native-vector-icons/ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PrimaryButton } from "@/src/components/ui";
import { rcEnabled, bindRevenueCatIdentity, useSubscription } from "@/src/revenuecat";
import { loadUser, saveUser } from "@/src/session";
import { makeStyles, useTheme } from "@/src/theme";

const BENEFITS = [
  "Ve el directorio completo de profesionales, no solo las mejor evaluadas",
  "Contacta y compara sin límites antes de decidir",
  "Apoya a una comunidad de expertas verificadas",
];

export default function PaywallScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { offerings, isSubscribed, identityReady, purchase, restore, isPurchasing, isRestoring, isLoading } = useSubscription();
  const pkg = offerings?.current?.availablePackages?.[0];
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [notice, setNotice] = useState("");
  const simulated = __DEV__ || Platform.OS === "web";
  const queryClient = useQueryClient();

  // Identidad + CustomerInfo frescos al abrir el paywall (autónomo: no depende
  // del orden de montaje de otros layouts).
  useEffect(() => {
    if (!rcEnabled) return;
    (async () => {
      try {
        const user = await loadUser();
        if (user) await bindRevenueCatIdentity(user.id);
      } catch (error) {
        console.warn("[RevenueCat] paywall identity:", error);
      }
      queryClient.invalidateQueries({ queryKey: ["revenuecat", "customer-info"] });
    })();
  }, [queryClient]);

  async function syncAndClose() {
    try {
      const updated = await api.upgrade();
      await saveUser(updated);
    } catch {
      // la membresía RevenueCat ya quedó activa; el plan se sincroniza al reingresar
    }
    router.back();
  }

  async function confirmPurchase() {
    setConfirmVisible(false);
    if (!pkg) return;
    try {
      await purchase(pkg);
      await syncAndClose();
    } catch (error) {
      const err = error as { userCancelled?: boolean; message?: string };
      if (err?.userCancelled) return; // cancelación silenciosa
      setNotice(err?.message === "identity_not_ready" ? "Estamos preparando tu cuenta. Inténtalo nuevamente en unos segundos." : "No pudimos completar la compra. Inténtalo de nuevo.");
    }
  }

  async function onRestore() {
    setNotice("");
    try {
      const info = await restore();
      if (info.entitlements.active["pro"]) {
        await syncAndClose();
      } else {
        setNotice("No encontramos una suscripción activa en tu cuenta.");
      }
    } catch {
      setNotice("No pudimos restaurar tus compras. Inténtalo más tarde.");
    }
  }

  if (isSubscribed) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.successIcon}><Ionicons name="ribbon" size={32} color={colors.onBrandSecondary} /></View>
        <Text style={styles.title}>Ya eres Premium</Text>
        <Text style={styles.subtitle}>Tienes acceso al directorio completo de profesionales.</Text>
        <View style={styles.actions}><PrimaryButton testID="paywall-close-button" label="Volver" onPress={() => router.back()} /></View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="paywall-back-button" onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroIcon}><Ionicons name="ribbon-outline" size={34} color={colors.onBrandSecondary} /></View>
        <Text style={styles.title}>MaestrasRed Premium</Text>
        <Text style={styles.subtitle}>Desbloquea el directorio completo de expertas cerca de ti.</Text>

        <View style={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={19} color={colors.success} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {simulated ? (
          <View testID="simulated-badge" style={styles.simulatedBadge}>
            <Ionicons name="flask-outline" size={14} color={colors.onBrandTertiary} />
            <Text style={styles.simulatedText}>Compra simulada (Test Store) — no se realizará un cobro real en esta vista previa</Text>
          </View>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: 24 }} />
        ) : pkg ? (
          <View testID="package-card" style={styles.packageCard}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageName}>Premium mensual</Text>
              <Text style={styles.packageDetail}>Se renueva automáticamente cada mes. Cancela cuando quieras.</Text>
            </View>
            <Text testID="package-price" style={styles.packagePrice}>{pkg.product.priceString}</Text>
          </View>
        ) : (
          <Text style={styles.unavailable}>Las opciones de suscripción no están disponibles por ahora. Inténtalo más tarde.</Text>
        )}

        {notice ? <Text testID="paywall-notice" style={styles.notice}>{notice}</Text> : null}

        {pkg ? (
          <PrimaryButton
            testID="paywall-buy-button"
            label={identityReady ? "Suscribirme" : "Preparando tu cuenta…"}
            onPress={() => setConfirmVisible(true)}
            busy={isPurchasing}
            disabled={!identityReady || isPurchasing}
          />
        ) : null}
        <Pressable testID="restore-button" onPress={onRestore} disabled={isRestoring} style={styles.restoreButton}>
          {isRestoring ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Text style={styles.restoreText}>Restaurar compras</Text>}
        </Pressable>
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar suscripción</Text>
            <Text style={styles.modalText}>
              {simulated
                ? `Esta es una compra simulada de "${pkg?.product.title ?? "Premium mensual"}" (${pkg?.product.priceString ?? ""}) contra la tienda de pruebas. No se realizará un cobro real.`
                : `Se te cobrará ${pkg?.product.priceString ?? ""} por mes con renovación automática. Puedes cancelar cuando quieras desde tu tienda.`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable testID="confirm-cancel-button" onPress={() => setConfirmVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable testID="confirm-buy-button" onPress={confirmPurchase} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
  header: { paddingHorizontal: 12, paddingVertical: 8 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 24, paddingTop: 12, gap: 18 },
  heroIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  successIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  benefits: { gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18 },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  benefitText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, flex: 1 },
  simulatedBadge: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.brandTertiary, borderRadius: 12, padding: 12 },
  simulatedText: { color: colors.onBrandTertiary, fontSize: 12, lineHeight: 17, flex: 1 },
  packageCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: 18, borderWidth: 2, borderColor: colors.brandSecondary, padding: 18 },
  packageInfo: { flex: 1, gap: 4 },
  packageName: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "800" },
  packageDetail: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  packagePrice: { color: colors.brandPrimary, fontSize: 22, fontWeight: "800" },
  unavailable: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", paddingVertical: 16 },
  notice: { color: colors.error, fontSize: 13, lineHeight: 19, textAlign: "center" },
  restoreButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  restoreText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
  actions: { alignSelf: "stretch", marginTop: 10 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 28 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 22, gap: 12, alignSelf: "stretch" },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  modalText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  modalCancel: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  modalCancelText: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  modalConfirm: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  modalConfirmText: { color: colors.onBrandSecondary, fontSize: 14, fontWeight: "800" },
}));
