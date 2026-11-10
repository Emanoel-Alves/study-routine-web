import { requestApi } from "./auth";

export type StudyStatus =
  "not_started" | "in_progress" | "studied" | "review_pending";

export type MaterialType =
  "video" | "law" | "book" | "article" | "questions" | "document" | "other";

export interface Subject {
  id: string;
  name: string;
  description: string;
  notes: string;
  position: number;
  archived: boolean;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  description: string;
  notes: string;
  position: number;
  status: StudyStatus;
  estimatedMinutes: number | null;
  reviewDueAt: string | null;
}

export interface Material {
  id: string;
  subjectId: string;
  topicId: string | null;
  title: string;
  type: MaterialType;
  url: string;
  text: string;
  professor?: string;
  thumbnailUrl?: string;
}

export interface ContentSnapshot {
  subjects: Subject[];
  topics: Topic[];
  materials: Material[];
}

export interface SubjectInput {
  name: string;
  description: string;
}

export interface TopicInput {
  name: string;
  description: string;
  status: StudyStatus;
  estimatedMinutes?: number | null;
}

export interface MaterialInput {
  topicId: string | null;
  title: string;
  type: MaterialType;
  url: string;
  text: string;
  professor: string;
  thumbnailUrl: string;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export function getContent(): Promise<ContentSnapshot> {
  return requestApi("/api/content");
}

export function importStudyMatrix(): Promise<{
  subjectsCreated: number;
  topicsCreated: number;
  materialsCreated: number;
  subjectsInMatrix: number;
  topicsInMatrix: number;
}> {
  return requestApi("/api/content/import-matrix", { method: "POST" });
}

export function createSubject(input: SubjectInput): Promise<Subject> {
  return requestApi("/api/subjects", {
    method: "POST",
    body: jsonBody(input),
  });
}

export function updateSubject(
  subjectId: string,
  input: Partial<SubjectInput> & { archived?: boolean; notes?: string },
): Promise<Subject> {
  return requestApi(`/api/subjects/${encodeURIComponent(subjectId)}`, {
    method: "PATCH",
    body: jsonBody(input),
  });
}

export function deleteSubject(
  subjectId: string,
): Promise<{ deleted: true; topics: number; materials: number }> {
  return requestApi(`/api/subjects/${encodeURIComponent(subjectId)}`, {
    method: "DELETE",
  });
}

export function createTopic(
  subjectId: string,
  input: TopicInput,
): Promise<Topic> {
  return requestApi(`/api/subjects/${encodeURIComponent(subjectId)}/topics`, {
    method: "POST",
    body: jsonBody(input),
  });
}

export function updateTopic(
  topicId: string,
  input: Partial<TopicInput> & { position?: number; notes?: string },
): Promise<Topic> {
  return requestApi(`/api/topics/${encodeURIComponent(topicId)}`, {
    method: "PATCH",
    body: jsonBody(input),
  });
}

export function deleteTopic(
  topicId: string,
): Promise<{ deleted: true; materials: number }> {
  return requestApi(`/api/topics/${encodeURIComponent(topicId)}`, {
    method: "DELETE",
  });
}

export function createMaterial(
  subjectId: string,
  input: MaterialInput,
): Promise<Material> {
  return requestApi(
    `/api/subjects/${encodeURIComponent(subjectId)}/materials`,
    {
      method: "POST",
      body: jsonBody(input),
    },
  );
}

export function updateMaterial(
  materialId: string,
  input: MaterialInput,
): Promise<Material> {
  return requestApi(`/api/materials/${encodeURIComponent(materialId)}`, {
    method: "PATCH",
    body: jsonBody(input),
  });
}

export function deleteMaterial(materialId: string): Promise<{ deleted: true }> {
  return requestApi(`/api/materials/${encodeURIComponent(materialId)}`, {
    method: "DELETE",
  });
}
