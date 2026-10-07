import Link from "next/link";
import { WavesHorizontal as Waves } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Waves className="size-5" />
      </span>
      SocialFlow
    </Link>
  );
}
