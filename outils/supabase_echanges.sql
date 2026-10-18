-- Échanges entre collectionneurs (18/10/2026, demande de Mathias). Après supabase_schema.sql et supabase_roles.sql.
-- À coller une fois dans Supabase : « SQL Editor » -> « New query » -> coller -> menu « Database » -> « Run ».
-- Peut être relancé sans risque.
--
--   annonces_echange : ce que chacun PUBLIE (volontairement) : ses doubles (sens « offre ») et sa liste de souhaits
--                      (sens « souhait »). Clé commune « cle » : F|<code LEGO> pour une figurine officielle,
--                      C|<code catalogue JB> (ou C|<nom>) pour une custom. Lisibles par tous les comptes connectés.
--   propositions     : proposition d'échange de A à B (ce que A donne, ce que A reçoit) et son état.
--   messages         : discussion attachée à une proposition (seuls les deux collectionneurs la voient).

create table if not exists public.annonces_echange (
  user_id uuid not null references auth.users (id) on delete cascade,
  sens text not null check (sens in ('offre', 'souhait')),
  cle text not null check (char_length(cle) between 3 and 200),
  type text not null check (type in ('Figurine', 'Custom')),
  code text,
  nom text check (char_length(nom) <= 200),
  quantite integer not null default 1 check (quantite between 1 and 999),
  numeros text check (char_length(numeros) <= 200),
  maj timestamptz not null default now(),
  primary key (user_id, sens, cle)
);
create index if not exists annonces_echange_cle on public.annonces_echange (cle, sens);
-- valeur estimée d'un exemplaire (€), d'après la Valeur de l'appli ou le prix JB : pour comparer ce qu'on donne et ce qu'on reçoit
alter table public.annonces_echange add column if not exists valeur numeric(8, 2) check (valeur >= 0 and valeur < 100000);

create table if not exists public.propositions (
  id bigint generated always as identity primary key,
  de uuid not null references auth.users (id) on delete cascade,
  a uuid not null references auth.users (id) on delete cascade,
  je_donne jsonb not null default '[]',
  je_recois jsonb not null default '[]',
  statut text not null default 'envoyee' check (statut in ('envoyee', 'acceptee', 'refusee', 'annulee', 'terminee')),
  cree_le timestamptz not null default now(),
  maj timestamptz not null default now(),
  check (de <> a)
);
create index if not exists propositions_de on public.propositions (de);
create index if not exists propositions_a on public.propositions (a);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  proposition_id bigint not null references public.propositions (id) on delete cascade,
  auteur uuid not null references auth.users (id) on delete cascade,
  texte text not null check (char_length(texte) between 1 and 2000),
  cree_le timestamptz not null default now()
);
create index if not exists messages_proposition on public.messages (proposition_id);

alter table public.annonces_echange enable row level security;
alter table public.propositions enable row level security;
alter table public.messages enable row level security;

-- Annonces : lues par tous les comptes connectés ; chacun n'écrit que les siennes
drop policy if exists "annonces lisibles par les comptes connectés" on public.annonces_echange;
create policy "annonces lisibles par les comptes connectés" on public.annonces_echange
  for select to authenticated using (true);
drop policy if exists "ses annonces seulement" on public.annonces_echange;
create policy "ses annonces seulement" on public.annonces_echange
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Propositions : visibles des deux collectionneurs ; envoyées en son nom ; seul l'état change ensuite
drop policy if exists "ses propositions" on public.propositions;
create policy "ses propositions" on public.propositions
  for select to authenticated using (auth.uid() in (de, a));
drop policy if exists "proposer en son nom" on public.propositions;
create policy "proposer en son nom" on public.propositions
  for insert to authenticated with check (de = auth.uid() and statut = 'envoyee');
drop policy if exists "changer l'état de ses propositions" on public.propositions;
revoke update, delete on public.propositions from anon, authenticated;

-- État d'une proposition, seulement par la fonction ci-dessous : le destinataire accepte ou refuse, l'expéditeur annule,
-- l'un ou l'autre marque l'échange comme terminé une fois accepté
create or replace function public.changer_statut(p_id bigint, p_statut text) returns text
  language plpgsql security definer set search_path = public
  as $$
  declare p public.propositions;
  begin
    select * into p from public.propositions where id = p_id for update;
    if p.id is null or auth.uid() not in (p.de, p.a) then raise exception 'proposition introuvable'; end if;
    if not (
         (p_statut in ('acceptee', 'refusee') and auth.uid() = p.a and p.statut = 'envoyee')
      or (p_statut = 'annulee' and auth.uid() = p.de and p.statut in ('envoyee', 'acceptee'))
      or (p_statut = 'terminee' and p.statut = 'acceptee')
    ) then raise exception 'changement non permis'; end if;
    update public.propositions set statut = p_statut, maj = now() where id = p_id;
    return p_statut;
  end $$;
