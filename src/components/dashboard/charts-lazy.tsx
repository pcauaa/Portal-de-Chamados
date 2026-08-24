"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

/**
 * Versoes carregadas sob demanda dos graficos de charts.tsx.
 *
 * O Recharts pesa ~370 KB minificados - o maior chunk do build inteiro. O
 * Next ja isola esse peso na rota /ti/dashboard (nao vaza para as outras
 * telas), mas dentro da propria rota o import estatico em charts.tsx
 * bloqueava a entrada: nada na tela aparecia ate os 370 KB chegarem.
 *
 * Com carregamento sob demanda, os cartoes de numero e as tabelas (que nao
 * dependem do Recharts) pintam imediatamente; o grafico entra assim que o
 * chunk chega, sem pular o layout porque o placeholder usa a mesma altura do
 * grafico real.
 *
 * `ssr: false`: o Recharts mede o container no navegador (ResponsiveContainer
 * depende de layout real, inexistente durante SSR) - sem isso o servidor
 * tentaria renderizar um grafico de tamanho zero antes de descartar o
 * resultado.
 */

function ChartPlaceholder({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      className="animate-pulse rounded-md bg-muted/50"
      aria-hidden
    />
  );
}

const MonthlyChartInner = dynamic(
  () => import("./charts").then((mod) => mod.MonthlyChart),
  { ssr: false },
);

export function MonthlyChart(
  props: React.ComponentProps<typeof import("./charts").MonthlyChart>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={264} />}>
      <MonthlyChartInner {...props} />
    </Suspense>
  );
}

const PriorityBarsInner = dynamic(
  () => import("./charts").then((mod) => mod.PriorityBars),
  { ssr: false },
);

export function PriorityBars(
  props: React.ComponentProps<typeof import("./charts").PriorityBars>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={200} />}>
      <PriorityBarsInner {...props} />
    </Suspense>
  );
}

const MagnitudeBarsInner = dynamic(
  () => import("./charts").then((mod) => mod.MagnitudeBars),
  { ssr: false },
);

// Altura variavel (mais linhas = mais alto): o placeholder precisa da mesma
// altura que o grafico vai ter, entao o wrapper repassa `height` para o
// fallback do Suspense em vez de usar a opcao `loading` do dynamic() - essa
// opcao nao recebe as props do componente embrulhado.
export function MagnitudeBars({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  return (
    <Suspense fallback={<ChartPlaceholder height={height} />}>
      <MagnitudeBarsInner data={data} height={height} />
    </Suspense>
  );
}
