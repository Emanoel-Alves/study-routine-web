import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUser, logout } from "../auth";
import ContentView from "./ContentView.vue";

HTMLElement.prototype.hasPointerCapture ??= () => false;
HTMLElement.prototype.releasePointerCapture ??= () => {};

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

  it("uses accessible icon buttons for topic actions and describes reordering controls", async () => {
    currentUser.value = { id: "user-4", email: "student@example.com" };
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
              name: "Direitos fundamentais",
              description: "",
              notes: "",
              position: 0,
              status: "not_started",
              estimatedMinutes: null,
              reviewDueAt: null,
            },
          ],
          materials: [],
        }),
      ),
    );

    const wrapper = await mountContentView();

    expect(
      wrapper
        .get('button[aria-label="Editar disciplina Direito Constitucional"]')
        .text(),
    ).toBe("edit");
    expect(
      wrapper
        .get('button[aria-label="Arquivar disciplina Direito Constitucional"]')
        .text(),
    ).toBe("archive");
    expect(
      wrapper
        .get('button[aria-label="Remover disciplina Direito Constitucional"]')
        .text(),
    ).toBe("delete");
    expect(
      wrapper.get('button[aria-label="Editar Direitos fundamentais"]').text(),
    ).toBe("edit");
    expect(
      wrapper.get('button[aria-label="Remover Direitos fundamentais"]').text(),
    ).toBe("delete");
    expect(
      wrapper
        .get('button[aria-label="Mover Direitos fundamentais para cima"]')
        .attributes("title"),
    ).toBe("Mover tópico para cima");
    expect(
      wrapper
        .get('button[aria-label="Mover Direitos fundamentais para baixo"]')
        .attributes("title"),
    ).toBe("Mover tópico para baixo");

    await wrapper
      .get('button[aria-label="Editar Direitos fundamentais"]')
      .trigger("click");
    expect(wrapper.text()).toContain("Editar tópico");
  });

  it("adds a link from the selected topic and shows it attached to that topic", async () => {
    currentUser.value = { id: "user-5", email: "student@example.com" };
    const materialInput: {
      topicId: string | null;
      title: string;
      type: string;
      url: string;
      text: string;
    }[] = [];
    const topic = {
      id: "topic-1",
      subjectId: "subject-1",
      name: "Direitos fundamentais",
      description: "",
      notes: "",
      position: 0,
      status: "not_started",
      estimatedMinutes: null,
      reviewDueAt: null,
    };
    const subject = {
      id: "subject-1",
      name: "Direito Constitucional",
      description: "",
      notes: "",
      position: 0,
      archived: false,
    };
    const materials: {
      id: string;
      subjectId: string;
      topicId: string | null;
      title: string;
      type: string;
      url: string;
      text: string;
    }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/subjects/subject-1/materials")) {
          const body = JSON.parse(
            String(init?.body),
          ) as (typeof materialInput)[number];
          materialInput.push(body);
          const savedMaterial = {
            id: "material-1",
            subjectId: "subject-1",
            ...body,
          };
          materials.push(savedMaterial);
          return response(savedMaterial, 201);
        }
        return response({
          subjects: [subject],
          topics: [topic],
          materials,
        });
      }),
    );

    const wrapper = await mountContentView();
    await wrapper.get(".topic-add-material").trigger("click");
    const form = wrapper.get("form.content-form");
    await form.get('input[maxlength="200"]').setValue("Aula sobre direitos");
    await form
      .get('input[type="url"]')
      .setValue("https://example.com/direitos");
    await form.trigger("submit");
    await flushPromises();

    expect(materialInput).toEqual([
      {
        topicId: "topic-1",
        title: "Aula sobre direitos",
        type: "other",
        url: "https://example.com/direitos",
        text: "",
      },
    ]);
    expect(wrapper.get(".topic-materials").text()).toContain(
      "Aula sobre direitos",
    );
    expect(wrapper.get(".topic-card .topic-linked-materials").text()).toContain(
      "Aula sobre direitos",
    );
    expect(
      wrapper.get(".topic-card .topic-linked-materials a").attributes("href"),
    ).toBe("https://example.com/direitos");
    expect(wrapper.get(".topic-materials a").attributes("href")).toBe(
      "https://example.com/direitos",
    );
    expect(
      wrapper.get('button[aria-label="Editar Aula sobre direitos"]').text(),
    ).toBe("edit");
    expect(
      wrapper.get('button[aria-label="Remover Aula sobre direitos"]').text(),
    ).toBe("delete");
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

    const filterTriggers = wrapper.findAll(
      ".content-filters .app-select-trigger",
    );
    expect(filterTriggers).toHaveLength(2);
    await filterTriggers[0].trigger("pointerdown");
    await flushPromises();
    const studiedOption = Array.from(
      document.querySelectorAll<HTMLElement>(".app-select-item"),
    ).find((option) => option.textContent?.trim() === "Estudado");
    expect(studiedOption).toBeDefined();
    studiedOption!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await flushPromises();
    expect(wrapper.text()).toContain(
      "Nenhum tópico encontrado. Experimente outro termo ou ajuste os filtros.",
    );

    await wrapper.get('input[type="search"]').setValue("");
    await filterTriggers[0].trigger("pointerdown");
    await flushPromises();
    const allStatusesOption = Array.from(
      document.querySelectorAll<HTMLElement>(".app-select-item"),
    ).find((option) => option.textContent?.trim() === "Todos os estados");
    expect(allStatusesOption).toBeDefined();
    allStatusesOption!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await flushPromises();
    expect(wrapper.text()).toContain("Videoaula");
    await filterTriggers[1].trigger("pointerdown");
    await flushPromises();
    const bookOption = Array.from(
      document.querySelectorAll<HTMLElement>(".app-select-item"),
    ).find((option) => option.textContent?.trim() === "Livro");
    expect(bookOption).toBeDefined();
    bookOption!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await flushPromises();
    expect(wrapper.find(".material-panel").text()).not.toContain("Videoaula");
  });
});
