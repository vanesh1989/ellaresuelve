import Ionicons from "@react-native-vector-icons/ionicons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Field, PrimaryButton } from "@/src/components/ui";
import { saveSession } from "@/src/session";
import { makeStyles, useTheme } from "@/src/theme";

WebBrowser.maybeCompleteAuthSession();

// A session_id is single-use; deep links can surface the same one twice.
const processedSessionIds = new Set<string>();

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingUrl = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Linking.addEventListener("url", (event) => {
      pendingUrl.current = event.url;
      exchangeSessionId(event.url);
    });
    Linking.getInitialURL().then((url) => {
      if (url) exchangeSessionId(url);
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exchangeSessionId(url: string) {
    // Emergent returns session_id in the hash fragment: match the raw URL,
    // Linking.parse().queryParams cannot see it.
    const match = url.match(/[?#&]session_id=([^&#]+)/);
    const sessionId = match?.[1];
    if (!sessionId || processedSessionIds.has(sessionId)) return;
    processedSessionIds.add(sessionId);
    setGoogleBusy(true);
    setError("");
    try {
      const result = await api.googleSession(sessionId);
      await saveSession(result.token, result.user);
      router.replace("/(tabs)");
    } catch (err) {
      processedSessionIds.delete(sessionId);
      setError(err instanceof Error ? err.message : "No pudimos ingresar con Google");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function googleSignIn() {
    const redirectUrl = Platform.OS === "web" ? `${window.location.origin}/` : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    setGoogleBusy(true);
    setError("");
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      // Android Custom Tabs often report dismiss even on success: fall back to
      // the Linking listener capture, then to the cold-start URL.
      const url = result.type === "success" ? result.url : pendingUrl.current ?? (await Linking.getInitialURL());
      if (url) {
        await exchangeSessionId(url);
      } else {
        setGoogleBusy(false);
      }
    } catch {
      setGoogleBusy(false);
      setError("No pudimos abrir el acceso con Google");
    }
  }

  async function submit() {
    if (!email.includes("@") || password.length < 6 || (mode === "register" && name.trim().length < 2)) {
      setError("Completa los datos. La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = mode === "login"
        ? await api.login({ email: email.trim(), password })
        : await api.register({ email: email.trim(), password, name: name.trim() });
      await saveSession(result.token, result.user);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos ingresar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.mark}><Ionicons name="leaf-outline" size={30} color={colors.onBrandPrimary} /></View>
      <Text style={styles.title}>Maestras<Text style={styles.accent}>Red</Text></Text>
      <Text style={styles.subtitle}>Encuentra expertas de confianza cerca de ti</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{mode === "login" ? "Qué bueno verte" : "Crea tu cuenta"}</Text>
        {mode === "register" ? (
          <Field testID="auth-name-input" icon="person-outline" placeholder="Tu nombre" value={name} onChangeText={setName} autoCapitalize="words" />
        ) : null}
        <Field testID="auth-email-input" icon="mail-outline" placeholder="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field testID="auth-password-input" icon="lock-closed-outline" placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text testID="auth-error-text" style={styles.error}>{error}</Text> : null}
        <PrimaryButton testID="auth-submit-button" label={mode === "login" ? "Iniciar sesión" : "Registrarme"} onPress={submit} busy={busy} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>o</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
        </View>
        <Pressable
          testID="google-signin-button"
          onPress={googleSignIn}
          disabled={googleBusy}
          style={{ minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: googleBusy ? 0.6 : 1 }}
        >
          {googleBusy ? (
            <Text style={{ color: colors.brandPrimary, fontSize: 15, fontWeight: "700" }}>Conectando con Google…</Text>
          ) : (
            <>
              <Ionicons name="logo-google" size={19} color={colors.brandSecondary} />
              <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "700" }}>Continuar con Google</Text>
            </>
          )}
        </Pressable>
        <Pressable testID="auth-switch-button" onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={styles.switchButton}>
          <Text style={styles.switchText}>
            {mode === "login" ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
            <Text style={styles.linkText}>{mode === "login" ? "Regístrate" : "Ingresa"}</Text>
          </Text>
        </Pressable>
      </View>
      <Text style={styles.footer}>Una comunidad para conectar con confianza</Text>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  mark: { width: 62, height: 62, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { color: colors.brandPrimary, fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  accent: { color: colors.brandSecondary },
  subtitle: { color: colors.muted, marginTop: 6, marginBottom: 30, fontSize: 14, textAlign: "center" },
  card: { width: "100%", maxWidth: 420, backgroundColor: colors.surfaceSecondary, borderRadius: 22, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.onSurfaceSecondary, fontSize: 18, fontWeight: "700" },
  error: { color: colors.error, fontSize: 12, lineHeight: 18 },
  switchButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  switchText: { color: colors.muted, fontSize: 13 },
  linkText: { color: colors.brandPrimary, fontWeight: "700" },
  footer: { color: colors.muted, fontSize: 12, marginTop: 24 },
}));
