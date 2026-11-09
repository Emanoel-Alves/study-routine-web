import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUser, logout } from "../auth";
import { activeStudyTimer } from "../study-timer";
import PlanningView from "./PlanningView.vue";

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
    await wrapper.get(".timer-control-button").trigger("click");
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises();
    expect(wrapper.get(".timer-display").text()).toBe("00:01:05");

    const continueButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Continuar"));
    expect(continueButton).toBeDefined();
    await continueButton!.trigger("click");
    await vi.advanceTimersByTimeAsync(10_000);
    await flushPromises();
    expect(wrapper.get(".timer-display").text()).toBe("00:01:15");

    const finishButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Finalizar"));
    expect(finishButton).toBeDefined();
    await finishButton!.trigger("click");
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
    let activePlanId = "default";
    let nextPlanId = 1;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/content")) {
          return response({ subjects: [], topics: [], materials: [] });
        }
        if (url.endsWith("/api/planning/plans") && init?.method === "POST") {
          const { name } = JSON.parse(String(init.body)) as { name: string };
          const plan = {
            id: `plan-${nextPlanId++}`,
            name,
            active: true,
            createdAt: new Date().toISOString(),
          };
          for (const item of plans) item.active = false;
          plans.push(plan);
          activePlanId = plan.id;
          return response(plan, 201);
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
    await wrapper.get(".planning-profile-panel button").trigger("click");
    await wrapper.get("#planning-profile-name").setValue("Concurso UFC 2027");
    await wrapper.get(".planning-profile-form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain(
      'Planejamento "Concurso UFC 2027" criado e selecionado.',
    );
    const planSelect = wrapper.get(".planning-profile-select select");
    expect((planSelect.element as HTMLSelectElement).value).toBe("plan-1");

    await planSelect.setValue("default");
    await flushPromises();
    expect(wrapper.text()).toContain(
      'Planejamento "Meu planejamento" selecionado.',
    );
    expect((planSelect.element as HTMLSelectElement).value).toBe("default");
    expect(wrapper.get('input[type="number"]').element).toHaveProperty(
      "value",
      "90",
    );
  });
});
