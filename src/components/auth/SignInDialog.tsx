import { SignIn } from "@clerk/clerk-react";
import { LogIn } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { signInAppearance } from "@/lib/clerkAppearance";

type SignInVariant = "header" | "bottom-nav" | "welcome";

interface SignInDialogProps {
  variant?: SignInVariant;
}

function getTriggerButton(variant: SignInVariant): React.ReactElement {
  switch (variant) {
    case "welcome":
      return (
        <Button size="lg" className="gap-2">
          <LogIn className="w-4 h-4" />
          Sign in to start
        </Button>
      );
    case "bottom-nav":
      return (
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors flex-1 text-foreground-muted hover:text-foreground"
        >
          <LogIn className="w-6 h-6" />
          <span className="text-xs font-medium">Sign In</span>
        </button>
      );
    case "header":
      return (
        <button
          type="button"
          className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-raised/80 transition-colors"
        >
          <LogIn className="w-4 h-4" />
        </button>
      );
  }
}

export function SignInDialog({ variant = "header" }: SignInDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={getTriggerButton(variant)} />
      <DialogContent
        showCloseButton={true}
        className="sm:max-w-[400px] p-0 overflow-hidden"
      >
        <SignIn appearance={signInAppearance} routing="hash" />
      </DialogContent>
    </Dialog>
  );
}
