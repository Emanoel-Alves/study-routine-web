import { requestApi } from "./auth";
import type { StudyStatus } from "./content";

export interface StudyPreferences {
  studyDays: number[];
  minutesPerDay: number;
  targetDate: string | null;
}

export interface PlannedTopic {
  topicId: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  status: StudyStatus;
  estimatedMinutes: number;
  usesDefaultEstimate: boolean;
  manuallyScheduled: boolean;
}

export interface PlannedDay {
  date: string;
  weekday: number;
  available: boolean;
  capacityMinutes: number;
  plannedMinutes: number;
  topics: PlannedTopic[];
  overCapacity: boolean;
  studiedMinutes: number;
}

export interface WeeklyPlan {
  weekStart: string;
  weekEnd: string;
  days: PlannedDay[];
  unscheduledTopics: PlannedTopic[];
  totalAvailableMinutes: number;
  plannedMinutes: number;
  workloadMinutes: number;
  weeklyStudiedMinutes: number;
  weeklySessionCount: number;
  deadline: {
    date: string;
    availableMinutes: number;
    workloadMinutes: number;
    feasible: boolean;
  } | null;
}

export interface StudySession {
  id: string;
  topicId: string;
  date: string;
  durationMinutes: number;
  durationSeconds?: number;
  notes: string;
  kind: "study" | "review";
  createdAt: string;
}

export interface PlanningSnapshot {
  plans: StudyPlanSummary[];
  activePlan: Pick<StudyPlanSummary, "id" | "name">;
  preferences: StudyPreferences;
  plan: WeeklyPlan;
  sessions: StudySession[];
}

export interface StudyPlanSummary {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface PlanningSessionResult {
  session: StudySession;
  topic: {
    id: string;
    status: StudyStatus;
    reviewDueAt: string | null;
  };
}

export function getPlanning(): Promise<PlanningSnapshot> {
  return requestApi("/api/planning");
}

export function createStudyPlan(name: string): Promise<StudyPlanSummary> {
  return requestApi("/api/planning/plans", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function activateStudyPlan(planId: string): Promise<StudyPlanSummary> {
  return requestApi(
    `/api/planning/plans/${encodeURIComponent(planId)}/activate`,
    {
      method: "PATCH",
    },
  );
}

export function savePreferences(
  preferences: StudyPreferences,
): Promise<StudyPreferences> {
  return requestApi("/api/planning/preferences", {
    method: "PATCH",
    body: JSON.stringify(preferences),
  });
}

export function movePlannedTopic(
  topicId: string,
  plannedDate: string,
): Promise<{ topicId: string; plannedDate: string; weekStart: string }> {
  return requestApi(`/api/planning/items/${encodeURIComponent(topicId)}`, {
    method: "PATCH",
    body: JSON.stringify({ plannedDate }),
  });
}

export function resetPlannedTopic(topicId: string): Promise<{ deleted: true }> {
  return requestApi(`/api/planning/items/${encodeURIComponent(topicId)}`, {
    method: "DELETE",
  });
}

export function registerSession(
  topicId: string,
  input: {
    kind: "study" | "review";
    durationMinutes?: number;
    durationSeconds?: number;
    date?: string;
    notes?: string;
  },
): Promise<PlanningSessionResult> {
  return requestApi(`/api/topics/${encodeURIComponent(topicId)}/sessions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
