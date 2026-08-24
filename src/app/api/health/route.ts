import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Healthcheck para monitoramento externo (Uptime Kuma, NSSM, script de
 * verificacao). Confere o banco de verdade, nao so "o processo esta de pe":
 * um Next.js respondendo com o Postgres fora do ar ainda e uma falha real.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "erro", detalhe: "banco indisponivel" }, { status: 503 });
  }
}
