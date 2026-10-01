import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from "react-native";

import { useAuthedImageSource } from "@/src/images";
import { makeStyles, useTheme } from "@/src/theme";

type Props = {
  testID: string;
  size?: number;
  localUri?: string | null;
  photoPath?: string | null;
  photoUrl?: string | null;
  uploading?: boolean;
  onPick: (asset: ImagePicker.ImagePickerAsset) => void;
};

// Circular photo picker with the full permission contract:
// check first, request only on user intent, and on permanent denial
// offer an "Abrir configuración" way out instead of dead-ending.
export function PhotoPicker({ testID, size = 96, localUri, photoPath, photoUrl, uploading, onPick }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [denied, setDenied] = useState(false);
  const remote = useAuthedImageSource(localUri ? null : photoPath, localUri ? null : photoUrl);

  async function pick() {
    setDenied(false);
    if (Platform.OS !== "web") {
      const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
      let status = existing.status;
      if (status !== "granted" && existing.canAskAgain) {
        status = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
      }
      if (status !== "granted") {
        setDenied(true);
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      onPick(result.assets[0]);
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable testID={testID} onPress={pick} disabled={uploading} style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        {localUri || remote ? (
          <Image source={localUri ? { uri: localUri } : remote!} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            {uploading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={size * 0.32} color={colors.onBrandPrimary} />
                {size >= 60 ? <Text style={styles.placeholderText}>Foto</Text> : null}
              </>
            )}
          </View>
        )}
        <View style={[styles.badge, { borderRadius: 14 }]}>
          <Ionicons name="add" size={16} color={colors.onBrandSecondary} />
        </View>
      </Pressable>
      {denied ? (
        <View style={styles.deniedRow}>
          <Text style={styles.deniedText}>El acceso a tus fotos está desactivado.</Text>
          <Pressable testID={`${testID}-open-settings`} onPress={() => Linking.openSettings()} hitSlop={8}>
            <Text style={styles.deniedLink}>Abrir configuración</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center", gap: 8 },
  circle: { backgroundColor: colors.brandPrimary, overflow: "visible" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 999, overflow: "hidden" },
  placeholderText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "700" },
  badge: { position: "absolute", right: 0, bottom: 0, width: 28, height: 28, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  deniedRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  deniedText: { color: colors.muted, fontSize: 12 },
  deniedLink: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
}));
