import {
  GitCompare,
  Home,
  PanelLeft,
  PanelLeftClose,
  Search,
  Settings,
} from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "Library" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/compare", icon: GitCompare, label: "Compare" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 safe-area-inset-bottom md:hidden z-50">
      <div className="flex items-center justify-around h-16 max-w-7xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors flex-1",
                isActive
                  ? "text-primary"
                  : "text-neutral-400 hover:text-neutral-50",
              )}
            >
              <Icon className="w-6 h-6" />
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
}

function NavItem({
  path,
  icon: Icon,
  label,
  isActive,
  isCollapsed,
}: NavItemProps) {
  const linkContent = (
    <Link
      to={path}
      className={cn(
        "flex items-center rounded-md transition-colors",
        isCollapsed ? "w-10 h-10 justify-center" : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50",
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
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

function Sidebar() {
  const location = useLocation();
  const { isCollapsed, toggle } = useSidebar();

  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex items-center rounded-md transition-colors text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50",
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
        "hidden md:flex flex-col bg-neutral-900 border-r border-neutral-800 h-screen fixed left-0 top-0 z-50 transition-all duration-200",
        isCollapsed ? "w-16" : "w-56",
      )}
    >
      <div
        className={cn(
          "h-14 border-b border-neutral-800 flex items-center",
          isCollapsed ? "justify-center" : "px-4",
        )}
      >
        {isCollapsed ? (
          <span className="text-lg font-bold text-neutral-50">C</span>
        ) : (
          <h1 className="text-lg font-bold text-neutral-50">Curator</h1>
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
          />
        ))}
      </nav>

      <div
        className={cn(
          "py-3 border-t border-neutral-800",
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <Sidebar />

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

      <BottomNav />
    </div>
  );
}
