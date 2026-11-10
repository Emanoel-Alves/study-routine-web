<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { RouterLink, useRouter } from "vue-router";
import { currentUser, logout } from "../auth";
import AppSelect from "../components/AppSelect.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { requestConfirmation } from "../confirm-dialog";
import { getContent, type ContentSnapshot, type Topic } from "../content";
import {
  activateStudyPlan,
  createStudyPlan,
  deleteStudyPlan,
  deleteStudySession,
  deleteStudySessions,
  getPlanning,
  movePlannedTopic,
  registerSession,
  resetPlannedTopic,
  savePreferences,
  saveSelectedTopics,
  type PlanningSnapshot,
  type StudyPreferences,
  type StudySession,
} from "../planning";
import { getQuestions, type StudyQuestion } from "../questions";
import {
  activeStudyTimer,
  focusTimerOpen,
  getTimedStudySession,
  pauseStudyTimer,
  resetStudyTimer,
  resumeStudyTimer,
  startStudyTimer,
} from "../study-timer";

const router = useRouter();
const emptyContent: ContentSnapshot = {
  subjects: [],
  topics: [],
  materials: [],
};
const emptyPlanning: PlanningSnapshot = {
  preferences: {
    studyDays: [0, 1, 2, 3, 4],
    minutesPerDay: 60,
    targetDate: null,
  },
  plan: {
    weekStart: "",
    weekEnd: "",
    days: [],
    unscheduledTopics: [],
    totalAvailableMinutes: 0,
    plannedMinutes: 0,
    workloadMinutes: 0,
    weeklyStudiedMinutes: 0,
    weeklySessionCount: 0,
    deadline: null,
  },
  plans: [],
  activePlan: { id: "", name: "", selectedTopicIds: null },
  sessions: [],
};
const content = ref<ContentSnapshot>(emptyContent);
const questions = ref<StudyQuestion[]>([]);
const planning = ref<PlanningSnapshot>(emptyPlanning);
const activeQuestionTopicIds = computed(
  () =>
    new Set(
      questions.value
        .filter((question) => question.status === "active")
        .map((question) => question.topicId),
    ),
);
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const selectedPlanId = ref("");
const selectedTopicIdsDraft = ref<string[]>([]);
const selectedSessionIds = ref<string[]>([]);
const planFormOpen = ref(false);
const topicEditorOpen = ref(false);
const planNameDraft = ref("");
const timedTopicId = computed(() => activeStudyTimer.topicId);
const preferencesDraft = reactive<StudyPreferences>({
  studyDays: [0, 1, 2, 3, 4],
  minutesPerDay: 60,
  targetDate: null,
});
const sessionDrafts = reactive<
  Record<string, { durationMinutes: number; notes: string }>
>({});

const dayLabels = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];
const today = new Date().toISOString().slice(0, 10);
const targetDatePickerOpen = ref(false);
const targetDatePickerMonth = ref(parseDateKey(today));

const activeTopics = computed(() => {
  const activeSubjectIds = new Set(
    content.value.subjects
      .filter((subject) => !subject.archived)
      .map((subject) => subject.id),
  );
  return content.value.topics.filter((topic) =>
    activeSubjectIds.has(topic.subjectId),
  );
});
const selectionSubjects = computed(() =>
  content.value.subjects
    .filter((subject) => !subject.archived)
    .map((subject) => ({
      ...subject,
      topics: activeTopics.value
        .filter((topic) => topic.subjectId === subject.id)
        .sort((first, second) => first.position - second.position),
    }))
    .filter((subject) => subject.topics.length > 0),
);
const activePlanTopics = computed(() => {
  const selectedTopicIds = planning.value.activePlan.selectedTopicIds;
  if (selectedTopicIds === null) return activeTopics.value;
  const selectedIds = new Set(selectedTopicIds);
  return activeTopics.value.filter((topic) => selectedIds.has(topic.id));
});
const selectedTopicCount = computed(() => selectedTopicIdsDraft.value.length);
const totalSelectableTopics = computed(() =>
  selectionSubjects.value.reduce(
    (total, subject) => total + subject.topics.length,
    0,
  ),
);
const hasUnsavedTopicSelection = computed(() => {
  const saved = planning.value.activePlan.selectedTopicIds ?? null;
  const activeTopicIds = new Set(activeTopics.value.map((topic) => topic.id));
  const savedIds =
    saved === null
      ? [...activeTopicIds]
      : saved.filter((topicId) => activeTopicIds.has(topicId));
  return (
    JSON.stringify([...selectedTopicIdsDraft.value].sort()) !==
    JSON.stringify(savedIds.sort())
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
const emptyStudyDays = computed(() => preferencesDraft.studyDays.length === 0);
const activeTimerTopicVisible = computed(() => {
  const topicId = activeStudyTimer.topicId;
  return (
    topicId !== null &&
    planning.value.plan.days.some(
      (day) =>
        day.date >= today &&
        day.topics.some((topic) => topic.topicId === topicId),
    )
  );
});
const hasUnsavedPreferences = computed(
  () =>
    JSON.stringify({
      ...preferencesDraft,
      studyDays: [...preferencesDraft.studyDays].sort((a, b) => a - b),
    }) !==
    JSON.stringify({
      ...planning.value.preferences,
      studyDays: [...planning.value.preferences.studyDays].sort(
        (a, b) => a - b,
      ),
    }),
);
const datePickerMonthLabel = computed(() =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(targetDatePickerMonth.value),
);
const datePickerDays = computed(() => {
  const firstOfMonth = new Date(
    targetDatePickerMonth.value.getFullYear(),
    targetDatePickerMonth.value.getMonth(),
    1,
  );
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      firstOfMonth.getFullYear(),
      firstOfMonth.getMonth(),
      index - mondayOffset + 1,
    );
    const value = dateKey(date);
    return {
      value,
      day: date.getDate(),
      inMonth: date.getMonth() === firstOfMonth.getMonth(),
      isToday: value === today,
      isSelected: value === preferencesDraft.targetDate,
      disabled: value < today,
    };
  });
});
const previousMonthDisabled = computed(() => {
  const currentMonth = parseDateKey(today);
  return (
    targetDatePickerMonth.value.getFullYear() === currentMonth.getFullYear() &&
    targetDatePickerMonth.value.getMonth() <= currentMonth.getMonth()
  );
});
const summaryBySubject = computed(() => {
  return content.value.subjects
    .filter((subject) => !subject.archived)
    .map((subject) => {
      const topics = activePlanTopics.value.filter(
        (topic) => topic.subjectId === subject.id,
      );
      const completed = topics.filter(
        (topic) => topic.status === "studied",
      ).length;
      return {
        id: subject.id,
        name: subject.name,
        total: topics.length,
        completed,
        progress:
          topics.length === 0
            ? 0
            : Math.round((completed / topics.length) * 100),
      };
    })
    .filter((subject) => subject.total > 0);
});

