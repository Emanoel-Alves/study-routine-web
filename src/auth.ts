import { ref } from "vue";
import { resetStudyTimer } from "./study-timer";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
const accessToken = ref<string | null>(null);
export const currentUser = ref<AuthenticatedUser | null>(null);
let hasPersistentSession = false;

function apiUrl(path: string): URL {
  return new URL(path, apiBaseUrl);
}

async function getErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

async function authenticate(
  path: string,
  payload: Record<string, string>,
): Promise<void> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));

  const result = (await response.json()) as AuthResponse;
  accessToken.value = result.accessToken;
  currentUser.value = result.user;
  hasPersistentSession = true;
}

export function login(email: string, password: string): Promise<void> {
  return authenticate("/api/auth/login", { email, password });
}

export function register(
  email: string,
  password: string,
  inviteCode: string,
): Promise<void> {
  return authenticate("/api/auth/register", { email, password, inviteCode });
}

export async function logout(): Promise<void> {
  const shouldEndServerSession = hasPersistentSession;
  hasPersistentSession = false;
  accessToken.value = null;
  currentUser.value = null;
  resetStudyTimer();

  if (!shouldEndServerSession) return;

  const response = await fetch(apiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));
}

export async function requestApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken.value) {
    headers.set("authorization", `Bearer ${accessToken.value}`);
  }
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return (await response.json()) as T;
}

export async function restoreSession(): Promise<boolean> {
  if (currentUser.value) return true;

  try {
    const response = await fetch(apiUrl("/api/auth/session"), {
      method: "POST",
      credentials: "include",
    });
    if (response.status === 401) {
      accessToken.value = null;
      currentUser.value = null;
      hasPersistentSession = false;
      return false;
    }
    if (!response.ok) throw new Error(await getErrorMessage(response));

    const result = (await response.json()) as AuthResponse;
    accessToken.value = result.accessToken;
    currentUser.value = result.user;
    hasPersistentSession = true;
    return true;
  } catch (error) {
    accessToken.value = null;
    currentUser.value = null;
    hasPersistentSession = false;
    console.error("Não foi possível restaurar a sessão.", error);
    return false;
  }
}
