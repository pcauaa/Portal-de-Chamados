import { Badge } from "@/components/ui/badge";
import { PRIORITY_META } from "@/config/status";
import type { Priority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", meta.className, className)}
    >
      {meta.label}
    </Badge>
  );
}
