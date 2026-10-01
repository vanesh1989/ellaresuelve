import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { ComponentProps } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { Provider } from "@/src/api";
import { useAuthedImageSource } from "@/src/images";
import { makeStyles, useTheme } from "@/src/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export const CATEGORIES = [
  { key: "Niñera", icon: "balloon-outline", image: "https://images.unsplash.com/photo-1715433492205-9256ae412a8d?crop=entropy&cs=srgb&fm=jpg&q=85" },
  { key: "Gasfitera", icon: "water-outline", image: "https://images.unsplash.com/photo-1635874554973-aa7e8b59ef14?crop=entropy&cs=srgb&fm=jpg&q=85" },
  { key: "Jardinera", icon: "leaf-outline", image: "https://images.unsplash.com/photo-1728881652468-d445a6c23333?crop=entropy&cs=srgb&fm=jpg&q=85" },
  { key: "Profesora", icon: "school-outline", image: "https://images.unsplash.com/photo-1590650213165-c1fef80648c4?crop=entropy&cs=srgb&fm=jpg&q=85" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function formatRate(rate: number): string {
  return `$${String(Math.round(rate)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}/hr`;
}

const useStyles = makeStyles((colors) => ({
  avatar: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandTertiary, fontWeight: "800" },
  providerCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  providerInfo: { flex: 1, gap: 4 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  providerName: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  providerMeta: { color: colors.muted, fontSize: 12 },
  providerBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  ratingLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  rateText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  cardChevron: { alignSelf: "center" },
  chip: { height: 36, borderRadius: 18, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.onBrandPrimary },
  chipRow: { flexGrow: 0, height: 56 },
  chipRowContent: { gap: 8, paddingHorizontal: 20, alignItems: "center" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  sectionAction: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 44, paddingHorizontal: 24, gap: 12 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.onSurfaceSecondary, textAlign: "center", fontSize: 15, lineHeight: 22 },
  emptyButton: { minHeight: 44, borderRadius: 22, paddingHorizontal: 18, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  emptyButtonText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "700" },
  field: { minHeight: 52, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.surfaceTertiary, flexDirection: "row", alignItems: "center", gap: 10 },
  fieldInput: { flex: 1, color: colors.onSurface, fontSize: 14 },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryButtonText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" },
  notice: { marginHorizontal: 20, marginTop: 8, minHeight: 44, borderRadius: 12, paddingHorizontal: 13, backgroundColor: colors.info, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { color: colors.onInfo, fontSize: 13, flex: 1 },
  banner: { backgroundColor: colors.brandTertiary, borderRadius: 18, padding: 16, flexDirection: "row", gap: 12, alignItems: "center" },
  bannerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  bannerCopy: { flex: 1, gap: 2 },
  bannerTitle: { color: colors.onBrandTertiary, fontSize: 14, fontWeight: "800" },
  bannerText: { color: colors.onBrandTertiary, fontSize: 12, lineHeight: 17, opacity: 0.85 },
  bannerButton: { minHeight: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  bannerButtonText: { color: colors.onBrandSecondary, fontSize: 12, fontWeight: "800" },
  categoryCard: { width: 148, height: 96, borderRadius: 16, overflow: "hidden", justifyContent: "flex-end", padding: 10, gap: 6 },
  categoryScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  categoryIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  categoryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  loaderWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
}));

export function Loader() {
  const styles = useStyles();
  const { colors } = useTheme();
  return <View style={styles.loaderWrap}><ActivityIndicator color={colors.brandPrimary} /></View>;
}

export function Avatar({ initials, size = 58, testID, photoPath, photoUrl }: { initials: string; size?: number; testID?: string; photoPath?: string | null; photoUrl?: string | null }) {
  const styles = useStyles();
  const source = useAuthedImageSource(photoPath, photoUrl);
  return (
    <View testID={testID} style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.3, overflow: "hidden" }]}>
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={[styles.avatarText, { fontSize: Math.max(12, size * 0.32) }]}>{initials}</Text>
      )}
    </View>
  );
}

