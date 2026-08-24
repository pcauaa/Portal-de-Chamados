# Backup e Restauracao

## O que e salvo

| Item | Como | Onde |
|---|---|---|
| Banco de dados | `pg_dump` formato custom (`-Fc`), comprimido | `backups\chamados-AAAAMMDD-HHMMSS.backup` |
| Anexos dos chamados | zip de `storage\attachments\` | `backups\storage-AAAAMMDD-HHMMSS.zip` |

Retencao: **30 dias**. Backups mais antigos sao apagados automaticamente a
cada execucao (ver `scripts/backup.ps1`).

## Quando roda

Tarefa agendada do Windows `PortalChamados-Backup`, todo dia as **02:00**,
rodando como SYSTEM (nao depende de nenhum usuario estar logado).

```powershell
Get-ScheduledTask -TaskName "PortalChamados-Backup"
Get-ScheduledTaskInfo -TaskName "PortalChamados-Backup"   # ultima/proxima execucao
```

## Rodar manualmente

Util antes de uma atualizacao arriscada (migration, mudanca grande):

```powershell
cd C:\portal-chamados
.\scripts\backup.ps1
```

O script grava um log cumulativo em `backups\backup.log` - confira ali se uma
execucao noturna falhou.

## Restaurando um backup

**Teste isto pelo menos uma vez por trimestre.** Um backup que nunca foi
restaurado nao e um backup - e uma esperanca. O procedimento abaixo cria um
banco **separado** para o teste, sem tocar no banco real; so troque o nome do
banco de destino para restaurar "de verdade" (ex.: apos perda de dados).

```powershell
$env:PGPASSWORD = "<senha de chamados_app, esta no .env>"
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$pgrestore = "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"

# 1. Escolha o arquivo de backup a restaurar
$arquivo = "C:\portal-chamados\backups\chamados-<timestamp>.backup"

# 2. Crie um banco de destino (nome de teste - NAO sobrescreva o banco em uso
#    sem ter certeza; para uma restauracao real, pare o servico primeiro)
& $psql -h 127.0.0.1 -p 5433 -U chamados_app -d postgres -c "CREATE DATABASE chamados_teste_restore OWNER chamados_app;"

# 3. Restaure
& $pgrestore -h 127.0.0.1 -p 5433 -U chamados_app -d chamados_teste_restore --no-owner --role=chamados_app $arquivo

# 4. Confira que os dados vieram
& $psql -h 127.0.0.1 -p 5433 -U chamados_app -d chamados_teste_restore -c "SELECT count(*) FROM tickets;"

# 5. Apague o banco de teste quando terminar
& $psql -h 127.0.0.1 -p 5433 -U chamados_app -d postgres -c "DROP DATABASE chamados_teste_restore;"
```

### Restauracao real (apos perda de dados)

1. Pare o servico da aplicacao: `Stop-Service PortalChamados`.
2. Renomeie ou apague o banco `chamados` atual (so se tiver certeza).
3. Rode os passos 2-3 acima usando `chamados` como nome do banco de destino
   em vez de `chamados_teste_restore`.
4. Restaure tambem os anexos: descompacte o `storage-*.zip` correspondente
   para dentro de `storage\attachments\`.
5. Reinicie o servico: `Start-Service PortalChamados`.
6. Confira `http://localhost/api/health` e faca login para validar.

## Limitacao conhecida: backup fica na mesma maquina

Hoje os arquivos de backup ficam em `backups\`, na mesma maquina que roda o
sistema. Isso protege contra corrupcao de dados, erro humano ou uma migration
malsucedida - mas **nao** protege contra perda da propria maquina (disco
queimado, roubo, incendio). Para proteger contra isso, copie periodicamente a
pasta `backups\` para um segundo local fisico (HD externo, outra maquina) ou
um servico de nuvem. Isso ainda nao esta automatizado.
