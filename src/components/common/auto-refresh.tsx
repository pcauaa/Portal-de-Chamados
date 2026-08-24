"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Recarrega os dados da rota atual em intervalos, para que alteracoes feitas
 * por OUTRA pessoa aparecam sem o usuario apertar F5.
 *
 * Por que sondagem (polling) e nao WebSocket/SSE: com poucas dezenas de pessoas numa rede
 * local, uma requisicao a cada poucos segundos e irrelevante para o servidor,
 * e nao exige conexao persistente, reconexao, nem processo separado. WebSocket
 * resolveria o mesmo problema cobrando muito mais complexidade operacional.
 *
 * router.refresh() rebusca os Server Components e reconcilia o resultado no
 * lugar - nao e um F5. O que o usuario digitou num campo, o scroll e o foco
 * ficam preservados; a tela nao pisca.
 *
 * Pausa quando a aba esta em segundo plano: sem isso, uma aba esquecida aberta
 * a noite inteira ficaria batendo no banco sem ninguem olhando.
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, seconds * 1000);

    // Voltou para a aba: atualiza na hora, sem esperar o proximo ciclo.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router, seconds]);

  return null;
}
