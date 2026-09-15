# docteursanak.com

Site statique déployé sur Netlify (base directory `site_final-3-6`, publish `.`). Une seule fonction serverless : le questionnaire pré-opératoire.

## Questionnaire pré-opératoire

Pages : `/bilan/questionnaire/`, `/nl/vooronderzoek/vragenlijst/`, `/en/preoperative-exam/questionnaire/`.

| Fichier | Rôle |
|---|---|
| `js/questionnaire-schema.js` | Étapes, questions, codes des options, libellés FR. Partagé entre le navigateur et la fonction. |
| `js/questionnaire-nl.js`, `js/questionnaire-en.js` | Libellés NL et EN (mêmes codes). |
| `js/questionnaire.js` | Moteur du formulaire : une étape par écran, aiguillage par l'âge, consigne lentilles, écran de fin, fichier `.ics`. |
| `css/questionnaire.css` | Styles, chargés uniquement sur ces pages. |
| `netlify/functions/questionnaire.js` | Réception : antispam, limite d'envois, validation, score SPEED, drapeaux, PDF, envoi par mail. |
| `netlify/functions/lib/` | `validate.js`, `analyse.js`, `pdf.js`, `logo.js`. |

Rien n'est stocké : la fonction génère le PDF en mémoire, l'envoie, puis répond `{ok:true}` ou `{ok:false}`. Aucune réponse n'est journalisée.

### Variables d'environnement (Netlify > Site configuration > Environment variables)

| Variable | Valeur |
|---|---|
| `BREVO_API_KEY` | Clé API Brevo (SMTP & API > Clés API). Jamais dans le code. |
| `QUESTIONNAIRE_TO` | Adresse qui reçoit les PDF, `contact@docteursanak.com`. |
| `QUESTIONNAIRE_FROM` | Adresse expéditrice, vérifiée dans Brevo (Expéditeurs et IP), `contact@docteursanak.com`. |
| `RATE_LIMIT_SALT` | Chaîne aléatoire d'au moins 32 caractères (`openssl rand -hex 32`). Sert à hacher les adresses IP pour la limite de 5 envois par heure. |

### Réglages Netlify

- Functions > Region : choisir une région européenne (`eu-central-1` Francfort ou `eu-west-1` Irlande). Le réglage n'est pas disponible sur tous les plans ; à vérifier.
- Le compteur d'envois utilise Netlify Blobs (store lié au déploiement, région `eu-central-1`). Il ne contient que des empreintes SHA-256 salées, effacées après deux heures.
- `netlify.toml` renvoie 404 sur `/netlify/*`, `/node_modules/*`, `/package.json`, `/package-lock.json` et `/README.md`, car le dossier publié est la racine.

### Brevo

1. Créer un compte Brevo, vérifier l'expéditeur `contact@docteursanak.com` (ou authentifier le domaine par DNS).
2. Créer une clé API et la coller dans `BREVO_API_KEY`.
3. Le mail envoyé a pour seul contenu « Nouveau questionnaire préopératoire reçu » ; tout le contenu médical est dans le PDF joint.

### Test local

```
cd site_final-3-6 && npm install
node ../scripts/questionnaire-dev-server.mjs
```

Le serveur sert le site sur `http://localhost:8765` et exécute la fonction. Sans `BREVO_API_KEY`, le mail n'est pas envoyé : le PDF est écrit dans `scripts/out/`. Avec les quatre variables définies dans l'environnement, l'envoi réel est effectué. `netlify dev` fonctionne aussi, avec les variables dans un fichier `.env`.
