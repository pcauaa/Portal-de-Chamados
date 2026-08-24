-- A troca de senha pelo proprio usuario deixou de existir: quem define senha e
-- sempre o administrador, em Administracao > Usuarios. Sem essa tela, a flag
-- nao tinha quem a limpasse - qualquer conta marcada ficaria presa no redirect.
ALTER TABLE "users" DROP COLUMN "must_change_password";
