<template>
  <div class="app-runtime">
    <div
      v-if="!isOnline || pwaMessage || canInstall"
      class="app-runtime-banner"
      :class="{ 'app-runtime-banner--offline': !isOnline }"
      role="status"
      aria-live="polite"
    >
      <p v-if="!isOnline">
        Você está offline. O aplicativo pode abrir, mas login, leitura e
        gravação de dados precisam de conexão. Nenhum dado pessoal é salvo para
        uso offline.
      </p>
      <p v-else-if="pwaMessage">{{ pwaMessage }}</p>
      <p v-else-if="isInstalled">Study Routine instalado neste dispositivo.</p>
      <p v-else>
        Instale o Study Routine para abrir o aplicativo pela tela inicial.
      </p>
      <button
        v-if="canInstall"
        class="app-install-button"
        type="button"
        @click="installApp"
      >
        Instalar
      </button>
    </div>
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { RouterView } from "vue-router";
import {
  canInstall,
  initializePwa,
  installApp,
  isInstalled,
  isOnline,
  pwaMessage,
} from "./pwa";

let cleanupPwa = () => {};

onMounted(() => {
  cleanupPwa = initializePwa();
});

onUnmounted(() => cleanupPwa());
</script>
