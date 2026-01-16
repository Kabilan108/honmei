import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import {
  type ComparisonItem,
  type ResultState,
  STATUS_COLORS,
  STATUS_LABELS,
} from "./ComparisonCard";

interface SwipeCardProps {
  item: ComparisonItem;
  ratingDisplay: ReactNode;
  resultState: ResultState;
}

function SwipeCard({ item, ratingDisplay, resultState }: SwipeCardProps) {
  const resultStyles = {
    winner: "border-success shadow-lg shadow-success/25",
    loser: "opacity-60 border-border/50",
    tie: "border-primary shadow-lg shadow-primary/15",
    null: "border-border",
  }[resultState ?? "null"];

  return (
    <div
      className={`w-full flex-shrink-0 bg-surface border-2 ${resultStyles} transition-all duration-300`}
    >
      <div className="aspect-[3/4] relative overflow-hidden">
        <img
          src={item.mediaCoverImage}
          alt={item.mediaTitle}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          <h3 className="text-xl font-bold line-clamp-2">{item.mediaTitle}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs px-2 py-0.5 ${STATUS_COLORS[item.watchStatus]}`}
            >
              {STATUS_LABELS[item.watchStatus]}
            </span>
            {item.startYear && (
              <span className="text-xs text-foreground-muted bg-white/10 px-2 py-0.5">
                {item.startYear}
              </span>
            )}
            {item.mediaType === "ANIME" && item.episodes && (
              <span className="text-xs text-foreground-muted bg-white/10 px-2 py-0.5">
                {item.episodes} eps
              </span>
            )}
            {item.mediaType === "MANGA" && item.chapters && (
              <span className="text-xs text-foreground-muted bg-white/10 px-2 py-0.5">
                {item.chapters} ch
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {item.mediaGenres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="text-xs text-foreground-muted bg-white/10 px-2 py-0.5"
              >
                {genre}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-foreground-muted text-sm">Rating:</span>
              <span className="font-mono font-bold text-lg">
                {ratingDisplay}
              </span>
            </div>
            <span className="text-foreground-muted text-sm">
              {item.comparisonCount} comps
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MobileComparisonSwipeProps {
  item1: ComparisonItem;
  item2: ComparisonItem;
  ratingDisplay1: ReactNode;
  ratingDisplay2: ReactNode;
  disabled: boolean;
  onChoice: (winnerId: string, loserId: string) => void;
  getResultState: (itemId: string) => ResultState;
}

export function MobileComparisonSwipe({
  item1,
  item2,
  ratingDisplay1,
  ratingDisplay2,
  disabled,
  onChoice,
  getResultState,
}: MobileComparisonSwipeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  const items = [
    { item: item1, rating: ratingDisplay1 },
    { item: item2, rating: ratingDisplay2 },
  ];

  const SWIPE_THRESHOLD = 0.4;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || disabled) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging || disabled) return;
    setIsDragging(false);

    const containerWidth = containerRef.current?.offsetWidth || 300;
    const swipeRatio = Math.abs(dragOffset) / containerWidth;

    if (swipeRatio > SWIPE_THRESHOLD) {
      const swipedLeft = dragOffset < 0;

      if (currentIndex === 0 && swipedLeft) {
        onChoice(item2._id, item1._id);
      } else if (currentIndex === 1 && !swipedLeft) {
        onChoice(item1._id, item2._id);
      } else {
        setCurrentIndex(swipedLeft ? 1 : 0);
      }
    }

    setDragOffset(0);
  };

  const handleNavClick = (index: number) => {
    if (disabled) return;
    setCurrentIndex(index);
  };

  const handleSelectCurrent = () => {
    if (disabled) return;
    const winner = items[currentIndex].item;
    const loser = items[1 - currentIndex].item;
    onChoice(winner._id, loser._id);
  };

  const containerWidth = containerRef.current?.offsetWidth || 300;
  const translateX = -currentIndex * 100 + (dragOffset / containerWidth) * 100;

  const currentTitle = items[currentIndex].item.mediaTitle;
  const truncatedTitle =
    currentTitle.length > 25 ? `${currentTitle.slice(0, 25)}...` : currentTitle;

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={() => handleNavClick(0)}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 rounded-r ${
            currentIndex === 0 ? "opacity-30" : "opacity-70"
          }`}
          disabled={currentIndex === 0 || disabled}
        >
          <ChevronLeft className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => handleNavClick(1)}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 rounded-l ${
            currentIndex === 1 ? "opacity-30" : "opacity-70"
          }`}
          disabled={currentIndex === 1 || disabled}
        >
          <ChevronRight className="size-6" />
        </button>

        <div
          className="flex transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(${translateX}%)`,
            transition: isDragging ? "none" : undefined,
          }}
        >
          {items.map(({ item, rating }) => (
            <SwipeCard
              key={item._id}
              item={item}
              ratingDisplay={rating}
              resultState={getResultState(item._id)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-2">
        {items.map(({ item }, index) => (
          <button
            key={item._id}
            type="button"
            onClick={() => handleNavClick(index)}
            disabled={disabled}
            className={`size-2.5 rounded-full transition-colors ${
              index === currentIndex ? "bg-primary" : "bg-foreground-subtle"
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleSelectCurrent}
        disabled={disabled}
        className="w-full py-3 bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 rounded"
      >
        Choose {truncatedTitle}
      </button>
    </div>
  );
}
