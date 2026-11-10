import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUser, logout } from "../auth";
import { activeStudyTimer } from "../study-timer";
import PlanningView from "./PlanningView.vue";

HTMLElement.prototype.hasPointerCapture ??= () => false;
HTMLElement.prototype.releasePointerCapture ??= () => {};

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

async function mountPlanningView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/planning", component: PlanningView },
      { path: "/:pathMatch(.*)*", component: { render: () => null } },
    ],
  });
  await router.push("/planning");
  await router.isReady();
  const wrapper = mount(RouterView, {
    global: { plugins: [router] },
  });
  await flushPromises();
  return wrapper;
}

async function chooseSelectOption(
  wrapper: Awaited<ReturnType<typeof mountPlanningView>>,
  selector: string,
  label: string,
): Promise<void> {
  await wrapper.get(selector).trigger("pointerdown");
  await flushPromises();
  const option = Array.from(
    document.querySelectorAll<HTMLElement>(".app-select-item"),
  ).find((item) => item.textContent?.trim() === label);
  expect(option).toBeDefined();
  option!.dispatchEvent(new Event("pointerup", { bubbles: true }));
  await flushPromises();
}

describe("PlanningView timer", () => {
  afterEach(() => {
    logout();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts, pauses, resumes, and saves the measured study session", async () => {
    currentUser.value = { id: "user-1", email: "student@example.com" };
    vi.useFakeTimers();
    const today = new Date().toISOString().slice(0, 10);
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    let registeredSession:
      | {
          kind: string;
          durationMinutes?: number;
          durationSeconds?: number;
          date: string;
        }
      | undefined;
    const session = {
      id: "session-1",
      topicId: "topic-1",
      date: today,
      durationMinutes: 1,
      durationSeconds: 75,
      notes: "",
      kind: "study",
      createdAt: new Date().toISOString(),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/topics/topic-1/sessions")) {
          registeredSession = JSON.parse(String(init?.body)) as {
            kind: string;
            durationMinutes?: number;
            durationSeconds?: number;
            date: string;
          };
          return response(
            {
              session,
              topic: {
                id: "topic-1",
                status: "in_progress",
                reviewDueAt: null,
              },
            },
            201,
          );
        }
        if (url.endsWith("/api/content")) {
          return response({
            subjects: [
              {
                id: "subject-1",
                name: "Banco de Dados",
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
                name: "Modelagem relacional",
                description: "",
                notes: "",
                position: 0,
                status: registeredSession ? "in_progress" : "not_started",
                estimatedMinutes: 45,
                reviewDueAt: null,
              },
            ],
            materials: [],
          });
        }
        return response({
          plans: [
            {
              id: "default",
              name: "Meu planejamento",
              active: true,
              createdAt: new Date().toISOString(),
            },
          ],
          activePlan: { id: "default", name: "Meu planejamento" },
          preferences: {
            studyDays: [weekday],
            minutesPerDay: 60,
            targetDate: null,
          },
          plan: {
            weekStart: today,
            weekEnd: today,
            days: [
              {
                date: today,
                weekday,
                available: true,
                capacityMinutes: 60,
                plannedMinutes: 45,
                topics: [
                  {
                    topicId: "topic-1",
                    subjectId: "subject-1",
                    subjectName: "Banco de Dados",
                    topicName: "Modelagem relacional",
                    status: registeredSession ? "in_progress" : "not_started",
                    estimatedMinutes: 45,
                    usesDefaultEstimate: false,
                    manuallyScheduled: false,
                  },
                ],
                overCapacity: false,
                studiedMinutes: registeredSession ? 1 : 0,
              },
            ],
            unscheduledTopics: [],
            totalAvailableMinutes: 60,
            plannedMinutes: registeredSession ? 0 : 45,
            workloadMinutes: registeredSession ? 0 : 45,
            weeklyStudiedMinutes: registeredSession ? 1 : 0,
            weeklySessionCount: registeredSession ? 1 : 0,
            deadline: null,
          },
          sessions: registeredSession ? [session] : [],
        });
      }),
    );

    const wrapper = await mountPlanningView();
    await wrapper.get("#target-date-trigger").trigger("click");
    expect(wrapper.find("#target-date-calendar").exists()).toBe(true);
    expect(wrapper.find('input[type="date"]').exists()).toBe(false);
    await wrapper.get(".date-picker-footer button:last-child").trigger("click");
    expect(wrapper.find("#target-date-calendar").exists()).toBe(false);
    expect(wrapper.get("#target-date-trigger").text()).toContain(
      new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${today}T12:00:00.000Z`)),
    );
    expect(wrapper.text()).toContain("Registrar manualmente");
    expect(wrapper.get(".timer-start").classes()).toContain("secondary-button");
    expect(wrapper.get(".timer-start").classes()).not.toContain("text-button");
    await wrapper.get(".timer-start").trigger("click");
    expect(wrapper.text()).not.toContain("Registrar manualmente");
    await vi.advanceTimersByTimeAsync(65_000);
    await flushPromises();

    expect(wrapper.get(".timer-display").text()).toBe("00:01:05");
    await wrapper.get(".timer-focus-trigger").trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "Modelagem relacional",
    );
    expect(wrapper.get(".timer-focus-display").text()).toBe("00:01:05");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);

    await wrapper.get(".timer-focus-trigger").trigger("click");
    await wrapper
      .get('button[aria-label="Pausar cronômetro"]')
      .trigger("click");
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises();
    expect(wrapper.get(".timer-display").text()).toBe("00:01:05");

    await wrapper
      .get('button[aria-label="Continuar cronômetro"]')
      .trigger("click");
    await vi.advanceTimersByTimeAsync(10_000);
    await flushPromises();
    expect(wrapper.get(".timer-display").text()).toBe("00:01:15");

    await wrapper.get('button[aria-label="Finalizar sessão"]').trigger("click");
    await flushPromises();

    expect(registeredSession).toEqual({
      kind: "study",
      date: today,
      durationSeconds: 75,
    });
    expect(activeStudyTimer.topicId).toBeNull();
    expect(wrapper.text()).toContain("Sessão de 1 min 15 s registrada.");
    expect(wrapper.text()).toContain("Registrar manualmente");
    expect(wrapper.text()).toContain("Sessões desta semana");
  });

  it("creates a named plan and switches back to the previous one", async () => {
    currentUser.value = { id: "user-1", email: "student@example.com" };
    const today = new Date().toISOString().slice(0, 10);
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    const plans = [
      {
        id: "default",
        name: "Meu planejamento",
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
    const subjects = [
      {
        id: "subject-1",
        name: "Banco de Dados",
        description: "",
        notes: "",
        position: 0,
        archived: false,
      },
    ];
    const topics = ["topic-1", "topic-2"].map((id, position) => ({
      id,
      subjectId: "subject-1",
      name: `Tópico ${position + 1}`,
      description: "",
      notes: "",
      position,
      status: "not_started",
      estimatedMinutes: 45,
      reviewDueAt: null,
    }));
    const topicSelections: Record<string, string[] | null> = {
      default: null,
    };
    let activePlanId = "default";
    let nextPlanId = 1;
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.endsWith("/api/planning/plans/plan-1") &&
          init?.method === "DELETE"
        ) {
          plans.splice(
            plans.findIndex((plan) => plan.id === "plan-1"),
            1,
          );
          delete topicSelections["plan-1"];
          activePlanId = "default";
          for (const plan of plans) plan.active = plan.id === activePlanId;
          return response({ deleted: true });
        }
        if (url.endsWith("/api/content")) {
          return response({ subjects, topics, materials: [] });
        }
        if (url.endsWith("/api/planning/plans") && init?.method === "POST") {
          const { name, topicIds } = JSON.parse(String(init.body)) as {
            name: string;
            topicIds: string[];
          };
          const plan = {
            id: `plan-${nextPlanId++}`,
            name,
            active: true,
            createdAt: new Date().toISOString(),
            selectedTopicIds: topicIds,
          };
          for (const item of plans) item.active = false;
          plans.push(plan);
          topicSelections[plan.id] = topicIds;
          activePlanId = plan.id;
          return response(plan, 201);
        }
        if (url.endsWith("/api/planning/topics") && init?.method === "PATCH") {
          const { topicIds } = JSON.parse(String(init.body)) as {
            topicIds: string[];
          };
          topicSelections[activePlanId] = topicIds;
          return response({ selectedTopicIds: topicIds });
        }
        if (url.includes("/api/planning/plans/") && url.endsWith("/activate")) {
          const planId = url.split("/").at(-2);
          for (const item of plans) item.active = item.id === planId;
          activePlanId = planId ?? "default";
          return response(plans.find((item) => item.id === activePlanId));
        }
        return response({
          plans,
          activePlan: {
            id: activePlanId,
            name: plans.find((item) => item.id === activePlanId)?.name ?? "",
            selectedTopicIds: topicSelections[activePlanId] ?? null,
          },
          preferences: {
            studyDays: [weekday],
            minutesPerDay: activePlanId === "default" ? 90 : 60,
            targetDate: null,
          },
          plan: {
            weekStart: today,
            weekEnd: today,
            days: [],
            unscheduledTopics: [],
            totalAvailableMinutes: 0,
            plannedMinutes: 0,
            workloadMinutes: 0,
            weeklyStudiedMinutes: 0,
            weeklySessionCount: 0,
            deadline: null,
          },
          sessions: [],
        });
      }),
    );

    const wrapper = await mountPlanningView();
    expect(wrapper.find(".planning-topics-panel").exists()).toBe(false);
    const newPlanButton = wrapper
      .findAll(".planning-profile-actions button")
      .find((button) => button.text().includes("Novo planejamento"));
    expect(newPlanButton).toBeDefined();
    await newPlanButton!.trigger("click");
    expect(wrapper.find(".planning-topics-panel").exists()).toBe(true);
    await wrapper.get("#planning-profile-name").setValue("Concurso UFC 2027");
    const creationTopicCheckboxes = wrapper.findAll(
      ".planning-topic-choice input[type=checkbox]",
    );
    expect(creationTopicCheckboxes).toHaveLength(2);
    await creationTopicCheckboxes[0].setValue(true);
    await wrapper.get(".planning-profile-form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain(
      'Planejamento "Concurso UFC 2027" criado e selecionado.',
    );
    expect(topicSelections["plan-1"]).toEqual(["topic-1"]);
    expect(wrapper.find(".planning-topics-panel").exists()).toBe(false);
    expect(wrapper.text()).toContain("0 de 1 tópicos · 0%");
    expect(
      wrapper.get(".planning-profile-select .app-select-trigger").text(),
    ).toContain("Concurso UFC 2027");
    await wrapper.get(".planning-profile-actions button").trigger("click");
    const topicCheckboxes = wrapper.findAll(
      ".planning-topic-choice input[type=checkbox]",
    );
    expect((topicCheckboxes[0].element as HTMLInputElement).checked).toBe(true);
    expect((topicCheckboxes[1].element as HTMLInputElement).checked).toBe(
      false,
    );
    await topicCheckboxes[1].setValue(true);
    await wrapper.get(".planning-topic-footer button").trigger("click");
    await flushPromises();
    expect(topicSelections["plan-1"]).toEqual(["topic-1", "topic-2"]);
    expect(wrapper.find(".planning-topics-panel").exists()).toBe(false);
    expect(wrapper.text()).toContain("0 de 2 tópicos · 0%");

    await chooseSelectOption(
      wrapper,
      ".planning-profile-select .app-select-trigger",
      "Meu planejamento",
    );
    expect(wrapper.text()).toContain(
      'Planejamento "Meu planejamento" selecionado.',
    );
    expect(wrapper.get('input[type="number"]').element).toHaveProperty(
      "value",
      "90",
    );
    expect(wrapper.find(".planning-topics-panel").exists()).toBe(false);
    expect(wrapper.text()).toContain("0 de 2 tópicos · 0%");
    await chooseSelectOption(
      wrapper,
      ".planning-profile-select .app-select-trigger",
      "Concurso UFC 2027",
    );
    await wrapper.get(".planning-profile-actions button").trigger("click");
    const planTopicCheckboxes = wrapper.findAll(
      ".planning-topic-choice input[type=checkbox]",
    );
    expect((planTopicCheckboxes[0].element as HTMLInputElement).checked).toBe(
      true,
    );
    expect((planTopicCheckboxes[1].element as HTMLInputElement).checked).toBe(
      true,
    );
    await wrapper
      .get(".planning-topic-footer .secondary-button")
      .trigger("click");
    await wrapper
      .get(".planning-profile-actions .danger-button")
      .trigger("click");
    await flushPromises();
    expect(vi.mocked(window.confirm)).toHaveBeenCalledOnce();
    expect(plans.map((plan) => plan.id)).toEqual(["default"]);
    expect(wrapper.text()).toContain(
      'Planejamento "Concurso UFC 2027" apagado.',
    );
    expect(
      wrapper.get(".planning-profile-select .app-select-trigger").text(),
    ).toContain("Meu planejamento");
    expect(
      wrapper.find(".planning-profile-actions .danger-button").exists(),
    ).toBe(false);
  });
});
