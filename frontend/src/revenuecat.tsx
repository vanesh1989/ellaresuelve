import React, { createContext, useContext, useEffect } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryClient } from "@/src/query-client";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "pro"; // entitlement_lookup_key from /setup

export const rcEnabled = Platform.OS !== "web" || __DEV__; // web preview usa el Test Store

function getRevenueCatApiKey() {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat public API keys not found — run the Setup section first");
  }
  if (Platform.OS === "web" || __DEV__) {
    return REVENUECAT_TEST_API_KEY; // Expo Go y el preview web usan el RevenueCat Test Store
  }
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  if (!rcEnabled) return; // sin store en web de producción
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: getRevenueCatApiKey() });
}

// Vincula la identidad estable del backend y deja el CustomerInfo fresco en caché.
export async function bindRevenueCatIdentity(userId: string): Promise<void> {
  if (!rcEnabled) return;
  const { customerInfo } = await Purchases.logIn(userId);
  queryClient.setQueryData(["revenuecat", "identity"], userId);
  queryClient.setQueryData(["revenuecat", "customer-info"], customerInfo);
}

export async function unbindRevenueCatIdentity(): Promise<void> {
  if (!rcEnabled) return;
  await Purchases.logOut();
  queryClient.setQueryData(["revenuecat", "identity"], null);
  queryClient.invalidateQueries({ queryKey: ["revenuecat"] });
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => Purchases.getCustomerInfo(),
    enabled: rcEnabled,
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: () => Purchases.getOfferings(),
    enabled: rcEnabled,
    staleTime: 300 * 1000,
  });

  // Entitlement updates reactivos: el SDK empuja CustomerInfo fresco tras
  // compras, restores, renovaciones y logIn/logOut. Nunca hacer polling.
  useEffect(() => {
    if (!rcEnabled) return;
    const listener = (info: CustomerInfo) =>
      queryClient.setQueryData(["revenuecat", "customer-info"], info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [queryClient]);

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      // Nunca permitir una compra anónima en tiendas reales (regla de identidad).
      // Excepción: Browser Mode/Test Store (preview web), donde purchases-js
      // conserva el appUserId anónimo pese a estar alias-vinculado.
      const browserMode = Platform.OS === "web" && __DEV__;
      const id = (await Purchases.getCustomerInfo()).originalAppUserId;
      if (id.startsWith("$RCAnonymousID:") && !browserMode) throw new Error("identity_not_ready");
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  const originalAppUserId = customerInfoQuery.data?.originalAppUserId;
  // Browser Mode a veces devuelve CustomerInfo anónimo en caché pese a que el
  // SDK ya quedó vinculado: la marca "identity" escrita por bindRevenueCatIdentity
  // es la fuente de verdad para habilitar la compra.
  const identityQuery = useQuery<string | null>({
    queryKey: ["revenuecat", "identity"],
    queryFn: async () => null,
    staleTime: Infinity,
    enabled: rcEnabled,
  });
  const identityReady = !!identityQuery.data || (!!originalAppUserId && !originalAppUserId.startsWith("$RCAnonymousID:"));

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed,
    identityReady,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
