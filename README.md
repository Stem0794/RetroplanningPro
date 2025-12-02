# RetroplanningPro

Planificateur React/Vite avec sauvegarde Supabase et export Excel façon Gantt.

## Fonctionnalités
- Tableau de bord : création, duplication, suppression et édition inline des projets (titre/description).
- Planning interactif : phases glissables/redimensionnables, ajout en traçant sur la grille, zoom, centrage sur aujourd’hui, import de liens publics en lecture seule.
- Sous-projets, phases, OOO multi-jours, export Excel stylé (mois/semaines/jours + couleurs de phases).
- Connexion Supabase (mode local possible pour les liens publics).

## Prérequis
- Node.js 18+ recommandé.
- Clés Supabase (clé anon publique + utilisateur email/mot de passe pour la synchro).

## Installation
```bash
npm install
```

## Démarrer en local
```bash
npm run dev
```

## Build production
```bash
npm run build
```

## Configuration Supabase
Créer un fichier `.env.local` (ou secrets GitHub Actions) :
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=anon-public-key
VITE_SUPABASE_EMAIL=auth-user@email.com
VITE_SUPABASE_PASSWORD=auth-user-password
```
- Utiliser **la clé anon publique** (jamais la service_role).
- Créer un utilisateur Auth avec l’email/mot de passe ci-dessus ; il servira pour la synchro.
- Les liens publics (`?plan=...`) restent en local/lecture seule.

## Déploiement GitHub Pages
- Le workflow Pages build avec `npm run build` et publie `dist/`.
- Assurez-vous que les secrets Supabase sont définis dans `Settings → Secrets and variables → Actions`.

## Export Excel
- Onglet “Task List” et “Visual Timeline” : entêtes mois/semaines/jours, couleurs des phases, OOO visibles.

## Notes
- Pas de migration SQL fournie : créer vos tables/politiques Supabase selon vos besoins (phases, subprojects, holidays, projects). Le client fonctionne en mode local si les clés manquent.
