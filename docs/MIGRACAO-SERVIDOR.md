# Migracao para outro servidor (Windows)

Roteiro completo para instalar o Portal de Chamados **do zero em outra
maquina**, trazendo junto todos os dados (chamados, usuarios, anexos,
historico). Foi escrito para ser executado por alguem que nao acompanhou a
preparacao do pacote: tudo o que precisa saber esta aqui.

Depois da migracao, este arquivo deixa de valer para o dia a dia. A operacao
normal esta em `docs/DEPLOY-WINDOWS.md` (servico, atualizacoes) e
`docs/BACKUP.md` (backup e restauracao).

## Principio: replicar identico

O ambiente de destino repete os mesmos nomes e portas da maquina de origem:

| Item | Valor |
|---|---|
| Usuario do banco | `chamados_app` (sem superusuario) |
| Banco | `chamados` |
| Porta do PostgreSQL | **5433** (instancia dedicada) |
| Porta da aplicacao | **4000** |
| Servico Windows | `PortalChamados` (NSSM) |

Assim o `.env` do pacote entra **sem nenhuma edicao** e os scripts continuam
valendo. A unica coisa que muda para o usuario final e o IP no endereco.

## O que vem no pacote

```
pacote-migracao-chamados\
  projeto\                        codigo-fonte completo (sem node_modules e sem .next)
  dados\
    .env                          configuracao real - CONTEM A SENHA DO BANCO
    chamados-<timestamp>.backup   dump do banco (pg_dump -Fc)
    storage\attachments\          anexos dos chamados
  LEIA-ME.txt                     aponta para este documento
```

`node_modules\` e `.next\` **nao** vem de proposito: sao reconstruidos aqui
(`@node-rs/argon2` e modulo nativo, compilado para a maquina, e `.next` tem
quase 900 MB).

O pacote contem a senha do banco em texto puro dentro de `dados\.env`. Apague o
pendrive / a copia de rede depois que a migracao for validada.

---

## Fase 1 - Pre-requisitos

Conferir o que ja existe antes de instalar qualquer coisa:

```powershell
node -v                                  # esperado: v24.x
Get-Service postgresql* -ErrorAction SilentlyContinue
Get-Command nssm -ErrorAction SilentlyContinue
```

### 1.1 Node.js 24.x

A maquina de origem roda **v24.18.0 / npm 11.16.0**. Instalar o mesmo major.

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

Caminho esperado do executavel: `C:\Program Files\nodejs\node.exe` (e o que
`scripts\retencao.ps1` assume - ver Fase 4).

### 1.2 PostgreSQL 16

Instalador EDB (`winget install -e --id PostgreSQL.PostgreSQL.16`) ou o .exe do
site. Ele ja traz o `contrib`, necessario porque o schema depende de tres
extensoes: `citext`, `pgcrypto` e `pg_trgm`. As tres sao *trusted* no PG 13+,
entao o dono do banco cria sem precisar de superusuario.

O schema tambem usa a configuracao de busca textual `portuguese` (indice GIN de
`tickets`), que vem por padrao em qualquer instalacao.

**Instalar na porta 5433**, nao na 5432. O instalador pergunta a porta. Se o
servidor ja tiver um PostgreSQL na 5432 para outro sistema, isso mantem as duas
instancias isoladas - foi exatamente a decisao tomada na maquina de origem.

Se por algum motivo a porta tiver que ser outra, e preciso editar a
`DATABASE_URL` em `dados\.env` antes de copiar (Fase 2.2).

### 1.3 Banco e usuario

Abrir o **SQL Shell (psql)** do menu iniciar, conectando na porta 5433 como
`postgres`, e rodar - trocando `<SENHA>` pela senha que esta dentro da
`DATABASE_URL` no `dados\.env` do pacote (entre `chamados_app:` e `@`):

```sql
CREATE ROLE chamados_app LOGIN PASSWORD '<SENHA>';
CREATE DATABASE chamados OWNER chamados_app;
```

Usar a **mesma** senha e o que dispensa qualquer edicao no `.env`. Trocar a
senha e igualmente seguro (o banco so aceita conexao local), mas ai o `.env`
precisa ser atualizado.

Testar a conexao antes de seguir:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -p 5433 -U chamados_app -d chamados -c "SELECT version();"
```

