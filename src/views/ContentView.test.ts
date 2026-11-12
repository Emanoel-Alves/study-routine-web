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
          materials: [
            {
              id: "material-1",
              subjectId: "subject-1",
              topicId: "topic-1",
              title: "Aula de direitos fundamentais",
              type: "video",
              url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              text: "Revisão dos direitos fundamentais.",
              professor: "Professora Ana",
              thumbnailUrl: "",
            },
            {
              id: "material-2",
              subjectId: "subject-1",
              topicId: "topic-1",
              title: "Resumo em PDF",
              type: "document",
              url: "https://example.com/resumo.pdf",
              text: "",
              professor: "",
              thumbnailUrl: "",
            },
            {
              id: "material-3",
              subjectId: "subject-1",
              topicId: "topic-1",
              title: "Artigo sobre direitos fundamentais",
              type: "article",
              url: "https://example.com/artigo",
              text: "",
              professor: "",
              thumbnailUrl: "",
            },
          ],
        }),
      ),
    );

    const wrapper = await mountContentView();
    const topicMaterials = wrapper.get(".topic-linked-materials");
    expect((topicMaterials.element as HTMLDetailsElement).open).toBe(false);
    expect(topicMaterials.get("summary").text()).toContain(
      "Materiais do tópico (3)",
    );
    await topicMaterials.get("summary").trigger("click");
    expect(topicMaterials.text()).toContain("Aula de direitos fundamentais");
    expect(topicMaterials.text()).toContain("Professora Ana");
    expect(topicMaterials.text()).toContain("Resumo em PDF");
    expect(topicMaterials.text()).toContain(
      "Artigo sobre direitos fundamentais",
    );
    expect(topicMaterials.get(".material-preview--document").text()).toBe(
      "description",
    );
    expect(
      topicMaterials.get(".material-preview--article img").attributes("src"),
    ).toBe("/article-icon.png");
    expect(topicMaterials.get("a").attributes("href")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    const subjectQconcursosLink = wrapper.get(
      'a[aria-label="Buscar Direito Constitucional em concursos no QConcursos"]',
    );
    expect(subjectQconcursosLink.attributes("href")).toBe(
      "https://www.qconcursos.com/questoes-de-concursos/questoes?exclude_nullified=false&exclude_outdated=false&q=Direito+Constitucional",
    );
    expect(subjectQconcursosLink.attributes("target")).toBe("_blank");
    expect(subjectQconcursosLink.attributes("rel")).toBe("noopener noreferrer");
    expect(subjectQconcursosLink.get("img").attributes("src")).toBe(
      "/qconcursos-icon.png",
    );
    const topicQconcursosLink = wrapper.get(
      'a[aria-label="Buscar Direitos fundamentais em concursos no QConcursos"]',
    );
    expect(topicQconcursosLink.attributes("href")).toBe(
      "https://www.qconcursos.com/questoes-de-concursos/questoes?exclude_nullified=false&exclude_outdated=false&q=Direitos+fundamentais",
    );
    expect(topicQconcursosLink.attributes("target")).toBe("_blank");
    expect(topicQconcursosLink.attributes("rel")).toBe("noopener noreferrer");
    expect(topicQconcursosLink.get("img").attributes("src")).toBe(
      "/qconcursos-icon.png",
    );
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
      professor: string;
      thumbnailUrl: string;
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
      professor: string;
      thumbnailUrl: string;
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
        professor: "",
        thumbnailUrl: "",
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

  it("resets a completed topic to not started from its topic card", async () => {
    currentUser.value = { id: "user-reset", email: "student@example.com" };
    let topicStatus = "studied";
    let topicReviewDueAt: string | null = "2026-11-17T00:00:00.000Z";
    let updatedStatus: string | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          const update = JSON.parse(String(init.body)) as {
            status: string;
          };
          updatedStatus = update.status;
          topicStatus = update.status;
          topicReviewDueAt = null;
          return response({
            id: "topic-1",
            subjectId: "subject-1",
            name: "Direitos fundamentais",
            status: topicStatus,
            reviewDueAt: topicReviewDueAt,
          });
        }
        return response({
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
              status: topicStatus,
              estimatedMinutes: null,
              reviewDueAt: topicReviewDueAt,
            },
          ],
          materials: [],
        });
      }),
    );

    const wrapper = await mountContentView();
    const resetButton = wrapper.get(
      'button[aria-label="Redefinir Direitos fundamentais para Não iniciado"]',
    );
    expect(resetButton.text()).toBe("restart_alt");
    await resetButton.trigger("click");
    await flushPromises();

    expect(updatedStatus).toBe("not_started");
    expect(wrapper.get(".topic-status-label").text()).toBe("Não iniciado");
    expect(
      wrapper
        .find(
          'button[aria-label="Redefinir Direitos fundamentais para Não iniciado"]',
        )
        .exists(),
    ).toBe(false);
    expect(wrapper.text()).toContain(
      'Status de "Direitos fundamentais" redefinido para Não iniciado.',
    );
  });

  it("adds video lessons and laws to their dedicated lists", async () => {
    currentUser.value = { id: "user-6", email: "student@example.com" };
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
      professor: string;
      thumbnailUrl: string;
    }[] = [];
    const materialInputs: Omit<
      (typeof materials)[number],
      "id" | "subjectId"
    >[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.endsWith("/api/subjects/subject-1/materials") &&
          init?.method === "POST"
        ) {
          const body = JSON.parse(String(init.body)) as Omit<
            (typeof materials)[number],
            "id" | "subjectId"
          >;
          materialInputs.push(body);
          const savedMaterial = {
            id: `material-${materials.length + 1}`,
            subjectId: subject.id,
            ...body,
          };
          materials.push(savedMaterial);
          return response(savedMaterial, 201);
        }
        return response({ subjects: [subject], topics: [], materials });
      }),
    );

    const wrapper = await mountContentView();
    const addMaterialButton = wrapper.get(
      ".material-panel .panel-section-heading .primary-button",
    );

    await addMaterialButton.trigger("click");
    let form = wrapper.get(".material-panel form.content-form");
    await form.get('input[maxlength="200"]').setValue("Aula de legalidade");
    await form.findAll(".app-select-trigger")[0].trigger("pointerdown");
    await flushPromises();
    const videoOption = Array.from(
      document.querySelectorAll<HTMLElement>(".app-select-item"),
    ).find((option) => option.textContent?.trim() === "Videoaula");
    expect(videoOption).toBeDefined();
    videoOption?.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await flushPromises();
    form = wrapper.get(".material-panel form.content-form");
    await form
      .findAll('input[type="url"]')[0]
      .setValue("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await form.findAll('input[maxlength="200"]')[1].setValue("Prof. Ana");
    await form.get("textarea").setValue("Princípio da legalidade");
    await form.trigger("submit");
    await flushPromises();

    expect(materialInputs[0]).toMatchObject({
      title: "Aula de legalidade",
      type: "video",
      professor: "Prof. Ana",
      thumbnailUrl: "",
    });
    expect(wrapper.get(".video-lessons-section").text()).toContain("Prof. Ana");
    const thumbnail = wrapper.get(".video-lesson-card .material-preview img");
    expect(thumbnail.attributes("src")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg",
    );
    await thumbnail.trigger("error");
    expect(thumbnail.attributes("src")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    await thumbnail.trigger("error");
    await thumbnail.trigger("error");
    await thumbnail.trigger("error");
    expect((thumbnail.element as HTMLImageElement).hidden).toBe(true);
    expect(
      wrapper
        .find(".video-lesson-card .material-preview-frame > span")
        .exists(),
    ).toBe(true);

    await addMaterialButton.trigger("click");
    form = wrapper.get(".material-panel form.content-form");
    await form.get('input[maxlength="200"]').setValue("Constituição Federal");
    await form.findAll(".app-select-trigger")[0].trigger("pointerdown");
    await flushPromises();
    const lawOption = Array.from(
      document.querySelectorAll<HTMLElement>(".app-select-item"),
    ).find((option) => option.textContent?.trim() === "Lei ou norma");
    expect(lawOption).toBeDefined();
    lawOption?.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await flushPromises();
    form = wrapper.get(".material-panel form.content-form");
    await form
      .find('input[type="url"]')
      .setValue("https://www.planalto.gov.br/");
    await form.trigger("submit");
    await flushPromises();

    expect(materialInputs[1]).toMatchObject({
      title: "Constituição Federal",
      type: "law",
    });
    expect(wrapper.get(".law-materials-section").text()).toContain(
      "Constituição Federal",
    );
    expect(
      wrapper
        .get(".law-material-card .material-preview--law img")
        .attributes("src"),
    ).toBe("/brazil-coat-of-arms.svg");
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
    expect(wrapper.find(".video-lessons-section").exists()).toBe(false);
  });
});
