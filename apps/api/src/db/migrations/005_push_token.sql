-- 005_push_token.sql — Token de push notification (US-015 Camada 2 / US-017)

-- Expo push token do dispositivo do atleta. Null = sem device registrado
-- (não bloqueia nada — Camada 3). Atualizado pelo app via POST /push/register.
alter table athletes add column if not exists push_token text;