function subjectName(topic: Topic): string {
  return (
    content.value.subjects.find((subject) => subject.id === topic.subjectId)
      ?.name ?? "Disciplina"
  );
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day);
}

function openTargetDatePicker(): void {
  if (!targetDatePickerOpen.value) {
    targetDatePickerMonth.value = parseDateKey(
      preferencesDraft.targetDate ?? today,
    );
  }
  targetDatePickerOpen.value = !targetDatePickerOpen.value;
}

function changeTargetDateMonth(amount: -1 | 1): void {
  targetDatePickerMonth.value = new Date(
    targetDatePickerMonth.value.getFullYear(),
    targetDatePickerMonth.value.getMonth() + amount,
    1,
  );
}

function selectTargetDate(value: string): void {
  if (value < today) return;
  preferencesDraft.targetDate = value;
  targetDatePickerOpen.value = false;
}

function clearTargetDate(): void {
  preferencesDraft.targetDate = null;
  targetDatePickerOpen.value = false;
}

function getTopic(topicId: string): Topic | undefined {
  return content.value.topics.find((topic) => topic.id === topicId);
}

function hasActiveQuestions(topicId: string): boolean {
  return activeQuestionTopicIds.value.has(topicId);
}

function qconcursosTopicUrl(topicName: string): string {
  const url = new URL("https://www.qconcursos.com/nova-busca");
  url.searchParams.set("q", topicName);
  return url.toString();
}

function draftFor(topic: Topic) {
  if (!sessionDrafts[topic.id]) {
    sessionDrafts[topic.id] = {
      durationMinutes: topic.estimatedMinutes ?? 45,
      notes: "",
    };
  }
  return sessionDrafts[topic.id]!;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function formatSessionDuration(
  session: Pick<StudySession, "durationMinutes" | "durationSeconds">,
): string {
  if (session.durationSeconds === undefined) {
    return formatTime(session.durationMinutes);
  }
  const minutes = Math.floor(session.durationSeconds / 60);
  const seconds = session.durationSeconds % 60;
  if (minutes === 0) return `${seconds} s`;
  if (seconds === 0) return formatTime(minutes);
  return `${formatTime(minutes)} ${seconds} s`;
}

function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const clock = [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  return clock;
}

function statusLabel(status: Topic["status"]): string {
  const labels = {
    not_started: "Não iniciado",
    in_progress: "Em andamento",
    studied: "Estudado",
    review_pending: "Revisão pendente",
  };
  return labels[status];
}

function toggleSubjectTopics(subjectId: string, event: Event): void {
  const subject = selectionSubjects.value.find((item) => item.id === subjectId);
  if (!subject) return;
  const checked = (event.target as HTMLInputElement).checked;
  const topicIds = new Set(selectedTopicIdsDraft.value);
  for (const topic of subject.topics) {
    if (checked) topicIds.add(topic.id);
    else topicIds.delete(topic.id);
  }
  selectedTopicIdsDraft.value = [...topicIds];
}

function resetTopicSelectionDraft(): void {
  const activeTopicIds = new Set(activeTopics.value.map((topic) => topic.id));
  const saved = planning.value.activePlan.selectedTopicIds ?? null;
  selectedTopicIdsDraft.value =
    saved === null
      ? [...activeTopicIds]
      : saved.filter((topicId) => activeTopicIds.has(topicId));
}

function openCreatePlan(): void {
  planNameDraft.value = "";
  selectedTopicIdsDraft.value = [];
  topicEditorOpen.value = false;
  planFormOpen.value = true;
}

function cancelCreatePlan(): void {
  planFormOpen.value = false;
  planNameDraft.value = "";
  resetTopicSelectionDraft();
}

function editTopicSelection(): void {
  resetTopicSelectionDraft();
  topicEditorOpen.value = true;
}

function cancelTopicSelectionEdit(): void {
  resetTopicSelectionDraft();
  topicEditorOpen.value = false;
}

async function loadPlanning(): Promise<boolean> {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [planningResult, contentResult, questionResult] = await Promise.all([
      getPlanning(),
      getContent(),
      getQuestions(),
    ]);
    planning.value = planningResult;
    content.value = contentResult;
    questions.value = questionResult;
    selectedPlanId.value = planningResult.activePlan.id;
    resetTopicSelectionDraft();
    preferencesDraft.studyDays = [...planningResult.preferences.studyDays];
    preferencesDraft.minutesPerDay = planningResult.preferences.minutesPerDay;
    preferencesDraft.targetDate = planningResult.preferences.targetDate;
    return true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar o planejamento.";
    return false;
  } finally {
    loading.value = false;
  }
}

async function createPlan(): Promise<void> {
  const name = planNameDraft.value.trim();
  if (!name) {
    errorMessage.value = "Informe um nome para o planejamento.";
    return;
  }
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await createStudyPlan(name, [...selectedTopicIdsDraft.value].sort());
    planNameDraft.value = "";
    planFormOpen.value = false;
    topicEditorOpen.value = false;
    if (!(await loadPlanning())) return;
    successMessage.value = `Planejamento "${name}" criado e selecionado.`;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Não foi possível criar o planejamento.";
  } finally {
    saving.value = false;
  }
}

