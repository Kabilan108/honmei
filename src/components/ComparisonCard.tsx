import type { JSX, ReactNode } from "react";

export type WatchStatus =
  | "COMPLETED"
  | "WATCHING"
  | "PLAN_TO_WATCH"
  | "DROPPED"
  | "ON_HOLD";

export interface ComparisonItem {
  _id: string;
  rating: number;
  rd: number;
  comparisonCount: number;
  mediaTitle: string;
  mediaCoverImage: string;
  mediaBannerImage?: string;
  mediaType: "ANIME" | "MANGA";
  mediaGenres: string[];
  watchStatus: WatchStatus;
  startYear?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  format?: string | null;
}

export const STATUS_LABELS: Record<WatchStatus, string> = {
  COMPLETED: "Completed",
  WATCHING: "Watching",
  PLAN_TO_WATCH: "Plan to Watch",
  DROPPED: "Dropped",
  ON_HOLD: "On Hold",
};

export const STATUS_COLORS: Record<WatchStatus, string> = {
  COMPLETED: "bg-status-completed text-status-completed-fg",
  WATCHING: "bg-status-watching text-status-watching-fg",
  PLAN_TO_WATCH: "bg-status-plan text-status-plan-fg",
  DROPPED: "bg-status-dropped text-status-dropped-fg",
  ON_HOLD: "bg-status-hold text-status-hold-fg",
};

export type ResultState = "winner" | "loser" | "tie" | null;

interface ComparisonCardProps {
  item: ComparisonItem;
  ratingDisplay: ReactNode;
  disabled: boolean;
  onClick: () => void;
  resultState?: ResultState;
}

function getResultStyles(resultState: ResultState): string {
  switch (resultState) {
    case "winner":
      return "border-success -translate-y-2 shadow-xl shadow-success/25";
    case "loser":
      return "border-border/50 opacity-60";
    case "tie":
      return "border-primary -translate-y-1 shadow-lg shadow-primary/15 opacity-75";
    default:
      return "border-border";
  }
}

export function ComparisonCard({
  item,
  ratingDisplay,
  disabled,
  onClick,
  resultState = null,
}: ComparisonCardProps): JSX.Element {
  const resultStyles = getResultStyles(resultState);
  const isShowingResult = resultState !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bg-surface border-2 overflow-hidden transition-all duration-300 text-left focus:outline-none w-full ${resultStyles} ${
        isShowingResult
          ? ""
          : "hover:border-primary hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 focus:border-primary"
      }`}
    >
      <div className="relative">
        <div className="aspect-[4/5] md:aspect-[3/4] bg-surface-raised relative overflow-hidden">
          <img
            src={item.mediaCoverImage}
            alt={item.mediaTitle}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 space-y-2 md:space-y-3">
            <h3
              className="text-lg md:text-xl font-bold line-clamp-2 leading-tight"
              title={item.mediaTitle}
            >
              {item.mediaTitle}
            </h3>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] md:text-xs px-1.5 py-0.5 ${STATUS_COLORS[item.watchStatus]}`}
              >
                {STATUS_LABELS[item.watchStatus]}
              </span>
              {item.startYear && (
                <span className="text-[10px] md:text-xs text-foreground-muted bg-white/10 px-1.5 py-0.5">
                  {item.startYear}
                </span>
              )}
              {item.mediaType === "ANIME" && item.episodes && (
                <span className="text-[10px] md:text-xs text-foreground-muted bg-white/10 px-1.5 py-0.5">
                  {item.episodes} eps
                </span>
              )}
              {item.mediaType === "MANGA" && item.chapters && (
                <span className="text-[10px] md:text-xs text-foreground-muted bg-white/10 px-1.5 py-0.5">
                  {item.chapters} ch
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.mediaGenres.slice(0, 2).map((genre) => (
                <span
                  key={genre}
                  className="text-[10px] md:text-xs text-foreground-muted bg-white/10 px-1.5 py-0.5"
                >
                  {genre}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm md:text-base pt-1">
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-foreground-muted text-xs md:text-sm">
                  Rating:
                </span>
                <span className="font-mono font-bold text-base md:text-xl">
                  {ratingDisplay}
                </span>
              </div>
              <div className="text-foreground-muted text-xs md:text-sm">
                {item.comparisonCount} comps
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
