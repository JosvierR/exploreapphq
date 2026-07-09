import { Link } from "react-router-dom";
import { LiquidButton } from "@/components/animate-ui/components/buttons/liquid";
import { T } from "@/components/ui/T";
import { challengeWebPath, type ChallengeType } from "@/lib/exploreAppLink";

type OpenExploreMissionButtonProps = {
  challengeId: ChallengeType;
  className?: string;
};

export function OpenExploreMissionButton({ challengeId, className }: OpenExploreMissionButtonProps) {
  return (
    <LiquidButton asChild className={className} size="lg">
      <Link to={challengeWebPath(challengeId)}>
        <T k="pioneer.challenge.openApp" />
      </Link>
    </LiquidButton>
  );
}
