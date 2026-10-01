import { TOKEN_KEY, User } from "@/src/api";
import { storage } from "@/src/utils/storage";

export const USER_KEY = "maestrasred_user";

export async function loadUser(): Promise<User | null> {
  return storage.getItem<User | null>(USER_KEY, null);
}

export async function saveUser(user: User): Promise<void> {
  await storage.setItem(USER_KEY, user);
}

export async function saveSession(token: string, user: User): Promise<void> {
  await storage.secureSet(TOKEN_KEY, token);
  await saveUser(user);
}

export async function clearSession(): Promise<void> {
  await storage.secureRemove(TOKEN_KEY);
  await storage.removeItem(USER_KEY);
}
