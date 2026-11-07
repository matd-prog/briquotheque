-- Partages avec un ami (Mathias, 07/11/2026) : « toute la collection, pour que des amis puissent la voir, sans pouvoir
-- faire d'action » et « un fichier des doubles à échanger », « sans aucune notion de valeur ». Après supabase_amis.sql.
-- Une ligne = ce qu'un compte (de) montre à UN ami (a) : sorte « collection » (catégorie, thème, nom, code, n°, état,
-- quantité) ou « doubles » (exemplaires en double : nom, code, nombre, n°). Jamais de prix, de valeur ni de photo.
-- Seuls ces deux comptes la voient ; on ne partage qu'avec un ami accepté ; un nouveau partage de la même sorte au même
-- ami remplace l'ancien ; l'un ou l'autre peut le retirer.
-- À coller une fois dans Supabase : « SQL Editor » > « New query », puis « Run ». Peut être relancé sans risque.

create table if not exists public.partages_amis (
  id bigint generated always as identity primary key,
  de uuid not null default auth.uid() references auth.users (id) on delete cascade,
  a uuid not null references auth.users (id) on delete cascade,
  sorte text not null check (sorte in ('collection', 'doubles')),
  contenu jsonb not null check (jsonb_typeof(contenu) = 'array' and jsonb_array_length(contenu) <= 30000),
  cree_le timestamptz not null default now(),
  check (de <> a)
);
create unique index if not exists partages_amis_paire on public.partages_amis (de, a, sorte);

alter table public.partages_amis enable row level security;

-- vrai si les deux comptes sont amis (demande acceptée)
create or replace function public.sont_amis(x uuid, y uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.amities where statut = 'acceptee'
           and ((de = x and a = y) or (de = y and a = x))) $$;
revoke execute on function public.sont_amis(uuid, uuid) from public, anon;
grant execute on function public.sont_amis(uuid, uuid) to authenticated;

drop policy if exists "partages visibles des deux amis" on public.partages_amis;
create policy "partages visibles des deux amis" on public.partages_amis
  for select to authenticated using (auth.uid() in (de, a));
drop policy if exists "partager avec un ami" on public.partages_amis;
create policy "partager avec un ami" on public.partages_amis
  for insert to authenticated with check (de = auth.uid() and public.sont_amis(de, a));
drop policy if exists "mettre à jour son partage" on public.partages_amis;
create policy "mettre à jour son partage" on public.partages_amis
  for update to authenticated using (de = auth.uid()) with check (de = auth.uid() and public.sont_amis(de, a));
drop policy if exists "retirer un partage" on public.partages_amis;
create policy "retirer un partage" on public.partages_amis
  for delete to authenticated using (auth.uid() in (de, a));

revoke all on public.partages_amis from anon;
grant select, insert, update, delete on public.partages_amis to authenticated;

-- Photos des partages (07/11/2026 : « qu'il n'y ait pas les prix, c'est bien, mais qu'il y ait les photos ») : espace
-- « partages » de Supabase Storage, privé. Chaque compte dépose ses photos (blisters, tiles et objets JB, réduites) dans
-- son dossier <son id>/ ; elles ne sont visibles que de lui et des amis avec qui il a partagé quelque chose.
-- Figurines officielles et sets : image BrickLink (publique), rien n'est déposé.
insert into storage.buckets (id, name, public) values ('partages', 'partages', false) on conflict (id) do nothing;

drop policy if exists "partages : déposer ses photos" on storage.objects;
create policy "partages : déposer ses photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'partages' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "partages : voir les photos partagées" on storage.objects;
create policy "partages : voir les photos partagées" on storage.objects for select to authenticated
  using (bucket_id = 'partages' and ((storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.partages_amis p where p.de::text = (storage.foldername(name))[1] and p.a = auth.uid())));
drop policy if exists "partages : retirer ses photos" on storage.objects;
create policy "partages : retirer ses photos" on storage.objects for delete to authenticated
  using (bucket_id = 'partages' and (storage.foldername(name))[1] = auth.uid()::text);
