import type { JSX, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface ComparisonItem {
  _id: string;
  eloRating: number;
  comparisonCount: number;
  mediaTitle: string;
  mediaCoverImage: string;
  mediaBannerImage?: string;
  mediaType: "ANIME" | "MANGA";
  mediaGenres: string[];
}

interface ComparisonCardProps {
  item: ComparisonItem;
  ratingDisplay: ReactNode;
  disabled: boolean;
  onClick: () => void;
}

export function ComparisonCard({
  item,
  ratingDisplay,
  disabled,
  onClick,
}: ComparisonCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-neutral-900 border-2 border-neutral-800 overflow-hidden hover:border-primary transition-all duration-200 disabled:opacity-50 text-left focus:outline-none focus:border-primary hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 w-full"
    >
      <div className="relative">
        <div className="aspect-[4/5] md:aspect-[3/4] bg-neutral-800 relative overflow-hidden">
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

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {item.mediaType}
              </Badge>
              {item.mediaGenres.slice(0, 2).map((genre) => (
                <span
                  key={genre}
                  className="text-[10px] md:text-xs text-neutral-300 bg-white/10 px-1.5 py-0.5"
                >
                  {genre}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm md:text-base pt-1">
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-neutral-400 text-xs md:text-sm">
                  Rating:
                </span>
                <span className="font-mono font-bold text-base md:text-xl">
                  {ratingDisplay}
                </span>
              </div>
              <div className="text-neutral-400 text-xs md:text-sm">
                {item.comparisonCount} comps
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
