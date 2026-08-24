# Deploy no Windows

Este documento descreve como o Portal de Chamados e implantado em um servidor
Windows, para que a operacao nao dependa de uma pessoa lembrar dos comandos.

> **Nota:** os valores de infraestrutura abaixo (IP, portas, caminhos, nomes de
> servico) sao ilustrativos. Substitua pelos do seu ambiente.

## Visao geral

| Item | Valor |
|---|---|
| Maquina | Windows 11 Pro - servidor e maquina de uso comum |
| URL na rede | `http://<IP-DO-SERVIDOR>:4000` (HTTP sem certificado) |
| Servico Windows | `PortalChamados` (via NSSM), inicia automaticamente com o Windows |
| Banco de dados | PostgreSQL 16, instancia dedicada na porta **5433** |
| Backup | Diario as 02:00, tarefa agendada `PortalChamados-Backup` |
| Retencao | Diaria as 03:00, tarefa agendada `PortalChamados-Retencao` - detalhes em `docs/RETENCAO.md` |

**Por que HTTP e nao HTTPS:** decisao consciente para um deploy em rede interna
sem exposicao externa, ponderando o custo de manter uma CA interna contra o
risco no perimetro em questao. A partir do momento em que o portal for acessivel
de fora da rede local (VPN, filial remota, internet), HTTPS deixa de ser
opcional - e o `SESSION_COOKIE_SECURE` abaixo deve virar `true` junto.

**Por que uma porta alta:** as portas convencionais (80, 8080) ja estavam
ocupadas por outros sistemas no servidor de destino. Para trocar de porta,
mude em **tres** lugares: o comando de start do servico (abaixo), a regra de
firewall, e o endereco divulgado aos usuarios.

**Atencao ao cookie de sessao (`SESSION_COOKIE_SECURE`):** deve ficar `false`
enquanto o portal for HTTP. Com `true` em um site HTTP, o navegador aceita o
cookie mas nunca o reenvia - o usuario faz login, e o sistema devolve ele para
a tela de login em loop infinito. Só marque `true` junto com HTTPS de verdade.

## O servico Windows (NSSM)

O Node roda como servico via [NSSM](https://nssm.cc/), o que garante:
- Inicia sozinho quando o Windows liga - ninguem precisa abrir um terminal.
- Reinicia sozinho se o processo cair (`AppExit Default Restart`).
- Loga stdout/stderr em `logs/service-out.log` e `logs/service-err.log`,
  com rotacao automatica ao passar de 10 MB.

### Comandos uteis

Rodar todos com PowerShell **como Administrador**.

```powershell
# ver status
Get-Service PortalChamados

# parar / iniciar / reiniciar
Stop-Service PortalChamados
Start-Service PortalChamados
Restart-Service PortalChamados

# ver os ultimos logs
Get-Content "C:\portal-chamados\logs\service-out.log" -Tail 50
Get-Content "C:\portal-chamados\logs\service-err.log" -Tail 50
```

### Como foi instalado (para reinstalar do zero se precisar)

```powershell
$nssm = "<caminho para nssm.exe>"  # instalado via: winget install -e --id NSSM.NSSM
$node = "C:\Program Files\nodejs\node.exe"
$project = "C:\portal-chamados"

& $nssm install PortalChamados $node "$project\node_modules\next\dist\bin\next start -p 4000"
& $nssm set PortalChamados AppDirectory $project
& $nssm set PortalChamados Start SERVICE_AUTO_START
& $nssm set PortalChamados AppEnvironmentExtra "NODE_ENV=production"
& $nssm set PortalChamados AppExit Default Restart
& $nssm set PortalChamados AppStdout "$project\logs\service-out.log"
& $nssm set PortalChamados AppStderr "$project\logs\service-err.log"
& $nssm start PortalChamados

New-NetFirewallRule -DisplayName "Portal de Chamados (porta 4000)" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Any
```

## Publicando uma atualizacao de codigo

Sempre que o codigo mudar (nova funcionalidade, correcao):

```powershell
cd C:\portal-chamados

# se houver mudanca no schema do banco:
npx prisma migrate deploy    # NUNCA "migrate dev" em producao

npm install                  # se houve mudanca de dependencias
npm run build

Restart-Service PortalChamados
```

Depois de reiniciar, confirme que subiu certo:

```powershell
Invoke-WebRequest http://localhost:4000/api/health
# deve responder {"status":"ok",...}
```

## Verificacao de saude

`GET /api/health` confere o processo E o banco (roda um `SELECT 1` de
verdade). Pode ser apontado por uma ferramenta de monitoramento (Uptime Kuma,
por exemplo) para avisar se o sistema cair.

## O banco de dados

PostgreSQL 16 roda como outro servico Windows, `postgresql-x64-16`, numa
instancia **separada** da que porventura ja exista na maquina (ex.: uma
instancia 18 na porta 5432 usada para outra coisa) - isolamento total, sem
risco de uma mexer na outra.

```powershell
Get-Service postgresql-x64-16
```

A aplicacao conecta com um usuario dedicado (`chamados_app`), sem privilegios
de superusuario, com acesso apenas ao banco `chamados`. A string de conexao
fica em `.env`, que **nunca** deve ser versionado nem copiado sem necessidade.

## Proximos passos ainda nao configurados

- **HTTPS**: se decidirem que vale a pena, ver `docs/BACKUP.md` nao cobre
  isso - exigiria gerar/instalar um certificado (autoassinado ou de uma CA
  interna) e mudar o comando do NSSM para apontar para um servidor HTTPS.
- **Notificacao por e-mail**: o event bus ja tem o ponto de extensao pronto
  (`src/lib/events/bus.ts`, `registerSideEffectHandler`); falta configurar um
  servidor SMTP real e implementar o handler.
- **Copia do backup fora desta maquina**: hoje os backups ficam na mesma
  maquina (`backups/`). Se esta maquina tiver um problema de hardware (disco,
  incendio, roubo), os backups vao junto. Vale copiar periodicamente para um
  segundo lugar (HD externo, outra maquina, nuvem) - isso ainda nao esta
  automatizado.
