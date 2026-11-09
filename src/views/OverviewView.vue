<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { currentUser, logout } from "../auth";

type HealthState = "loading" | "online" | "offline";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
const router = useRouter();
const healthState = ref<HealthState>("loading");
const healthError = ref("");
let activeRequest: AbortController | undefined;

async function checkApiHealth() {
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  healthState.value = "loading";
  healthError.value = "";

  try {
    const url = new URL("/api/health", apiBaseUrl);
    const response = await fetch(url, { signal: request.signal });

    if (!response.ok) {
      throw new Error(`A API respondeu com o status HTTP ${response.status}.`);
    }

    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("status" in body) ||
      body.status !== "ok"
    ) {
      throw new Error("A API retornou uma resposta de saúde inválida.");
    }

    healthState.value = "online";
  } catch (error) {
    if (request.signal.aborted) return;

    healthState.value = "offline";
    healthError.value =
      error instanceof TypeError
        ? "Não foi possível conectar à API. Verifique se o serviço está ativo."
        : error instanceof Error
          ? error.message
          : "Não foi possível verificar a conexão com a API.";
  }
}

onMounted(checkApiHealth);
onUnmounted(() => activeRequest?.abort());

function logoutAndReturnToLogin() {
  logout();
  void router.replace({ name: "login" });
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/" aria-label="Study Routine — visão geral">
        <span class="brand-mark" aria-hidden="true">
          <span class="material-symbols-rounded">school</span>
        </span>
        <span>Study Routine</span>
      </RouterLink>
      <div class="account-menu">
        <span class="topbar-note">{{ currentUser?.email }}</span>
        <button
          class="text-button"
          type="button"
          @click="logoutAndReturnToLogin"
        >
          Sair
        </button>
      </div>
    </header>

    <main class="main-content">
      <p class="eyebrow">Visão geral</p>
      <h1>Sua rotina de estudos começa aqui.</h1>
      <p class="page-intro">
        Organize disciplinas, acompanhe seu progresso e construa um plano que
        respeita o tempo que você tem.
      </p>

      <section class="health-card" aria-label="Conexão com a API">
        <div class="health-label">
          <span
            class="health-indicator"
            :class="{
              'health-indicator--online': healthState === 'online',
              'health-indicator--offline': healthState === 'offline',
            }"
            aria-hidden="true"
          />
          <span>Conexão com a API</span>
        </div>

        <div class="health-message" aria-live="polite">
          <span v-if="healthState === 'loading'">Verificando conexão...</span>
          <span v-else-if="healthState === 'online'">Serviço disponível</span>
          <template v-else>
            <span class="health-error">{{ healthError }}</span>
            <button class="retry-button" type="button" @click="checkApiHealth">
              <span class="material-symbols-rounded" aria-hidden="true"
                >refresh</span
              >
              Tentar novamente
            </button>
          </template>
        </div>
      </section>

      <div class="content-grid">
        <section class="panel" aria-labelledby="plan-heading">
          <div class="panel-heading">
            <span class="panel-icon" aria-hidden="true">
              <span class="material-symbols-rounded">calendar_month</span>
            </span>
            <div>
              <h2 id="plan-heading">Plano da semana</h2>
              <p class="panel-subtitle">
                Uma visão clara do que vem pela frente.
              </p>
            </div>
          </div>

          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">
              <span class="material-symbols-rounded">event_note</span>
            </span>
            <h3>Seu planejamento aparecerá aqui</h3>
            <p>
              Quando suas disciplinas e disponibilidade estiverem configuradas,
              você poderá organizar os estudos por semana e por dia.
            </p>
          </div>
        </section>

        <section class="panel" aria-labelledby="steps-heading">
          <div class="panel-heading">
            <span class="panel-icon" aria-hidden="true">
              <span class="material-symbols-rounded">flag</span>
            </span>
            <div>
              <h2 id="steps-heading">Por onde começar</h2>
              <p class="panel-subtitle">O caminho para uma rotina possível.</p>
            </div>
          </div>

          <ol class="steps-list">
            <li class="step-item">
              <span class="step-number">1</span>
              <span class="step-copy">
                <strong>Organize o conteúdo</strong>
                <span>Cadastre suas disciplinas e os tópicos de cada uma.</span>
              </span>
            </li>
            <li class="step-item">
              <span class="step-number">2</span>
              <span class="step-copy">
                <strong>Defina sua disponibilidade</strong>
                <span>Escolha os dias e o tempo que pode estudar.</span>
              </span>
            </li>
            <li class="step-item">
              <span class="step-number">3</span>
              <span class="step-copy">
                <strong>Acompanhe seu progresso</strong>
                <span>Registre sessões e mantenha as revisões em dia.</span>
              </span>
            </li>
          </ol>
        </section>
      </div>

      <p class="footer-note">
        Pequenos passos consistentes também são progresso.
      </p>
    </main>
  </div>
</template>
