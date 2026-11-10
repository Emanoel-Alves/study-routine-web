<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AppSelect from "../components/AppSelect.vue";
import { currentUser, logout } from "../auth";
import {
  createMaterial,
  createSubject,
  createTopic,
  deleteMaterial,
  deleteSubject,
  deleteTopic,
  getContent,
  importStudyMatrix,
  updateMaterial,
  updateSubject,
  updateTopic,
  type ContentSnapshot,
  type Material,
  type MaterialInput,
  type MaterialType,
  type StudyStatus,
  type Subject,
  type Topic,
} from "../content";

const router = useRouter();
const content = ref<ContentSnapshot>({
  subjects: [],
  topics: [],
  materials: [],
});
const contentLoaded = ref(false);
const loading = ref(true);
const saving = ref(false);
const importingMatrix = ref(false);
const pageError = ref("");
const successMessage = ref("");
const searchQuery = ref("");
const statusFilter = ref("all");
const materialTypeFilter = ref("all");
const showArchived = ref(false);
const selectedSubjectId = ref("");
const selectedTopicId = ref("");
const subjectNotesDraft = ref("");
const topicNotesDraft = ref("");
const subjectFormOpen = ref(false);
const editingSubjectId = ref("");
const topicFormOpen = ref(false);
const editingTopicId = ref("");
const materialFormOpen = ref(false);
const editingMaterialId = ref("");

const subjectDraft = reactive({ name: "", description: "" });
const topicDraft = reactive({
  name: "",
  description: "",
  status: "not_started" as StudyStatus,
  estimatedMinutes: "",
});
const materialDraft = reactive({
  topicId: "",
  title: "",
  type: "other" as MaterialType,
  url: "",
  text: "",
});

