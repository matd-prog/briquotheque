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
