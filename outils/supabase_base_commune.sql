-- Base commune de reconnaissance des blisters, ouverte à tous les comptes de l'appli (Mathias, 07/11/2026 : « la base
-- commune des photos doit être accessible pour tous les utilisateurs de l'application, c'est ça qui va faire que quand un
-- utilisateur va prendre une photo d'un blister, il soit reconnu »).
--  - commune_blisters : une ligne par figurine (code BC-…) : nom, figurine du catalogue rattachée, « résumés » de
--    reconnaissance calculés par l'appli au moment de l'envoi (empreinte du décor, de la figurine, vision, texte du
--    verso), chemins des photos. Jamais de prix ni de numéro d'exemplaire. Tout compte connecté la lit et y ajoute ses
--    blisters ; chacun ne modifie que les siens (photo refaite).
--  - espace « commune » (Storage) : les photos, lisibles par tous les comptes ; chacun dépose dans son dossier.
--  - commune_export(depuis) : les nouveautés (sans les photos ni l'auteur), lisibles même sans compte : chaque matin, la
--    tâche « Base commune » du dépôt public les recopie dans data/jb_*.tsv ; d'ici là, l'appli les ajoute toute seule.
-- À coller une fois dans Supabase : « SQL Editor » > « New query », puis « Run ». Peut être relancé sans risque.

create table if not exists public.commune_blisters (
  code text primary key check (code ~ '^BC-[A-Z0-9_-]{2,40}$'),
  nom text not null check (char_length(nom) between 1 and 200),
  rattache text check (char_length(rattache) <= 60),
  empreinte text check (char_length(empreinte) <= 10000),
  empreinte_fig text check (char_length(empreinte_fig) <= 10000),
  vision text check (char_length(vision) <= 10000),
  verso_texte text check (char_length(verso_texte) <= 3000),
  photo text check (char_length(photo) <= 200),
  verso text check (char_length(verso) <= 200),
  auteur uuid not null default auth.uid() references auth.users (id) on delete set null,
  cree timestamptz not null default now(),
  maj timestamptz not null default now()
);
alter table public.commune_blisters alter column auteur drop not null;
alter table public.commune_blisters enable row level security;

drop policy if exists "base commune lisible par les comptes" on public.commune_blisters;
create policy "base commune lisible par les comptes" on public.commune_blisters for select to authenticated using (true);
drop policy if exists "ajouter ses blisters" on public.commune_blisters;
create policy "ajouter ses blisters" on public.commune_blisters for insert to authenticated with check (auteur = auth.uid());
drop policy if exists "modifier ses blisters" on public.commune_blisters;
create policy "modifier ses blisters" on public.commune_blisters for update to authenticated
  using (auteur = auth.uid() or public.est_admin()) with check (auteur = auth.uid() or public.est_admin());
revoke all on public.commune_blisters from anon;
grant select, insert, update on public.commune_blisters to authenticated;

-- date de mise à jour à chaque modification (pour les nouveautés de commune_export)
create or replace function public._commune_maj() returns trigger language plpgsql as $$
  begin new.maj = now(); return new; end $$;
drop trigger if exists commune_maj on public.commune_blisters;
create trigger commune_maj before update on public.commune_blisters for each row execute function public._commune_maj();

-- nouveautés depuis une date, sans photo ni auteur (ces données deviennent de toute façon publiques dans data/)
create or replace function public.commune_export(depuis timestamptz) returns table (
  code text, nom text, rattache text, empreinte text, empreinte_fig text, vision text, verso_texte text, maj timestamptz)
  language sql security definer set search_path = public stable
  as $$ select code, nom, rattache, empreinte, empreinte_fig, vision, verso_texte, maj from public.commune_blisters
        where maj > depuis order by maj $$;
grant execute on function public.commune_export(timestamptz) to anon, authenticated;

-- photos : espace « commune », lisible par tous les comptes ; chacun dépose et remplace dans son dossier <son id>/
insert into storage.buckets (id, name, public) values ('commune', 'commune', false) on conflict (id) do nothing;
drop policy if exists "commune : voir les photos" on storage.objects;
create policy "commune : voir les photos" on storage.objects for select to authenticated using (bucket_id = 'commune');
drop policy if exists "commune : déposer ses photos" on storage.objects;
create policy "commune : déposer ses photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'commune' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "commune : remplacer ses photos" on storage.objects;
create policy "commune : remplacer ses photos" on storage.objects for update to authenticated
  using (bucket_id = 'commune' and (storage.foldername(name))[1] = auth.uid()::text);