export function Stars({ rating, size = 14, onSelect, testID }: { rating: number; size?: number; onSelect?: (value: number) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((value) => {
        const name: IconName = rating >= value - 0.25 ? "star" : "star-outline";
        const icon = <Ionicons name={name} size={size} color={colors.warning} />;
        return onSelect ? (
          <Pressable key={value} testID={`${testID ?? "star"}-${value}`} onPress={() => onSelect(value)} hitSlop={6}>{icon}</Pressable>
        ) : (
          <View key={value}>{icon}</View>
        );
      })}
    </View>
  );
}

export function ProviderCard({ provider, onPress }: { provider: Provider; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={`provider-card-${provider.id}`} onPress={onPress} style={styles.providerCard}>
      <Avatar initials={provider.initials} />
      <View style={styles.providerInfo}>
        <View style={styles.nameLine}>
          <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
          {provider.verified ? <Ionicons name="checkmark-circle" size={15} color={colors.success} /> : null}
        </View>
        <Text style={styles.providerMeta}>{provider.category} · {provider.commune}</Text>
        <View style={styles.providerBottom}>
          <View style={styles.ratingLine}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={styles.ratingText}>{provider.rating > 0 ? provider.rating.toFixed(1) : "Nueva"}</Text>
            {provider.reviews_count > 0 ? <Text style={styles.providerMeta}>({provider.reviews_count})</Text> : null}
          </View>
          <Text style={styles.rateText}>{formatRate(provider.rate)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} style={styles.cardChevron} />
    </Pressable>
  );
}

export function CategoryCard({ category, onPress }: { category: CategoryKey; onPress?: () => void }) {
  const styles = useStyles();
  const meta = CATEGORIES.find((item) => item.key === category) ?? CATEGORIES[0];
  return (
    <Pressable testID={`category-${category}`} onPress={onPress} style={styles.categoryCard}>
      <Image source={{ uri: meta.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <View style={styles.categoryScrim} />
      <View style={styles.categoryIconWrap}>
        <Ionicons name={meta.icon as IconName} size={16} color="#FFFFFF" />
      </View>
      <Text style={styles.categoryText}>{category}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon, testID }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {icon ? <Ionicons name={icon} size={14} color={active ? colors.onBrandPrimary : colors.brandPrimary} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, noPadding }: { children: React.ReactNode; noPadding?: boolean }) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={[styles.chipRowContent, noPadding && { paddingHorizontal: 0 }]}>
      {children}
    </ScrollView>
  );
}

export function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable testID={`section-${action.toLowerCase().replace(/\s+/g, "-")}`} onPress={onPress} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, actionLabel, onAction, testID }: { icon: IconName; title: string; actionLabel?: string; onAction?: () => void; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={28} color={colors.brandPrimary} /></View>
      <Text style={styles.emptyText}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable testID={`${testID ?? "empty"}-action`} onPress={onAction} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Field({ icon, ...props }: TextInputProps & { icon: IconName }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <TextInput placeholderTextColor={colors.muted} style={styles.fieldInput} {...props} />
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled, testID }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={busy || disabled} style={[styles.primaryButton, (busy || disabled) && { opacity: 0.6 }]}>
      {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

export function Notice({ text, onClose }: { text: string; onClose?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID="notice-banner" onPress={onClose} style={styles.notice}>
      <Ionicons name="information-circle" size={17} color={colors.onInfo} />
      <Text style={styles.noticeText}>{text}</Text>
    </Pressable>
  );
}

export function FreeBanner({ onUpgrade, busy }: { onUpgrade: () => void; busy?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID="free-plan-banner" style={styles.banner}>
      <View style={styles.bannerIcon}><Ionicons name="ribbon-outline" size={20} color={colors.onBrandPrimary} /></View>
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>Plan gratuito</Text>
        <Text style={styles.bannerText}>Ves solo las mejor evaluadas (4,5★+). Premium por $3.000/mes.</Text>
      </View>
      <Pressable testID="upgrade-button" onPress={onUpgrade} disabled={busy} style={styles.bannerButton}>
        {busy ? <ActivityIndicator size="small" color={colors.onBrandSecondary} /> : <Text style={styles.bannerButtonText}>Hazte Premium</Text>}
      </Pressable>
    </View>
  );
}
