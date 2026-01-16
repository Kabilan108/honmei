import { SignInDialog } from "@/components/auth";

export function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
        Honmei
      </h1>
      <p className="text-foreground-muted text-lg mb-8 max-w-md">
        Track and rank your anime & manga
      </p>
      <SignInDialog variant="welcome" />
    </div>
  );
}
