export type WatchStatus =
  | "COMPLETED"
  | "WATCHING"
  | "PLAN_TO_WATCH"
  | "DROPPED"
  | "ON_HOLD";

export type MediaType = "ANIME" | "MANGA";

export const STATUS_CYCLE: WatchStatus[] = [
  "PLAN_TO_WATCH",
  "WATCHING",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
];

export const STATUS_CONFIG: Record<
  WatchStatus,
  { label: string; mangaLabel?: string; className: string }
> = {
  COMPLETED: {
    label: "Completed",
    className: "bg-green-600/20 text-green-400 border-green-600/30",
  },
  WATCHING: {
    label: "Watching",
    mangaLabel: "Reading",
    className: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  },
  PLAN_TO_WATCH: {
    label: "Plan to Watch",
    mangaLabel: "Plan to Read",
    className: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
  },
  DROPPED: {
    label: "Dropped",
    className: "bg-red-600/20 text-red-400 border-red-600/30",
  },
  ON_HOLD: {
    label: "On Hold",
    className: "bg-orange-600/20 text-orange-400 border-orange-600/30",
  },
};

export function getStatusLabel(
  status: WatchStatus,
  mediaType: MediaType,
): string {
  const config = STATUS_CONFIG[status];
  if (mediaType === "MANGA" && config.mangaLabel) {
    return config.mangaLabel;
  }
  return config.label;
}
