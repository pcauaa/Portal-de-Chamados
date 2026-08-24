import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Numero-heroi.
 *
 * Quando a historia e "quantos", um numero grande comunica melhor que
 * qualquer grafico. Figuras proporcionais (sem tabular-nums): em tamanho
 * grande, digitos de largura fixa deixam "121" com espacamento estranho.
 */
export function StatCard({
  label,
  value,
  hint,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Barra semantica lateral. Ausente = neutro. */
  accent?: string;
  href?: string;
}) {
  const content = (
    <>
      {accent ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight">{value}</dd>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  const className = cn(
    "relative overflow-hidden rounded-lg border bg-card p-4",
    href && "transition-colors hover:bg-muted/50",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
