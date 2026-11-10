<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { currentUser } from "../auth";
import { getContent, type Topic } from "../content";
import { registerSession } from "../planning";
import {
  activeStudyTimer,
  focusTimerOpen,
  getTimedStudySession,
  pauseStudyTimer,
  resetStudyTimer,
  resumeStudyTimer,
} from "../study-timer";

const topic = ref<Topic | null>(null);
const errorMessage = ref("");
const successMessage = ref("");
const saving = ref(false);
const timerActive = computed(
  () => currentUser.value !== null && activeStudyTimer.topicId !== null,
);
const timerControlsVisible = computed(
  () => timerActive.value && !focusTimerOpen.value,
);

function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function todayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadTopic(): Promise<void> {
  const topicId = activeStudyTimer.topicId;
  topic.value = null;
  errorMessage.value = "";
  if (!topicId || !currentUser.value) return;

  try {
    const content = await getContent();
    if (activeStudyTimer.topicId !== topicId) return;
    topic.value = content.topics.find((item) => item.id === topicId) ?? null;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar o tópico do cronômetro.";
  }
}

async function finishTimedSession(): Promise<void> {
  if (saving.value) return;
  pauseStudyTimer();
  const timedSession = getTimedStudySession();
  if (!timedSession) return;
  if (timedSession.durationSeconds < 1) {
    errorMessage.value = "Deixe o cronômetro rodar por pelo menos um segundo.";
    return;
  }

  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await registerSession(timedSession.topicId, {
      kind: "study",
      date: todayDateKey(),
      durationSeconds: timedSession.durationSeconds,
    });
    resetStudyTimer();
    focusTimerOpen.value = false;
    successMessage.value = `Sessão de ${formatElapsedTime(
      timedSession.durationSeconds,
    )} registrada.`;
    window.dispatchEvent(new CustomEvent("study-session-updated"));
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Não foi possível salvar a sessão. O tempo foi mantido.";
  } finally {
    saving.value = false;
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && focusTimerOpen.value) {
    focusTimerOpen.value = false;
  }
}

watch(
  [() => activeStudyTimer.topicId, () => currentUser.value?.id],
  ([topicId]) => {
    if (topicId) successMessage.value = "";
    void loadTopic();
  },
  { immediate: true },
);

onMounted(() => window.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <aside
    v-if="timerControlsVisible"
    class="active-study-timer"
    role="region"
    aria-label="Cronômetro de estudo em andamento"
  >
    <RouterLink class="active-study-timer-topic" to="/planning">
      <span class="material-symbols-rounded" aria-hidden="true">timer</span>
      <span class="active-study-timer-topic-copy">
        <strong>{{ topic?.name ?? "Sessão de estudo" }}</strong>
        <small>{{
          activeStudyTimer.isRunning ? "Em andamento" : "Pausado"
        }}</small>
      </span>
      <output
        class="active-study-timer-display"
        aria-live="off"
        :aria-label="`Tempo de estudo: ${formatElapsedTime(activeStudyTimer.elapsedSeconds)}`"
      >
        {{ formatElapsedTime(activeStudyTimer.elapsedSeconds) }}
      </output>
    </RouterLink>
    <div class="active-study-timer-actions">
      <button
        class="icon-action"
        type="button"
        :aria-label="
          activeStudyTimer.isRunning
            ? 'Pausar cronômetro'
            : 'Continuar cronômetro'
        "
        :title="
          activeStudyTimer.isRunning
            ? 'Pausar cronômetro'
            : 'Continuar cronômetro'
        "
        @click="
          activeStudyTimer.isRunning ? pauseStudyTimer() : resumeStudyTimer()
        "
      >
        <span class="material-symbols-rounded" aria-hidden="true">
          {{ activeStudyTimer.isRunning ? "pause" : "play_arrow" }}
        </span>
      </button>
      <button
        class="secondary-button timer-focus-trigger"
        type="button"
        aria-label="Expandir cronômetro"
        @click="focusTimerOpen = true"
      >
        <span class="material-symbols-rounded" aria-hidden="true">
          open_in_full
        </span>
        Expandir
      </button>
      <button
        class="primary-button active-study-timer-finish"
        type="button"
        :disabled="saving"
        @click="finishTimedSession"
      >
        Finalizar
      </button>
    </div>
    <p v-if="errorMessage" class="active-study-timer-message" role="alert">
      {{ errorMessage }}
    </p>
  </aside>
  <p
    v-else-if="successMessage && currentUser"
    class="active-study-timer-success"
    role="status"
  >
    {{ successMessage }}
  </p>

  <Transition name="timer-focus">
    <section
      v-if="focusTimerOpen && timerActive"
      class="timer-focus-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="timer-focus-heading"
    >
      <div class="timer-focus-card">
        <button
          class="icon-action timer-focus-close"
          type="button"
          aria-label="Fechar tela cheia"
          title="Fechar tela cheia"
          autofocus
          @click="focusTimerOpen = false"
        >
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
        <div class="timer-focus-orbit" aria-hidden="true">
          <div class="timer-focus-orbit-track"></div>
          <div class="timer-focus-orbit-inner">
            <span class="material-symbols-rounded">timer</span>
          </div>
        </div>
        <p class="eyebrow">
          {{ topic ? `Sessão · ${topic.name}` : "Sessão de estudo" }}
        </p>
        <h2 id="timer-focus-heading">
          {{
            activeStudyTimer.isRunning
              ? "Cronômetro em andamento"
              : "Cronômetro pausado"
          }}
        </h2>
        <output
          class="timer-focus-display"
          aria-live="off"
          :aria-label="`Tempo de estudo: ${formatElapsedTime(activeStudyTimer.elapsedSeconds)}`"
        >
          {{ formatElapsedTime(activeStudyTimer.elapsedSeconds) }}
        </output>
        <p v-if="errorMessage" class="active-study-timer-message" role="alert">
          {{ errorMessage }}
        </p>
        <div class="timer-focus-controls">
          <button
            class="timer-focus-icon-button"
            type="button"
            :aria-label="
              activeStudyTimer.isRunning
                ? 'Pausar cronômetro'
                : 'Continuar cronômetro'
            "
            @click="
              activeStudyTimer.isRunning
                ? pauseStudyTimer()
                : resumeStudyTimer()
            "
          >
            <span class="material-symbols-rounded" aria-hidden="true">
              {{ activeStudyTimer.isRunning ? "pause" : "play_arrow" }}
            </span>
          </button>
          <button
            class="timer-focus-icon-button timer-focus-finish"
            type="button"
            aria-label="Finalizar sessão"
            :disabled="saving"
            @click="finishTimedSession"
          >
            <span class="material-symbols-rounded" aria-hidden="true">
              {{ saving ? "hourglass_top" : "stop" }}
            </span>
          </button>
        </div>
        <p class="timer-focus-hint">Pressione Esc para sair</p>
      </div>
    </section>
  </Transition>
</template>
