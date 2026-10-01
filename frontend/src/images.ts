import { useEffect, useState } from "react";
import { ImageSourcePropType, Platform } from "react-native";

import { api, TOKEN_KEY } from "@/src/api";
import { storage } from "@/src/utils/storage";

// Resolves a storage-backed photo (photo_path) into an expo-image source.
// Native attaches the Bearer header; web <img> cannot send headers, so the
// token goes in the query string (the /api/files route accepts both).
// External URLs (e.g. Google profile pictures) pass through untouched.
export function useAuthedImageSource(photoPath?: string | null, photoUrl?: string | null): ImageSourcePropType | null {
  const [source, setSource] = useState<ImageSourcePropType | null>(photoUrl ? { uri: photoUrl } : null);

  useEffect(() => {
    let active = true;
    if (photoPath) {
      storage.secureGet<string | null>(TOKEN_KEY, null).then((token) => {
        if (!active) return;
        const uri = api.fileUrl(photoPath);
        setSource(Platform.OS === "web" ? { uri: `${uri}?token=${token ?? ""}` } : { uri, headers: { Authorization: `Bearer ${token ?? ""}` } });
      });
    } else if (photoUrl) {
      setSource({ uri: photoUrl });
    } else {
      setSource(null);
    }
    return () => {
      active = false;
    };
  }, [photoPath, photoUrl]);

  return source;
}
