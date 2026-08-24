import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/config/status";
import type { TicketStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * Sempre texto + cor, nunca cor sozinha: cerca de 8% dos homens tem alguma
 * forma de daltonismo, e cor isolada nao comunica status para eles.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", meta.className, className)}
    >
      {meta.label}
    </Badge>
  );
}
