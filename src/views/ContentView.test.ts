import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUser, logout } from "../auth";
import ContentView from "./ContentView.vue";

const emptyContent = { subjects: [], topics: [], materials: [] };

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

async function mountContentView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", redirect: "/content" },
      { path: "/content", component: ContentView },
    ],
  });
  await router.push("/content");
  await router.isReady();
  const wrapper = mount(RouterView, {
    global: { plugins: [router] },
  });
  await flushPromises();
  return wrapper;
}

describe("ContentView", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
  });

  it("creates the first subject from the empty state and reloads persisted content", async () => {
    currentUser.value = { id: "user-1", email: "student@example.com" };
    const subject = {
      id: "subject-1",
      name: "Direito Administrativo",
      description: "",
      notes: "",
      position: 0,
      archived: false,
    };
    let subjectCreated = false;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          subjectCreated = true;
          return response(subject, 201);
        }
        return response(
          subjectCreated
            ? { subjects: [subject], topics: [], materials: [] }
            : emptyContent,
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountContentView();
    expect(wrapper.text()).toContain(
      "Sua organização começa por uma disciplina",
    );

    await wrapper.get(".content-page-heading .primary-button").trigger("click");
    const nameInput = wrapper.get('input[maxlength="120"]');
    await nameInput.setValue("Direito Administrativo");
    await wrapper.get(".subject-form-panel form").trigger("submit");
    await flushPromises();

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/api/subjects") && init?.method === "POST",
      ),
    ).toBe(true);
    expect(wrapper.get("#selected-subject-heading").text()).toBe(
      "Direito Administrativo",
    );
    expect(wrapper.text()).toContain("Disciplina criada.");
  });

  it("shows API failures instead of presenting empty content as a successful load", async () => {
    currentUser.value = { id: "user-2", email: "student@example.com" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ error: "Serviço indisponível." }, 503)),
    );

    const wrapper = await mountContentView();

    expect(wrapper.get('[role="alert"]').text()).toBe("Serviço indisponível.");
    expect(wrapper.find(".content-empty").exists()).toBe(false);
  });

  it("searches without accent sensitivity and combines topic and material filters", async () => {
    currentUser.value = { id: "user-3", email: "student@example.com" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          subjects: [
            {
              id: "subject-1",
              name: "Direito Constitucional",
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
              name: "Ação e cidadania",
              description: "",
              notes: "",
              position: 0,
              status: "review_pending",
            },
          ],
          materials: [
            {
              id: "material-1",
              subjectId: "subject-1",
              topicId: "topic-1",
              title: "Videoaula",
              type: "video",
              url: "https://example.com/aula",
              text: "",
            },
          ],
        }),
      ),
    );

    const wrapper = await mountContentView();
    await wrapper.get('input[type="search"]').setValue("ACAO");

    expect(wrapper.text()).toContain("Ação e cidadania");
    expect(wrapper.text()).toContain("0 de 1 tópicos concluídos");
    expect(wrapper.text()).toContain("Tópicos encontrados");

    const selects = wrapper.findAll("select");
    await selects[0]?.setValue("studied");
    expect(wrapper.text()).toContain(
      "Nenhum tópico encontrado. Experimente outro termo ou ajuste os filtros.",
    );

    await wrapper.get('input[type="search"]').setValue("");
    await selects[0]?.setValue("all");
    expect(wrapper.text()).toContain("Videoaula");
    await selects[1]?.setValue("book");
    expect(wrapper.text()).not.toContain("Videoaula");
  });
});
