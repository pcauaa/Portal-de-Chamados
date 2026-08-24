# Portal de Chamados

Sistema interno de abertura e acompanhamento de chamados de TI — do formulário
de abertura à fila da equipe técnica, com dashboards, controle de permissões
por perfil, trilha de auditoria, retenção automática de dados e rotina de
backup verificada.

Projeto real, em produção. O código foi anonimizado para publicação:
identidade visual, endereços de rede e caminhos de servidor foram substituídos
por valores genéricos.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Server Components) |
| Linguagem | TypeScript 5, React 19 |
| Banco | PostgreSQL 16 (`citext`, `pgcrypto`, `pg_trgm`) |
| ORM | Prisma 7 com `@prisma/adapter-pg` (driver adapter) |
| UI | Tailwind CSS v4, shadcn/ui sobre Base UI, lucide-react, Recharts |
| Formulários/validação | react-hook-form + Zod 4 (mesmo schema no cliente e no servidor) |
| Dados no cliente | TanStack Query e TanStack Table |
| Auth | Implementação própria — Argon2 + sessão em banco |
| Observabilidade | pino com redação de campos sensíveis |
| Testes | Vitest (unidade) e Playwright |

---

## Decisões técnicas

As decisões abaixo estão documentadas no próprio código, junto do trecho que
elas justificam — é onde vale a pena olhar primeiro.

### Sessão em banco, não JWT

[`src/lib/auth/session.ts`](src/lib/auth/session.ts)

Com JWT o servidor não consegue invalidar um token antes do vencimento: alguém
desligado continuaria com acesso até o fim da validade. Com sessão em tabela,
apagar a linha derruba o acesso no mesmo segundo.

O banco guarda apenas o **SHA-256 do token com um pepper** (`SESSION_SECRET`).
Consequência: um dump do banco não permite sequestrar sessões — o mesmo
princípio que impede descobrir senhas. SHA-256 puro basta aqui, e não Argon2,
porque o token tem 256 bits de entropia real: não há dicionário nem força bruta
viável contra ele.

Senhas de usuário, essas sim, usam **Argon2** (`@node-rs/argon2`).

### Permissões em tabela, não `if (role === 'admin')`

[`src/config/permissions.ts`](src/config/permissions.ts)

O catálogo de permissões é a fonte da verdade: o seed popula `permissions` e
`role_permissions` a partir dele, e a checagem em runtime usa os mesmos slugs.
É o que permite criar um perfil novo — um "Gestor" que só lê dashboards — com
um `INSERT`, em vez de um deploy.

Vale também para dados: sem a permissão `comment.internal`, uma nota interna
**nunca sai do servidor** — não é escondida no cliente.

### Anexos fora de `public/`

[`src/lib/storage/index.ts`](src/lib/storage/index.ts)

Arquivos enviados nunca ganham URL direta. O download passa por uma rota que
valida sessão e permissão, o tipo real do arquivo é conferido pelo conteúdo
(`file-type`), e o disco é organizado em subpastas ano/mês para não criar um
diretório com dezenas de milhares de arquivos.

### Retenção de 90 dias que preserva o histórico gerencial

[`docs/RETENCAO.md`](docs/RETENCAO.md) · [`scripts/retencao.ts`](scripts/retencao.ts)

Chamados encerrados há mais de 90 dias perdem o conteúdo pesado (anexos,
comentários, histórico passo a passo) mas **nunca são apagados**: número,
título, datas, tempo de atendimento e a solução aplicada permanecem. Os
gráficos de 12 meses continuam íntegros e a solução segue consultável.

Só é elegível quem passa em **dois** filtros independentes — status terminal
`FINALIZADO`/`CANCELADO` **e** encerramento há mais de 90 dias —, reduzindo a
chance de pegar o chamado errado. Toda execução registra um evento em
`/admin/auditoria`, e há `--dry-run`.

### Log que não vaza

[`src/lib/logger.ts`](src/lib/logger.ts)

O pino roda com `redact` configurado para `password`, `senha`, `passwordHash`,
`token`, `tokenHash` e `sessionToken`. Nenhuma credencial chega ao arquivo de
log, mesmo em stack trace.

### Sondagem em vez de WebSocket

[`src/components/common/auto-refresh.tsx`](src/components/common/auto-refresh.tsx)

Na escala deste sistema, uma conexão persistente por usuário custa mais em
infraestrutura e modos de falha do que entrega em latência percebida.

---

## Arquitetura

```
src/
  app/           App Router — route groups (app)/(auth) e rotas de API
  components/    ui/ (shadcn), layout/, dashboard/, tickets/, common/
  config/        catálogo de permissões, política de senha, status, navegação
  lib/           auth/, events/, http/, storage/, db, logger, datetime
  modules/       audit, auth, catalog, dashboard, interactions, tickets, users
                 — cada módulo com service / queries / schemas
prisma/          schema, migrations e seed idempotente
scripts/         backup, retenção e wrappers de tarefa agendada
docs/            deploy, backup/restauração, retenção, migração de servidor
```

A separação em `modules/` mantém regra de negócio fora dos componentes: a
página monta a tela, o `service` decide, o `queries` fala com o banco, e o
`schemas` (Zod) valida a entrada uma vez só, valendo para o formulário e para a
Server Action.

O event bus (`src/lib/events/bus.ts`) tem ponto de extensão pronto para efeitos
colaterais — notificação por e-mail entra ali, sem tocar no fluxo do chamado.

---

## Rodando localmente

Pré-requisitos: Node 20+, PostgreSQL 16.

```bash
git clone <url-do-repo>
cd portal-chamados
npm install
```

Configure o ambiente:

```bash
cp .env.example .env
```

Preencha no `.env`:

- `DATABASE_URL` — aponte para um banco vazio e um usuário sem superusuário
- `SESSION_SECRET` — gere um valor novo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Crie o schema e popule o catálogo inicial (perfis, permissões, categorias e um
usuário administrador):

```bash
npx prisma migrate deploy
npm run db:seed
```

O seed **não** tem senha fixa: se `SEED_ADMIN_PASSWORD` não estiver definida,
ele sorteia uma senha aleatória e a imprime uma única vez no terminal. É
idempotente — rodar de novo não duplica nada.

```bash
npm run dev
```

Aplicação em `http://localhost:3000`.

### Outros comandos

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest
npm run db:studio    # Prisma Studio
```

---

## Operação

A pasta [`docs/`](docs/) traz os runbooks usados em produção: instalação como
serviço do Windows via NSSM ([`DEPLOY-WINDOWS.md`](docs/DEPLOY-WINDOWS.md)),
backup diário com procedimento de restauração testável
([`BACKUP.md`](docs/BACKUP.md)), a política de retenção
([`RETENCAO.md`](docs/RETENCAO.md)) e o roteiro de migração para outro servidor
([`MIGRACAO-SERVIDOR.md`](docs/MIGRACAO-SERVIDOR.md)).

Os valores de infraestrutura nesses documentos (IP, portas, caminhos) são
ilustrativos.

---

## Licença

Sem licença de uso definida. O código está publicado para fins de portfólio.