### 1.4 NSSM

```powershell
winget install -e --id NSSM.NSSM
```

Anotar o caminho do `nssm.exe` - e usado na Fase 4.

---

## Fase 2 - Instalar a aplicacao

### 2.1 Copiar o codigo

Destino sugerido: `C:\Apps\PortalChamados` (uma pasta de servidor, nao a Area
de Trabalho). O caminho pode ser qualquer um: `STORAGE_DIR` e resolvido a partir
do diretorio de trabalho do processo (`src/lib/storage/index.ts`), e o NSSM vai
apontar para ca.

```powershell
robocopy "<pacote>\projeto" "C:\Apps\PortalChamados" /E
```

### 2.2 Colocar o .env

```powershell
Copy-Item "<pacote>\dados\.env" "C:\Apps\PortalChamados\.env"
```

O arquivo vai sem edicao se a Fase 1 replicou porta, usuario e senha. Nao mexer
em `SESSION_SECRET`: as sessoes ativas vem dentro do dump, entao mantendo a
chave ninguem e deslogado pela migracao. Trocar a chave e uma escolha valida
(ela esteve numa maquina que sera descartada), mas obriga todo mundo a entrar
de novo.

**Nao marcar `SESSION_COOKIE_SECURE=true`.** O portal continua em HTTP puro na
rede interna. Com `true` em um site HTTP o navegador aceita o cookie mas nunca
o reenvia, e o login entra em loop infinito de volta para a tela de entrada.

### 2.3 Instalar dependencias e compilar

```powershell
cd C:\Apps\PortalChamados
npm ci        # o postinstall roda "prisma generate" -> src/generated/prisma
npm run build
```

**Ainda nao inicie o servico** - o banco esta vazio.

---

## Fase 3 - Restaurar os dados

### 3.1 Banco

```powershell
$env:PGPASSWORD = "<SENHA de chamados_app>"
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" `
    -h 127.0.0.1 -p 5433 -U chamados_app -d chamados `
    --no-owner --role=chamados_app "<pacote>\dados\chamados-<timestamp>.backup"
Remove-Item Env:\PGPASSWORD
```

E o mesmo procedimento ja documentado e testado em `docs/BACKUP.md`.

### 3.2 Anexos

```powershell
robocopy "<pacote>\dados\storage\attachments" "C:\Apps\PortalChamados\storage\attachments" /E
```

A estrutura `AAAA\MM\` precisa ser preservada: a coluna
`attachments.stored_name` guarda esse caminho relativo, e um anexo cujo arquivo
nao existir vira erro 404 na hora do download.

### 3.3 Conferir que o schema bateu

```powershell
cd C:\Apps\PortalChamados
npx prisma migrate deploy
```

Deve responder que **nao ha migrations pendentes**. Isso funciona porque a
tabela `_prisma_migrations` vem dentro do dump. Se ele tentar aplicar alguma
migration, o restore veio incompleto - parar e investigar antes de seguir.

Conferencia rapida dos dados:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -p 5433 -U chamados_app -d chamados `
    -c "SELECT (SELECT count(*) FROM tickets) AS chamados, (SELECT count(*) FROM users) AS usuarios, (SELECT count(*) FROM attachments) AS anexos;"
