import { Authenticated, useQuery } from "convex/react";
import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  RD_CONFIDENCE_THRESHOLD,
  UNRANKED_NOTIFICATION_THRESHOLD,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import { Header, navItems } from "./Header";

function BottomNav({ unrankedCount }: { unrankedCount: number }) {
  const location = useLocation();
  const showBadge = unrankedCount >= UNRANKED_NOTIFICATION_THRESHOLD;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border safe-area-inset-bottom md:hidden z-50">
      <div className="flex items-center justify-around h-16 max-w-7xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors flex-1 relative",
                isActive
                  ? "text-primary"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {item.showBadge && showBadge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Layout() {
  const library = useQuery(api.library.getByRating);

  const unrankedCount = useMemo(() => {
    if (!library) return 0;
    return library.filter((item) => item.rd > RD_CONFIDENCE_THRESHOLD).length;
  }, [library]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header unrankedCount={unrankedCount} />

      <main className="pb-20 md:pb-0">
        <div className="container mx-auto px-4 py-6 max-w-7xl animate-in fade-in duration-300">
          <Outlet />
        </div>
      </main>

      <Authenticated>
        <BottomNav unrankedCount={unrankedCount} />
      </Authenticated>
    </div>
  );
}
