import Constants from "expo-constants";

import { storage } from "@/src/utils/storage";

const baseUrl = `${Constants.expoConfig?.extra?.backendUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? ""}/api`;
export const TOKEN_KEY = "maestrasred_token";

export type User = { id: string; name: string; email: string; plan: "free" | "premium" };
export type Provider = { id: string; name: string; category: string; bio: string; rate: number; city: string; commune: string; whatsapp: string; rating: number; reviews_count: number; distance: number; verified: boolean; initials: string; reviews?: Review[] };
export type Review = { id: string; user_name: string; rating: number; comment: string; created_at: string };
export type ProvidersResult = { providers: Provider[]; limited: boolean };
export type Conversation = { id: string; provider_id: string; provider_name: string; provider_initials: string; last_message: string; updated_at: string };
export type Message = { id: string; sender_id: string; text: string; created_at: string };

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
  if (!response.ok) throw new Error(body.detail ?? "No pudimos completar la solicitud");
  return body as T;
}

export const api = {
  register: (payload: { email: string; password: string; name: string }) => request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) => request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<User>("/auth/me"),
  upgrade: () => request<User>("/users/upgrade", { method: "POST" }),
  providers: (params = "") => request<ProvidersResult>(`/providers${params}`),
  provider: (id: string) => request<Provider>(`/providers/${id}`),
  review: (id: string, payload: { rating: number; comment: string }) => request<Review>(`/providers/${id}/reviews`, { method: "POST", body: JSON.stringify(payload) }),
  createProvider: (payload: Record<string, string | number>) => request<Provider>("/providers", { method: "POST", body: JSON.stringify(payload) }),
  conversations: () => request<Conversation[]>("/conversations"),
  createConversation: (id: string) => request<Conversation>(`/conversations/${id}`, { method: "POST" }),
  messages: (id: string) => request<Message[]>(`/conversations/${id}/messages`),
  sendMessage: (id: string, text: string) => request<Message>(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
};
