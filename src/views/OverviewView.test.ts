import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUser, logout } from "../auth";
import OverviewView from "./OverviewView.vue";

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

async function mountOverviewView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: OverviewView }],
  });
  await router.push("/");
  await router.isReady();
  const wrapper = mount(RouterView, {
    global: { plugins: [router] },
  });
  await flushPromises();
  return wrapper;
}

describe("OverviewView", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
  });

  it("shows a real weekly summary and keeps the two main actions separated", async () => {
    currentUser.value = { id: "user-1", email: "student@example.com" };
    const today = new Date().toISOString().slice(0, 10);
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/health")) {
          return response({ status: "ok" });
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
                status: "not_started",
                estimatedMinutes: 45,
                reviewDueAt: null,
              },
            ],
            materials: [],
          });
        }
        return response({
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
                    status: "not_started",
                    estimatedMinutes: 45,
                    usesDefaultEstimate: false,
                    manuallyScheduled: false,
                  },
                ],
                overCapacity: false,
                studiedMinutes: 0,
              },
            ],
            unscheduledTopics: [],
            totalAvailableMinutes: 60,
            plannedMinutes: 45,
            workloadMinutes: 45,
            weeklyStudiedMinutes: 0,
            weeklySessionCount: 0,
            deadline: null,
          },
          sessions: [],
        });
      }),
    );

    const wrapper = await mountOverviewView();

    expect(wrapper.get("#plan-heading").text()).toBe("Plano da semana");
    expect(wrapper.text()).toContain("Modelagem relacional");
    expect(wrapper.text()).toContain("Banco de Dados");
    expect(wrapper.text()).toContain("Abrir planejamento semanal");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    expect(wrapper.find(".overview-actions").findAll("a")).toHaveLength(2);
  });

  it("shows API failures instead of treating them as an empty plan", async () => {
    currentUser.value = { id: "user-2", email: "student@example.com" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/api/health")
          ? response({ status: "ok" })
          : response({ error: "API indisponível." }, 503),
      ),
    );

    const wrapper = await mountOverviewView();

    expect(wrapper.get('[role="alert"]').text()).toBe("API indisponível.");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
  });
});
