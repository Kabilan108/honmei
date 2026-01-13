export type WatchStatus =
  | "COMPLETED"
  | "WATCHING"
  | "PLAN_TO_WATCH"
  | "DROPPED"
  | "ON_HOLD";

export function malScoreToRating(malScore: number | null): number {
  if (!malScore || malScore === 0) return 1500;
  return 900 + (malScore - 1) * 100;
}

export function malStatusToWatchStatus(malStatus: string): WatchStatus {
  const normalized = malStatus.toLowerCase().replace(/\s+/g, "_");
  switch (normalized) {
    case "completed":
      return "COMPLETED";
    case "watching":
    case "reading":
      return "WATCHING";
    case "plan_to_watch":
    case "plan_to_read":
      return "PLAN_TO_WATCH";
    case "dropped":
      return "DROPPED";
    case "on_hold":
    case "on-hold":
      return "ON_HOLD";
    default:
      return "PLAN_TO_WATCH";
  }
}
