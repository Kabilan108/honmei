import { Authenticated, Unauthenticated } from "convex/react";
import type { LucideIcon } from "lucide-react";
import { GitCompare, Home, Search, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { SignInDialog, UserMenu } from "@/components/auth";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { UNRANKED_NOTIFICATION_THRESHOLD } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
  showBadge?: boolean;
}

export const navItems: NavItem[] = [
  { path: "/", icon: Home, label: "Library" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/compare", icon: GitCompare, label: "Compare", showBadge: true },
  { path: "/settings", icon: Settings, label: "Settings" },
];

interface HeaderProps {
  unrankedCount: number;
}

function DesktopNav({ unrankedCount }: { unrankedCount: number }) {
  const location = useLocation();
  const showBadge = unrankedCount >= UNRANKED_NOTIFICATION_THRESHOLD;

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
              isActive
                ? "text-primary/80"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
            {item.showBadge && showBadge && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Header({ unrankedCount }: HeaderProps) {
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-50 h-14 bg-surface border-b border-border">
      <div className="container mx-auto px-4 h-full max-w-7xl flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-lg font-bold text-foreground">
            Honmei
          </Link>

          {!isMobile && (
            <Authenticated>
              <DesktopNav unrankedCount={unrankedCount} />
            </Authenticated>
          )}
        </div>

        <Authenticated>
          <UserMenu />
        </Authenticated>
        <Unauthenticated>
          <SignInDialog variant="header" />
        </Unauthenticated>
      </div>
    </header>
  );
}
