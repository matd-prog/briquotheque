-- Rôles des comptes (18/10/2026) : « admin » pour Mathias, « utilisateur » pour tous les autres.
-- À coller une fois dans Supabase : « SQL Editor » -> « New query » -> coller -> « Run » (après supabase_schema.sql).
-- Peut être relancé sans risque. Déjà repris dans supabase_schema.sql pour une base neuve.
--
-- Sécurité : personne ne peut changer son propre rôle depuis l'appli (droits limités aux colonnes pseudo et
-- visibilite) ; le rôle admin ne se donne que d'ici (SQL Editor, réservé au propriétaire du projet Supabase).

alter table public.profils add column if not exists role text not null default 'utilisateur'
  check (role in ('utilisateur', 'admin'));

-- Les comptes connectés ne modifient que pseudo et visibilité ; la création du profil passe par le déclencheur.
revoke insert, update on public.profils from anon, authenticated;
grant update (pseudo, visibilite) on public.profils to authenticated;
drop policy if exists "créer son profil" on public.profils;

-- Profil créé avec le compte : admin pour l'adresse de Mathias, utilisateur pour les autres
create or replace function public.creer_profil() returns trigger
  language plpgsql security definer set search_path = public
  as $$
  begin
    insert into public.profils (id, pseudo, role)
    values (new.id,
            coalesce(nullif(trim(new.raw_user_meta_data ->> 'pseudo'), ''), 'collectionneur-' || left(new.id::text, 8)),
            case when lower(new.email) = 'mathiasdurand@gmail.com' then 'admin' else 'utilisateur' end)
    on conflict (id) do nothing;
    return new;
  end $$;

-- Pour les futures règles d'accès réservées à l'admin : « using (public.est_admin()) »
create or replace function public.est_admin() returns boolean
  language sql security definer set search_path = public stable
  as $$ select exists (select 1 from public.profils where id = auth.uid() and role = 'admin') $$;
grant execute on function public.est_admin() to authenticated;

-- Compte de Mathias déjà créé : passé admin
update public.profils set role = 'admin'
  where id in (select id from auth.users where lower(email) = 'mathiasdurand@gmail.com');
