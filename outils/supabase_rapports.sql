-- Rapports de problème et suggestions envoyés depuis l'appli et la mini-appli (06/11/2026).
-- À coller une fois dans Supabase : projet « briquotheque » > « SQL Editor » > « New query », puis « Run ».
-- N'importe qui peut ENVOYER un rapport (même sans compte : l'ami de la mini-appli n'en a pas) ;
-- seul le compte administrateur (Mathias, est_admin(), outils/supabase_schema.sql) peut les LIRE et les marquer traités.
-- Rien de la collection n'y est mis : description, type, version, écran, appareil, dernières erreurs et actions,
-- capture d'écran facultative (réduite, en texte base64).

create table if not exists public.rapports (
  id bigint generated always as identity primary key,
  cree timestamptz not null default now(),
  type text not null check (type in ('bug', 'idee')),
  texte text not null check (char_length(texte) between 1 and 4000),
  appli text check (char_length(appli) <= 40),          -- « appli » ou « mini-appli »
  version text check (char_length(version) <= 20),
  pseudo text check (char_length(pseudo) <= 60),        -- pseudo du compte, s'il y en a un
  diagnostic text check (char_length(diagnostic) <= 20000),
  capture text check (char_length(capture) <= 2000000), -- image JPEG en base64 (data:image/jpeg;base64,…)
  traite boolean not null default false
);

alter table public.rapports enable row level security;

drop policy if exists "envoyer un rapport" on public.rapports;
create policy "envoyer un rapport" on public.rapports
  for insert to anon, authenticated with check (traite = false);

drop policy if exists "lire les rapports (admin)" on public.rapports;
create policy "lire les rapports (admin)" on public.rapports
  for select to authenticated using (public.est_admin());

drop policy if exists "marquer un rapport traité (admin)" on public.rapports;
create policy "marquer un rapport traité (admin)" on public.rapports
  for update to authenticated using (public.est_admin()) with check (public.est_admin());

grant insert on public.rapports to anon, authenticated;
grant select, update on public.rapports to authenticated;

-- Analyse automatique des rapports (06/11/2026) : une tâche programmée de Claude lit chaque jour les rapports pas encore
-- traités ni analysés, cherche la cause dans le code et note sa proposition (colonne « analyse », lue dans l'appli par
-- l'admin ; « analyse » est un mot réservé du SQL : toujours entre guillemets). Elle n'a pas de compte : elle présente une clé privée (en-tête « x-rapports-key »), créée ici et gardée
-- dans une table que personne ne peut lire par Internet ; Mathias la colle lui-même dans le formulaire sécurisé de
-- l'environnement de Claude (jamais dans une conversation).
alter table public.rapports add column if not exists "analyse" text check (char_length("analyse") <= 20000);
alter table public.rapports add column if not exists analyse_le timestamptz;

create table if not exists public.cles_privees (nom text primary key, valeur text not null);
alter table public.cles_privees enable row level security; -- aucune règle : illisible par Internet
revoke all on public.cles_privees from anon, authenticated;
create extension if not exists pgcrypto;
insert into public.cles_privees (nom, valeur) values ('rapports', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (nom) do nothing;

create or replace function public._cle_rapports_ok() returns boolean
  language sql security definer set search_path = public stable
  as $$ select exists (select 1 from public.cles_privees where nom = 'rapports'
           and valeur = coalesce(current_setting('request.headers', true)::json ->> 'x-rapports-key', '')) $$;
revoke execute on function public._cle_rapports_ok() from public, anon, authenticated;

create or replace function public.rapports_a_analyser() returns setof public.rapports
  language sql security definer set search_path = public stable
  as $$ select * from public.rapports where public._cle_rapports_ok() and not traite and "analyse" is null order by cree $$;
grant execute on function public.rapports_a_analyser() to anon;

create or replace function public.noter_analyse(p_id bigint, p_texte text) returns void
  language plpgsql security definer set search_path = public
  as $$ begin
    if not public._cle_rapports_ok() then raise exception 'clé refusée'; end if;
    update public.rapports set "analyse" = left(p_texte, 20000), analyse_le = now() where id = p_id;
  end $$;
grant execute on function public.noter_analyse(bigint, text) to anon;

-- À la fin : la clé à copier (une seule fois) dans le formulaire sécurisé que Claude affiche
select valeur as cle_a_copier from public.cles_privees where nom = 'rapports';