async function changeActivePlan(): Promise<void> {
  if (
    !selectedPlanId.value ||
    selectedPlanId.value === planning.value.activePlan.id
  ) {
    return;
  }
  const planId = selectedPlanId.value;
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await activateStudyPlan(planId);
    if (!(await loadPlanning())) return;
    successMessage.value = `Planejamento "${planning.value.activePlan.name}" selecionado.`;
  } catch (error) {
    selectedPlanId.value = planning.value.activePlan.id;
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Não foi possível trocar de planejamento.";
  } finally {
    saving.value = false;
  }
}

async function removeActivePlan(): Promise<void> {
  const plan = planning.value.activePlan;
  if (plan.id === "default" || planning.value.plans.length <= 1) return;
  const confirmed = await requestConfirmation({
    title: "Apagar planejamento?",
    message: `Apagar o planejamento "${plan.name}"? A disponibilidade e os ajustes semanais deste plano serão removidos. O progresso e o histórico de sessões continuarão salvos.`,
    confirmLabel: "Apagar planejamento",
    danger: true,
  });
  if (!confirmed) return;
  await runAction(
    () => deleteStudyPlan(plan.id),
    `Planejamento "${plan.name}" apagado.`,
  );
}

async function removeStudySession(session: StudySession): Promise<void> {
  const confirmed = await requestConfirmation({
    title: "Apagar sessão?",
    message: `Apagar a sessão de ${sessionTopicName(session)} registrada em ${formatDate(session.date)}?`,
    confirmLabel: "Apagar sessão",
    danger: true,
  });
  if (!confirmed) return;
  await runAction(
    () => deleteStudySession(session.id),
    "Sessão apagada do histórico deste planejamento.",
  );
}

async function removeSelectedSessions(): Promise<void> {
  const sessionIds = selectedSessionIds.value.filter((id) =>
    planning.value.sessions.some((session) => session.id === id),
  );
  if (sessionIds.length === 0) return;
  const confirmed = await requestConfirmation({
    title: "Apagar sessões selecionadas?",
    message: `Apagar ${sessionIds.length} sessão(ões) selecionada(s) desta semana deste planejamento?`,
    confirmLabel: "Apagar selecionadas",
    danger: true,
  });
  if (!confirmed) return;
  await runAction(
    () => deleteStudySessions({ sessionIds }),
    `${sessionIds.length} sessão(ões) apagada(s) deste planejamento.`,
  );
  if (!errorMessage.value) selectedSessionIds.value = [];
}

async function removeAllWeeklySessions(): Promise<void> {
  const count = planning.value.sessions.length;
  if (count === 0) return;
  const confirmed = await requestConfirmation({
    title: "Apagar todas as sessões da semana?",
    message: `Apagar todas as ${count} sessões desta semana do planejamento "${planning.value.activePlan.name}"? Esta ação não pode ser desfeita.`,
    confirmLabel: "Apagar todas",
    danger: true,
  });
  if (!confirmed) return;
  await runAction(
    () => deleteStudySessions({ all: true }),
    "Todas as sessões desta semana foram apagadas deste planejamento.",
  );
  if (!errorMessage.value) selectedSessionIds.value = [];
}

async function runAction(action: () => Promise<unknown>, success: string) {
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await action();
    if (!(await loadPlanning())) return;
    successMessage.value = success;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Não foi possível salvar a alteração.";
  } finally {
    saving.value = false;
  }
}

async function saveStudyPreferences() {
  if (
    !Number.isInteger(preferencesDraft.minutesPerDay) ||
    preferencesDraft.minutesPerDay < 15 ||
    preferencesDraft.minutesPerDay > 480
  ) {
    errorMessage.value = "Informe entre 15 e 480 minutos disponíveis por dia.";
    return;
  }
  if (preferencesDraft.targetDate && preferencesDraft.targetDate < today) {
    errorMessage.value = "A data-alvo não pode estar no passado.";
    return;
  }
  await runAction(
    () =>
      savePreferences({
        studyDays: [...preferencesDraft.studyDays].sort((a, b) => a - b),
        minutesPerDay: preferencesDraft.minutesPerDay,
        targetDate: preferencesDraft.targetDate || null,
      }),
    "Disponibilidade salva e planejamento recalculado.",
  );
}

async function saveTopicSelection() {
  await runAction(
    () => saveSelectedTopics([...selectedTopicIdsDraft.value].sort()),
    "Conteúdo do planejamento salvo e semana recalculada.",
  );
  if (!errorMessage.value) topicEditorOpen.value = false;
}

async function moveTopic(topicId: string, plannedDate: string) {
  if (!plannedDate) return;
  await runAction(
    () => movePlannedTopic(topicId, plannedDate),
    "Tópico movido. Confira a capacidade do dia.",
  );
}

async function resetTopic(topicId: string) {
  await runAction(
    () => resetPlannedTopic(topicId),
    "Ajuste removido; o tópico voltou à distribuição automática.",
  );
}

async function recordStudySession(topic: Topic, kind: "study" | "review") {
  if (timedTopicId.value !== null) {
    errorMessage.value =
      "Finalize o cronômetro atual antes de registrar outra sessão.";
    return;
  }

  const draft = draftFor(topic);
  if (
    !Number.isInteger(draft.durationMinutes) ||
    draft.durationMinutes < 1 ||
    draft.durationMinutes > 720
  ) {
    errorMessage.value = "A duração precisa estar entre 1 e 720 minutos.";
    return;
  }
  await runAction(
    () =>
      registerSession(topic.id, {
        kind,
        date: today,
        durationMinutes: draft.durationMinutes,
        notes: draft.notes.trim(),
      }),
    kind === "review"
      ? "Revisão registrada; novo lembrete em 7 dias."
      : "Sessão registrada e progresso atualizado.",
  );
}

function beginTimedSession(topicId: string) {
  errorMessage.value = "";
  successMessage.value = "";
  try {
    startStudyTimer(topicId);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Não foi possível iniciar o cronômetro.";
  }
}

function handleFocusTimerKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && focusTimerOpen.value)
    focusTimerOpen.value = false;
}

