-- Busca textual dos chamados.
--
-- Por que um indice GIN e nao "LIKE '%texto%'":
-- o LIKE com curinga a esquerda nao usa indice nenhum - o Postgres varre a
-- tabela inteira a cada busca. Com poucos chamados ninguem percebe; com alguns
-- milhares a fila da TI trava. O tsvector tambem trata plural e acento
-- ("impressoras" encontra "impressora"), que e o comportamento que o usuario
-- espera de um campo de busca.
--
-- A configuracao 'portuguese' e fixa (nao 'default') porque to_tsvector so e
-- IMMUTABLE - requisito para indice por expressao - quando o idioma e explicito.

CREATE INDEX "tickets_search_idx"
  ON "tickets"
  USING GIN (to_tsvector('portuguese', "title" || ' ' || "description"));

-- Busca por trecho de nome na tela de admin e no filtro por solicitante.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "users_name_trgm_idx"
  ON "users"
  USING GIN ("name" gin_trgm_ops);
