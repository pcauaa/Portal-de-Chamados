"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { Priority } from "@/generated/prisma/enums";

/**
 * Graficos do painel.
 *
 * Regras aplicadas (e o porque):
 *
 * - SERIE UNICA = UMA COR. Em "chamados por categoria", cada barra ja comunica
 *   magnitude pelo comprimento; pintar cada uma de uma cor diferente gastaria o
 *   canal de cor repetindo o que o tamanho ja diz, e sugeriria que as cores
 *   significam algo. Cor por identidade so quando a identidade importa.
 *
 * - Cor semantica so onde a cor SIGNIFICA algo: prioridade (Urgente vermelho,
 *   Baixa cinza) carrega estado, entao usa a paleta ja definida em config/status.
 *
 * - Grade em fio de cabelo e solida. Grade tracejada vira ruido e sugere
 *   "projecao" ou "limite" quando e so grade.
 *
 * - Tema escuro e escolhido, nao invertido automaticamente: as cores do eixo e
 *   da grade tem valores proprios para cada superficie.
 */

/** Cor unica das series de magnitude (slot 1 da paleta categorica). */
const SERIES_1_LIGHT = "#2a78d6";
const SERIES_1_DARK = "#3987e5";
const SERIES_2_LIGHT = "#1baf7a";
const SERIES_2_DARK = "#199e70";

/**
 * Rampa ORDINAL para prioridade (Baixa -> Urgente): um unico tom, do claro ao
 * escuro, com a intensidade crescendo junto com a urgencia.
 *
 * Nao usamos aqui as cores dos badges (cinza/azul/laranja/vermelho): o
 * validador reprovou esse conjunto - laranja "Alta" e vermelho "Urgente" ficam
 * a ΔE 8.7, abaixo do piso de 15, ou seja, dificeis de distinguir mesmo com
 * visao normal de cores. No badge isso nao e problema porque o rotulo de texto
 * esta do lado; num grafico a cor ficaria sozinha carregando a identidade.
 */
const PRIORITY_RAMP_LIGHT = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"];
const PRIORITY_RAMP_DARK = ["#cde2fb", "#86b6ef", "#3987e5", "#184f95"];

function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  return {
    series1: dark ? SERIES_1_DARK : SERIES_1_LIGHT,
    series2: dark ? SERIES_2_DARK : SERIES_2_LIGHT,
    priorityRamp: dark ? PRIORITY_RAMP_DARK : PRIORITY_RAMP_LIGHT,
    grid: dark ? "#2c2c2a" : "#e1e0d9",
    axis: "#898781",
    surface: dark ? "#1a1a19" : "#fcfcfb",
    text: dark ? "#ffffff" : "#0b0b0b",
    border: dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,11,0.10)",
  };
}

type TooltipRow = { name: string; value: number; color: string };

function ChartTooltip({
  active,
  payload,
  label,
  surface,
  text,
  border,
  suffix,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: unknown }[];
  label?: string;
  surface: string;
  text: string;
  border: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  const rows: TooltipRow[] = payload.map((entry) => ({
    name: entry.name ?? "",
    value: Number(entry.value ?? 0),
    color: entry.color ?? "currentColor",
  }));

  return (
    <div
      className="rounded-md px-2.5 py-1.5 text-xs shadow-sm"
      style={{ background: surface, color: text, border: `1px solid ${border}` }}
    >
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2 rounded-full"
            style={{ background: row.color }}
          />
          <span className="text-muted-foreground">{row.name}:</span>
          <span className="font-medium tabular-nums">
            {row.value}
            {suffix ?? ""}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Serie mensal: duas series, entao legenda e obrigatoria. */
export function MonthlyChart({
  data,
}: {
  data: { month: string; label: string; abertos: number; finalizados: number }[];
}) {
  const t = useChartTheme();

  // Uma linha precisa de pelo menos dois pontos para existir. Com um mes so, o
  // grafico vira dois pontos soltos no vazio - pior que nao mostrar nada. Os
  // numeros do mes seguem acessiveis pela visao em tabela do card.
  if (data.length < 2) {
    const only = data[0];
    return (
      <div className="flex flex-col items-center gap-1 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          {only
            ? `Ha dados de apenas um mes (${only.label}): ${only.abertos} abertos, ${only.finalizados} finalizados.`
            : "Sem chamados no periodo."}
        </p>
        <p className="text-xs text-muted-foreground">
          A evolucao mensal aparece a partir do segundo mes de uso.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={t.series1} label="Abertos" />
        <LegendItem color={t.series2} label="Finalizados" />
      </div>
      {/* Altura inclui a faixa do eixo X - fixar so a area do plot faria os
          rotulos do eixo criarem uma barra de rolagem dentro do card. */}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={t.axis}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: t.grid }}
          />
          <YAxis
            stroke={t.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: t.grid, strokeWidth: 1 }}
            content={
              <ChartTooltip surface={t.surface} text={t.text} border={t.border} />
            }
          />
          <Line
            type="monotone"
            dataKey="abertos"
            name="Abertos"
            stroke={t.series1}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: t.series1 }}
            activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="finalizados"
            name="Finalizados"
            stroke={t.series2}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: t.series2 }}
            activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Barras horizontais de magnitude - uma cor so.
 * Usado por categoria e por colaborador.
 */
export function MagnitudeBars({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const t = useChartTheme();

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sem dados no periodo.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
        barCategoryGap={6}
      >
        <CartesianGrid stroke={t.grid} strokeWidth={1} horizontal={false} />
        <XAxis
          type="number"
          stroke={t.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          stroke={t.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip
          cursor={{ fill: t.grid, fillOpacity: 0.35 }}
          content={<ChartTooltip surface={t.surface} text={t.text} border={t.border} />}
        />
        <Bar
          dataKey="value"
          name="Chamados"
          fill={t.series1}
          // Cantos arredondados so na ponta do dado, ancorados na linha de base.
          radius={[0, 4, 4, 0]}
          barSize={14}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Prioridade: escala ORDENADA, entao rampa ordinal (um tom, claro -> escuro).
 * A identidade de cada barra vem do rotulo no eixo X, nao da cor - a cor
 * apenas reforca a ordem de urgencia.
 */
export function PriorityBars({
  data,
}: {
  data: { priority: Priority; label: string; value: number }[];
}) {
  const t = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={t.axis}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: t.grid }}
        />
        <YAxis
          stroke={t.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: t.grid, fillOpacity: 0.35 }}
          content={<ChartTooltip surface={t.surface} text={t.text} border={t.border} />}
        />
        <Bar
          dataKey="value"
          name="Chamados"
          radius={[4, 4, 0, 0]}
          barSize={36}
          isAnimationActive={false}
        >
          {data.map((row, index) => (
            <Cell key={row.priority} fill={t.priorityRamp[index] ?? t.series1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className="inline-block h-0.5 w-4 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
