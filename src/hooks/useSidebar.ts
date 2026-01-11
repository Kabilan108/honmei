import { useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";

export function useSidebar(): { isCollapsed: boolean; toggle: () => void } {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  function toggle() {
    setIsCollapsed((prev) => !prev);
  }

  return { isCollapsed, toggle };
}
