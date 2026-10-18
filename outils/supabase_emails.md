# E-mails des comptes (Supabase) : envoi rapide et textes en français

À régler une fois dans Supabase (projet « briquotheque »). Les noms de menus sont en anglais (site non traduit).

## 1. Envoi rapide : serveur d'envoi Brevo (gratuit, 300 e-mails par jour)

Sans réglage, Supabase envoie les e-mails par son propre serveur : 2 e-mails par heure au plus, parfois en retard,
souvent classés en indésirables. Avec Brevo (société française), l'e-mail arrive en quelques secondes.

1. Créer un compte gratuit sur https://www.brevo.com (adresse mathiasdurand@gmail.com).
2. Brevo, menu en haut à droite (nom du compte) → « SMTP et API » (SMTP & API) → onglet « SMTP » →
   « Générer une nouvelle clé SMTP » (Generate a new SMTP key), nom « briquotheque ». Copier la clé
   (elle n'est montrée qu'une fois). Elle est SECRÈTE : la coller seulement dans Supabase, ne la donner à personne.
3. Brevo → « Expéditeurs, domaines et IP dédiées » (Senders, Domains & Dedicated IPs) → « Expéditeurs » →
   vérifier que mathiasdurand@gmail.com est bien un expéditeur validé (sinon l'ajouter et cliquer le lien reçu).
4. Supabase → Authentication → Emails → onglet « SMTP Settings » → activer « Enable custom SMTP » :
   - Sender email : mathiasdurand@gmail.com
   - Sender name : Briquothèque
   - Host : smtp-relay.brevo.com
   - Port number : 587
   - Minimum interval between emails : 60 (laisser)
   - Username : l'identifiant SMTP affiché par Brevo (onglet SMTP, « Identifiant » / Login, finit par @smtp-brevo.com)
   - Password : la clé SMTP de l'étape 2
   → « Save changes ».
5. Supabase → Authentication → Rate Limits → « Rate limit for sending emails » : mettre 30 (par heure) → Save.

## 2. Textes des e-mails en français

Supabase → Authentication → Emails → onglet « Templates ».

### « Confirm signup »

Subject : `Confirmez votre compte Briquothèque`

Body (onglet « Source ») :

```html
<h2>Bienvenue dans la Briquothèque</h2>
<p>Pour activer votre compte, touchez ce lien :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon adresse e-mail</a></p>
<p>Vous reviendrez dans l'appli, connecté.</p>
<p>Si vous n'avez pas créé de compte, ignorez cet e-mail.</p>
```

### « Reset Password »

Subject : `Nouveau mot de passe pour la Briquothèque`

Body :

```html
<h2>Mot de passe oublié</h2>
<p>Pour choisir un nouveau mot de passe, touchez ce lien (valable 1 heure) :</p>
<p><a href="{{ .ConfirmationURL }}">Choisir un nouveau mot de passe</a></p>
<p>Vous reviendrez dans l'appli pour le taper.</p>
<p>Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.</p>
```
