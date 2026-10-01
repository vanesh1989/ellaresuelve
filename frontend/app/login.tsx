import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Field, PrimaryButton } from "@/src/components/ui";
import { saveSession } from "@/src/session";
import { makeStyles, useTheme } from "@/src/theme";

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
  const [error, setError] = useState("");

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
