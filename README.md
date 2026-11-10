# Atelier Logique · Camille

Petite PWA éducative pour apprendre à vérifier un raisonnement (style *Logic Theorist*, 1956), pas à partir d’une conclusion toute faite.

## Outils

1. **Validité d’argument** — prémisses + conclusion, contre-exemple pas à pas, formes classiques avec une phrase simple.
2. **Table de vérité** — tautologie / contradiction / contingente. Mode « Montre-moi » ou « Je la remplis ».
3. **Analyser une affirmation** — checklist de logicien (hors ligne, réponses sauvées par affirmation).
4. **Phrase → formule** — une phrase en français devient une formule, avec les lettres expliquées.
5. **Leçons** — cinq mini-leçons (une idée à la fois), puis « Essaie dans l’outil ».
6. **Cahier** — dix petits exercices, progression sauvée sur le téléphone.

## Lancer en local

```bash
npx --yes serve -l 4177 .
```

## Tests

```bash
npm test
npm run test:ui
```

## Live

https://passcool17.github.io/logic-lab-camille/