revoke all on function public.changer_statut(bigint, text) from public, anon;
grant execute on function public.changer_statut(bigint, text) to authenticated;

-- Messages : lus et écrits seulement par les deux collectionneurs de la proposition
drop policy if exists "messages de ses propositions" on public.messages;
create policy "messages de ses propositions" on public.messages
  for select to authenticated using (exists (select 1 from public.propositions p where p.id = proposition_id and auth.uid() in (p.de, p.a)));
drop policy if exists "écrire dans ses propositions" on public.messages;
create policy "écrire dans ses propositions" on public.messages
  for insert to authenticated with check (auteur = auth.uid()
    and exists (select 1 from public.propositions p where p.id = proposition_id and auth.uid() in (p.de, p.a)));
revoke update, delete on public.messages from anon, authenticated;

-- Publier ses annonces d'un coup (remplace les précédentes) : offres et souhaits = [{cle, type, code, nom, quantite, numeros}]
create or replace function public.publier_annonces(offres jsonb, souhaits jsonb) returns integer
  language plpgsql security invoker set search_path = public
  as $$
  declare n integer;
  begin
    if auth.uid() is null then raise exception 'non connecté'; end if;
    delete from public.annonces_echange where user_id = auth.uid();
    insert into public.annonces_echange (user_id, sens, cle, type, code, nom, quantite, numeros, valeur)
    select auth.uid(), s.sens, e ->> 'cle', e ->> 'type', e ->> 'code', left(e ->> 'nom', 200),
           greatest(1, least(999, coalesce((e ->> 'quantite')::int, 1))), left(e ->> 'numeros', 200),
           case when (e ->> 'valeur') ~ '^[0-9]+(\.[0-9]+)?$' and (e ->> 'valeur')::numeric < 100000 then round((e ->> 'valeur')::numeric, 2) end
    from (select 'offre' as sens, x as e from jsonb_array_elements(coalesce(offres, '[]')) x
          union all select 'souhait', x from jsonb_array_elements(coalesce(souhaits, '[]')) x) s
    on conflict (user_id, sens, cle) do nothing;
    get diagnostics n = row_count;
    return n;
  end $$;
grant execute on function public.publier_annonces(jsonb, jsonb) to authenticated;

-- Collectionneurs avec qui échanger : ce qu'ils ont de ma liste de souhaits, ce qu'ils cherchent dans mes doubles
create or replace function public.correspondances()
  returns table (user_id uuid, pseudo text, il_a jsonb, il_cherche jsonb)
  language sql stable security invoker set search_path = public
  as $$
    with moi as (select sens, cle from public.annonces_echange where user_id = auth.uid()),
    a as (select o.user_id, jsonb_agg(jsonb_build_object('cle', o.cle, 'type', o.type, 'code', o.code, 'nom', o.nom,
                 'quantite', o.quantite, 'numeros', o.numeros, 'valeur', o.valeur) order by o.nom) l
          from public.annonces_echange o join moi on moi.sens = 'souhait' and moi.cle = o.cle
          where o.sens = 'offre' and o.user_id <> auth.uid() group by o.user_id),
    c as (select s.user_id, jsonb_agg(jsonb_build_object('cle', s.cle, 'type', s.type, 'code', mo.code, 'nom', mo.nom,
                 'quantite', mo.quantite, 'numeros', mo.numeros, 'valeur', mo.valeur) order by s.nom) l
          from public.annonces_echange s join moi on moi.sens = 'offre' and moi.cle = s.cle
          join public.annonces_echange mo on mo.user_id = auth.uid() and mo.sens = 'offre' and mo.cle = s.cle
          where s.sens = 'souhait' and s.user_id <> auth.uid() group by s.user_id)
    select coalesce(a.user_id, c.user_id), p.pseudo, coalesce(a.l, '[]'::jsonb), coalesce(c.l, '[]'::jsonb)
    from a full join c on a.user_id = c.user_id
    join public.profils p on p.id = coalesce(a.user_id, c.user_id)
  $$;
grant execute on function public.correspondances() to authenticated;
