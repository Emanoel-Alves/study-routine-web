import { ref } from "vue";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const isOnline = ref(
  typeof navigator === "undefined" ? true : navigator.onLine,
);
export const canInstall = ref(false);
export const isInstalled = ref(false);
export const pwaMessage = ref("");

let installPrompt: BeforeInstallPromptEvent | null = null;

function updateOnlineState() {
  isOnline.value = navigator.onLine;
}

function handleInstallPrompt(event: Event) {
  event.preventDefault();
  installPrompt = event as BeforeInstallPromptEvent;
  canInstall.value = true;
}

function handleInstalled() {
  installPrompt = null;
  canInstall.value = false;
  isInstalled.value = true;
}

export function initializePwa(): () => void {
  if (typeof window === "undefined") return () => {};

  updateOnlineState();
  isInstalled.value =
    (window.matchMedia?.("(display-mode: standalone)").matches ?? false) ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
  window.addEventListener("beforeinstallprompt", handleInstallPrompt);
  window.addEventListener("appinstalled", handleInstalled);

  if (import.meta.env.PROD) {
    if (!("serviceWorker" in navigator)) {
      pwaMessage.value =
        "Este navegador não oferece suporte para abertura offline.";
    } else {
      const appBaseUrl = new URL(
        import.meta.env.BASE_URL,
        window.location.origin,
      );
      const workerUrl = new URL("sw.js", appBaseUrl);
      void navigator.serviceWorker
        .register(workerUrl, { scope: appBaseUrl.pathname })
        .catch(() => {
          pwaMessage.value =
            "Não foi possível habilitar a abertura offline neste navegador.";
        });
    }
  }

  return () => {
    window.removeEventListener("online", updateOnlineState);
    window.removeEventListener("offline", updateOnlineState);
    window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    window.removeEventListener("appinstalled", handleInstalled);
  };
}

export async function installApp(): Promise<void> {
  if (!installPrompt) return;

  const prompt = installPrompt;
  installPrompt = null;
  canInstall.value = false;

  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") isInstalled.value = true;
  } catch {
    pwaMessage.value =
      "A instalação não foi concluída. Tente novamente pelo menu do navegador.";
  }
}
