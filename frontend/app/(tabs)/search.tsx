import Ionicons from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ProvidersResult, User } from "@/src/api";
import { CATEGORIES, Chip, ChipRow, EmptyState, FreeBanner, Loader, Notice, ProviderCard } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { loadUser } from "@/src/session";
import { makeStyles, useTheme } from "@/src/theme";

const RATING_FILTERS = [
  { label: "Todas", value: 0 },
  { label: "4,0+", value: 4 },
  { label: "4,5+", value: 4.5 },
];

export default function SearchScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const params = useLocalSearchParams<{ category?: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(params.category ?? "");
  const [minRating, setMinRating] = useState(0);
  const [result, setResult] = useState<ProvidersResult>({ providers: [], limited: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upgrading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setCategory(params.category ?? "");
  }, [params.category]);

  const load = useCallback(async (text: string, cat: string, rating: number, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const qs = `?search=${encodeURIComponent(text)}&category=${encodeURIComponent(cat)}&min_rating=${rating}`;
      setResult(await api.providers(qs));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Revisa tu conexión e inténtalo nuevamente");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUser().then(setUser);
    const timeout = setTimeout(() => load(query, category, minRating), 250);
    return () => clearTimeout(timeout);
  }, [query, category, minRating, load]);

  function upgrade() {
    router.push("/paywall");
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DESCUBRE</Text>
        <Text style={styles.title}>Profesionales cerca de ti</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre o descripción"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {query ? (
            <Ionicons name="close-circle" size={18} color={colors.muted} onPress={() => setQuery("")} />
          ) : null}
        </View>
      </View>
      <ChipRow>
        <Chip testID="chip-category-todas" label="Todas" active={!category} onPress={() => setCategory("")} />
        {CATEGORIES.map((item) => (
          <Chip key={item.key} testID={`chip-category-${item.key}`} label={item.key} icon={item.icon} active={category === item.key} onPress={() => setCategory(item.key)} />
        ))}
      </ChipRow>
      <ChipRow>
        {RATING_FILTERS.map((filter) => (
          <Chip key={filter.value} testID={`chip-rating-${filter.value}`} label={filter.label} icon="star" active={minRating === filter.value} onPress={() => setMinRating(filter.value)} />
        ))}
      </ChipRow>
      {notice ? <Notice text={notice} onClose={() => setNotice("")} /> : null}
      {user?.plan === "free" && result.limited ? (
        <View style={styles.bannerWrap}><FreeBanner onUpgrade={upgrade} busy={upgrading} /></View>
      ) : null}
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          testID="search-results-list"
          data={result.providers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProviderCard provider={item} onPress={() => router.push({ pathname: "/provider/[id]", params: { id: item.id } })} />}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(query, category, minRating, true); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              testID="search-empty-state"
              icon="search-outline"
              title="No encontramos resultados para tu búsqueda. Prueba ajustando los filtros."
              actionLabel="Restablecer filtros"
              onAction={() => { setQuery(""); setCategory(""); setMinRating(0); }}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 10, gap: 4, paddingBottom: 6 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontSize: 23, fontWeight: "800", letterSpacing: -0.4, marginBottom: 8 },
  searchBox: { minHeight: 52, borderRadius: 15, paddingHorizontal: 14, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 14, paddingVertical: 0 },
  bannerWrap: { paddingHorizontal: 20, paddingBottom: 4 },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 12, flexGrow: 1 },
}));