```

Os numeros tem que bater com os da maquina de origem.

> **Nao rode `npm run db:seed` nesta rota.** O seed serve para instalacao nova;
> aqui ele so criaria um admin a mais. Usuarios e senhas vem no dump.

---

## Fase 4 - Servico, firewall e tarefas agendadas

Tudo desta fase exige **PowerShell como Administrador**.

### 4.1 Servico Windows via NSSM

```powershell
$nssm    = "<caminho do nssm.exe>"
$node    = "C:\Program Files\nodejs\node.exe"
$project = "C:\Apps\PortalChamados"

& $nssm install PortalChamados $node "$project\node_modules\next\dist\bin\next start -p 4000"
& $nssm set PortalChamados AppDirectory $project
& $nssm set PortalChamados Start SERVICE_AUTO_START
& $nssm set PortalChamados AppEnvironmentExtra "NODE_ENV=production"
& $nssm set PortalChamados AppExit Default Restart
& $nssm set PortalChamados AppStdout "$project\logs\service-out.log"
& $nssm set PortalChamados AppStderr "$project\logs\service-err.log"
& $nssm start PortalChamados
```

`AppDirectory` nao e detalhe: e ele que define o diretorio de trabalho do
processo, do qual `STORAGE_DIR` (`./storage/attachments`) e resolvido.

### 4.2 Firewall

```powershell
New-NetFirewallRule -DisplayName "Portal de Chamados (porta 4000)" `
    -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Any
```

### 4.3 Tarefas agendadas

Na maquina de origem elas existem mas foram registradas como SYSTEM com
permissao restrita (`schtasks /query` responde "Acesso negado" sem elevacao),
entao sao recriadas do zero aqui - o que e melhor, ja que os caminhos mudaram.

