# Amicale Sapeurs-Pompiers de Bailleul

Application web mobile-first pour gérer l'Amicale :
- connexion membre par code
- profils utilisateur / administrateur
- festivités et réponses
- conjoint, enfants, bon cadeau et date limite
- sondages
- matériel et demandes de prêt
- boîte à idées
- gestion des membres
- récapitulatif des réponses côté administrateur
- logo intégré dans l'application

## Mise en service

### 1. Supabase
1. Ouvrir **Authentication > Providers**.
2. Activer **Anonymous Sign-Ins**.
3. Dans **SQL Editor**, exécuter `sql_patch.sql`.
4. Récupérer dans **Project Settings > API** :
   - Project URL
   - Publishable/anon key

### 2. Application
Ouvrir `app.js` et remplacer :

`REMPLACE_MOI_PAR_TON_URL_SUPABASE`

par l'URL du projet Supabase, et :

`REMPLACE_MOI_PAR_TA_CLE_ANON_SUPABASE`

par la clé publique/anon.

**Ne jamais mettre la clé `service_role` dans ce projet.**

### 3. GitHub / Vercel
Importer le dépôt GitHub dans Vercel. Le projet est une application statique et sera servi directement par Vercel.

## Premier accès
Le compte administrateur `ADMIN001` a été créé dans la base lors des étapes précédentes. Après activation des connexions anonymes et déploiement, utiliser `ADMIN001` dans l'écran de connexion.

## Important
Le système de connexion utilise une session anonyme Supabase, puis associe cette session au membre après vérification du code côté serveur via une fonction PostgreSQL `security definer`. Les codes sont stockés sous forme d'empreinte bcrypt.
