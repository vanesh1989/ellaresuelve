import { Platform } from "react-native";

// iOS 26+ renders the native liquid-glass tab bar; older iOS, Android and web
// fall back to the classic JS tab bar. Import this everywhere tab layout matters.
export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
