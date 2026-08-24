-- A migration anterior (add_ticket_retention) derrubou este indice sem
-- querer: ele foi criado via SQL bruto em 20260729192905_add_ticket_fulltext_index
-- ("busca por trecho de nome na tela de admin e no filtro por solicitante"),
-- entao nao existe no schema.prisma e o diff automatico do Prisma o
-- interpretou como "indice que nao deveria existir".
--
-- IF NOT EXISTS: este indice ja foi recriado manualmente em producao no
-- momento em que o problema foi percebido; aqui so garante que o historico de
-- migrations registre e reproduza o estado correto em qualquer ambiente novo.
CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users"
  USING GIN ("name" gin_trgm_ops);
