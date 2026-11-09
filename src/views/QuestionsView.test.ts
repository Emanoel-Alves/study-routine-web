import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUser, logout } from "../auth";
import QuestionsView from "./QuestionsView.vue";

const question = {
  id: "question-1",
  subjectId: "subject-1",
  topicId: "topic-1",
  statement: "Qual princípio rege a atuação administrativa conforme a lei?",
  options: ["Legalidade", "Publicidade", "Eficiência"],
  correctOption: 0,
  explanation: "A Administração Pública deve obedecer à lei.",
  source: {
    name: "Banca de exemplo",
    url: "https://example.com/prova",
    exam: "Concurso de teste",
    board: "Banca de exemplo",
    role: "Analista de TI",
    year: 2024,
    number: "12",
  },
  status: "active",
  statusNote: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

async function mountQuestionsView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/questions", component: QuestionsView }],
  });
  await router.push("/questions");
  await router.isReady();
  const wrapper = mount(RouterView, {
    global: { plugins: [router] },
  });
  await flushPromises();
  return wrapper;
}

describe("QuestionsView", () => {
  afterEach(async () => {
    await logout();
    vi.unstubAllGlobals();
  });

  it("eliminates an alternative, checks the selected answer, and shows its explanation", async () => {
    currentUser.value = { id: "user-1", email: "student@example.com" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/api/content")) {
          return response({
            subjects: [
              {
                id: "subject-1",
                name: "Direito Administrativo",
                description: "",
                notes: "",
                position: 0,
                archived: false,
              },
            ],
            topics: [
              {
                id: "topic-1",
                subjectId: "subject-1",
                name: "Princípios da Administração",
                description: "",
                notes: "",
                position: 0,
                status: "not_started",
                estimatedMinutes: null,
                reviewDueAt: null,
              },
            ],
            materials: [],
          });
        }
        return response([question]);
      }),
    );

    const wrapper = await mountQuestionsView();
    const card = wrapper.find(".question-card");
    expect(card.text()).toContain("Banca de exemplo");

    await card
      .find('button[aria-label="Eliminar alternativa B"]')
      .trigger("click");
    expect(card.find(".question-option--eliminated").text()).toContain(
      "Publicidade",
    );

    await card.find('input[type="radio"][value="0"]').setValue();
    await card.get("button.primary-button").trigger("click");
    await flushPromises();

    expect(card.text()).toContain("Resposta correta!");
    expect(card.text()).toContain(
      "A Administração Pública deve obedecer à lei.",
    );
    expect(card.find(".question-option--correct").text()).toContain(
      "Legalidade",
    );

    await card.get("button.secondary-button").trigger("click");
    expect(card.find(".question-feedback").exists()).toBe(false);
    expect(card.find(".question-option--eliminated").exists()).toBe(false);
  });
});
