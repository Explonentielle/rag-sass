# CLAUDE.md : rag-saas (Corpus.ai)

Projet solo, dissocié des projets clients de la section « Projets » de
`~/.claude/CLAUDE.md` (aucune règle PHP/Laravel/Latin-1/ticket de cette
section ne s'applique ici). Les règles globales (style, sécurité `.env`,
periimètre strict, honnêteté sur les tests, etc.) s'appliquent toutes en
plus de ce fichier ; seul ce qui est propre à rag-saas est redit ici.

## Stack

Next.js (App Router, TypeScript), Supabase (Postgres + RLS + Storage),
Elasticsearch, OpenAI (génération + reranking + extraction), Tailwind CSS.

Scripts de référence (`package.json`) : `npm run typecheck` (`tsc
--noEmit`), `npm test` (`vitest run`), `npm run smoke-test`, `npm run
rag-eval`. **Avant de considérer une tâche terminée** : `typecheck` + `test`
au vert.

## Git : pas de workflow par ticket ici

Projet solo, une seule branche : `main` sert à la fois de branche de
travail et de déploiement (Vercel). Pas de `feature/{iid}-{slug}`, pas de
PR.

- Grouper les commits par sujet logique (une feature, un lot de fixes, une
  refonte visuelle : des commits séparés plutôt qu'un seul fourre-tout).
  Message en français, direct, pas de trailer `Co-Authored-By`.
- **Jamais de push sans demande explicite dans le même message**, règle
  globale inchangée : sur ce projet elle compte double puisqu'il n'y a pas
  de PR entre le commit et la prod. _(2026-11-23 : le classificateur de
  sécurité de Claude Code a lui-même bloqué un commit sur `main` avant
  validation explicite ; contourné volontairement ce jour-là après
  confirmation explicite, mais la règle de prudence reste la même pour la
  suite.)_

## Commentaires : pas de docblock PHP-style ici

Projet TypeScript, pas de PHPDoc/`@param`/`@return` à la façon des projets
PHP du fichier global. Style observé et à garder : commentaire d'une ligne
seulement quand le pourquoi n'est pas évident (contrainte cachée,
contournement, lien vers `docs/roadmap.md item N`), jamais pour répéter ce
que le code dit déjà. Pas de bloc de commentaire multi-lignes.

## Style UI

Tailwind uniquement : pas de `style="..."` ni `style={{...}}` en ligne. Les
couleurs passent par les tokens `brand`/`slate`/`brass` de
`tailwind.config.ts`, jamais une couleur en dur dans un composant
(`bg-[#...]`) : si une teinte manque, l'ajouter au token plutôt que la
coder en dur localement. _(2026-11-23 : `components/ui/Logo.tsx` avait un
`bg-[#A8341F]` en dur, contournant le token déjà en place, corrigé lors de
la refonte de charte.)_

## Sécurité et secrets

`.env`, `.env.example`, `.env.prod.example` à la racine : mêmes règles
globales (jamais lus/affichés, jamais résolus indirectement). Secrets
concernés : clés Supabase (service role), OpenAI, Stripe, Elasticsearch.

Modèle de sécurité de l'appli : multi-tenant par `organization_id`, imposé
par des policies RLS Postgres (`is_org_member`, `is_org_admin`...), pas
par un filtre applicatif seul. Toute nouvelle requête Supabase doit
s'appuyer sur ce RLS plutôt que ré-implémenter un contrôle d'accès à la
main.

## Debug temporaire

Pas de `console.log` ni de logger ad hoc : utiliser `lib/logger.ts`
(JSON lines, un fichier par jour dans `./logs`, lecture seule dev/VPS, pas
fiable sur Vercel/serverless). **RGPD (docs/roadmap.md item 20)** : jamais
de contenu brut utilisateur/visiteur dans ces logs (questions de chat,
texte de document...), seulement des longueurs/compteurs/ids.

## Documentation à tenir à jour (pas automatique, à faire explicitement)

`docs/roadmap.md` est la mémoire centralisée du projet (items numérotés
référencés depuis le code). Après une implémentation notable :
- ajouter une entrée dans `docs/roadmap.md` ;
- mettre à jour `docs/deployment.md` si une étape de déploiement change ;
- mettre à jour `docs/architecture.md` si un composant ou un flux de
  données change.

Ce n'est pas vérifié automatiquement : un commentaire de code qui devient
faux avec le temps (ex. une couleur de thème commentée comme « à jour »
alors qu'elle ne l'était plus, trouvé le 2026-11-23) ne sera pas détecté
tout seul.
