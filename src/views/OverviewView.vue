<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { currentUser, logout } from "../auth";
import { getContent, type ContentSnapshot, type Topic } from "../content";
import { getPlanning, type PlanningSnapshot } from "../planning";

type HealthState = "loading" | "online" | "offline";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
const router = useRouter();
const healthState = ref<HealthState>("loading");
const healthError = ref("");
const content = ref<ContentSnapshot | null>(null);
const planning = ref<PlanningSnapshot | null>(null);
const overviewLoading = ref(true);
const overviewError = ref("");
let activeRequest: AbortController | undefined;

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = dateKey(new Date());
const activeTopics = computed(() => {
  if (!content.value) return [];
  const activeSubjectIds = new Set(
    content.value.subjects
      .filter((subject) => !subject.archived)
      .map((subject) => subject.id),
  );
  return content.value.topics.filter((topic) =>
    activeSubjectIds.has(topic.subjectId),
  );
});
const completedTopics = computed(
  () => activeTopics.value.filter((topic) => topic.status === "studied").length,
);
const overallProgress = computed(() =>
  activeTopics.value.length === 0
    ? 0
    : Math.round((completedTopics.value / activeTopics.value.length) * 100),
);
const reviewTopics = computed(() =>
  activeTopics.value
    .filter(
      (topic) =>
        topic.status === "review_pending" ||
        (topic.status === "studied" &&
          topic.reviewDueAt !== null &&
          topic.reviewDueAt.slice(0, 10) <= today),
    )
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR")),
);
const plannedDays = computed(
  () =>
    planning.value?.plan.days.filter(
      (day) => day.date >= today && day.topics.length > 0,
    ) ?? [],
);
const plannedTopicCount = computed(
  () =>
    planning.value?.plan.days.reduce(
      (total, day) => total + day.topics.length,
      0,
    ) ?? 0,
);

async function loadOverview(): Promise<void> {
  overviewLoading.value = true;
  overviewError.value = "";
  try {
    const [contentResult, planningResult] = await Promise.all([
      getContent(),
      getPlanning(),
    ]);
    content.value = contentResult;
    planning.value = planningResult;
  } catch (error) {
    overviewError.value =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar o resumo semanal.";
  } finally {
    overviewLoading.value = false;
  }
}

function subjectName(topic: Topic): string {
  return (
    content.value?.subjects.find((subject) => subject.id === topic.subjectId)
      ?.name ?? "Disciplina"
  );
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

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

onMounted(() => {
  void checkApiHealth();
  void loadOverview();
});
onUnmounted(() => activeRequest?.abort());

async function logoutAndReturnToLogin() {
  try {
    await logout();
  } catch (error) {
    console.error("Não foi possível encerrar a sessão no servidor.", error);
  }
  await router.replace({ name: "login" });
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
      <nav class="content-navigation" aria-label="Navegação principal">
        <RouterLink to="/">Visão geral</RouterLink>
        <RouterLink to="/content">Conteúdo</RouterLink>
        <RouterLink to="/planning">Planejamento</RouterLink>
      </nav>
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
      <div class="overview-actions">
        <RouterLink class="primary-button overview-action" to="/content">
          Organizar conteúdo
        </RouterLink>
        <RouterLink class="secondary-button overview-action" to="/planning">
          Ver planejamento
        </RouterLink>
      </div>

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

          <div v-if="overviewLoading" class="overview-loading" role="status">
            Carregando seu resumo semanal...
          </div>

          <div v-else-if="overviewError" class="overview-plan-empty">
            <p class="content-alert content-alert--error" role="alert">
              {{ overviewError }}
            </p>
            <button
              class="secondary-button"
              type="button"
              @click="loadOverview"
            >
              Tentar novamente
            </button>
          </div>

          <div v-else-if="activeTopics.length === 0" class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">
              <span class="material-symbols-rounded">event_note</span>
            </span>
            <h3>Adicione tópicos ao seu plano</h3>
            <p>
              Cadastre disciplinas e tópicos para ver o resumo semanal aqui.
            </p>
            <RouterLink class="primary-button" to="/content">
              Organizar conteúdo
            </RouterLink>
          </div>

          <div v-else-if="planning" class="overview-weekly-plan">
            <div class="overview-plan-stats">
              <span>
                Semana de {{ formatDate(planning.plan.weekStart) }} a
                {{ formatDate(planning.plan.weekEnd) }}
              </span>
              <strong
                >{{
                  formatTime(planning.plan.plannedMinutes)
                }}
                planejados</strong
              >
              <span>
                {{ plannedTopicCount }} tópico(s) ·
                {{ planning.plan.weeklySessionCount }} sessão(ões) registrada(s)
              </span>
            </div>

            <div class="overview-progress">
              <div>
                <span>Progresso geral</span>
                <strong>
                  {{ completedTopics }}/{{ activeTopics.length }} tópicos ·
                  {{ overallProgress }}%
                </strong>
              </div>
              <progress max="100" :value="overallProgress">
                {{ overallProgress }}%
              </progress>
            </div>

            <ul v-if="plannedDays.length" class="overview-day-list">
              <li v-for="day in plannedDays.slice(0, 3)" :key="day.date">
                <div class="overview-day-heading">
                  <strong>{{ formatDate(day.date) }}</strong>
                  <span>{{ formatTime(day.plannedMinutes) }}</span>
                </div>
                <ul>
                  <li
                    v-for="topic in day.topics.slice(0, 2)"
                    :key="topic.topicId"
                  >
                    <span>{{ topic.topicName }}</span>
                    <small>{{ topic.subjectName }}</small>
                  </li>
                </ul>
                <small v-if="day.topics.length > 2" class="overview-more">
                  + {{ day.topics.length - 2 }} tópico(s)
                </small>
              </li>
            </ul>
            <p v-else class="overview-plan-note">
              Nenhum tópico foi distribuído para os próximos dias desta semana.
              <template v-if="planning.plan.unscheduledTopics.length">
                {{ planning.plan.unscheduledTopics.length }} tópico(s) ficaram
                para as próximas semanas por falta de capacidade.
              </template>
              Configure sua disponibilidade para ajustar o plano.
            </p>

            <section
              v-if="reviewTopics.length"
              class="overview-reviews"
              aria-labelledby="overview-reviews-heading"
            >
              <h3 id="overview-reviews-heading">
                Revisões pendentes ({{ reviewTopics.length }})
              </h3>
              <ul>
                <li v-for="topic in reviewTopics.slice(0, 3)" :key="topic.id">
                  <span>{{ topic.name }}</span>
                  <small>{{ subjectName(topic) }}</small>
                </li>
              </ul>
            </section>

            <p v-else class="overview-plan-note">Nenhuma revisão pendente.</p>
            <RouterLink class="text-button overview-plan-link" to="/planning">
              Abrir planejamento semanal
            </RouterLink>
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
