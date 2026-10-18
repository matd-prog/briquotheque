-- Base en ligne de la Briquothèque (Supabase, projet « briquotheque », région Francfort), 18/10/2026.
-- À coller une fois dans Supabase : menu de gauche « SQL Editor » -> « New query » -> coller -> « Run ».
-- Peut être relancé sans risque (il ne recrée que ce qui manque).
--
-- Comptes : gérés par Supabase (auth.users : e-mail, mot de passe chiffré). Ici :
--   profils      : pseudo et visibilité de la collection de chaque compte ;
--   sauvegardes  : dernière sauvegarde en ligne de la collection (même contenu que la sauvegarde .json de l'appli).
-- Sécurité (Row Level Security) : chacun ne lit et n'écrit que SA sauvegarde ; les pseudos sont lisibles par les
-- comptes connectés (pour les retrouver entre amis), modifiables seulement par leur propriétaire.

create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text unique not null check (char_length(pseudo) between 3 and 30),
  visibilite text not null default 'prive' check (visibilite in ('prive', 'amis', 'public')),
  cree_le timestamptz not null default now()
);

create table if not exists public.sauvegardes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  contenu jsonb not null,
  articles integer,
  maj timestamptz not null default now()
);

alter table public.profils enable row level security;
alter table public.sauvegardes enable row level security;

drop policy if exists "pseudos lisibles par les comptes connectés" on public.profils;
create policy "pseudos lisibles par les comptes connectés" on public.profils
  for select to authenticated using (true);
drop policy if exists "créer son profil" on public.profils;
create policy "créer son profil" on public.profils
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "modifier son profil" on public.profils;
create policy "modifier son profil" on public.profils
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "sa sauvegarde seulement" on public.sauvegardes;
create policy "sa sauvegarde seulement" on public.sauvegardes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pseudo libre ? (avant la création du compte : appelée sans être connecté)
create or replace function public.pseudo_libre(p text) returns boolean
  language sql security definer set search_path = public stable
  as $$ select not exists (select 1 from public.profils where lower(pseudo) = lower(trim(p))) $$;
grant execute on function public.pseudo_libre(text) to anon, authenticated;

-- Profil créé avec le compte (pseudo donné à l'inscription, dans les données du compte)
create or replace function public.creer_profil() returns trigger
  language plpgsql security definer set search_path = public
  as $$
  begin
    insert into public.profils (id, pseudo)
    values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'pseudo'), ''), 'collectionneur-' || left(new.id::text, 8)))
    on conflict (id) do nothing;
    return new;
  end $$;
drop trigger if exists profil_a_l_inscription on auth.users;
create trigger profil_a_l_inscription after insert on auth.users
  for each row execute function public.creer_profil();

-- Suppression de son propre compte (RGPD) : le compte, son profil et sa sauvegarde (cascade)
create or replace function public.supprimer_mon_compte() returns void
  language sql security definer set search_path = public
  as $$ delete from auth.users where id = auth.uid() $$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
