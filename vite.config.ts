import { createHash } from "node:crypto";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import type { Plugin, ResolvedConfig } from "vite";

function pwaServiceWorker(): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: "study-routine-pwa-service-worker",
    apply: "build",
    configResolved(config) {
      resolvedConfig = config;
    },
    generateBundle(_, bundle) {
      const basePath = new URL(
        resolvedConfig.base,
        "https://study-routine.invalid",
      ).pathname;
      const publicFiles = [
        "manifest.webmanifest",
        "favicon.svg",
        "icon-192.png",
        "icon-512.png",
        "qconcursos-icon.png",
        "brazil-coat-of-arms.svg",
      ];
      const precacheFiles = [
        "index.html",
        ...new Set([
          ...Object.keys(bundle).filter(
            (fileName) =>
              fileName === "index.html" || fileName.startsWith("assets/"),
          ),
          ...publicFiles,
        ]),
      ];
      const version = createHash("sha256")
        .update(precacheFiles.join("\n"))
        .digest("hex")
        .slice(0, 12);
      const namespace = basePath.replace(/[^a-z0-9-]/gi, "-");
      const serviceWorker = `
const CACHE_PREFIX = "study-routine-shell-${namespace}-";
const CACHE_NAME = CACHE_PREFIX + "${version}";
const APP_SHELL_URL = new URL("index.html", self.registration.scope).href;
const PRECACHE_URLS = ${JSON.stringify(precacheFiles)}.map((file) =>
  new URL(file, self.registration.scope).href,
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);

  if (
    request.method !== "GET" ||
    requestUrl.origin !== scopeUrl.origin ||
    !requestUrl.pathname.startsWith(scopeUrl.pathname)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const appShell = await caches.match(APP_SHELL_URL);
        if (appShell) return appShell;
        throw new Error("The offline app shell is not available.");
      }),
    );
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches
        .match(request, { ignoreSearch: true, ignoreVary: true })
        .then((cached) => cached || fetch(request)),
    );
  }
});
`;

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: serviceWorker,
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [vue(), tailwindcss(), pwaServiceWorker()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
