import { requestApi } from "./auth";

export type QuestionStatus = "active" | "annulled" | "outdated";

export interface QuestionSource {
  name: string;
  url: string;
  exam: string;
  board: string;
  role: string;
  year: number | null;
  number: string;
}

export interface StudyQuestion {
  id: string;
  subjectId: string;
  topicId: string;
  statement: string;
  options: string[];
  correctOption: number;
  explanation: string;
  source: QuestionSource;
  status: QuestionStatus;
  statusNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyQuestionInput {
  topicId: string;
  statement: string;
  options: string[];
  correctOption: number;
  explanation: string;
  source: QuestionSource;
  status: QuestionStatus;
  statusNote: string;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export function getQuestions(): Promise<StudyQuestion[]> {
  return requestApi("/api/questions");
}

export function importUfcGovernanceQuestions(): Promise<{
  createdCount: number;
  existingCount: number;
  totalCount: number;
}> {
  return requestApi("/api/questions/import-ufc-governance", {
    method: "POST",
  });
}

export function createQuestion(
  input: StudyQuestionInput,
): Promise<StudyQuestion> {
  return requestApi("/api/questions", {
    method: "POST",
    body: jsonBody(input),
  });
}

export function updateQuestion(
  questionId: string,
  input: StudyQuestionInput,
): Promise<StudyQuestion> {
  return requestApi(`/api/questions/${encodeURIComponent(questionId)}`, {
    method: "PATCH",
    body: jsonBody(input),
  });
}

export function deleteQuestion(questionId: string): Promise<{ deleted: true }> {
  return requestApi(`/api/questions/${encodeURIComponent(questionId)}`, {
    method: "DELETE",
  });
}