const statusOptions: { value: StudyStatus; label: string }[] = [
  { value: "not_started", label: "Não iniciado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "studied", label: "Estudado" },
  { value: "review_pending", label: "Revisão pendente" },
];

const materialTypes: { value: MaterialType; label: string }[] = [
  { value: "video", label: "Vídeo" },
  { value: "book", label: "Livro" },
  { value: "article", label: "Artigo" },
  { value: "questions", label: "Questões" },
  { value: "document", label: "Documento" },
  { value: "other", label: "Outro" },
];
const statusFilterOptions = computed(() => [
  { value: "all", label: "Todos os estados" },
  ...statusOptions,
]);
const materialFilterOptions = computed(() => [
  { value: "all", label: "Todos os tipos" },
  ...materialTypes,
]);
const materialTopicOptions = computed(() => [
  { value: "", label: "Disciplina inteira" },
  ...subjectTopics.value.map((topic) => ({
    value: topic.id,
    label: topic.name,
  })),
]);

const selectedSubject = computed(
  () =>
    content.value.subjects.find(
      (subject) => subject.id === selectedSubjectId.value,
    ) ?? null,
);
const selectedTopic = computed(
  () =>
    content.value.topics.find((topic) => topic.id === selectedTopicId.value) ??
    null,
);
const selectedSubjectVisible = computed(
  () =>
    selectedSubject.value !== null &&
    visibleSubjects.value.some(
      (subject) => subject.id === selectedSubject.value?.id,
    ),
);

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function matchesSearch(value: string): boolean {
  const query = normalized(searchQuery.value);
  return query.length === 0 || normalized(value).includes(query);
}

const visibleSubjects = computed(() => {
  return content.value.subjects
    .filter((subject) => showArchived.value || !subject.archived)
    .filter((subject) => {
      if (matchesSearch(subject.name) || matchesSearch(subject.description)) {
        return true;
      }
      return (
        content.value.topics.some(
          (topic) =>
            topic.subjectId === subject.id &&
            (matchesSearch(topic.name) || matchesSearch(topic.description)),
        ) ||
        content.value.materials.some(
          (material) =>
            material.subjectId === subject.id &&
            (matchesSearch(material.title) || matchesSearch(material.text)),
        )
      );
    })
    .sort((first, second) => first.position - second.position);
});

const subjectTopics = computed(() =>
  content.value.topics
    .filter((topic) => topic.subjectId === selectedSubjectId.value)
    .sort((first, second) => first.position - second.position),
);
const completedTopicCount = computed(
  () =>
    subjectTopics.value.filter((topic) => topic.status === "studied").length,
);
const subjectProgress = computed(() =>
  subjectTopics.value.length === 0
    ? 0
    : Math.round(
        (completedTopicCount.value / subjectTopics.value.length) * 100,
      ),
);

const visibleTopics = computed(() =>
  subjectTopics.value.filter((topic) => {
    const matchesStatus =
      statusFilter.value === "all" || topic.status === statusFilter.value;
    const subjectMatches =
      selectedSubject.value !== null &&
      (matchesSearch(selectedSubject.value.name) ||
        matchesSearch(selectedSubject.value.description));
    const matchesText =
      matchesSearch(topic.name) ||
      matchesSearch(topic.description) ||
      matchesSearch(topic.notes);
    return matchesStatus && (subjectMatches || matchesText);
  }),
);

const topicSearchResults = computed(() => {
  if (!searchQuery.value.trim()) return [];
  return content.value.topics
    .filter((topic) => {
      const subject = content.value.subjects.find(
        (item) => item.id === topic.subjectId,
      );
      const matchesStatus =
        statusFilter.value === "all" || topic.status === statusFilter.value;
      return (
        subject &&
        (showArchived.value || !subject.archived) &&
        matchesStatus &&
        (matchesSearch(topic.name) ||
          matchesSearch(topic.description) ||
          matchesSearch(subject.name))
      );
    })
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
});

const subjectMaterials = computed(() =>
  content.value.materials.filter((material) => {
    const belongsToSubject = material.subjectId === selectedSubjectId.value;
    const matchesType =
      materialTypeFilter.value === "all" ||
      material.type === materialTypeFilter.value;
    const matchesText =
      matchesSearch(material.title) || matchesSearch(material.text);
    return belongsToSubject && matchesType && matchesText;
  }),
);

const selectedTopicMaterials = computed(() =>
  content.value.materials.filter(
    (material) => material.topicId === selectedTopicId.value,
  ),
);
const materialsByTopic = computed(() => {
  const grouped = new Map<string, Material[]>();
  for (const material of content.value.materials) {
    if (material.topicId === null) continue;
    const topicMaterials = grouped.get(material.topicId) ?? [];
    topicMaterials.push(material);
    grouped.set(material.topicId, topicMaterials);
  }
  return grouped;
});

function subjectForTopic(topic: Topic): Subject | undefined {
  return content.value.subjects.find(
    (subject) => subject.id === topic.subjectId,
  );
}

function statusLabel(status: StudyStatus): string {
  return (
    statusOptions.find((option) => option.value === status)?.label ?? status
  );
}

function materialTypeLabel(type: MaterialType): string {
  return (
    materialTypes.find((option) => option.value === type)?.label ?? "Outro"
  );
}

async function loadContent(): Promise<boolean> {
  loading.value = true;
  pageError.value = "";
  try {
    content.value = await getContent();
    contentLoaded.value = true;
    if (
      !content.value.subjects.some(
        (subject) => subject.id === selectedSubjectId.value,
      )
    ) {
      const firstSubject =
        content.value.subjects.find((subject) => !subject.archived) ??
        content.value.subjects[0];
      selectedSubjectId.value = firstSubject?.id ?? "";
    }
    if (
      !content.value.topics.some(
        (topic) =>
          topic.id === selectedTopicId.value &&
          topic.subjectId === selectedSubjectId.value,
      )
    ) {
      selectedTopicId.value = subjectTopics.value[0]?.id ?? "";
    }
    return true;
  } catch (error) {
    pageError.value =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar seu conteúdo.";
    return false;
  } finally {
    loading.value = false;
  }
}

async function performMutation<T>(
  action: () => Promise<T>,
  onSuccess: (result: T) => void = () => undefined,
  message: string,
): Promise<void> {
  saving.value = true;
  pageError.value = "";
  successMessage.value = "";
  try {
    const result = await action();
    if (!(await loadContent())) return;
    onSuccess(result);
    successMessage.value = message;
  } catch (error) {
    pageError.value =
      error instanceof Error
        ? error.message
        : "Não foi possível salvar as alterações.";
  } finally {
    saving.value = false;
  }
}

watch(selectedSubjectId, () => {
  subjectNotesDraft.value = selectedSubject.value?.notes ?? "";
  const firstTopic = subjectTopics.value[0];
  if (
    !content.value.topics.some(
      (topic) =>
        topic.id === selectedTopicId.value &&
        topic.subjectId === selectedSubjectId.value,
    )
  ) {
    selectedTopicId.value = firstTopic?.id ?? "";
  }
});

watch(selectedTopicId, () => {
  topicNotesDraft.value = selectedTopic.value?.notes ?? "";
});

onMounted(loadContent);

async function logoutAndReturnToLogin() {
  try {
    await logout();
  } catch (error) {
    console.error("Não foi possível encerrar a sessão no servidor.", error);
  }
  await router.replace({ name: "login" });
}

function openSubjectForm(subject?: Subject) {
  editingSubjectId.value = subject?.id ?? "";
  subjectDraft.name = subject?.name ?? "";
  subjectDraft.description = subject?.description ?? "";
  subjectFormOpen.value = true;
}

async function submitSubject() {
  const input = {
    name: subjectDraft.name.trim(),
    description: subjectDraft.description.trim(),
  };
  if (!input.name) {
    pageError.value = "Informe o nome da disciplina.";
    return;
  }
  const subjectId = editingSubjectId.value;
  await performMutation(
    () => (subjectId ? updateSubject(subjectId, input) : createSubject(input)),
    (subject) => {
      selectedSubjectId.value = subject.id;
      subjectFormOpen.value = false;
      editingSubjectId.value = "";
    },
    subjectId ? "Disciplina atualizada." : "Disciplina criada.",
  );
}

async function saveSubjectNotes() {
  const subject = selectedSubject.value;
  if (!subject) return;
  await performMutation(
    () => updateSubject(subject.id, { notes: subjectNotesDraft.value.trim() }),
    () => {
      subjectNotesDraft.value = selectedSubject.value?.notes ?? "";
    },
    "Anotações da disciplina salvas.",
  );
}

async function toggleArchived(subject: Subject) {
  await performMutation(
    () => updateSubject(subject.id, { archived: !subject.archived }),
    () => {
      showArchived.value = true;
    },
    subject.archived ? "Disciplina reativada." : "Disciplina arquivada.",
  );
}

async function removeSubject(subject: Subject) {
  const topicCount = content.value.topics.filter(
    (topic) => topic.subjectId === subject.id,
  ).length;
  const materialCount = content.value.materials.filter(
    (material) => material.subjectId === subject.id,
  ).length;
  const impact = [
    `${topicCount} tópico(s)`,
    `${materialCount} material(is)`,
    "e todas as anotações associadas",
  ].join(", ");
  if (
    !window.confirm(
      `Remover definitivamente "${subject.name}"? Também serão removidos ${impact}.`,
    )
  ) {
    return;
  }
  await performMutation(
    () => deleteSubject(subject.id),
    () => {
      selectedSubjectId.value =
        content.value.subjects.find((item) => !item.archived)?.id ?? "";
      selectedTopicId.value = "";
      subjectFormOpen.value = false;
    },
    "Disciplina removida.",
  );
}

function openTopicForm(topic?: Topic) {
  editingTopicId.value = topic?.id ?? "";
  topicDraft.name = topic?.name ?? "";
  topicDraft.description = topic?.description ?? "";
  topicDraft.status = topic?.status ?? "not_started";
  topicDraft.estimatedMinutes =
    topic?.estimatedMinutes === null || topic?.estimatedMinutes === undefined
      ? ""
      : String(topic.estimatedMinutes);
  topicFormOpen.value = true;
}

async function submitTopic() {
  const subject = selectedSubject.value;
  if (!subject) return;
  const input = {
    name: topicDraft.name.trim(),
    description: topicDraft.description.trim(),
    status: topicDraft.status,
    estimatedMinutes: topicDraft.estimatedMinutes
      ? Number(topicDraft.estimatedMinutes)
      : null,
  };
  if (!input.name) {
    pageError.value = "Informe o nome do tópico.";
    return;
  }
  const topicId = editingTopicId.value;
  await performMutation(
    () =>
      topicId ? updateTopic(topicId, input) : createTopic(subject.id, input),
    (topic) => {
      selectedTopicId.value = topic.id;
      topicFormOpen.value = false;
      editingTopicId.value = "";
    },
    topicId ? "Tópico atualizado." : "Tópico criado.",
  );
}

async function importMatrix() {
  if (
    !window.confirm(
      "Adicionar à sua conta a matriz de 8 disciplinas e 62 tópicos, incluindo Língua Portuguesa e Legislação do Edital UFC nº 01/2024? As referências aparecem nos materiais. Itens com nomes já existentes não serão duplicados nem sobrescritos.",
    )
  ) {
    return;
  }
  importingMatrix.value = true;
  pageError.value = "";
  successMessage.value = "";
  try {
    const result = await importStudyMatrix();
    if (!(await loadContent())) return;
    successMessage.value =
      result.subjectsCreated === 0 &&
      result.topicsCreated === 0 &&
      result.materialsCreated === 0
        ? "A matriz já estava cadastrada; nenhum item foi duplicado."
        : `Matriz adicionada: ${result.subjectsCreated} disciplina(s), ${result.topicsCreated} tópico(s) e ${result.materialsCreated} referência(s).`;
  } catch (error) {
    pageError.value =
      error instanceof Error
        ? error.message
        : "Não foi possível importar a matriz de estudos.";
  } finally {
    importingMatrix.value = false;
  }
}

async function changeTopicStatus(topic: Topic, value: string) {
  const status = statusOptions.find((option) => option.value === value)?.value;
  if (!status) return;
  await performMutation(
    () => updateTopic(topic.id, { status }),
    () => undefined,
    "Estado do tópico atualizado.",
  );
}

async function saveTopicNotes() {
  const topic = selectedTopic.value;
  if (!topic) return;
  await performMutation(
    () => updateTopic(topic.id, { notes: topicNotesDraft.value.trim() }),
    () => {
      topicNotesDraft.value = selectedTopic.value?.notes ?? "";
    },
    "Anotações do tópico salvas.",
  );
}

async function moveTopic(topic: Topic, direction: -1 | 1) {
  const index = subjectTopics.value.findIndex((item) => item.id === topic.id);
  const target = subjectTopics.value[index + direction];
  if (index < 0 || !target) return;
  await performMutation(
    async () => {
      await Promise.all([
        updateTopic(topic.id, { position: target.position }),
        updateTopic(target.id, { position: topic.position }),
      ]);
    },
    () => undefined,
    "Ordem dos tópicos atualizada.",
  );
}

async function removeTopic(topic: Topic) {
  const materialCount = content.value.materials.filter(
    (material) => material.topicId === topic.id,
  ).length;
  if (
    !window.confirm(
      `Remover "${topic.name}" e seus ${materialCount} material(is) associados?`,
    )
  ) {
    return;
  }
  await performMutation(
    () => deleteTopic(topic.id),
    () => {
      if (selectedTopicId.value === topic.id) selectedTopicId.value = "";
      topicFormOpen.value = false;
    },
    "Tópico removido.",
  );
}

function openMaterialForm(material?: Material) {
  editingMaterialId.value = material?.id ?? "";
  materialDraft.topicId = material?.topicId ?? selectedTopicId.value;
  materialDraft.title = material?.title ?? "";
  materialDraft.type = material?.type ?? "other";
  materialDraft.url = material?.url ?? "";
  materialDraft.text = material?.text ?? "";
  materialFormOpen.value = true;
}

async function submitMaterial() {
  const subject = selectedSubject.value;
  if (!subject) return;
  const input: MaterialInput = {
    topicId: materialDraft.topicId || null,
    title: materialDraft.title.trim(),
    type: materialDraft.type,
    url: materialDraft.url.trim(),
    text: materialDraft.text.trim(),
  };
  if (!input.title) {
    pageError.value = "Informe o título do material.";
    return;
  }
  if (!input.url && !input.text) {
    pageError.value = "Informe um link ou um texto para o material.";
    return;
  }
  const materialId = editingMaterialId.value;
  await performMutation(
    () =>
      materialId
        ? updateMaterial(materialId, input)
        : createMaterial(subject.id, input),
    (material) => {
      selectedTopicId.value = material.topicId ?? "";
      materialFormOpen.value = false;
      editingMaterialId.value = "";
    },
    materialId ? "Material atualizado." : "Material adicionado.",
  );
}

async function removeMaterial(material: Material) {
  if (!window.confirm(`Remover o material "${material.title}"?`)) return;
  await performMutation(
    () => deleteMaterial(material.id),
    () => undefined,
    "Material removido.",
  );
}

function openTopicResult(topic: Topic) {
  selectedSubjectId.value = topic.subjectId;
  selectedTopicId.value = topic.id;
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
      <div class="content-page-heading">
        <div>
          <h1>Organize o que você vai estudar.</h1>
          <p class="page-intro">
            Reúna disciplinas, tópicos, materiais e suas anotações em um só
            lugar.
          </p>
        </div>
        <div class="action-row content-heading-actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="importingMatrix || saving"
            @click="importMatrix"
          >
            {{
              importingMatrix ? "Importando matriz..." : "Importar matriz UFC"
            }}
          </button>
          <button
            class="primary-button"
            type="button"
            @click="openSubjectForm()"
          >
            Nova disciplina
          </button>
        </div>
      </div>

      <section class="content-filters" aria-label="Busca e filtros">
        <label class="filter-field filter-field--search">
          <span>Buscar disciplinas, tópicos e materiais</span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Ex.: Direito Constitucional"
          />
        </label>
        <label class="filter-field">
          <span>Estado do tópico</span>
          <AppSelect
            v-model="statusFilter"
            :options="statusFilterOptions"
            aria-label="Estado do tópico"
          />
        </label>
        <label class="filter-field">
          <span>Tipo de material</span>
          <AppSelect
            v-model="materialTypeFilter"
            :options="materialFilterOptions"
            aria-label="Tipo de material"
          />
        </label>
        <label class="archived-filter">
          <input v-model="showArchived" type="checkbox" />
          <span>Incluir arquivadas</span>
        </label>
      </section>

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

      <p v-if="loading" class="content-loading" role="status">
        Carregando seu conteúdo...
      </p>
      <section
        v-if="!loading && contentLoaded && subjectFormOpen"
        class="panel content-form subject-form-panel"
      >
        <form @submit.prevent="submitSubject">
          <h2>
            {{ editingSubjectId ? "Editar disciplina" : "Nova disciplina" }}
          </h2>
          <label>
            Nome
            <input
              v-model="subjectDraft.name"
              required
              maxlength="120"
              autocomplete="off"
            />
          </label>
          <label>
            Descrição <span class="optional-label">(opcional)</span>
            <textarea
              v-model="subjectDraft.description"
              rows="2"
              maxlength="2000"
            />
          </label>
          <div class="action-row">
            <button class="primary-button" type="submit" :disabled="saving">
              {{ saving ? "Salvando..." : "Salvar disciplina" }}
            </button>
            <button
              class="secondary-button"
              type="button"
              @click="subjectFormOpen = false"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
      <div v-if="!loading && contentLoaded" class="content-layout">
        <aside class="panel subject-panel" aria-labelledby="subjects-heading">
          <div class="panel-heading">
            <span class="panel-icon" aria-hidden="true">
              <span class="material-symbols-rounded">menu_book</span>
            </span>
            <div>
              <h2 id="subjects-heading">Disciplinas</h2>
              <p class="panel-subtitle">
                {{ visibleSubjects.length }} encontrada(s)
              </p>
            </div>
          </div>

          <ul v-if="visibleSubjects.length" class="subject-list">
            <li v-for="subject in visibleSubjects" :key="subject.id">
              <button
                class="subject-choice"
                :class="{
                  'subject-choice--selected': subject.id === selectedSubjectId,
                }"
                type="button"
                @click="selectedSubjectId = subject.id"
              >
                <span>{{ subject.name }}</span>
                <span v-if="subject.archived" class="archive-tag">
                  Arquivada
                </span>
              </button>
            </li>
          </ul>
          <p v-else class="inline-empty">
            {{
              content.subjects.length
                ? "Nenhuma disciplina corresponde à busca ou aos filtros."
                : "Cadastre sua primeira disciplina para começar."
            }}
          </p>
        </aside>

        <section
          v-if="selectedSubject && selectedSubjectVisible"
          class="content-detail"
          aria-labelledby="selected-subject-heading"
        >
          <section class="panel subject-detail-panel">
            <div class="detail-heading">
              <div>
                <p class="eyebrow">Disciplina</p>
                <h2 id="selected-subject-heading">
                  {{ selectedSubject.name }}
                </h2>
                <p v-if="selectedSubject.description" class="panel-subtitle">
                  {{ selectedSubject.description }}
                </p>
                <div class="subject-progress">
                  <label :for="`subject-progress-${selectedSubject.id}`">
                    Progresso da disciplina
                  </label>
                  <progress
                    :id="`subject-progress-${selectedSubject.id}`"
                    max="100"
                    :value="subjectProgress"
                  >
                    {{ subjectProgress }}%
                  </progress>
                  <p>
                    {{ completedTopicCount }} de {{ subjectTopics.length }}
                    tópicos concluídos
                  </p>
                </div>
                <span v-if="selectedSubject.archived" class="archive-tag">
                  Arquivada
                </span>
              </div>
              <div class="action-row subject-actions">
                <button
                  class="icon-action icon-action--large"
                  type="button"
                  :disabled="saving"
                  :aria-label="`Editar disciplina ${selectedSubject.name}`"
                  title="Editar disciplina"
                  @click="openSubjectForm(selectedSubject)"
                >
                  <span class="material-symbols-rounded" aria-hidden="true">
                    edit
                  </span>
                </button>
                <button
                  class="icon-action icon-action--large"
                  type="button"
                  :disabled="saving"
                  :aria-label="`${selectedSubject.archived ? 'Reativar' : 'Arquivar'} disciplina ${selectedSubject.name}`"
                  :title="
                    selectedSubject.archived
                      ? 'Reativar disciplina'
                      : 'Arquivar disciplina'
                  "
                  @click="toggleArchived(selectedSubject)"
                >
                  <span class="material-symbols-rounded" aria-hidden="true">
                    {{ selectedSubject.archived ? "unarchive" : "archive" }}
                  </span>
                </button>
                <button
                  class="icon-action icon-action--large icon-action--danger"
                  type="button"
                  :disabled="saving"
                  :aria-label="`Remover disciplina ${selectedSubject.name}`"
                  title="Remover disciplina"
                  @click="removeSubject(selectedSubject)"
                >
                  <span class="material-symbols-rounded" aria-hidden="true">
                    delete
                  </span>
                </button>
              </div>
            </div>

            <div class="note-editor">
              <label for="subject-notes">Anotações gerais</label>
              <textarea
                id="subject-notes"
                v-model="subjectNotesDraft"
                rows="3"
                maxlength="20000"
                placeholder="Registre observações gerais desta disciplina."
              />
              <button
                class="secondary-button"
                type="button"
                :disabled="
                  saving || subjectNotesDraft === selectedSubject.notes
                "
                @click="saveSubjectNotes"
              >
                Salvar anotações
              </button>
            </div>
          </section>

          <section class="panel topic-panel" aria-labelledby="topics-heading">
            <div class="panel-section-heading">
              <div>
                <h2 id="topics-heading">Tópicos</h2>
                <p class="panel-subtitle">
                  Atualize o estado, a ordem e as anotações de cada tópico.
                </p>
              </div>
              <button
                class="primary-button"
                type="button"
                :disabled="selectedSubject.archived"
                @click="openTopicForm()"
              >
                Novo tópico
              </button>
            </div>

            <p v-if="selectedSubject.archived" class="inline-empty">
              Reative a disciplina para adicionar ou alterar tópicos.
            </p>
            <form
              v-if="topicFormOpen && !selectedSubject.archived"
              class="content-form"
              @submit.prevent="submitTopic"
            >
              <h3>{{ editingTopicId ? "Editar tópico" : "Novo tópico" }}</h3>
              <label>
                Nome
                <input
                  v-model="topicDraft.name"
                  required
                  maxlength="160"
                  autocomplete="off"
                />
              </label>
              <label>
                Descrição <span class="optional-label">(opcional)</span>
                <textarea
                  v-model="topicDraft.description"
                  rows="2"
                  maxlength="4000"
                />
              </label>
              <label>
                Estado
                <AppSelect
                  v-model="topicDraft.status"
                  :options="statusOptions"
                  aria-label="Estado do tópico"
                />
              </label>
              <label>
                Estimativa (minutos)
                <input
                  v-model="topicDraft.estimatedMinutes"
                  type="number"
                  min="1"
                  max="480"
                  step="1"
                  placeholder="Opcional; o plano estima 45 min"
                />
              </label>
              <div class="action-row">
                <button class="primary-button" type="submit" :disabled="saving">
                  {{ saving ? "Salvando..." : "Salvar tópico" }}
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  @click="topicFormOpen = false"
                >
                  Cancelar
                </button>
              </div>
            </form>

            <ul v-if="visibleTopics.length" class="topic-list">
              <li
                v-for="(topic, index) in visibleTopics"
                :key="topic.id"
                class="topic-card"
              >
                <button
                  class="topic-name"
                  type="button"
                  @click="selectedTopicId = topic.id"
                >
                  <strong>{{ topic.name }}</strong>
                  <span v-if="topic.description">{{ topic.description }}</span>
                </button>
                <label class="topic-status">
                  <span class="visually-hidden">
                    Estado de {{ topic.name }}
                  </span>
                  <AppSelect
                    :model-value="topic.status"
                    :disabled="saving || selectedSubject.archived"
                    :options="statusOptions"
                    :aria-label="`Estado de ${topic.name}`"
                    class="topic-status-select"
                    @change="changeTopicStatus(topic, $event)"
                  />
                </label>
                <div class="topic-actions">
                  <button
                    class="icon-action"
                    type="button"
                    :disabled="
                      saving ||
                      index === 0 ||
                      selectedSubject.archived ||
                      searchQuery.trim() !== '' ||
                      statusFilter !== 'all'
                    "
                    :aria-label="`Mover ${topic.name} para cima`"
                    title="Mover tópico para cima"
                    @click="moveTopic(topic, -1)"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      arrow_upward
                    </span>
                  </button>
                  <button
                    class="icon-action"
                    type="button"
                    :disabled="
                      saving ||
                      index === visibleTopics.length - 1 ||
                      selectedSubject.archived ||
                      searchQuery.trim() !== '' ||
                      statusFilter !== 'all'
                    "
                    :aria-label="`Mover ${topic.name} para baixo`"
                    title="Mover tópico para baixo"
                    @click="moveTopic(topic, 1)"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      arrow_downward
                    </span>
                  </button>
                  <button
                    class="icon-action"
                    type="button"
                    :disabled="saving || selectedSubject.archived"
                    :aria-label="`Editar ${topic.name}`"
                    title="Editar tópico"
                    @click="openTopicForm(topic)"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      edit
                    </span>
                  </button>
                  <button
                    class="icon-action icon-action--danger"
                    type="button"
                    :disabled="saving || selectedSubject.archived"
                    :aria-label="`Remover ${topic.name}`"
                    title="Remover tópico"
                    @click="removeTopic(topic)"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      delete
                    </span>
                  </button>
                </div>
                <div
                  v-if="materialsByTopic.get(topic.id)?.length"
                  class="topic-linked-materials"
                >
                  <span class="topic-linked-materials-label">
                    <span class="material-symbols-rounded" aria-hidden="true">
                      attach_file
                    </span>
                    Materiais deste tópico
                  </span>
                  <ul>
                    <li
                      v-for="material in materialsByTopic.get(topic.id)"
                      :key="material.id"
                    >
                      <a
                        v-if="material.url"
                        :href="material.url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {{ material.title }}
                        <span
                          class="material-symbols-rounded"
                          aria-hidden="true"
                        >
                          open_in_new
                        </span>
                        <span class="visually-hidden">(abre em nova aba)</span>
                      </a>
                      <span v-else>{{ material.title }}</span>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
            <p v-else-if="!selectedSubject.archived" class="inline-empty">
              {{
                subjectTopics.length
                  ? "Nenhum tópico corresponde à busca ou ao estado escolhido."
                  : "Esta disciplina ainda não tem tópicos. Adicione o primeiro."
              }}
            </p>
          </section>

          <section
            v-if="selectedTopic"
            class="panel topic-notes-panel"
            aria-labelledby="topic-notes-heading"
          >
            <div class="panel-section-heading">
              <div>
                <h2 id="topic-notes-heading">
                  Anotações: {{ selectedTopic.name }}
                </h2>
                <p class="panel-subtitle">
                  Estado atual: {{ statusLabel(selectedTopic.status) }}
                </p>
              </div>
              <button
                class="secondary-button topic-add-material"
                type="button"
                :disabled="saving || selectedSubject?.archived"
                @click="openMaterialForm()"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  add_link
                </span>
                Adicionar link ao tópico
              </button>
            </div>
            <label class="visually-hidden" for="topic-notes">
              Anotações do tópico {{ selectedTopic.name }}
            </label>
            <textarea
              id="topic-notes"
              v-model="topicNotesDraft"
              rows="4"
              maxlength="20000"
              placeholder="Escreva suas anotações para este tópico."
            />
            <button
              class="secondary-button"
              type="button"
              :disabled="saving || topicNotesDraft === selectedTopic.notes"
              @click="saveTopicNotes"
            >
              Salvar anotações
            </button>
            <div class="topic-materials">
              <h3>Links e materiais relacionados</h3>
              <ul
                v-if="selectedTopicMaterials.length"
                class="topic-material-list"
              >
                <li
                  v-for="material in selectedTopicMaterials"
                  :key="material.id"
                  class="topic-material-item"
                >
                  <div>
                    <span class="material-kind">
                      {{ materialTypeLabel(material.type) }}
                    </span>
                    <strong>{{ material.title }}</strong>
                    <p v-if="material.text">{{ material.text }}</p>
                    <a
                      v-if="material.url"
                      :href="material.url"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span class="material-symbols-rounded" aria-hidden="true">
                        open_in_new
                      </span>
                      Abrir link
                      <span class="visually-hidden">(abre em nova aba)</span>
                    </a>
                  </div>
                  <div class="topic-material-actions">
                    <button
                      class="icon-action"
                      type="button"
                      :disabled="saving || selectedSubject?.archived"
                      :aria-label="`Editar ${material.title}`"
                      title="Editar material"
                      @click="openMaterialForm(material)"
                    >
                      <span class="material-symbols-rounded" aria-hidden="true">
                        edit
                      </span>
                    </button>
                    <button
                      class="icon-action icon-action--danger"
                      type="button"
                      :disabled="saving || selectedSubject?.archived"
                      :aria-label="`Remover ${material.title}`"
                      title="Remover material"
                      @click="removeMaterial(material)"
                    >
                      <span class="material-symbols-rounded" aria-hidden="true">
                        delete
                      </span>
                    </button>
                  </div>
                </li>
              </ul>
              <p v-else class="field-help">
                Nenhum link ou material associado a este tópico ainda.
              </p>
            </div>
          </section>

          <section
            class="panel material-panel"
            aria-labelledby="materials-heading"
          >
            <div class="panel-section-heading">
              <div>
                <h2 id="materials-heading">Materiais</h2>
                <p class="panel-subtitle">
                  Links e referências da disciplina ou do tópico selecionado.
                </p>
              </div>
              <button
                class="primary-button"
                type="button"
                @click="openMaterialForm()"
              >
                Adicionar material
              </button>
            </div>

            <form
              v-if="materialFormOpen"
              class="content-form"
              @submit.prevent="submitMaterial"
            >
              <h3>
                {{ editingMaterialId ? "Editar material" : "Novo material" }}
              </h3>
              <label>
                Título
                <input
                  v-model="materialDraft.title"
                  required
                  maxlength="200"
                  autocomplete="off"
                />
              </label>
              <label>
                Tipo
                <AppSelect
                  v-model="materialDraft.type"
                  :options="materialTypes"
                  aria-label="Tipo de material"
                />
              </label>
              <label>
                Associar a
                <AppSelect
                  v-model="materialDraft.topicId"
                  :options="materialTopicOptions"
                  aria-label="Associar a"
                />
              </label>
              <label>
                URL <span class="optional-label">(opcional)</span>
                <input
                  v-model="materialDraft.url"
                  type="url"
                  maxlength="2048"
                  placeholder="https://..."
                />
              </label>
              <label>
                Texto ou descrição
                <textarea
                  v-model="materialDraft.text"
                  rows="3"
                  maxlength="20000"
                  placeholder="Adicione o conteúdo textual ou uma descrição."
                />
              </label>
              <p class="field-help">
                Informe um link HTTP(S), um texto ou ambos. O conteúdo de
                terceiros não é copiado para a plataforma.
              </p>
              <div class="action-row">
                <button class="primary-button" type="submit" :disabled="saving">
                  {{ saving ? "Salvando..." : "Salvar material" }}
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  @click="materialFormOpen = false"
                >
                  Cancelar
                </button>
              </div>
            </form>

            <ul v-if="subjectMaterials.length" class="material-list">
              <li
                v-for="material in subjectMaterials"
                :key="material.id"
                class="material-card"
              >
                <div class="material-copy">
                  <span class="material-kind">
                    {{ materialTypeLabel(material.type) }}
                    <template v-if="material.topicId">
                      ·
                      {{
                        subjectTopics.find(
                          (topic) => topic.id === material.topicId,
                        )?.name
                      }}
                    </template>
                    <template v-else> · Disciplina</template>
                  </span>
                  <h3>{{ material.title }}</h3>
                  <p v-if="material.text">{{ material.text }}</p>
                  <a
                    v-if="material.url"
                    :href="material.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      open_in_new
                    </span>
                    Abrir referência externa
                    <span class="visually-hidden">(abre em nova aba)</span>
                  </a>
                </div>
                <div class="material-actions">
                  <button
                    class="icon-action"
                    type="button"
                    :disabled="saving || selectedSubject.archived"
                    :aria-label="`Editar ${material.title}`"
                    title="Editar material"
                    @click="openMaterialForm(material)"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      edit
                    </span>
                  </button>
                  <button
                    class="icon-action icon-action--danger"
                    type="button"
                    :disabled="saving"
                    :aria-label="`Remover ${material.title}`"
                    title="Remover material"
                    @click="removeMaterial(material)"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      delete
                    </span>
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="inline-empty">
              Nenhum material corresponde aos filtros atuais. Você pode
              adicionar um link ou uma referência em texto.
            </p>
          </section>
        </section>

        <section v-else class="panel content-empty">
          <span class="empty-state-icon" aria-hidden="true">
            <span class="material-symbols-rounded">library_add</span>
          </span>
          <h2>
            {{
              content.subjects.length
                ? "Nenhuma disciplina selecionada"
                : "Sua organização começa por uma disciplina"
            }}
          </h2>
          <p>
            {{
              content.subjects.length
                ? "Escolha uma disciplina na lista ou ajuste a busca e os filtros."
                : "Crie uma disciplina, adicione tópicos e anexe materiais e anotações."
            }}
          </p>
          <button
            class="primary-button"
            type="button"
            @click="openSubjectForm()"
          >
            Criar disciplina
          </button>
        </section>
      </div>

      <section
        v-if="!loading && contentLoaded && searchQuery.trim()"
        class="panel search-results"
        aria-labelledby="search-results-heading"
      >
        <h2 id="search-results-heading">Tópicos encontrados</h2>
        <ul v-if="topicSearchResults.length" class="search-result-list">
          <li v-for="topic in topicSearchResults" :key="topic.id">
            <button type="button" @click="openTopicResult(topic)">
              <strong>{{ topic.name }}</strong>
              <span>
                {{ subjectForTopic(topic)?.name }} ·
                {{ statusLabel(topic.status) }}
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="inline-empty">
          Nenhum tópico encontrado. Experimente outro termo ou ajuste os
          filtros.
        </p>
      </section>
    </main>
  </div>
</template>
