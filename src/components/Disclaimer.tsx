import { AlertTriangle } from "lucide-react";
import { DEFAULT_PUBLIC_DISCLAIMER } from "@/lib/platform/constants";

interface DisclaimerProps {
  text?: string;
  compact?: boolean;
}

export default function Disclaimer({ text, compact = false }: DisclaimerProps) {
  return (
    <div
      className={`flex gap-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <AlertTriangle
        className={`shrink-0 ${compact ? "h-3.5 w-3.5 mt-0.5" : "h-4 w-4 mt-0.5"}`}
      />
      <p>{text ?? DEFAULT_PUBLIC_DISCLAIMER}</p>
    </div>
  );
}
