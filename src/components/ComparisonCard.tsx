import type { JSX, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface ComparisonItem {
  _id: string;
  eloRating: number;
  comparisonCount: number;
  // Denormalized media fields
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
      className="bg-neutral-900 border-2 border-neutral-800 overflow-hidden hover:border-blue-500 transition-all disabled:opacity-50 text-left focus:outline-none focus:border-blue-500"
    >
      <div className="aspect-video bg-neutral-800 relative overflow-hidden">
        {item.mediaBannerImage ? (
          <img
            src={item.mediaBannerImage}
            alt={item.mediaTitle}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={item.mediaCoverImage}
            alt={item.mediaTitle}
            loading="lazy"
            className="w-full h-full object-cover blur-lg scale-110"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
      </div>

      <div className="p-6 space-y-4">
        <div className="flex gap-4">
          <div className="w-20 h-28 bg-neutral-800 overflow-hidden flex-shrink-0">
            <img
              src={item.mediaCoverImage}
              alt={item.mediaTitle}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold mb-2 line-clamp-2">
              {item.mediaTitle}
            </h3>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">
                {item.mediaType}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="space-y-1">
            <div className="text-neutral-400">Rating</div>
            <div className="text-2xl font-bold font-mono">{ratingDisplay}</div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-neutral-400">Comparisons</div>
            <div className="text-lg font-medium">{item.comparisonCount}</div>
          </div>
        </div>

        {item.mediaGenres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.mediaGenres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