async function finishTimedSession() {
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
      date: today,
      durationSeconds: timedSession.durationSeconds,
    });
    resetStudyTimer();
    successMessage.value = `Sessão de ${formatSessionDuration({
      durationMinutes: timedSession.durationMinutes,
      durationSeconds: timedSession.durationSeconds,
    })} registrada.`;
    await loadPlanning();
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Não foi possível salvar a sessão cronometrada. O tempo foi mantido.";
  } finally {
    saving.value = false;
  }
}

async function logoutAndReturnToLogin() {
  try {
    await logout();
  } catch (error) {
    console.error("Não foi possível encerrar a sessão no servidor.", error);
  }
  await router.replace({ name: "login" });
}

function sessionTopicName(session: StudySession): string {
  return getTopic(session.topicId)?.name ?? "Tópico removido";
}

watch(timedTopicId, (topicId) => {
  if (topicId === null) focusTimerOpen.value = false;
});

onMounted(() => {
  window.addEventListener("keydown", handleFocusTimerKeydown);
  window.addEventListener("study-session-updated", handleStudySessionUpdated);
  void loadPlanning();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleFocusTimerKeydown);
  window.removeEventListener(
    "study-session-updated",
    handleStudySessionUpdated,
  );
});

function handleStudySessionUpdated(): void {
  void loadPlanning();
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
        <RouterLink to="/questions">Questões</RouterLink>
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
      <h1>Um plano que cabe na sua semana.</h1>
      <p class="page-intro">
        Defina seus dias e tempo disponível. O plano prioriza revisões e tópicos
        em andamento, sem marcar nada como estudado automaticamente.
      </p>

      <p
        v-if="errorMessage"
        class="content-alert content-alert--error"
        role="alert"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="successMessage"
        class="content-alert content-alert--success"
        role="status"
      >
        {{ successMessage }}
      </p>

      <p v-if="loading" class="content-loading" role="status">
        Carregando planejamento e progresso...
      </p>

      <template v-else>
        <section class="panel planning-profile-panel">
          <div class="panel-section-heading">
            <div>
              <h2>Planejamento em uso</h2>
              <p class="panel-subtitle">
                Cada planejamento guarda sua própria disponibilidade e seus
                ajustes semanais. O progresso e o histórico de sessões são
                compartilhados.
              </p>
            </div>
            <div class="planning-profile-actions">
              <button
                v-if="!planFormOpen && !topicEditorOpen"
                class="secondary-button"
                type="button"
                :disabled="saving"
                @click="editTopicSelection"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  edit
                </span>
                Editar matérias e tópicos
              </button>
              <button
                v-if="
                  !planFormOpen &&
                  !topicEditorOpen &&
                  planning.activePlan.id !== 'default' &&
                  planning.plans.length > 1
                "
                class="danger-button"
                type="button"
                :disabled="saving"
                @click="removeActivePlan"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  delete
                </span>
                Apagar planejamento
              </button>
              <button
                class="secondary-button"
                type="button"
                :disabled="saving"
                @click="planFormOpen ? cancelCreatePlan() : openCreatePlan()"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  {{ planFormOpen ? "close" : "add" }}
                </span>
                {{ planFormOpen ? "Cancelar criação" : "Novo planejamento" }}
              </button>
            </div>
          </div>
          <label class="filter-field planning-profile-select">
            <span>Escolha qual planejamento seguir</span>
            <AppSelect
              v-model="selectedPlanId"
              :disabled="
                saving ||
                planFormOpen ||
                topicEditorOpen ||
                planning.plans.length < 2
              "
              :options="
                planning.plans.map((planOption) => ({
                  value: planOption.id,
                  label: `${planOption.name}${planOption.active ? ' · em uso' : ''}`,
                }))
              "
              aria-label="Escolha qual planejamento seguir"
              @change="changeActivePlan"
            />
          </label>
          <form
            v-if="planFormOpen"
            class="planning-profile-form"
            @submit.prevent="createPlan"
          >
            <label class="filter-field" for="planning-profile-name">
              <span>Nome do novo planejamento</span>
              <input
                id="planning-profile-name"
                v-model="planNameDraft"
                type="text"
                maxlength="80"
                placeholder="Ex.: Concurso UFC 2027"
                required
              />
            </label>
            <div class="form-actions">
              <button
                class="primary-button"
                type="submit"
                :disabled="
                  saving ||
                  !planNameDraft.trim() ||
                  (totalSelectableTopics > 0 && selectedTopicCount === 0)
                "
              >
                {{ saving ? "Criando..." : "Criar e seguir" }}
              </button>
            </div>
          </form>
        </section>

        <section
          v-if="planFormOpen || topicEditorOpen"
          class="panel planning-topics-panel"
        >
          <div class="panel-section-heading">
            <div>
              <h2>Matérias e tópicos deste planejamento</h2>
              <p class="panel-subtitle">
                Escolha o conteúdo que será distribuído na semana. Cada
                planejamento mantém sua própria seleção; progresso e sessões
                continuam compartilhados.
              </p>
            </div>
            <button
              v-if="totalSelectableTopics > 0"
              class="secondary-button"
              type="button"
              :disabled="saving"
              @click="
                selectedTopicIdsDraft =
                  selectedTopicCount === totalSelectableTopics
                    ? []
                    : activeTopics.map((topic) => topic.id)
              "
            >
              {{
                selectedTopicCount === totalSelectableTopics
                  ? "Desmarcar todos"
                  : "Selecionar todos"
              }}
            </button>
          </div>

          <p
            v-if="selectionSubjects.length === 0"
            class="planning-topics-empty"
          >
            Nenhum tópico disponível. Adicione matérias e tópicos em
            <RouterLink to="/content">Conteúdos</RouterLink>.
          </p>
          <div v-else class="planning-topic-groups">
            <fieldset
              v-for="subject in selectionSubjects"
              :key="subject.id"
              class="planning-topic-group"
            >
              <legend>
                <label>
                  <input
                    type="checkbox"
                    :checked="
                      subject.topics.every((topic) =>
                        selectedTopicIdsDraft.includes(topic.id),
                      )
                    "
                    :disabled="saving"
                    @change="toggleSubjectTopics(subject.id, $event)"
                  />
                  <span>{{ subject.name }}</span>
                  <small>
                    {{
                      subject.topics.filter((topic) =>
                        selectedTopicIdsDraft.includes(topic.id),
                      ).length
                    }}/{{ subject.topics.length }}
                  </small>
                </label>
              </legend>
              <label
                v-for="topic in subject.topics"
                :key="topic.id"
                class="planning-topic-choice"
              >
                <input
                  v-model="selectedTopicIdsDraft"
                  type="checkbox"
                  :value="topic.id"
                  :disabled="saving"
                />
                <span>{{ topic.name }}</span>
              </label>
            </fieldset>
          </div>

          <div class="planning-topic-footer">
            <p
              v-if="selectedTopicCount === 0 && totalSelectableTopics > 0"
              class="planning-topic-selection-warning"
            >
              Selecione ao menos um tópico para gerar o plano semanal.
            </p>
            <p v-else>
              {{ selectedTopicCount }} de {{ totalSelectableTopics }} tópicos
              selecionados{{ planFormOpen ? " para este planejamento." : "." }}
            </p>
            <div v-if="topicEditorOpen" class="form-actions">
              <button
                class="primary-button"
                type="button"
                :disabled="saving || !hasUnsavedTopicSelection"
                @click="saveTopicSelection"
              >
                {{ saving ? "Salvando..." : "Salvar conteúdo" }}
              </button>
              <button
                class="secondary-button"
                type="button"
                :disabled="saving"
                @click="cancelTopicSelectionEdit"
              >
                Cancelar
              </button>
            </div>
          </div>
        </section>

        <section class="planning-summary" aria-label="Resumo do progresso">
          <article class="summary-card">
            <span>Progresso geral</span>
            <strong>{{ overallProgress }}%</strong>
            <progress max="100" :value="overallProgress">
              {{ overallProgress }}%
            </progress>
            <small>
              {{ completedTopics }} de {{ activeTopics.length }} tópicos
              estudados
            </small>
          </article>
          <article class="summary-card">
            <span>Tempo estudado nesta semana</span>
            <strong>{{
              formatTime(planning.plan.weeklyStudiedMinutes)
            }}</strong>
            <small>{{ planning.plan.weeklySessionCount }} sessão(ões)</small>
          </article>
          <article class="summary-card">
            <span>Revisões pendentes</span>
            <strong>{{ reviewTopics.length }}</strong>
            <small>Revisões concluídas preservam o histórico.</small>
          </article>
          <article class="summary-card">
            <span>Plano desta semana</span>
            <strong>{{ formatTime(planning.plan.plannedMinutes) }}</strong>
            <small>
              de {{ formatTime(planning.plan.totalAvailableMinutes) }}
              disponíveis
            </small>
          </article>
        </section>

        <section class="panel availability-panel">
          <div class="panel-section-heading">
            <div>
              <h2>Sua disponibilidade</h2>
              <p class="panel-subtitle">
                Use uma estimativa realista; dias desmarcados não recebem
                sessões automaticamente.
              </p>
            </div>
            <button
              class="primary-button"
              type="button"
              :disabled="saving || !hasUnsavedPreferences"
              @click="saveStudyPreferences"
            >
              {{ saving ? "Salvando..." : "Salvar disponibilidade" }}
            </button>
          </div>

          <fieldset class="weekday-options">
            <legend>Dias em que pode estudar</legend>
            <label
              v-for="(label, weekday) in dayLabels"
              :key="weekday"
              class="weekday-choice"
            >
              <input
                v-model="preferencesDraft.studyDays"
                type="checkbox"
                :value="weekday"
              />
              <span>{{ label }}</span>
            </label>
          </fieldset>

          <div class="availability-fields">
            <label class="filter-field">
              <span>Minutos disponíveis por dia</span>
              <input
                v-model.number="preferencesDraft.minutesPerDay"
                type="number"
                min="15"
                max="480"
                step="5"
              />
            </label>
            <div class="filter-field">
              <span id="target-date-label">Data-alvo (opcional)</span>
              <div class="custom-date-picker">
                <button
                  id="target-date-trigger"
                  class="date-picker-trigger"
                  type="button"
                  aria-haspopup="dialog"
                  :aria-expanded="targetDatePickerOpen"
                  aria-controls="target-date-calendar"
                  aria-labelledby="target-date-label"
                  @click="openTargetDatePicker"
                >
                  <span>
                    {{
                      preferencesDraft.targetDate
                        ? formatDate(preferencesDraft.targetDate)
                        : "Selecione uma data"
                    }}
                  </span>
                  <span class="material-symbols-rounded" aria-hidden="true">
                    calendar_month
                  </span>
                </button>
                <div
                  v-if="targetDatePickerOpen"
                  id="target-date-calendar"
                  class="date-picker-calendar"
                  role="dialog"
                  aria-label="Escolher data-alvo"
                >
                  <div class="date-picker-heading">
                    <strong>{{ datePickerMonthLabel }}</strong>
                    <div>
                      <button
                        class="icon-action"
                        type="button"
                        aria-label="Mês anterior"
                        title="Mês anterior"
                        :disabled="previousMonthDisabled"
                        @click="changeTargetDateMonth(-1)"
                      >
                        <span
                          class="material-symbols-rounded"
                          aria-hidden="true"
                          >chevron_left</span
                        >
                      </button>
                      <button
                        class="icon-action"
                        type="button"
                        aria-label="Próximo mês"
                        title="Próximo mês"
                        @click="changeTargetDateMonth(1)"
                      >
                        <span
                          class="material-symbols-rounded"
                          aria-hidden="true"
                          >chevron_right</span
                        >
                      </button>
                    </div>
                  </div>
                  <div
                    class="date-picker-grid"
                    role="group"
                    aria-label="Dias do mês"
                  >
                    <span
                      v-for="weekday in [
                        'Seg',
                        'Ter',
                        'Qua',
                        'Qui',
                        'Sex',
                        'Sáb',
                        'Dom',
                      ]"
                      :key="weekday"
                      class="date-picker-weekday"
                    >
                      {{ weekday }}
                    </span>
                    <button
                      v-for="day in datePickerDays"
                      :key="day.value"
                      class="date-picker-day"
                      :class="{
                        'date-picker-day--outside': !day.inMonth,
                        'date-picker-day--today': day.isToday,
                        'date-picker-day--selected': day.isSelected,
                      }"
                      type="button"
                      :disabled="day.disabled"
                      :aria-label="formatDate(day.value)"
                      :aria-pressed="day.isSelected"
                      @click="selectTargetDate(day.value)"
                    >
                      {{ day.day }}
                    </button>
                  </div>
                  <div class="date-picker-footer">
                    <button
                      v-if="preferencesDraft.targetDate"
                      class="text-button"
                      type="button"
                      @click="clearTargetDate"
                    >
                      Limpar data
                    </button>
                    <span v-else />
                    <button
                      class="text-button"
                      type="button"
                      :disabled="today === preferencesDraft.targetDate"
                      @click="selectTargetDate(today)"
                    >
                      Hoje
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p v-if="emptyStudyDays" class="inline-empty">
            Selecione ao menos um dia para gerar um plano semanal.
          </p>
        </section>

        <section
          v-if="planning.plan.deadline && !planning.plan.deadline.feasible"
          class="content-alert content-alert--warning"
          role="status"
        >
          A estimativa de
          {{ formatTime(planning.plan.deadline.workloadMinutes) }}
          excede a capacidade até
          {{ formatDate(planning.plan.deadline.date) }} ({{
            formatTime(planning.plan.deadline.availableMinutes)
          }}). Aumente disponibilidade, reduza a carga ou ajuste a data-alvo.
          Nenhum conteúdo foi descartado.
        </section>
        <p
          v-else-if="planning.plan.deadline"
          class="content-alert content-alert--success"
          role="status"
        >
          A estimativa de conteúdo cabe na disponibilidade até
          {{ formatDate(planning.plan.deadline.date) }}. Isso não é uma data de
          conclusão garantida.
        </p>

        <section
          v-if="timedTopicId && !activeTimerTopicVisible"
          class="panel active-timer-panel"
          aria-labelledby="active-timer-heading"
        >
          <div>
            <p class="eyebrow">Sessão em andamento</p>
            <h2 id="active-timer-heading">
              {{ getTopic(timedTopicId)?.name ?? "Tópico de estudo" }}
            </h2>
            <p>
              {{
                getTopic(timedTopicId)
                  ? subjectName(getTopic(timedTopicId)!)
                  : ""
              }}
            </p>
          </div>
          <output
            class="timer-display"
            aria-live="off"
            :aria-label="`Tempo de estudo: ${formatElapsedTime(activeStudyTimer.elapsedSeconds)}`"
          >
            {{ formatElapsedTime(activeStudyTimer.elapsedSeconds) }}
          </output>
          <span class="visually-hidden">
            Ao finalizar, a duração medida será registrada em segundos exatos.
          </span>
          <div class="timer-controls">
            <div class="timer-action-group">
              <button
                class="secondary-button timer-focus-trigger"
                type="button"
                aria-label="Expandir cronômetro"
                title="Expandir cronômetro"
                @click="focusTimerOpen = true"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  open_in_full
                </span>
                Expandir
              </button>
              <button
                class="secondary-button timer-control-button"
                type="button"
                @click="
                  activeStudyTimer.isRunning
                    ? pauseStudyTimer()
                    : resumeStudyTimer()
                "
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  {{ activeStudyTimer.isRunning ? "pause" : "play_arrow" }}
                </span>
                {{ activeStudyTimer.isRunning ? "Pausar" : "Continuar" }}
              </button>
              <button
                class="primary-button timer-control-button"
                type="button"
                :disabled="saving"
                @click="finishTimedSession"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  {{ saving ? "hourglass_top" : "stop" }}
                </span>
                {{ saving ? "Salvando..." : "Finalizar" }}
              </button>
            </div>
          </div>
        </section>

        <section class="panel weekly-plan-panel" aria-labelledby="week-heading">
          <div class="panel-section-heading">
            <div>
              <p class="eyebrow">Semana atual</p>
              <h2 id="week-heading">
                {{ formatDate(planning.plan.weekStart) }} —
                {{ formatDate(planning.plan.weekEnd) }}
              </h2>
            </div>
            <p class="panel-subtitle">
              Estimativa da carga restante:
              {{ formatTime(planning.plan.workloadMinutes) }}
            </p>
          </div>

          <div v-if="activeTopics.length === 0" class="content-empty">
            <span class="empty-state-icon" aria-hidden="true">
              <span class="material-symbols-rounded">event_note</span>
            </span>
            <h2>Adicione tópicos para montar o plano</h2>
            <p>
              O planejamento usa disciplinas ativas e tópicos ainda não
              estudados.
            </p>
            <RouterLink class="primary-button" to="/content">
              Organizar conteúdo
            </RouterLink>
          </div>
          <p v-else-if="emptyStudyDays" class="inline-empty">
            Escolha dias de estudo para gerar a distribuição semanal.
          </p>
          <div v-else class="week-days">
            <article
              v-for="day in planning.plan.days.filter(
                (item) => item.date >= today,
              )"
              :key="day.date"
              class="week-day"
              :class="{
                'week-day--unavailable': !day.available,
                'week-day--over-capacity': day.overCapacity,
              }"
            >
              <div class="week-day-heading">
                <div>
                  <h3>{{ dayLabels[day.weekday] }}</h3>
                  <p>{{ formatDate(day.date) }}</p>
                </div>
                <span v-if="day.available" class="capacity-label">
                  {{ formatTime(day.plannedMinutes) }} /
                  {{ formatTime(day.capacityMinutes) }}
                </span>
                <span v-else class="capacity-label">Dia livre</span>
              </div>
              <p v-if="day.overCapacity" class="over-capacity-message">
                Acima do tempo disponível; ajuste o plano.
              </p>
              <ul v-if="day.topics.length" class="planned-topic-list">
                <li
                  v-for="planned in day.topics"
                  :key="planned.topicId"
                  class="planned-topic"
                >
                  <div class="planned-topic-copy">
                    <strong>{{ planned.topicName }}</strong>
                    <span>{{ planned.subjectName }}</span>
                    <small>
                      {{ formatTime(planned.estimatedMinutes) }}
                      <template v-if="planned.usesDefaultEstimate">
                        · estimativa padrão
                      </template>
                      <template v-else> · estimativa informada</template>
                      · {{ statusLabel(planned.status) }}
                    </small>
                  </div>
                  <RouterLink
                    v-if="hasActiveQuestions(planned.topicId)"
                    class="icon-action planned-topic-questions"
                    :to="{
                      name: 'questions',
                      query: { topicId: planned.topicId },
                    }"
                    :aria-label="`Ver questões de ${planned.topicName}`"
                    :title="`Ver questões de ${planned.topicName}`"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      quiz
                    </span>
                  </RouterLink>
                  <button
                    v-else
                    class="icon-action planned-topic-questions"
                    type="button"
                    disabled
                    :aria-label="`Sem questões para ${planned.topicName}`"
                    :title="`Ainda não há questões ativas para ${planned.topicName}`"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      quiz
                    </span>
                  </button>
                  <a
                    class="icon-action planned-topic-qconcursos"
                    :href="qconcursosTopicUrl(planned.topicName)"
                    target="_blank"
                    rel="noopener noreferrer"
                    :aria-label="`Buscar ${planned.topicName} em concursos no QConcursos`"
                    :title="`Buscar ${planned.topicName} em concursos no QConcursos`"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      open_in_new
                    </span>
                  </a>
                  <div class="planned-topic-actions">
                    <label>
                      <span class="visually-hidden">
                        Mover {{ planned.topicName }} para outro dia disponível
                      </span>
                      <AppSelect
                        :model-value="day.date"
                        :disabled="saving"
                        :options="
                          planning.plan.days
                            .filter(
                              (item) => item.available && item.date >= today,
                            )
                            .map((option) => ({
                              value: option.date,
                              label: dayLabels[option.weekday],
                            }))
                        "
                        :aria-label="`Mover ${planned.topicName} para outro dia disponível`"
                        class="planned-day-select"
                        @change="moveTopic(planned.topicId, $event)"
                      />
                    </label>
                    <button
                      v-if="planned.manuallyScheduled"
                      class="text-button"
                      type="button"
                      :disabled="saving"
                      @click="resetTopic(planned.topicId)"
                    >
                      Automático
                    </button>
                    <div class="timer-controls">
                      <output
                        v-if="timedTopicId === planned.topicId"
                        class="timer-display"
                        aria-live="off"
                        :aria-label="`Tempo de estudo: ${formatElapsedTime(activeStudyTimer.elapsedSeconds)}`"
                      >
                        {{ formatElapsedTime(activeStudyTimer.elapsedSeconds) }}
                      </output>
                      <span
                        v-if="
                          timedTopicId === planned.topicId &&
                          !activeStudyTimer.isRunning
                        "
                        class="timer-paused-label"
                      >
                        Pausado
                      </span>
                      <button
                        v-if="timedTopicId !== planned.topicId"
                        class="secondary-button timer-start"
                        type="button"
                        :disabled="saving || timedTopicId !== null"
                        :title="
                          timedTopicId !== null
                            ? 'Finalize ou pause o cronômetro atual antes de iniciar outro.'
                            : 'Iniciar cronômetro de estudo'
                        "
                        @click="beginTimedSession(planned.topicId)"
                      >
                        <span
                          class="material-symbols-rounded"
                          aria-hidden="true"
                          >timer</span
                        >
                        Iniciar cronômetro
                      </button>
                      <template v-else>
                        <div class="timer-action-group">
                          <button
                            class="secondary-button timer-focus-trigger"
                            type="button"
                            aria-label="Expandir cronômetro"
                            title="Expandir cronômetro"
                            @click="focusTimerOpen = true"
                          >
                            <span
                              class="material-symbols-rounded"
                              aria-hidden="true"
                            >
                              open_in_full
                            </span>
                            Expandir
                          </button>
                          <button
                            class="secondary-button timer-control-button"
                            type="button"
                            :disabled="saving"
                            @click="
                              activeStudyTimer.isRunning
                                ? pauseStudyTimer()
                                : resumeStudyTimer()
                            "
                          >
                            <span
                              class="material-symbols-rounded"
                              aria-hidden="true"
                            >
                              {{
                                activeStudyTimer.isRunning
                                  ? "pause"
                                  : "play_arrow"
                              }}
                            </span>
                            {{
                              activeStudyTimer.isRunning
                                ? "Pausar"
                                : "Continuar"
                            }}
                          </button>
                          <button
                            class="primary-button timer-control-button"
                            type="button"
                            :disabled="saving"
                            @click="finishTimedSession"
                          >
                            <span
                              class="material-symbols-rounded"
                              aria-hidden="true"
                            >
                              {{ saving ? "hourglass_top" : "stop" }}
                            </span>
                            {{ saving ? "Salvando..." : "Finalizar" }}
                          </button>
                        </div>
                      </template>
                    </div>
                    <details
                      v-if="getTopic(planned.topicId) && timedTopicId === null"
                    >
                      <summary>Registrar manualmente</summary>
                      <form
                        class="session-form"
                        @submit.prevent="
                          recordStudySession(
                            getTopic(planned.topicId)!,
                            'study',
                          )
                        "
                      >
                        <label>
                          Duração em minutos
                          <input
                            v-model.number="
                              draftFor(getTopic(planned.topicId)!)
                                .durationMinutes
                            "
                            type="number"
                            min="1"
                            max="720"
                            required
                          />
                        </label>
                        <label>
                          Anotação (opcional)
                          <textarea
                            v-model="draftFor(getTopic(planned.topicId)!).notes"
                            rows="2"
                            maxlength="2000"
                          />
                        </label>
                        <button
                          class="secondary-button"
                          type="submit"
                          :disabled="saving"
                        >
                          Salvar sessão
                        </button>
                      </form>
                    </details>
                  </div>
                </li>
              </ul>
              <p v-else class="inline-empty">
                {{
                  day.available
                    ? "Nenhum tópico distribuído para este dia."
                    : "Nenhuma sessão será planejada neste dia."
                }}
              </p>
            </article>
          </div>

          <section
            v-if="planning.plan.unscheduledTopics.length > 0"
            class="unscheduled-section"
            aria-labelledby="unscheduled-heading"
          >
            <h3 id="unscheduled-heading">Tópicos ainda não distribuídos</h3>
            <p>
              Não couberam na capacidade disponível desta semana. Eles continuam
              no seu conteúdo para semanas futuras.
            </p>
            <ul class="planned-topic-list">
              <li
                v-for="topic in planning.plan.unscheduledTopics"
                :key="topic.topicId"
                class="planned-topic"
              >
                <div class="planned-topic-copy">
                  <strong>{{ topic.topicName }}</strong>
                  <span>{{ topic.subjectName }}</span>
                  <small>
                    {{ formatTime(topic.estimatedMinutes) }}
                    <template v-if="topic.usesDefaultEstimate">
                      · estimativa padrão de 45 min
                    </template>
                  </small>
                </div>
              </li>
            </ul>
          </section>
        </section>

        <section class="panel review-panel" aria-labelledby="reviews-heading">
          <div class="panel-section-heading">
            <div>
              <h2 id="reviews-heading">Revisões pendentes</h2>
              <p class="panel-subtitle">
                Ao registrar uma revisão, o próximo lembrete fica para 7 dias
                depois.
              </p>
            </div>
          </div>
          <ul v-if="reviewTopics.length" class="review-list">
            <li
              v-for="topic in reviewTopics"
              :key="topic.id"
              class="review-card"
            >
              <div>
                <strong>{{ topic.name }}</strong>
                <span>{{ subjectName(topic) }}</span>
                <small>{{ statusLabel(topic.status) }}</small>
              </div>
              <details>
                <summary>Registrar revisão</summary>
                <form
                  class="session-form"
                  @submit.prevent="recordStudySession(topic, 'review')"
                >
                  <label>
                    Duração em minutos
                    <input
                      v-model.number="draftFor(topic).durationMinutes"
                      type="number"
                      min="1"
                      max="720"
                      required
                    />
                  </label>
                  <label>
                    Anotação (opcional)
                    <textarea
                      v-model="draftFor(topic).notes"
                      rows="2"
                      maxlength="2000"
                    />
                  </label>
                  <button
                    class="primary-button"
                    type="submit"
                    :disabled="saving"
                  >
                    Concluir revisão
                  </button>
                </form>
              </details>
            </li>
          </ul>
          <p v-else class="inline-empty">
            Nenhuma revisão está pendente. Os tópicos estudados recebem uma
            revisão automática sugerida após 7 dias.
          </p>
        </section>

        <section
          class="panel progress-panel"
          aria-labelledby="progress-heading"
        >
          <div class="panel-section-heading">
            <div>
              <h2 id="progress-heading">Progresso por disciplina</h2>
              <p class="panel-subtitle">
                Um tópico conta como concluído somente no estado Estudado.
              </p>
            </div>
          </div>
          <ul v-if="summaryBySubject.length" class="subject-progress-list">
            <li v-for="subject in summaryBySubject" :key="subject.id">
              <div>
                <strong>{{ subject.name }}</strong>
                <span>
                  {{ subject.completed }} de {{ subject.total }} tópicos ·
                  {{ subject.progress }}%
                </span>
              </div>
              <progress max="100" :value="subject.progress">
                {{ subject.progress }}%
              </progress>
            </li>
          </ul>
          <p v-else class="inline-empty">
            Cadastre tópicos em uma disciplina para acompanhar o progresso.
          </p>
        </section>

        <section
          class="panel sessions-panel"
          aria-labelledby="sessions-heading"
        >
          <div class="panel-section-heading">
            <div>
              <h2 id="sessions-heading">Sessões desta semana</h2>
              <p class="panel-subtitle">
                O histórico é preservado quando o plano é recalculado.
              </p>
            </div>
            <div class="session-bulk-actions">
              <button
                class="danger-button"
                type="button"
                :disabled="saving || selectedSessionIds.length === 0"
                @click="removeSelectedSessions"
              >
                Apagar selecionadas ({{ selectedSessionIds.length }})
              </button>
              <button
                class="danger-button"
                type="button"
                :disabled="saving || planning.sessions.length === 0"
                @click="removeAllWeeklySessions"
              >
                Apagar todas
              </button>
            </div>
          </div>
          <ul v-if="planning.sessions.length" class="session-history">
            <li v-for="session in planning.sessions" :key="session.id">
              <div>
                <strong>{{ sessionTopicName(session) }}</strong>
                <span>
                  {{ session.kind === "review" ? "Revisão" : "Estudo" }} ·
                  {{ formatDate(session.date) }}
                </span>
                <small v-if="session.notes">{{ session.notes }}</small>
              </div>
              <div class="session-history-actions">
                <label class="session-selection">
                  <input
                    v-model="selectedSessionIds"
                    type="checkbox"
                    :value="session.id"
                    :aria-label="`Selecionar sessão de ${sessionTopicName(session)} em ${formatDate(session.date)}`"
                    :disabled="saving"
                  />
                </label>
                <strong>{{ formatSessionDuration(session) }}</strong>
                <button
                  class="icon-action icon-action--danger session-delete-button"
                  type="button"
                  :aria-label="`Apagar sessão de ${sessionTopicName(session)} em ${formatDate(session.date)}`"
                  title="Apagar sessão"
                  :disabled="saving"
                  @click="removeStudySession(session)"
                >
                  <span class="material-symbols-rounded" aria-hidden="true">
                    delete
                  </span>
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="inline-empty">
            Nenhuma sessão registrada nesta semana.
          </p>
        </section>
      </template>
    </main>
  </div>

  <ConfirmDialog />
</template>
