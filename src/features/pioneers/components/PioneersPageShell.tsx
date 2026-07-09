import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { GradientBackground } from "@/components/animate-ui/components/backgrounds/gradient";

export function PioneersPageShell({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pioneers-page">
      <div className="pioneers-page__ambient" aria-hidden="true">
        {reduceMotion ? <div className="pioneers-page__static-gradient" /> : <GradientBackground />}
      </div>
      {children}
    </div>
  );
}
