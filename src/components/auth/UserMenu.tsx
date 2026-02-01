import { useClerk, useUser } from "@clerk/clerk-react";
import { LogOut, User } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { UserMenuDrawer } from "./UserMenuDrawer";
import { UserProfileDialog } from "./UserProfileDialog";

export function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const isMobile = useIsMobile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!user) return null;

  const initials = user.firstName
    ? user.firstName.charAt(0).toUpperCase()
    : (user.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() ?? "U");

  const avatar = (
    <div className="w-8 h-8 rounded-full overflow-hidden">
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt={user.fullName ?? "User"}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
          {initials}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button type="button" onClick={() => setDrawerOpen(true)}>
          {avatar}
        </button>
        <UserMenuDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onManageAccount={() => setProfileOpen(true)}
        />
        <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          {avatar}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="min-w-[200px]"
        >
          <div className="flex items-center gap-3 px-2 py-3">
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName ?? "User"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
                {initials}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {user.fullName ?? "User"}
              </span>
              <span className="text-xs text-foreground-muted truncate max-w-[140px]">
                {user.emailAddresses[0]?.emailAddress}
              </span>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setTimeout(() => setProfileOpen(true), 100);
            }}
          >
            <User />
            Manage account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
