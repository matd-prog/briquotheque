-- Valeur de la collection pour tous les comptes de l'appli (Mathias, 07/11/2026 : « donne-lui aussi accès à la valeur »).
-- Les prix du MARCHÉ relevés dans le dépôt privé (ventes BrickLink, prix LEGO France, annonces eBay) sont recopiés ici
-- chaque jour par le relevé des prix (GitHub, workflow prix.yml du dépôt privé) ; tout compte connecté peut les lire.
-- Jamais d'achats ni de prix payés ici (achats.tsv, customs_achetees.tsv restent dans le dépôt privé).
-- Chaque compte envoie la liste des codes de SA collection (codes seulement, sans noms ni prix) ; le relevé quotidien
-- relève aussi ces codes. Accès du relevé : clé privée « prix » (en-tête x-prix-key), créée ici, que Mathias copie dans
-- les secrets du dépôt privé (SUPABASE_CLE_PRIX). Nécessite outils/supabase_rapports.sql (table cles_privees).
-- À coller une fois dans Supabase : « SQL Editor » > « New query », puis « Run ». Peut être relancé sans risque.

-- 1. Prix partagés : un fichier par ligne (même format que dans le dépôt privé)
create table if not exists public.fichiers_prix (
  nom text primary key check (nom in ('prix.tsv', 'lego.tsv', 'prix_ebay.tsv', 'prix_ebay_sets.tsv', 'prix_ebay_marques.tsv')),
  contenu text not null check (char_length(contenu) <= 5000000),
  maj timestamptz not null default now()
);
alter table public.fichiers_prix enable row level security;
drop policy if exists "prix lisibles par les comptes" on public.fichiers_prix;
create policy "prix lisibles par les comptes" on public.fichiers_prix for select to authenticated using (true);
revoke all on public.fichiers_prix from anon;
grant select on public.fichiers_prix to authenticated;

-- 2. Liste des codes de chaque compte (« MINIFIG sw0841 », « SET 75192-1 »… un par ligne)
create table if not exists public.listes_codes (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  codes text not null check (char_length(codes) <= 300000),
  maj timestamptz not null default now()
);
alter table public.listes_codes enable row level security;
drop policy if exists "sa liste seulement" on public.listes_codes;
create policy "sa liste seulement" on public.listes_codes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.listes_codes from anon;
grant select, insert, update, delete on public.listes_codes to authenticated;

-- 3. Accès du relevé des prix (GitHub) : clé privée « prix »
insert into public.cles_privees (nom, valeur) values ('prix', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (nom) do nothing;

create or replace function public._cle_prix_ok() returns boolean
  language sql security definer set search_path = public stable
  as $$ select exists (select 1 from public.cles_privees where nom = 'prix'
           and valeur = coalesce(current_setting('request.headers', true)::json ->> 'x-prix-key', '')) $$;
revoke execute on function public._cle_prix_ok() from public, anon, authenticated;

-- codes de toutes les listes, sans doublon ni rien d'autre (pas de compte, pas de date)
create or replace function public.codes_a_relever() returns setof text
  language sql security definer set search_path = public stable
  as $$ select distinct trim(l) from public.listes_codes, regexp_split_to_table(codes, E'\n') as l
        where public._cle_prix_ok() and trim(l) ~ '^[A-Z]{2,10} [A-Za-z0-9._-]{1,40}$' order by 1 $$;
grant execute on function public.codes_a_relever() to anon;

create or replace function public.publier_prix(p_nom text, p_contenu text) returns void
  language plpgsql security definer set search_path = public
  as $$ begin
    if not public._cle_prix_ok() then raise exception 'clé refusée'; end if;
    insert into public.fichiers_prix (nom, contenu, maj) values (p_nom, p_contenu, now())
      on conflict (nom) do update set contenu = excluded.contenu, maj = now();
  end $$;
grant execute on function public.publier_prix(text, text) to anon;

-- À la fin : la clé à copier dans les secrets du dépôt privé (nom du secret : SUPABASE_CLE_PRIX)
select valeur as cle_prix_a_copier from public.cles_privees where nom = 'prix';
