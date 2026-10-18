-- Amis et présence (18/10/2026, demande de Mathias). Après supabase_schema.sql, supabase_roles.sql, supabase_echanges.sql.
-- À coller une fois dans Supabase : « SQL Editor » -> « New query » -> coller -> menu « Database » -> « Run ».
-- Peut être relancé sans risque.
--
--   amities  : demande d'ami de A à B (« en_attente »), puis « acceptee » quand B accepte. Refuser ou retirer = supprimer.
--   presence : dernière activité de chaque compte dans l'appli (mise à jour chaque minute quand l'appli est ouverte) ;
--              visible seulement de ses amis : pastille verte (vu il y a moins de 3 minutes) ou rouge.

create table if not exists public.amities (
  id bigint generated always as identity primary key,
  de uuid not null references auth.users (id) on delete cascade,
  a uuid not null references auth.users (id) on delete cascade,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee')),
  cree_le timestamptz not null default now(),
  check (de <> a)
);
create unique index if not exists amities_paire on public.amities (least(de, a), greatest(de, a));

create table if not exists public.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vu_le timestamptz not null default now()
);

alter table public.amities enable row level security;
alter table public.presence enable row level security;

-- Amitiés : visibles des deux comptes ; demande envoyée en son nom ; retirée (ou refusée) par l'un ou l'autre
drop policy if exists "ses amitiés" on public.amities;
create policy "ses amitiés" on public.amities for select to authenticated using (auth.uid() in (de, a));
drop policy if exists "demander en son nom" on public.amities;
create policy "demander en son nom" on public.amities
  for insert to authenticated with check (de = auth.uid() and statut = 'en_attente');
drop policy if exists "retirer une amitié" on public.amities;
create policy "retirer une amitié" on public.amities for delete to authenticated using (auth.uid() in (de, a));
revoke update on public.amities from anon, authenticated;

-- Accepter une demande reçue (seul le destinataire)
create or replace function public.accepter_ami(p_id bigint) returns void
  language plpgsql security definer set search_path = public
  as $$
  begin
    update public.amities set statut = 'acceptee' where id = p_id and a = auth.uid() and statut = 'en_attente';
    if not found then raise exception 'demande introuvable'; end if;
  end $$;
revoke all on function public.accepter_ami(bigint) from public, anon;
grant execute on function public.accepter_ami(bigint) to authenticated;

-- Présence : chacun écrit la sienne ; lue par soi-même et ses amis
drop policy if exists "sa présence" on public.presence;
create policy "sa présence" on public.presence
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "présence des amis" on public.presence;
create policy "présence des amis" on public.presence for select to authenticated using (exists (
  select 1 from public.amities m where m.statut = 'acceptee'
    and ((m.de = auth.uid() and m.a = presence.user_id) or (m.a = auth.uid() and m.de = presence.user_id))));

create or replace function public.je_suis_la() returns void
  language sql security invoker set search_path = public
  as $$ insert into public.presence (user_id, vu_le) values (auth.uid(), now())
        on conflict (user_id) do update set vu_le = now() $$;
grant execute on function public.je_suis_la() to authenticated;

-- Ma liste : amis (avec présence), demandes reçues, demandes envoyées
create or replace function public.mes_amis()
  returns table (id bigint, ami uuid, pseudo text, statut text, sens text, vu_le timestamptz, en_ligne boolean)
  language sql stable security invoker set search_path = public
  as $$
    select m.id, case when m.de = auth.uid() then m.a else m.de end, p.pseudo, m.statut,
           case when m.statut = 'acceptee' then 'ami' when m.de = auth.uid() then 'envoyee' else 'recue' end,
           pr.vu_le, coalesce(pr.vu_le > now() - interval '3 minutes', false)
    from public.amities m
    join public.profils p on p.id = case when m.de = auth.uid() then m.a else m.de end
    left join public.presence pr on pr.user_id = p.id
    where auth.uid() in (m.de, m.a)
    order by 7 desc, p.pseudo
  $$;
grant execute on function public.mes_amis() to authenticated;
