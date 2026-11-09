import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canInstall,
  initializePwa,
  installApp,
  isInstalled,
  isOnline,
  pwaMessage,
} from "./pwa";

describe("PWA runtime", () => {
  afterEach(() => {
    canInstall.value = false;
    isInstalled.value = false;
    isOnline.value = true;
    pwaMessage.value = "";
  });

  it("reports connectivity changes and removes listeners on cleanup", () => {
    const onlineDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "onLine",
    );
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    const cleanup = initializePwa();

    try {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
      expect(isOnline.value).toBe(false);

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
      expect(isOnline.value).toBe(true);

      cleanup();
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
      expect(isOnline.value).toBe(true);
    } finally {
      cleanup();
      if (onlineDescriptor) {
        Object.defineProperty(navigator, "onLine", onlineDescriptor);
      } else {
        Reflect.deleteProperty(navigator, "onLine");
      }
    }
  });

  it("offers and handles installation when the browser supports it", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: prompt },
      userChoice: {
        value: Promise.resolve({ outcome: "accepted", platform: "web" }),
      },
    });
    const cleanup = initializePwa();

    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(canInstall.value).toBe(true);

    await installApp();
    expect(prompt).toHaveBeenCalledOnce();
    expect(canInstall.value).toBe(false);
    expect(isInstalled.value).toBe(true);
    cleanup();
  });
});
