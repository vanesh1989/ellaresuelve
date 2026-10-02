import Ionicons from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Provider } from "@/src/api";
import { PhotoPicker } from "@/src/components/photo-picker";
import { GalleryItem, GalleryPicker, VerificationCard } from "@/src/components/provider-extras";
import { CATEGORIES, Chip, ChipRow, Field, PrimaryButton } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

const STICKY_HEIGHT = 88;

export default function RegisterScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Niñera");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState("");
  const [city, setCity] = useState("Santiago");
  const [commune, setCommune] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Provider | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [myProvider, setMyProvider] = useState<Provider | null>(null);

  useFocusEffect(useCallback(() => {
    api.myProviders().then((list) => setMyProvider(list[0] ?? null)).catch(() => {});
  }, []));

  async function onPhoto(asset: ImagePicker.ImagePickerAsset) {
    setPhotoUri(asset.uri);
    setPhotoBusy(true);
    setError("");
    try {
      const uploaded = await api.uploadPhoto(asset);
      setPhotoPath(uploaded.path);
    } catch (err) {
      setPhotoUri(null);
      setError(err instanceof Error ? err.message : "No pudimos subir la foto");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit() {
    const rateValue = Number(rate.replace(/[^\d]/g, ""));
    if (name.trim().length < 2) return setError("Ingresa tu nombre completo.");
    if (bio.trim().length < 10) return setError("Cuéntanos un poco más sobre tu experiencia (mínimo 10 caracteres).");
    if (!rateValue || rateValue <= 0) return setError("Ingresa una tarifa válida por hora.");
    if (commune.trim().length < 2) return setError("Ingresa tu comuna.");
    if (whatsapp.replace(/[^\d]/g, "").length < 8) return setError("Ingresa un número de WhatsApp válido, ej. +56912345678.");
    setBusy(true);
    setError("");
    try {
      const created = await api.createProvider({
        name: name.trim(),
        category,
        bio: bio.trim(),
        rate: rateValue,
        city: city.trim() || "Santiago",
        commune: commune.trim(),
        whatsapp: whatsapp.trim(),
        ...(photoPath ? { photo_path: photoPath } : {}),
        gallery: galleryItems.map((item) => item.path),
      });
      setMyProvider(created);
      setDone(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos publicar tu perfil");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <View style={[styles.root, styles.successRoot, { paddingTop: insets.top, paddingBottom: bottomChrome + 24 }]}>
        <View style={styles.successIcon}><Ionicons name="checkmark" size={34} color={colors.onSuccess} /></View>
        <Text style={styles.successTitle}>¡Tu perfil está publicado!</Text>
        <Text style={styles.successText}>Las clientas de tu comuna ya pueden encontrarte en MaestrasRed. Recuerda que las reseñas te ayudarán a destacar.</Text>
        <View style={styles.successActions}>
          <PrimaryButton testID="view-my-profile-button" label="Ver mi perfil" onPress={() => router.push({ pathname: "/provider/[id]", params: { id: done.id } })} />
          <Pressable testID="publish-another-button" onPress={() => { setDone(null); setBio(""); setRate(""); setWhatsapp(""); }} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Publicar otro servicio</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        bottomOffset={STICKY_HEIGHT}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: STICKY_HEIGHT + bottomChrome + 16 }]}
      >
        <Text style={styles.eyebrow}>PUBLICA</Text>
        <Text style={styles.title}>Ofrece tus servicios</Text>
        <Text style={styles.subtitle}>Crea tu perfil profesional y empieza a recibir contactos por WhatsApp.</Text>

        {myProvider ? <VerificationCard provider={myProvider} /> : null}

        <PhotoPicker testID="register-photo-picker" localUri={photoUri} uploading={photoBusy} onPick={onPhoto} />
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>Una foto real genera más confianza y contactos.</Text>

        <Text style={styles.label}>Galería de trabajos (opcional)</Text>
        <GalleryPicker testID="register-gallery" items={galleryItems} onChange={setGalleryItems} />

        <Text style={styles.label}>Tu nombre</Text>
        <Field testID="register-name-input" icon="person-outline" placeholder="Ej. María González" value={name} onChangeText={setName} autoCapitalize="words" />

        <Text style={styles.label}>Categoría</Text>
        <ChipRow noPadding>
          {CATEGORIES.map((item) => (
            <Chip key={item.key} testID={`register-category-${item.key}`} label={item.key} icon={item.icon} active={category === item.key} onPress={() => setCategory(item.key)} />
          ))}
        </ChipRow>

        <Text style={styles.label}>Descripción</Text>
        <View style={styles.multilineWrap}>
          <TextInput
            testID="register-bio-input"
            value={bio}
            onChangeText={setBio}
            placeholder="Describe tu experiencia, especialidades y cómo trabajas."
            placeholderTextColor={colors.muted}
            style={styles.multiline}
            multiline
          />
        </View>

        <Text style={styles.label}>Tarifa por hora (CLP)</Text>
        <Field testID="register-rate-input" icon="cash-outline" placeholder="Ej. 15000" value={rate} onChangeText={setRate} keyboardType="number-pad" />

        <Text style={styles.label}>Ciudad</Text>
        <Field testID="register-city-input" icon="business-outline" placeholder="Santiago" value={city} onChangeText={setCity} autoCapitalize="words" />

        <Text style={styles.label}>Comuna</Text>
        <Field testID="register-commune-input" icon="location-outline" placeholder="Ej. Providencia" value={commune} onChangeText={setCommune} autoCapitalize="words" />

        <Text style={styles.label}>WhatsApp</Text>
        <Field testID="register-whatsapp-input" icon="logo-whatsapp" placeholder="+56912345678" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
        <Text style={styles.hint}>Las clientas te contactarán directamente a este número con un solo clic.</Text>

        {error ? <Text testID="register-error-text" style={styles.error}>{error}</Text> : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: bottomChrome + 12 }]}>
          <PrimaryButton testID="register-submit-button" label="Publicar mi perfil" onPress={submit} busy={busy} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginTop: 6 },
  multilineWrap: { borderRadius: 14, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 14 },
  multiline: { minHeight: 108, paddingTop: 14, textAlignVertical: "top", color: colors.onSurface, fontSize: 14 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, marginTop: 4 },
  stickyBar: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  successRoot: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  successTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "800", textAlign: "center" },
  successText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  successActions: { alignSelf: "stretch", gap: 10, marginTop: 14 },
  secondaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
}));
