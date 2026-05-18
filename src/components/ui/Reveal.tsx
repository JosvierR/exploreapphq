import type { CSSProperties, ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";

type RevealVariant = "up" | "left" | "right" | "scale";

export function Reveal({
  children,
  className = "",
  delay = 0,
  variant = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
}) {
  const { ref, className: revealClass } = useReveal();
  const style: CSSProperties | undefined =
    delay > 0 ? { transitionDelay: `${delay}s` } : undefined;

  return (
    <div
      ref={ref}
      className={`${revealClass} reveal--${variant} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
