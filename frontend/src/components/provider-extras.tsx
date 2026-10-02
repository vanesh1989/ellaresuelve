import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { api, Provider } from "@/src/api";
import { useAuthedImageSource } from "@/src/images";
import { makeStyles, useTheme } from "@/src/theme";

export type GalleryItem = { path: string; localUri?: string };

async function pickImage(): Promise<ImagePicker.ImagePickerAsset | "denied" | null> {
  if (Platform.OS !== "web") {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = existing.status;
    if (status !== "granted" && existing.canAskAgain) {
      status = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
    }
    if (status !== "granted") return "denied";
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
  return result.canceled ? null : result.assets[0];
}

function DeniedNote() {
  const styles = useStyles();
  return (
    <View style={styles.deniedRow}>
      <Text style={styles.deniedText}>El acceso a tus fotos está desactivado.</Text>
      <Pressable testID="gallery-open-settings" onPress={() => Linking.openSettings()} hitSlop={8}>
        <Text style={styles.deniedLink}>Abrir configuración</Text>
      </Pressable>
    </View>
  );
}

export function GalleryTile({ item, size = 100, onRemove, testID }: { item: GalleryItem; size?: number; onRemove?: () => void; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const remote = useAuthedImageSource(item.localUri ? null : item.path, null);
  const source = item.localUri ? { uri: item.localUri } : remote;
  return (
    <View testID={testID} style={[styles.tile, { width: size, height: size }]}>
      {source ? (
        <Image source={source} style={{ width: size, height: size, borderRadius: 14 }} contentFit="cover" />
      ) : (
        <View style={styles.tileLoading}><ActivityIndicator size="small" color={colors.brandPrimary} /></View>
      )}
      {onRemove ? (
        <Pressable testID={testID ? `${testID}-remove` : undefined} onPress={onRemove} style={styles.tileRemove} hitSlop={6}>
          <Ionicons name="close" size={13} color={colors.onError} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Tira horizontal de solo lectura para el perfil público.
export function GalleryStrip({ paths }: { paths: string[] }) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
      {paths.map((path) => (
        <GalleryTile key={path} item={{ path }} size={120} testID={`gallery-photo-${path.split("/").pop()}`} />
      ))}
    </ScrollView>
  );
}

export function GalleryPicker({ items, onChange, max = 6, testID }: { items: GalleryItem[]; onChange: (items: GalleryItem[]) => void; max?: number; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setDenied(false);
    setError("");
    const asset = await pickImage();
    if (asset === "denied") return setDenied(true);
    if (!asset) return;
    setBusy(true);
    try {
      const uploaded = await api.uploadPhoto(asset);
      onChange([...items, { path: uploaded.path, localUri: asset.uri }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir la foto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.pickerWrap}>
      <View style={styles.tilesWrap}>
        {items.map((item) => (
          <GalleryTile key={item.path} item={item} testID={`${testID ?? "gallery"}-item`} onRemove={() => onChange(items.filter((entry) => entry.path !== item.path))} />
        ))}
        {items.length < max ? (
          <Pressable testID={`${testID ?? "gallery"}-add`} onPress={add} disabled={busy} style={styles.addTile}>
            {busy ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : (
              <>
                <Ionicons name="add" size={24} color={colors.brandPrimary} />
                <Text style={styles.addTileText}>Agregar</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.counter}>{items.length}/{max} fotos</Text>
      {denied ? <DeniedNote /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function DocPicker({ label, icon, value, onChange, testID }: { label: string; icon: string; value: GalleryItem | null; onChange: (item: GalleryItem) => void; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  async function pick() {
    setDenied(false);
    const asset = await pickImage();
    if (asset === "denied") return setDenied(true);
    if (!asset) return;
    setBusy(true);
    try {
      const uploaded = await api.uploadPhoto(asset);
      onChange({ path: uploaded.path, localUri: asset.uri });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.docWrap}>
      <Pressable testID={testID} onPress={pick} disabled={busy} style={styles.docTile}>
        {value?.localUri ? (
          <Image source={{ uri: value.localUri }} style={styles.docImage} contentFit="cover" />
        ) : (
          <View style={styles.docPlaceholder}>
            {busy ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Ionicons name={icon as never} size={24} color={colors.brandPrimary} />}
            <Text style={styles.docLabel}>{label}</Text>
          </View>
        )}
      </Pressable>
      {denied ? <DeniedNote /> : null}
    </View>
  );
}

// Verificación de identidad: cédula + selfie, revisada manualmente por la administración.
export function VerificationCard({ provider, testID }: { provider: Provider; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [status, setStatus] = useState<"loading" | "none" | "pending" | "approved" | "rejected">("loading");
  const [idDoc, setIdDoc] = useState<GalleryItem | null>(null);
  const [selfie, setSelfie] = useState<GalleryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (provider.verified) {
      setStatus("approved");
      return;
    }
    api.myVerifications()
      .then((list) => {
        const latest = list.find((item) => item.provider_id === provider.id);
        setStatus(latest ? latest.status : "none");
      })
      .catch(() => setStatus("none"));
  }, [provider.id, provider.verified]);

  async function submit() {
    if (!idDoc || !selfie) {
      setError("Sube ambas fotos para continuar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.submitVerification({ provider_id: provider.id, id_path: idDoc.path, selfie_path: selfie.path });
      setStatus("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar tu verificación");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return null;

  return (
    <View testID={testID ?? "verification-card"} style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons
          name={status === "approved" ? "shield-checkmark" : "shield-half-outline"}
          size={22}
          color={status === "approved" ? colors.success : colors.brandPrimary}
        />
        <Text style={styles.cardTitle}>Verificación de identidad</Text>
      </View>
      {status === "approved" ? (
        <Text style={styles.okText}>Tu identidad está verificada. Tu perfil muestra la insignia de confianza.</Text>
      ) : status === "pending" ? (
        <Text style={styles.infoText}>Tus documentos están en revisión. Te avisaremos cuando se apruebe.</Text>
      ) : (
        <>
          {status === "rejected" ? (
            <Text style={styles.errorText}>Tu verificación fue rechazada. Reenvía fotos legibles y bien iluminadas.</Text>
          ) : (
            <Text style={styles.infoText}>Sube tu cédula de identidad y una selfie para ganar la insignia de verificada.</Text>
          )}
          <View style={styles.docsRow}>
            <DocPicker testID="verification-id-picker" label="Cédula" icon="card-outline" value={idDoc} onChange={setIdDoc} />
            <DocPicker testID="verification-selfie-picker" label="Selfie" icon="person-circle-outline" value={selfie} onChange={setSelfie} />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable testID="verification-submit-button" onPress={submit} disabled={busy} style={[styles.submitButton, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Text style={styles.submitText}>Enviar verificación</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  deniedRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  deniedText: { color: colors.muted, fontSize: 12 },
  deniedLink: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  tile: { borderRadius: 14, overflow: "visible" },
  tileLoading: { flex: 1, borderRadius: 14, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tileRemove: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  stripRow: { gap: 10 },
  pickerWrap: { gap: 8 },
  tilesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  addTile: { width: 100, height: 100, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: colors.surfaceSecondary },
  addTileText: { color: colors.brandPrimary, fontSize: 11, fontWeight: "700" },
  counter: { color: colors.muted, fontSize: 11 },
  errorText: { color: colors.error, fontSize: 12, lineHeight: 18 },
  docWrap: { flex: 1, gap: 6 },
  docTile: { height: 110, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, overflow: "hidden" },
  docImage: { width: "100%", height: "100%" },
  docPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  docLabel: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "800" },
  infoText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  okText: { color: colors.success, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  docsRow: { flexDirection: "row", gap: 10 },
  submitButton: { minHeight: 46, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  submitText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "700" },
}));
