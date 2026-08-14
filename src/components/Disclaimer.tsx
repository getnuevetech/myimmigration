import { AlertTriangle } from "lucide-react";

interface DisclaimerProps {
  text?: string;
  compact?: boolean;
}

export default function Disclaimer({ text, compact = false }: DisclaimerProps) {
  const defaultText =
    "This platform is for informational and organizational purposes only. It does not constitute legal advice and does not create an attorney-client relationship. Immigration law is complex and fact-specific. Please consult a licensed immigration attorney or accredited representative before making any immigration decisions or filing any forms.";

  return (
    <div
      className={`flex gap-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <AlertTriangle
        className={`shrink-0 ${compact ? "h-3.5 w-3.5 mt-0.5" : "h-4 w-4 mt-0.5"}`}
      />
      <p>{text ?? defaultText}</p>
    </div>
  );
}
