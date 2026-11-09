import { reactive } from "vue";

interface ActiveStudyTimer {
  topicId: string | null;
  elapsedSeconds: number;
  isRunning: boolean;
}

export const activeStudyTimer = reactive<ActiveStudyTimer>({
  topicId: null,
  elapsedSeconds: 0,
  isRunning: false,
});

let accumulatedMilliseconds = 0;
let segmentStartedAt: number | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

function updateElapsedTime(now = Date.now()): void {
  const currentSegment =
    segmentStartedAt === null ? 0 : Math.max(0, now - segmentStartedAt);
  activeStudyTimer.elapsedSeconds = Math.floor(
    (accumulatedMilliseconds + currentSegment) / 1000,
  );
}

function stopTicker(): void {
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
}

function startTicker(): void {
  stopTicker();
  ticker = setInterval(updateElapsedTime, 1000);
}

export function startStudyTimer(topicId: string): void {
  if (
    activeStudyTimer.topicId !== null &&
    activeStudyTimer.topicId !== topicId
  ) {
    throw new Error(
      "Finalize ou pause o cronômetro atual antes de iniciar outro.",
    );
  }

  if (activeStudyTimer.topicId === topicId) {
    resumeStudyTimer();
    return;
  }

  activeStudyTimer.topicId = topicId;
  activeStudyTimer.elapsedSeconds = 0;
  activeStudyTimer.isRunning = true;
  accumulatedMilliseconds = 0;
  segmentStartedAt = Date.now();
  startTicker();
}

export function pauseStudyTimer(): void {
  if (activeStudyTimer.topicId === null || !activeStudyTimer.isRunning) return;

  const now = Date.now();
  updateElapsedTime(now);
  if (segmentStartedAt !== null) {
    accumulatedMilliseconds += Math.max(0, now - segmentStartedAt);
  }
  segmentStartedAt = null;
  activeStudyTimer.isRunning = false;
  stopTicker();
}

export function resumeStudyTimer(): void {
  if (activeStudyTimer.topicId === null || activeStudyTimer.isRunning) return;

  segmentStartedAt = Date.now();
  activeStudyTimer.isRunning = true;
  startTicker();
}

export function getTimedStudySession(): {
  topicId: string;
  durationMinutes: number;
  durationSeconds: number;
  elapsedSeconds: number;
} | null {
  if (activeStudyTimer.topicId === null) return null;

  if (activeStudyTimer.isRunning) updateElapsedTime();
  return {
    topicId: activeStudyTimer.topicId,
    elapsedSeconds: activeStudyTimer.elapsedSeconds,
    durationMinutes: Math.floor(activeStudyTimer.elapsedSeconds / 60),
    durationSeconds: activeStudyTimer.elapsedSeconds,
  };
}

export function resetStudyTimer(): void {
  stopTicker();
  activeStudyTimer.topicId = null;
  activeStudyTimer.elapsedSeconds = 0;
  activeStudyTimer.isRunning = false;
  accumulatedMilliseconds = 0;
  segmentStartedAt = null;
}
