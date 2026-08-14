import { CaseHealth } from "@/types/case";

interface CaseHealthBadgeProps {
  health: CaseHealth;
}

const CONFIG: Record<CaseHealth, { label: string; color: string; dot: string }> = {
  good: {
    label: "Looks Good",
    color: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
  },
  needs_attention: {
    label: "Needs Attention",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-500",
  },
  critical: {
    label: "Requires Action",
    color: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
  },
};

export default function CaseHealthBadge({ health }: CaseHealthBadgeProps) {
  const { label, color, dot } = CONFIG[health];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${color}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
