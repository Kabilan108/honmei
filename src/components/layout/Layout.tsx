import { useQuery } from "convex/react";
import {
  GitCompare,
  Home,
  PanelLeft,
  PanelLeftClose,
  Search,
  Settings,
} from "lucide-react";
import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/hooks/useSidebar";
import { RD_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

const UNRANKED_NOTIFICATION_THRESHOLD = 3;

const navItems = [
  { path: "/", icon: Home, label: "Library" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/compare", icon: GitCompare, label: "Compare", showBadge: true },
  { path: "/settings", icon: Settings, label: "Settings" },
];

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

interface NavItemProps {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  showBadge?: boolean;
}

function NavItem({
  path,
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  showBadge,
}: NavItemProps) {
  const linkContent = (
    <Link
      to={path}
      className={cn(
        "flex items-center rounded-md transition-colors",
        isCollapsed ? "w-10 h-10 justify-center" : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
      )}
    >
      <div className="relative">
        <Icon className="w-5 h-5 shrink-0" />
        {showBadge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
        )}
      </div>
      {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={linkContent} />
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

function Sidebar({ unrankedCount }: { unrankedCount: number }) {
  const location = useLocation();
  const { isCollapsed, toggle } = useSidebar();
  const showBadge = unrankedCount >= UNRANKED_NOTIFICATION_THRESHOLD;

  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex items-center rounded-md transition-colors text-foreground-muted hover:bg-surface-raised hover:text-foreground",
        isCollapsed ? "w-10 h-10 justify-center" : "gap-3 px-3 py-2.5 w-full",
      )}
    >
      {isCollapsed ? (
        <PanelLeft className="w-5 h-5 shrink-0" />
      ) : (
        <>
          <PanelLeftClose className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">Collapse</span>
        </>
      )}
    </button>
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-surface border-r border-border h-screen fixed left-0 top-0 z-50 transition-all duration-200",
        isCollapsed ? "w-16" : "w-56",
      )}
    >
      <div
        className={cn(
          "h-14 border-b border-border flex items-center",
          isCollapsed ? "justify-center" : "px-4",
        )}
      >
        {isCollapsed ? (
          <span className="text-lg font-bold text-foreground">C</span>
        ) : (
          <h1 className="text-lg font-bold text-foreground">Curator</h1>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 py-3 space-y-1",
          isCollapsed ? "px-3 flex flex-col items-center" : "px-3",
        )}
      >
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            path={item.path}
            icon={item.icon}
            label={item.label}
            isActive={location.pathname === item.path}
            isCollapsed={isCollapsed}
            showBadge={item.showBadge && showBadge}
          />
        ))}
      </nav>

      <div
        className={cn(
          "py-3 border-t border-border",
          isCollapsed ? "px-3 flex justify-center" : "px-3",
        )}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger render={toggleButton} />
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          toggleButton
        )}
      </div>
    </aside>
  );
}

export function Layout() {
  const { isCollapsed } = useSidebar();
  const library = useQuery((api as any).library?.getByRating);

  const unrankedCount = useMemo(() => {
    if (!library) return 0;
    return library.filter((item: any) => item.rd > RD_CONFIDENCE_THRESHOLD)
      .length;
  }, [library]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar unrankedCount={unrankedCount} />

      <main
        className={cn(
          "pb-20 md:pb-0 transition-all duration-200",
          isCollapsed ? "md:ml-16" : "md:ml-56",
        )}
      >
        <div className="container mx-auto px-4 py-6 max-w-7xl animate-in fade-in duration-300">
          <Outlet />
        </div>
      </main>

      <BottomNav unrankedCount={unrankedCount} />
    </div>
  );
}
