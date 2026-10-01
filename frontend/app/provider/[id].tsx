import Ionicons from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Provider } from "@/src/api";
import { Avatar, EmptyState, formatRate, Loader, Notice, Stars } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function ProviderDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setProvider(await api.provider(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar el perfil");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function openWhatsApp() {
    if (!provider) return;
    const digits = provider.whatsapp.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`Hola ${provider.name}, te encontré en MaestrasRed y me interesa tu servicio de ${provider.category.toLowerCase()}.`);
    Linking.openURL(`https://wa.me/${digits}?text=${text}`).catch(() => setNotice("No pudimos abrir WhatsApp en este dispositivo."));
  }

  async function startChat() {
    if (!provider) return;
    setOpeningChat(true);
    try {
      const conversation = await api.createConversation(provider.id);
      router.push({ pathname: "/chat/[id]", params: { id: conversation.id, name: provider.name, initials: provider.initials } });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No pudimos abrir el chat");
    } finally {
      setOpeningChat(false);
    }
  }

  async function submitReview() {
    if (!provider) return;
    if (!myRating || comment.trim().length < 3) {
      setNotice("Elige una calificación y escribe un comentario breve.");
      return;
    }
    setSending(true);
    try {
      await api.review(provider.id, { rating: myRating, comment: comment.trim() });
      setMyRating(0);
      setComment("");
      setNotice("¡Gracias! Tu reseña fue publicada.");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No pudimos publicar tu reseña");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Perfil profesional</Text>
        <View style={styles.headerSpacer} />
      </View>
      {notice ? <Notice text={notice} onClose={() => setNotice("")} /> : null}
      {loading ? (
        <Loader />
      ) : error || !provider ? (
        <EmptyState testID="provider-error-state" icon="alert-circle-outline" title={error || "Profesional no encontrada"} actionLabel="Reintentar" onAction={load} />
      ) : (
        <>
          <KeyboardAwareScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: 132 + insets.bottom }]}>
            <View style={styles.hero}>
              <Avatar testID="provider-avatar" initials={provider.initials} size={82} />
              <View style={styles.heroCopy}>
                <View style={styles.nameLine}>
                  <Text testID="provider-name" style={styles.name}>{provider.name}</Text>
                  {provider.verified ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
                </View>
                <Text style={styles.meta}>{provider.category} · {provider.commune}, {provider.city}</Text>
                <View style={styles.ratingRow}>
                  <Stars rating={provider.rating} />
                  <Text testID="provider-rating" style={styles.ratingText}>
                    {provider.rating > 0 ? provider.rating.toFixed(1) : "Nueva"}{provider.reviews_count > 0 ? ` · ${provider.reviews_count} reseñas` : ""}
                  </Text>
                </View>
                {provider.verified ? <Text style={styles.verified}>Identidad verificada</Text> : null}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>SOBRE MÍ</Text>
              <Text testID="provider-bio" style={styles.bio}>{provider.bio}</Text>
              <View style={styles.rateRow}>
                <View>
                  <Text style={styles.cardLabel}>TARIFA REFERENCIAL</Text>
                  <Text testID="provider-rate" style={styles.rate}>{formatRate(provider.rate)}</Text>
                </View>
                <View style={styles.distance}>
                  <Ionicons name="walk-outline" size={16} color={colors.muted} />
                  <Text style={styles.meta}>{provider.distance} km de ti</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Reseñas{provider.reviews_count ? ` (${provider.reviews_count})` : ""}</Text>

            <View style={styles.card}>
              <Text style={styles.reviewPrompt}>Califica tu experiencia</Text>
              <Stars testID="review-star" rating={myRating} size={30} onSelect={setMyRating} />
              <View style={styles.commentField}>
                <TextInput
                  testID="review-comment-input"
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Cuéntanos cómo te fue con el servicio..."
                  placeholderTextColor={colors.muted}
                  style={styles.commentFieldInput}
                  multiline
                />
              </View>
              <Pressable testID="review-submit-button" onPress={submitReview} disabled={sending} style={[styles.reviewButton, sending && { opacity: 0.6 }]}>
                {sending ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Text style={styles.reviewButtonText}>Publicar reseña</Text>}
              </Pressable>
            </View>

            {provider.reviews && provider.reviews.length ? (
              <View style={styles.reviewsList}>
                {provider.reviews.map((review) => (
                  <View key={review.id} testID={`review-${review.id}`} style={styles.reviewCard}>
                    <View style={styles.reviewTop}>
                      <Text style={styles.reviewName}>{review.user_name}</Text>
                      <Stars rating={review.rating} size={12} />
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noReviews}>Aún no hay reseñas registradas para esta profesional.</Text>
            )}
          </KeyboardAwareScrollView>

          <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable testID="chat-button" onPress={startChat} disabled={openingChat} style={styles.ctaOutline}>
              {openingChat ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : (
                <>
                  <Ionicons name="chatbubble-outline" size={17} color={colors.brandPrimary} />
                  <Text style={styles.ctaOutlineText}>Chat interno</Text>
                </>
              )}
            </Pressable>
            <Pressable testID="whatsapp-button" onPress={openWhatsApp} style={styles.ctaSolid}>
              <Ionicons name="logo-whatsapp" size={18} color={colors.onBrandSecondary} />
              <Text style={styles.ctaSolidText}>WhatsApp</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  headerSpacer: { width: 44 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  hero: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 6 },
  heroCopy: { flex: 1, gap: 5 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: colors.onSurface, fontSize: 21, fontWeight: "800", letterSpacing: -0.3, flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  verified: { color: colors.success, fontSize: 11, fontWeight: "700" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 10 },
  cardLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  bio: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  rateRow: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 14, marginTop: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rate: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800", marginTop: 2 },
  distance: { flexDirection: "row", alignItems: "center", gap: 5 },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  reviewPrompt: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  commentField: { borderRadius: 14, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 14 },
  commentFieldInput: { minHeight: 72, paddingTop: 12, textAlignVertical: "top", color: colors.onSurface, fontSize: 14 },
  reviewButton: { minHeight: 46, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  reviewButtonText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "700" },
  reviewsList: { gap: 10 },
  reviewCard: { padding: 14, backgroundColor: colors.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 6 },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewName: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  reviewComment: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  noReviews: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  ctaBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  ctaOutline: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.brandPrimary, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  ctaOutlineText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
  ctaSolid: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: colors.brandSecondary, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  ctaSolidText: { color: colors.onBrandSecondary, fontSize: 14, fontWeight: "800" },
}));
