<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AppSelect from "../components/AppSelect.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { currentUser, logout } from "../auth";
import { requestConfirmation } from "../confirm-dialog";
import { getContent, type ContentSnapshot, type Topic } from "../content";
import {
  createQuestion,
  deleteQuestion,
  getQuestions,
  importUfcGovernanceQuestions,
  updateQuestion,
  type QuestionStatus,
  type StudyQuestion,
  type StudyQuestionInput,
} from "../questions";

interface QuestionAttempt {
  selectedOption: number | null;
  eliminatedOptions: number[];
  checked: boolean;
}

const router = useRouter();
const route = useRoute();
const content = ref<ContentSnapshot>({
  subjects: [],
  topics: [],
  materials: [],
});
const questions = ref<StudyQuestion[]>([]);
const loading = ref(true);
const saving = ref(false);
const formOpen = ref(false);
const editingQuestionId = ref("");
const pageError = ref("");
const successMessage = ref("");
const subjectFilter = ref("all");
const topicFilter = ref("all");
const statusFilter = ref<"active" | "all" | "annulled" | "outdated">("active");
const attempts = reactive<Record<string, QuestionAttempt>>({});

const draft = reactive({
  topicId: "",
  statement: "",
  optionsText: "",
  correctOption: "0",
  explanation: "",
  sourceName: "",
  sourceUrl: "",
  sourceExam: "",
  sourceBoard: "",
  sourceRole: "",
  sourceYear: "",
  sourceNumber: "",
  status: "active" as QuestionStatus,
  statusNote: "",
});

const availableTopics = computed(() =>
  content.value.topics.filter((topic) =>
    subjectFilter.value === "all"
      ? true
      : topic.subjectId === subjectFilter.value,
  ),
);
const questionTopicOptions = computed(() =>
  content.value.topics.map((topic) => ({
    value: topic.id,
    label: `${getSubjectName(topic.subjectId)} — ${topic.name}`,
  })),
);
const subjectFilterOptions = computed(() => [
  { value: "all", label: "Todas" },
  ...content.value.subjects.map((subject) => ({
    value: subject.id,
    label: subject.name,
  })),
]);
const topicFilterOptions = computed(() => [
  { value: "all", label: "Todos" },
  ...availableTopics.value.map((topic) => ({
    value: topic.id,
    label: topic.name,
  })),
]);
const correctOptionOptions = computed(() =>
  draft.optionsText
    .split(/\r?\n/)
    .filter((item) => item.trim())
    .map((option, index) => ({
      value: String(index),
      label: `${optionLetter(index)} — ${option.slice(0, 60)}`,
    })),
);
const visibleQuestions = computed(() =>
  questions.value.filter((question) => {
    if (
      subjectFilter.value !== "all" &&
      question.subjectId !== subjectFilter.value
    ) {
      return false;
    }
    if (topicFilter.value !== "all" && question.topicId !== topicFilter.value) {
      return false;
    }
    return (
      statusFilter.value === "all" || question.status === statusFilter.value
    );
  }),
);
const activeQuestionCount = computed(
  () =>
    questions.value.filter((question) => question.status === "active").length,
);
const questionStatusOptions = [
  { value: "active", label: "Ativa" },
  { value: "annulled", label: "Anulada" },
  { value: "outdated", label: "Desatualizada" },
];
const questionStatusFilterOptions = [
  { value: "active", label: "Para resolver (ativas)" },
  { value: "all", label: "Todas as situações" },
  { value: "annulled", label: "Anuladas" },
  { value: "outdated", label: "Desatualizadas" },
];

function getTopic(topicId: string): Topic | undefined {
  return content.value.topics.find((topic) => topic.id === topicId);
}

function getSubjectName(subjectId: string): string {
  return (
    content.value.subjects.find((subject) => subject.id === subjectId)?.name ??
    "Disciplina removida"
  );
}

