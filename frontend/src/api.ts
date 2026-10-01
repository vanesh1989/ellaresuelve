import Constants from "expo-constants";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const baseUrl = `${Constants.expoConfig?.extra?.backendUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? ""}/api`;
export const TOKEN_KEY = "maestrasred_token";

export type User = { id: string; name: string; email: string; plan: "free" | "premium"; photo_url?: string | null; photo_path?: string | null };
export type Provider = { id: string; name: string; category: string; bio: string; rate: number; city: string; commune: string; whatsapp: string; rating: number; reviews_count: number; distance: number; verified: boolean; initials: string; photo_path?: string | null; reviews?: Review[] };
export type Review = { id: string; user_name: string; rating: number; comment: string; created_at: string };
export type ProvidersResult = { providers: Provider[]; limited: boolean };
export type Conversation = { id: string; provider_id: string; provider_name: string; provider_initials: string; display_name: string; display_initials: string; role: "client" | "professional"; provider_photo?: string | null; last_message: string; updated_at: string };
export type Message = { id: string; sender_id: string; text: string; created_at: string };
export type PhotoAsset = { uri: string; fileName?: string | null; mimeType?: string | null };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.detail ?? "No pudimos completar la solicitud") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

export const api = {
  register: (payload: { email: string; password: string; name: string }) => request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) => request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  googleSession: (sessionId: string) => request<{ token: string; user: User }>("/auth/session", { method: "POST", body: JSON.stringify({ session_id: sessionId }) }),
  me: () => request<User>("/auth/me"),
  upgrade: () => request<User>("/users/upgrade", { method: "POST" }),
  setMyPhoto: (path: string) => request<User>("/users/me/photo", { method: "PUT", body: JSON.stringify({ path }) }),
  providers: (params = "") => request<ProvidersResult>(`/providers${params}`),
  provider: (id: string) => request<Provider>(`/providers/${id}`),
  myProviders: () => request<Provider[]>("/providers/mine/list"),
  review: (id: string, payload: { rating: number; comment: string }) => request<Review>(`/providers/${id}/reviews`, { method: "POST", body: JSON.stringify(payload) }),
  createProvider: (payload: Record<string, string | number>) => request<Provider>("/providers", { method: "POST", body: JSON.stringify(payload) }),
  conversations: () => request<Conversation[]>("/conversations"),
  createConversation: (id: string) => request<Conversation>(`/conversations/${id}`, { method: "POST" }),
  messages: (id: string) => request<Message[]>(`/conversations/${id}/messages`),
  sendMessage: (id: string, text: string) => request<Message>(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
  fileUrl: (path: string) => `${baseUrl}/files/${path}`,
  uploadPhoto: async (asset: PhotoAsset): Promise<{ path: string }> => {
    const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
    const form = new FormData();
    const name = asset.fileName ?? "foto.jpg";
    const type = asset.mimeType ?? "image/jpeg";
    if (Platform.OS === "web") {
      const blob = await (await fetch(asset.uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri: asset.uri, name, type } as unknown as Blob);
    }
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail ?? "No pudimos subir la imagen");
    return body as { path: string };
  },
};
