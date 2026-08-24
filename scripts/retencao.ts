/**
 * Ponto de entrada da limpeza de retencao, para rodar via Tarefa Agendada do
 * Windows (ver retencao.ps1) ou manualmente.
 *
 * Uso:
 *   npx tsx scripts/retencao.ts                 # aplica, 90 dias
 *   npx tsx scripts/retencao.ts --dry-run        # so simula, nao apaga nada
 *   npx tsx scripts/retencao.ts --dias=60        # janela diferente
 */
import "dotenv/config";
import { purgeOldTicketContent } from "../src/modules/tickets/retention.service";

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const diasArg = args.find((a) => a.startsWith("--dias="));
  const days = diasArg ? Number(diasArg.split("=")[1]) : 90;
  return { dryRun, days };
}

async function main() {
  const { dryRun, days } = parseArgs();
  const inicio = new Date().toISOString();

  console.log(`[${inicio}] Retencao iniciada (janela: ${days} dias, dry-run: ${dryRun})`);

  const result = await purgeOldTicketContent({ days, dryRun });

  console.log(
    `[${new Date().toISOString()}] ${dryRun ? "SIMULACAO - nada foi alterado" : "Concluido"}:`,
  );
  console.log(`  chamados elegiveis:   ${result.chamados}`);
  console.log(`  comentarios removidos: ${result.comentarios}`);
  console.log(`  historico removido:    ${result.historico}`);
  console.log(`  anexos (registro):     ${result.anexosRegistro}`);
  if (!dryRun) {
    console.log(`  arquivos removidos:    ${result.arquivosRemovidos}`);
    if (result.falhasArquivo > 0) {
      console.log(`  FALHAS ao remover arquivo: ${result.falhasArquivo} (ver log de erro)`);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] ERRO na retencao:`, error);
  process.exit(1);
});