```powershell
$project   = "C:\Apps\PortalChamados"
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$config    = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Backup diario as 02:00
Register-ScheduledTask -TaskName "PortalChamados-Backup" `
    -Action (New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$project\scripts\backup.ps1`"") `
    -Trigger (New-ScheduledTaskTrigger -Daily -At 02:00) `
    -Principal $principal -Settings $config

# Retencao diaria as 03:00 (depois do backup, de proposito)
Register-ScheduledTask -TaskName "PortalChamados-Retencao" `
    -Action (New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$project\scripts\retencao.ps1`"") `
    -Trigger (New-ScheduledTaskTrigger -Daily -At 03:00) `
    -Principal $principal -Settings $config
```

`-StartWhenAvailable` faz a tarefa rodar assim que possivel se a maquina estiver
desligada as 02:00 - e o que acontece hoje na origem (varios backups gravados de
manha em vez de 02:00).

### 4.4 Caminhos fixos dentro dos scripts

Dois scripts tem caminho absoluto no codigo. Conferir - e corrigir se a
instalacao aqui ficou diferente:

- `scripts/backup.ps1:15` -> `$PgBinDir = 'C:\Program Files\PostgreSQL\16\bin'`
  (muda se a versao do PostgreSQL for outra)
- `scripts/retencao.ps1:17` -> `$Node = 'C:\Program Files\nodejs\node.exe'`

O resto dos caminhos os dois derivam de `$PSScriptRoot`, entao a mudanca da
pasta do projeto nao os afeta.

### 4.5 IP fixo

Nao ha dominio: os usuarios vao guardar o IP no favorito. Reservar **IP
estatico** (ou reserva de DHCP pelo MAC) neste servidor **antes** de divulgar o
endereco. Se o IP mudar depois, todo mundo perde o acesso de uma vez.

Descobrir o IP atual:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object IPAddress, InterfaceAlias
```

---

## Fase 5 - Validacao (antes de divulgar)

Nao basta "o site abriu". A migracao so esta boa quando os oito passos passam:

1. **Saude**: `Invoke-WebRequest http://localhost:4000/api/health` responde
   `{"status":"ok",...}`. O endpoint roda um `SELECT 1` de verdade, entao valida
   aplicacao **e** banco.
2. **Rede**: abrir `http://<IP-do-servidor>:4000` de **outro** computador da
   rede - prova que a regra de firewall funciona.
3. **Login** com um usuario real ja existente - prova que o dump trouxe os
   hashes Argon2 e que o `SESSION_SECRET` esta correto.
4. **Anexo antigo**: abrir um chamado antigo que tenha anexo e baixar o anexo.
   E o teste que prova que a copia de `storage\` e as linhas do banco casam.
5. **Upload novo**: criar um chamado com anexo - prova permissao de escrita em
   `storage\`.
6. **Backup**: rodar `.\scripts\backup.ps1` manualmente e conferir
   `backups\backup.log`.
7. **Retencao**: `npx tsx scripts/retencao.ts --dry-run` - valida a rotina sem
   apagar nada.
8. **Reboot**: reiniciar o servidor inteiro e confirmar que o portal volta
   sozinho. E o unico teste real do `SERVICE_AUTO_START`.

Enquanto os passos 4 e 8 nao passarem, **nao desligue a maquina antiga**.

---

## Fase 6 - Desativar a maquina antiga

Enquanto as duas maquinas estiverem no ar, **so uma pode receber chamados**: os
bancos divergem em minutos e nao ha como fundir depois.

Na maquina antiga, com PowerShell como Administrador:

```powershell
Stop-Service PortalChamados
Set-Service PortalChamados -StartupType Disabled
Disable-ScheduledTask -TaskName "PortalChamados-Backup"
Disable-ScheduledTask -TaskName "PortalChamados-Retencao"
```

Desabilitar as tarefas importa: senao elas continuam gerando backup de um
sistema morto todas as noites.

Depois:

1. Divulgar o novo endereco `http://<IP-do-servidor>:4000`.
2. Se alguem tiver aberto chamados na maquina antiga **depois** do dump, e
   preciso repetir o dump e a Fase 3 sobre um banco recriado vazio. A regra
   pratica e simples: a partir do momento do dump, use um portal **ou** o
   outro, nunca os dois. (Na migracao de 08/2026 isso foi facil - o sistema
   ainda nao tinha usuarios alem do administrador. Numa migracao futura, com o
   portal em uso real, o corte precisa de uma janela fora do expediente.)
3. Manter a maquina antiga intacta por ~2 semanas antes de apagar qualquer
   coisa.
4. Guardar uma copia do ultimo `.backup` + `storage-*.zip` num terceiro lugar
   (HD externo, outra maquina). Hoje os backups moram na mesma maquina que o
   sistema - limitacao ja registrada em `docs/BACKUP.md`.
5. Atualizar `docs/DEPLOY-WINDOWS.md` com a maquina, o IP e o caminho novos, e
   `docs/BACKUP.md:48`, que cita o caminho antigo.

---

## Se der errado

| Sintoma | Causa provavel |
|---|---|
| Login volta para a tela de login, em loop | `SESSION_COOKIE_SECURE=true` em site HTTP. Deixar `false`. |
| Erro 404 ao baixar anexo antigo | `storage\attachments\` nao foi copiado, veio sem a estrutura `AAAA\MM\`, ou o `AppDirectory` do NSSM aponta para outra pasta. |
| Servico sobe e cai sozinho | Ler `logs\service-err.log`. Quase sempre: `npm run build` nao foi rodado, `.env` ausente, ou banco inacessivel. |
| `prisma migrate deploy` quer aplicar migrations | O restore veio incompleto. Nao siga - refaca a Fase 3. |
| Erro de extensao no `pg_restore` | Falta o `contrib` do PostgreSQL (`citext`, `pgcrypto`, `pg_trgm`). |
| `npm ci` falha em `@node-rs/argon2` | Modulo nativo. Confirme que o servidor e Windows x64 e que o Node e 24.x. |
| "Acesso negado" em `schtasks` / `Register-ScheduledTask` | Falta abrir o PowerShell como Administrador. |
| Login funciona local mas nao pela rede | Regra de firewall (4.2) ausente, ou perfil de rede do servidor esta como Publico. |
