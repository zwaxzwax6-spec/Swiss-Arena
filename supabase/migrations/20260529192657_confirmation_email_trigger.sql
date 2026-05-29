-- Automatic order-confirmation email.
--
-- Adds the tracking columns (no-op if the earlier ad-hoc migration already ran)
-- and an AFTER INSERT trigger on `orders` that calls the send-confirmation-email
-- Edge Function via pg_net.
--
-- Secret handling:
--   * The anon key below is the project's PUBLIC anon key (already shipped in the
--     browser client) — safe to commit.
--   * The shared webhook secret is NOT in this file. It is read at trigger time
--     from Supabase Vault (secret name `confirmation_webhook_secret`), which is
--     created out-of-band at deploy:
--         select vault.create_secret('<random>', 'confirmation_webhook_secret');
--     The same value is set as the Edge Function's WEBHOOK_SECRET env var.

alter table orders add column if not exists confirmation_email_sent boolean not null default false;
alter table orders add column if not exists confirmation_email_error text;

create extension if not exists pg_net;

create or replace function public.trigger_send_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'confirmation_webhook_secret'
  limit 1;

  perform net.http_post(
    url := 'https://fqygbnqrlvzlzrumwhcl.supabase.co/functions/v1/send-confirmation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxeWdibnFybHZ6bHpydW13aGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzE2NzksImV4cCI6MjA5NDk0NzY3OX0.lx_qm5j2VqMZ-a3HLd-4xCJQH8TwkFk-OPKdp_FsYBc',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists on_order_created on orders;
create trigger on_order_created
  after insert on orders
  for each row execute function public.trigger_send_confirmation();
