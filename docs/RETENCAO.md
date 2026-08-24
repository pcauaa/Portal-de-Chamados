# Retenção de 90 dias

## O que faz

Todo dia às **03:00** (depois do backup das 02:00), o sistema remove o
conteúdo "pesado" de chamados **encerrados há mais de 90 dias**:

| Removido | Preservado |
|---|---|
| Arquivos de anexo no disco | Número, título, descrição |
| Registros de `attachments` | Categoria, prioridade, setor |
| Comentários (públicos e internos) | Solicitante, responsável |
| Histórico de eventos | Todas as datas e o tempo de atendimento |
| | `closingNote` (a solução aplicada) |

**O chamado em si nunca é apagado.** Só o conteúdo que ocupa espaço em disco
(anexos) e que perde relevância operacional com o tempo (comentários,
histórico passo a passo). Isso mantém os gráficos de Indicadores (que olham
12 meses) intactos, e preserva a solução aplicada para consulta futura.

## Quem é elegível

Um chamado só é tocado quando **os dois** critérios valem ao mesmo tempo:

- Status é `FINALIZADO` ou `CANCELADO` (os dois estados terminais)
- Foi encerrado (`closedAt`) há mais de 90 dias

Chamado em andamento **nunca** é tocado, não importa a idade. A data usada é
a de encerramento, não a de abertura nem a de última atualização.

## Onde fica registrado

Toda execução grava um evento `retention.purged` em `/admin/auditoria`, com
a contagem de chamados, comentários, histórico e arquivos removidos.

Quando você abre um chamado que já passou pela limpeza, a tela mostra um
aviso no lugar da conversa vazia, explicando o que aconteceu.

## Rodar manualmente

```powershell
cd C:\portal-chamados

# so simula, nao apaga nada - use para conferir antes
npx tsx scripts/retencao.ts --dry-run

# aplica de verdade
npx tsx scripts/retencao.ts

# janela diferente de 90 dias, se precisar
npx tsx scripts/retencao.ts --dias=60
```

Ou rode o wrapper completo (mesmo script que a tarefa agendada usa, com log):

```powershell
.\scripts\retencao.ps1
```

O log cumulativo fica em `logs\retencao.log`.

## Ver ou alterar o agendamento

```powershell
Get-ScheduledTask -TaskName "PortalChamados-Retencao"
Get-ScheduledTaskInfo -TaskName "PortalChamados-Retencao"   # ultima/proxima execucao
```

## Risco a ter em mente

**O backup guarda 30 dias; a retenção apaga aos 90.** Se a limpeza remover
algo por engano e ninguém perceber dentro de 30 dias, não há de onde
restaurar aquele conteúdo específico. Por isso:

- Sempre teste com `--dry-run` antes de mudar a janela de dias.
- A elegibilidade exige dois filtros independentes (status terminal E data),
  reduzindo a chance de pegar chamado errado.
- Confira `/admin/auditoria` de vez em quando para acompanhar o volume
  removido - um número muito maior que o esperado é sinal de algo errado.
