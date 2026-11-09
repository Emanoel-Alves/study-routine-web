import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeStudyTimer,
  getTimedStudySession,
  pauseStudyTimer,
  resetStudyTimer,
  resumeStudyTimer,
  startStudyTimer,
} from "./study-timer";

describe("study timer", () => {
  afterEach(() => {
    resetStudyTimer();
    vi.useRealTimers();
  });

  it("pauses and resumes elapsed time and rounds saved duration up to a minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    startStudyTimer("topic-1");

    vi.advanceTimersByTime(65_000);
    expect(getTimedStudySession()).toEqual({
      topicId: "topic-1",
      elapsedSeconds: 65,
      durationMinutes: 2,
    });

    pauseStudyTimer();
    vi.advanceTimersByTime(30_000);
    expect(activeStudyTimer.elapsedSeconds).toBe(65);

    resumeStudyTimer();
    vi.advanceTimersByTime(10_000);
    expect(getTimedStudySession()).toEqual({
      topicId: "topic-1",
      elapsedSeconds: 75,
      durationMinutes: 2,
    });
  });

  it("does not allow two topics to run at once", () => {
    vi.useFakeTimers();
    startStudyTimer("topic-1");

    expect(() => startStudyTimer("topic-2")).toThrow(
      "Finalize ou pause o cronômetro atual antes de iniciar outro.",
    );
    expect(activeStudyTimer.topicId).toBe("topic-1");
  });
});