function attemptFor(questionId: string): QuestionAttempt {
  attempts[questionId] ??= {
    selectedOption: null,
    eliminatedOptions: [],
    checked: false,
  };
  return attempts[questionId];
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function toggleEliminated(question: StudyQuestion, optionIndex: number): void {
  const attempt = attemptFor(question.id);
  if (attempt.checked) return;
  if (attempt.eliminatedOptions.includes(optionIndex)) {
    attempt.eliminatedOptions = attempt.eliminatedOptions.filter(
      (item) => item !== optionIndex,
    );
  } else {
    attempt.eliminatedOptions.push(optionIndex);
    if (attempt.selectedOption === optionIndex) {
      attempt.selectedOption = null;
    }
  }
}

function resetAttempt(questionId: string): void {
  attempts[questionId] = {
    selectedOption: null,
    eliminatedOptions: [],
    checked: false,
  };
}

function resetDraft(): void {
  Object.assign(draft, {
    topicId: content.value.topics[0]?.id ?? "",
    statement: "",
    optionsText: "",
    correctOption: "0",
    explanation: "",
    sourceName: "",
    sourceUrl: "",
    sourceExam: "",
    sourceBoard: "",
    sourceRole: "",
    sourceYear: "",
    sourceNumber: "",
    status: "active" as QuestionStatus,
    statusNote: "",
  });
}

function openQuestionForm(question?: StudyQuestion): void {
  editingQuestionId.value = question?.id ?? "";
  if (!question) {
    resetDraft();
  } else {
    Object.assign(draft, {
      topicId: question.topicId,
      statement: question.statement,
      optionsText: question.options.join("\n"),
      correctOption: String(question.correctOption),
      explanation: question.explanation,
      sourceName: question.source.name,
      sourceUrl: question.source.url,
      sourceExam: question.source.exam,
      sourceBoard: question.source.board,
      sourceRole: question.source.role,
      sourceYear: question.source.year?.toString() ?? "",
      sourceNumber: question.source.number,
      status: question.status,
      statusNote: question.statusNote,
    });
  }
  pageError.value = "";
  formOpen.value = true;
}

function createInput(): StudyQuestionInput {
  return {
    topicId: draft.topicId,
    statement: draft.statement.trim(),
    options: draft.optionsText
      .split(/\r?\n/)
      .map((option) => option.trim())
      .filter(Boolean),
    correctOption: Number(draft.correctOption),
    explanation: draft.explanation.trim(),
    source: {
      name: draft.sourceName.trim(),
      url: draft.sourceUrl.trim(),
      exam: draft.sourceExam.trim(),
      board: draft.sourceBoard.trim(),
      role: draft.sourceRole.trim(),
      year: draft.sourceYear ? Number(draft.sourceYear) : null,
      number: draft.sourceNumber.trim(),
    },
    status: draft.status,
    statusNote: draft.statusNote.trim(),
  };
}

async function saveQuestion(): Promise<void> {
  pageError.value = "";
  successMessage.value = "";
  saving.value = true;
  try {
    const input = createInput();
    const saved = editingQuestionId.value
      ? await updateQuestion(editingQuestionId.value, input)
      : await createQuestion(input);
    const existingIndex = questions.value.findIndex(
      (question) => question.id === saved.id,
    );
    if (existingIndex < 0) questions.value.unshift(saved);
    else questions.value[existingIndex] = saved;
    resetAttempt(saved.id);
    formOpen.value = false;
    successMessage.value = editingQuestionId.value
      ? "Questão atualizada."
      : "Questão adicionada ao banco.";
    editingQuestionId.value = "";
  } catch (error) {
    pageError.value =
      error instanceof Error
        ? error.message
        : "Não foi possível salvar a questão.";
  } finally {
    saving.value = false;
  }
}

async function removeQuestion(question: StudyQuestion): Promise<void> {
  const confirmed = await requestConfirmation({
    title: "Excluir questão?",
    message:
      "Excluir esta questão do seu banco? Essa ação não pode ser desfeita.",
    confirmLabel: "Excluir questão",
    danger: true,
  });
  if (!confirmed) return;
  pageError.value = "";
  try {
    await deleteQuestion(question.id);
    questions.value = questions.value.filter((item) => item.id !== question.id);
    delete attempts[question.id];
  } catch (error) {
    pageError.value =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir a questão.";
  }
}

async function importUfcQuestions(): Promise<void> {
  pageError.value = "";
  successMessage.value = "";
  saving.value = true;
  try {
    const result = await importUfcGovernanceQuestions();
    const refreshedQuestions = await getQuestions();
    questions.value = refreshedQuestions;
    successMessage.value =
      result.createdCount > 0
        ? `${result.createdCount} questões autorais adicionadas; ${result.existingCount} já estavam no banco. As respostas aparecem somente depois de responder.`
        : `As ${result.totalCount} questões deste conjunto já estavam no banco.`;
  } catch (error) {
    pageError.value =
      error instanceof Error
        ? error.message
        : "Não foi possível importar as questões autorais.";
  } finally {
    saving.value = false;
  }
}

async function loadQuestions(): Promise<void> {
  loading.value = true;
  pageError.value = "";
  try {
    const [contentResult, questionResult] = await Promise.all([
      getContent(),
      getQuestions(),
    ]);
    content.value = contentResult;
    questions.value = questionResult;
    applyTopicFilterFromRoute();
  } catch (error) {
    pageError.value =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar o banco.";
  } finally {
    loading.value = false;
  }
}

function applyTopicFilterFromRoute(): void {
  const topicId = route.query.topicId;
  if (typeof topicId !== "string") {
    subjectFilter.value = "all";
    topicFilter.value = "all";
    return;
  }
  const topic = content.value.topics.find((item) => item.id === topicId);
  if (!topic) {
    subjectFilter.value = "all";
    topicFilter.value = "all";
    return;
  }
  subjectFilter.value = topic.subjectId;
  topicFilter.value = topic.id;
}

function checkAnswer(question: StudyQuestion): void {
  const attempt = attemptFor(question.id);
  if (attempt.selectedOption !== null) attempt.checked = true;
}

function questionStatusLabel(status: QuestionStatus): string {
  if (status === "annulled") return "Anulada";
  if (status === "outdated") return "Desatualizada";
  return "Ativa";
}

async function logoutAndReturnToLogin(): Promise<void> {
  try {
    await logout();
  } catch (error) {
    console.error("Não foi possível encerrar a sessão no servidor.", error);
  }
  await router.replace({ name: "login" });
}

watch(() => route.query.topicId, applyTopicFilterFromRoute);
onMounted(loadQuestions);
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

    <main class="main-content questions-page">
      <div class="content-page-heading">
        <div>
          <p class="eyebrow">Prática por tópico</p>
          <h1>Banco de questões</h1>
          <p class="page-intro">
            Resolva, confira o gabarito e elimine alternativas. Cada questão
            mantém sua fonte e fica vinculada ao tópico correspondente.
          </p>
        </div>
        <div class="question-heading-actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="saving || content.topics.length === 0"
            @click="importUfcQuestions"
          >
            <span class="material-symbols-rounded" aria-hidden="true">
              playlist_add
            </span>
            Importar 30 questões autorais
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="content.topics.length === 0"
            @click="openQuestionForm()"
          >
            <span class="material-symbols-rounded" aria-hidden="true">add</span>
            Adicionar questão
          </button>
        </div>
      </div>
      <p class="question-import-note">
        Conjunto de 30 adaptações autorais baseadas nos temas do caderno
        UFC/FCPC 2025, sem transcrição dos enunciados. A importação adiciona
        somente as questões que ainda não estão no seu banco.
      </p>

      <p
        v-if="pageError"
        class="content-alert content-alert--error"
        role="alert"
      >
        {{ pageError }}
      </p>
      <p
        v-if="successMessage"
        class="content-alert content-alert--success"
        role="status"
      >
        {{ successMessage }}
      </p>

      <section v-if="formOpen" class="panel questions-form-panel">
        <div class="panel-section-heading">
          <div>
            <h2>{{ editingQuestionId ? "Editar questão" : "Nova questão" }}</h2>
            <p class="panel-subtitle">
              Registre uma questão que você tem autorização para usar ou um
              resumo próprio com link para a fonte original.
            </p>
          </div>
          <button
            class="icon-action"
            type="button"
            aria-label="Fechar formulário"
            @click="formOpen = false"
          >
            <span class="material-symbols-rounded" aria-hidden="true"
              >close</span
            >
          </button>
        </div>
        <form
          class="content-form questions-form"
          @submit.prevent="saveQuestion"
        >
          <label>
            Tópico
            <AppSelect
              v-model="draft.topicId"
              :options="questionTopicOptions"
              placeholder="Selecione um tópico"
              required
              aria-label="Tópico da questão"
            />
          </label>
          <label class="questions-form-wide">
            Enunciado ou resumo próprio
            <textarea
              v-model="draft.statement"
              required
              maxlength="20000"
              rows="4"
              placeholder="Digite o enunciado ou um resumo escrito por você."
            />
          </label>
          <label class="questions-form-wide">
            Alternativas (uma por linha, de 2 a 6)
            <textarea
              v-model="draft.optionsText"
              required
              rows="5"
              placeholder="Alternativa A&#10;Alternativa B&#10;Alternativa C"
            />
          </label>
          <label>
            Gabarito
            <AppSelect
              v-model="draft.correctOption"
              :options="correctOptionOptions"
              required
              aria-label="Gabarito"
            />
          </label>
          <label>
            Situação
            <AppSelect
              v-model="draft.status"
              :options="questionStatusOptions"
              aria-label="Situação"
            />
          </label>
          <label class="questions-form-wide">
            Explicação (opcional)
            <textarea
              v-model="draft.explanation"
              maxlength="10000"
              rows="3"
              placeholder="Escreva uma explicação própria ou deixe em branco."
            />
          </label>
          <label class="questions-form-wide">
            Fonte
            <input
              v-model="draft.sourceName"
              required
              maxlength="120"
              placeholder="Ex.: QConcursos, banca organizadora ou órgão"
            />
          </label>
          <label class="questions-form-wide">
            Link direto da questão ou prova
            <input
              v-model="draft.sourceUrl"
              required
              type="url"
              maxlength="2048"
              placeholder="https://..."
            />
          </label>
          <label>
            Concurso
            <input
              v-model="draft.sourceExam"
              maxlength="200"
              placeholder="Ex.: UFC — Técnico de TI"
            />
          </label>
          <label>
            Banca
            <input
              v-model="draft.sourceBoard"
              maxlength="120"
              placeholder="Ex.: Cebraspe"
            />
          </label>
          <label>
            Cargo
            <input
              v-model="draft.sourceRole"
              maxlength="160"
              placeholder="Ex.: Analista de TI"
            />
          </label>
          <label>
            Ano
            <input
              v-model="draft.sourceYear"
              type="number"
              min="1900"
              max="2200"
              placeholder="2024"
            />
          </label>
          <label>
            Número da questão
            <input
              v-model="draft.sourceNumber"
              maxlength="32"
              placeholder="Ex.: 12"
            />
          </label>
          <label v-if="draft.status !== 'active'" class="questions-form-wide">
            Motivo da sinalização
            <input
              v-model="draft.statusNote"
              maxlength="1000"
              placeholder="Ex.: anulada no gabarito definitivo ou norma revogada"
            />
          </label>
          <div class="form-actions questions-form-wide">
            <button class="primary-button" type="submit" :disabled="saving">
              {{ saving ? "Salvando..." : "Salvar questão" }}
            </button>
            <button
              class="secondary-button"
              type="button"
              :disabled="saving"
              @click="formOpen = false"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>

      <section class="questions-toolbar" aria-label="Filtros de questões">
        <label class="filter-field">
          Disciplina
          <AppSelect
            v-model="subjectFilter"
            :options="subjectFilterOptions"
            aria-label="Disciplina"
            @change="topicFilter = 'all'"
          />
        </label>
        <label class="filter-field">
          Tópico
          <AppSelect
            v-model="topicFilter"
            :options="topicFilterOptions"
            aria-label="Tópico"
          />
        </label>
        <label class="filter-field">
          Exibição
          <AppSelect
            v-model="statusFilter"
            :options="questionStatusFilterOptions"
            aria-label="Exibição"
          />
        </label>
        <p class="questions-count">
          {{ activeQuestionCount }} ativa(s) no banco
        </p>
      </section>

      <p v-if="loading" class="overview-loading" role="status">
        Carregando questões...
      </p>
      <section v-else-if="visibleQuestions.length" class="questions-list">
        <article
          v-for="question in visibleQuestions"
          :key="question.id"
          class="panel question-card"
          :class="`question-card--${question.status}`"
        >
          <header class="question-card-header">
            <div class="question-card-source">
              <span
                class="question-status"
                :class="`question-status--${question.status}`"
              >
                {{ questionStatusLabel(question.status) }}
              </span>
              <span>
                {{ getSubjectName(question.subjectId) }} ·
                {{ getTopic(question.topicId)?.name ?? "Tópico removido" }}
              </span>
              <span v-if="question.source.exam">
                {{ question.source.exam
                }}<template v-if="question.source.year">
                  ({{ question.source.year }})</template
                >
              </span>
              <span v-if="question.source.board">
                {{ question.source.board }}
              </span>
              <span v-if="question.source.role">
                {{ question.source.role }}
              </span>
            </div>
            <div class="question-card-actions">
              <button
                class="icon-action"
                type="button"
                :aria-label="`Editar questão de ${question.source.name}`"
                @click="openQuestionForm(question)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  edit
                </span>
              </button>
              <button
                class="icon-action icon-action--danger"
                type="button"
                aria-label="Excluir questão"
                @click="removeQuestion(question)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  delete
                </span>
              </button>
            </div>
          </header>

          <p class="question-statement">{{ question.statement }}</p>
          <div
            v-if="question.status !== 'active'"
            class="question-status-note"
            role="note"
          >
            <span class="material-symbols-rounded" aria-hidden="true">
              info
            </span>
            <span>
              Fora da prática principal.
              {{
                question.statusNote || "Confira a fonte antes de reutilizar."
              }}
            </span>
          </div>

          <div class="question-options">
            <div
              v-for="(option, index) in question.options"
              :key="`${question.id}-${index}`"
              class="question-option"
              :class="{
                'question-option--selected':
                  attemptFor(question.id).selectedOption === index,
                'question-option--eliminated': attemptFor(
                  question.id,
                ).eliminatedOptions.includes(index),
                'question-option--correct':
                  attemptFor(question.id).checked &&
                  index === question.correctOption,
                'question-option--incorrect':
                  attemptFor(question.id).checked &&
                  attemptFor(question.id).selectedOption === index &&
                  index !== question.correctOption,
              }"
            >
              <label class="question-option-answer">
                <input
                  v-model="attemptFor(question.id).selectedOption"
                  type="radio"
                  :name="`answer-${question.id}`"
                  :value="index"
                  :disabled="
                    question.status !== 'active' ||
                    attemptFor(question.id).checked ||
                    attemptFor(question.id).eliminatedOptions.includes(index)
                  "
                />
                <span class="question-option-letter">{{
                  optionLetter(index)
                }}</span>
                <span class="question-option-text">{{ option }}</span>
              </label>
              <button
                class="scissor-button"
                type="button"
                :disabled="
                  question.status !== 'active' ||
                  attemptFor(question.id).checked
                "
                :aria-label="
                  attemptFor(question.id).eliminatedOptions.includes(index)
                    ? `Restaurar alternativa ${optionLetter(index)}`
                    : `Eliminar alternativa ${optionLetter(index)}`
                "
                :aria-pressed="
                  attemptFor(question.id).eliminatedOptions.includes(index)
                "
                @click="toggleEliminated(question, index)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  content_cut
                </span>
              </button>
            </div>
          </div>

          <div
            v-if="question.status === 'active'"
            class="question-answer-actions"
          >
            <button
              v-if="!attemptFor(question.id).checked"
              class="primary-button"
              type="button"
              :disabled="attemptFor(question.id).selectedOption === null"
              @click="checkAnswer(question)"
            >
              Conferir resposta
            </button>
            <button
              v-else
              class="secondary-button"
              type="button"
              @click="resetAttempt(question.id)"
            >
              Tentar novamente
            </button>
            <p
              v-if="attemptFor(question.id).checked"
              class="question-feedback"
              :class="
                attemptFor(question.id).selectedOption ===
                question.correctOption
                  ? 'question-feedback--correct'
                  : 'question-feedback--incorrect'
              "
              role="status"
            >
              <span class="material-symbols-rounded" aria-hidden="true">
                {{
                  attemptFor(question.id).selectedOption ===
                  question.correctOption
                    ? "check_circle"
                    : "cancel"
                }}
              </span>
              {{
                attemptFor(question.id).selectedOption ===
                question.correctOption
                  ? "Resposta correta!"
                  : `Resposta incorreta. Gabarito: alternativa ${optionLetter(question.correctOption)}.`
              }}
            </p>
          </div>

          <section
            v-if="attemptFor(question.id).checked && question.explanation"
            class="question-explanation"
          >
            <h3>Explicação</h3>
            <p>{{ question.explanation }}</p>
          </section>
          <p
            v-else-if="attemptFor(question.id).checked"
            class="question-no-explanation"
          >
            Não há explicação cadastrada para esta questão.
          </p>

          <footer class="question-source">
            <span class="material-symbols-rounded" aria-hidden="true">
              source
            </span>
            <span>
              Fonte:
              <a
                :href="question.source.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ question.source.name
                }}<template v-if="question.source.number">
                  · questão {{ question.source.number }}</template
                >
              </a>
            </span>
          </footer>
        </article>
      </section>
      <section v-else-if="!loading" class="panel questions-empty">
        <span class="empty-state-icon" aria-hidden="true">
          <span class="material-symbols-rounded">quiz</span>
        </span>
        <h2>
          {{
            questions.length
              ? "Nenhuma questão corresponde aos filtros."
              : "Seu banco de questões está vazio."
          }}
        </h2>
        <p>
          Adicione questões que você tem autorização para usar ou resumos
          próprios. Guarde o link da fonte para abrir a prova ou a página
          original quando precisar.
        </p>
        <button
          v-if="content.topics.length && questions.length === 0"
          class="primary-button"
          type="button"
          @click="openQuestionForm()"
        >
          Adicionar primeira questão
        </button>
        <RouterLink
          v-else-if="!content.topics.length"
          class="secondary-button"
          to="/content"
        >
          Criar um tópico primeiro
        </RouterLink>
      </section>
    </main>
  </div>
  <ConfirmDialog />
</template>
