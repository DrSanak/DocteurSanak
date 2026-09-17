/* Questionnaire pré-opératoire : structure des étapes et libellés français.
   Fichier partagé entre le navigateur (rendu du formulaire) et la fonction
   Netlify (validation, PDF). Les codes des options sont indépendants de la
   langue ; NL et EN ne fournissent que des libellés (questionnaire-nl.js,
   questionnaire-en.js). */

export const ENDPOINT = '/.netlify/functions/questionnaire';
export const STEP_COUNT = 5;
export const BRANCH_AGE = 45;

const YN = [['yes', 'oui'], ['no', 'non']];
const YNDK = [['yes', 'oui'], ['no', 'non'], ['dk', 'je ne sais pas']];
const FREQ = [['0', 'jamais'], ['1', 'parfois'], ['2', 'souvent'], ['3', 'en permanence']];
const SEV = [['0', 'aucune gêne'], ['1', 'gêne tolérable'], ['2', 'gêne inconfortable'], ['3', 'gêne pénible'], ['4', 'gêne intolérable']];

export const SITES = [
  ['delta', 'Delta'],
  ['parc-leopold', 'Parc Léopold'],
  ['cavell', 'Cavell'],
  ['lambermont', 'Lambermont'],
  ['nivelles', 'Nivelles'],
];

/* Consigne d'arrêt des lentilles, en jours, alignée sur la page /bilan/. */
export const LENS_STOP = { daily: 2, monthly: 2, toric: 7, rigid: 7, ortho: 7 };

function speed(n, heading) {
  return [
    { id: 's' + n + '_freq', type: 'radio', heading: heading, sub: 'À quelle fréquence ?', options: FREQ, required: true, cols: 2, keep: true },
    { id: 's' + n + '_sev', type: 'radio', sub: 'Quelle gêne cela représente-t-il ?', options: SEV, required: true },
  ];
}

export const STEPS = [
  {
    id: 'identite',
    title: 'Votre rendez-vous',
    fields: [
      { id: 'prenom', type: 'text', label: 'Votre prénom', required: true, maxlen: 60, autocomplete: 'given-name' },
      { id: 'age', type: 'number', label: 'Votre âge', required: true, min: 18, max: 99, unit: 'ans' },
      { id: 'rdv', type: 'date', label: 'Date du rendez-vous', required: true },
      { id: 'site', type: 'select', label: 'Site de consultation', required: true, options: SITES, placeholder: 'Choisir un site' },
    ],
  },
  {
    id: 'yeux',
    title: 'Vos yeux au quotidien',
    intro: 'Pour chacune des quatre situations, indiquez la fréquence, puis la gêne que cela représente.',
    fields: [
      ...speed(1, 'Sécheresse, sensation de sable ou de grain dans l’œil'),
      ...speed(2, 'Douleur ou irritation'),
      ...speed(3, 'Brûlure ou larmoiement'),
      ...speed(4, 'Fatigue oculaire'),
      { id: 'today', type: 'radio', label: 'Ces symptômes sont-ils présents aujourd’hui ?', options: YN, required: true, cols: 2 },
      { id: 'duration', type: 'radio', label: 'Depuis combien de temps ?', options: [['less3', 'moins de 3 mois'], ['more3', 'plus de 3 mois']], required: true, cols: 2 },
      { id: 'pain', type: 'radio', label: 'Avez-vous des douleurs oculaires marquées pour lesquelles aucune cause n’a été trouvée ?', options: YN, required: true, cols: 2 },
    ],
  },
  {
    id: 'sante',
    title: 'Vos yeux et votre santé',
    fields: [
      { id: 'lenses', type: 'radio', label: 'Portez-vous des lentilles ?', options: YN, required: true, cols: 2 },
      { id: 'lens_type', type: 'select', label: 'Quel type de lentilles ?', required: true, cond: { field: 'lenses', eq: 'yes' }, placeholder: 'Choisir', options: [
        ['daily', 'souples journalières'], ['monthly', 'souples mensuelles'], ['toric', 'souples toriques'], ['rigid', 'rigides'], ['ortho', 'orthokératologie (nuit)'],
      ] },
      { id: 'lens_years', type: 'number', label: 'Depuis combien d’années ?', required: true, min: 0, max: 80, unit: 'ans', cond: { field: 'lenses', eq: 'yes' } },
      { id: 'lens_notice', type: 'lensnotice', cond: { field: 'lenses', eq: 'yes' } },
      { id: 'drops', type: 'radio', label: 'Utilisez-vous des larmes artificielles ou des collyres ?', options: YN, required: true, cols: 2 },
      { id: 'drops_detail', type: 'text', label: 'Lesquels et à quelle fréquence ?', required: true, maxlen: 200, cond: { field: 'drops', eq: 'yes' } },
      { id: 'allergy', type: 'radio', label: 'Allergies oculaires connues ?', options: YN, required: true, cols: 2 },
      { id: 'eye_surgery', type: 'radio', label: 'Avez-vous déjà eu une chirurgie ou un traumatisme de l’œil ?', options: YN, required: true, cols: 2 },
      { id: 'eye_surgery_detail', type: 'text', label: 'Précisez', required: true, maxlen: 200, cond: { field: 'eye_surgery', eq: 'yes' } },
      { id: 'family_cornea', type: 'radio', label: 'Dans votre famille proche (parents, frères, sœurs, enfants), quelqu’un a-t-il une maladie de la cornée ?', help: 'Par exemple un kératocône, une cornée déformée, des lentilles rigides prescrites pour cette raison, une greffe de cornée, ou une chirurgie au laser refusée pour un problème de cornée.', options: YNDK, required: true, cols: 3 },
      { id: 'retina', type: 'radio', label: 'Avez-vous déjà eu un décollement de rétine, une déchirure de la rétine ou un traitement au laser de la rétine ?', options: YN, required: true, cols: 2 },
      { id: 'family_retina', type: 'radio', label: 'Quelqu’un de votre famille proche a-t-il eu un décollement de rétine ?', options: YNDK, required: true, cols: 3 },
      { id: 'better_without', type: 'radio', label: 'Sans lunettes, voyez-vous mieux de loin ou de près ?', options: [['far', 'de loin'], ['near', 'de près'], ['neither', 'ni l’un ni l’autre'], ['dk', 'je ne sais pas']], required: true, cols: 2 },
      { id: 'rx_changed', type: 'radio', label: 'Votre correction a-t-elle changé au cours des 12 derniers mois ?', options: YNDK, required: true, cols: 3 },
      { id: 'meds', type: 'checks', label: 'Prenez-vous un des traitements suivants ?', required: true, none: 'none', options: [
        ['isotretinoin', 'isotrétinoïne (Roaccutane)'], ['antihist', 'antihistaminiques réguliers'], ['antidep', 'antidépresseurs'], ['hormones', 'traitement hormonal ou contraception'], ['immuno', 'immunosuppresseurs ou cortisone'], ['none', 'aucun'],
      ] },
      { id: 'conditions', type: 'checks', label: 'Souffrez-vous d’une de ces affections ?', required: true, none: 'none', options: [
        ['autoimmune', 'maladie auto-immune (Sjögren, polyarthrite, lupus)'], ['thyroid', 'problème de thyroïde'], ['diabetes', 'diabète'], ['rosacea', 'rosacée ou acné rosacée'], ['none', 'aucune'],
      ] },
      { id: 'pregnancy', type: 'radio', label: 'Grossesse, allaitement ou projet de grossesse dans l’année ?', options: [['yes', 'oui'], ['no', 'non'], ['na', 'non concerné']], required: true, cols: 3 },
      { id: 'history', type: 'textarea', label: 'Autres antécédents importants', optional: true, maxlen: 1000 },
    ],
  },
  {
    id: 'confort',
    branch: 'A',
    title: 'Votre confort au quotidien',
    fields: [
      { id: 'lens_hours', type: 'number', label: 'Combien d’heures portez-vous vos lentilles par jour ?', required: true, min: 0, max: 24, unit: 'heures', cond: { field: 'lenses', eq: 'yes' } },
      { id: 'lens_tol', type: 'radio', label: 'Les tolérez-vous ?', options: [['good', 'bien'], ['less', 'de moins en moins'], ['bad', 'mal']], required: true, cols: 3, cond: { field: 'lenses', eq: 'yes' } },
      { id: 'lens_evening', type: 'radio', label: 'Vos yeux sont-ils gênés en fin de journée avec les lentilles ?', options: [['never', 'jamais'], ['sometimes', 'parfois'], ['often', 'souvent']], required: true, cols: 3, cond: { field: 'lenses', eq: 'yes' } },
      { id: 'screen', type: 'radio', label: 'Temps d’écran par jour', options: [['lt2', 'moins de 2 h'], ['2-5', '2 à 5 h'], ['5-8', '5 à 8 h'], ['gt8', 'plus de 8 h']], required: true, cols: 2 },
      { id: 'dry_air', type: 'radio', label: 'Travaillez-vous dans un air sec ou climatisé ?', options: [['yes', 'oui'], ['no', 'non'], ['varies', 'cela varie']], required: true, cols: 3 },
      { id: 'wind', type: 'radio', label: 'Vos yeux larmoient-ils ou piquent-ils au vent, au froid ou devant un écran ?', options: [['never', 'jamais'], ['sometimes', 'parfois'], ['often', 'souvent']], required: true, cols: 3 },
      { id: 'sports', type: 'checks', label: 'Pratiquez-vous un sport de contact ?', required: true, none: 'none', options: [['combat', 'sports de combat'], ['rugby_football', 'rugby ou football'], ['none', 'aucun']] },
      { id: 'dust', type: 'radio', label: 'Votre métier vous expose-t-il à la poussière ou aux projections ?', options: YN, required: true, cols: 2 },
      { id: 'work_off', type: 'radio', label: 'Combien de jours d’arrêt de travail seraient envisageables après l’intervention ?', options: [['1-2', '1 à 2 jours'], ['week', 'une semaine'], ['more', 'plus']], required: true, cols: 3 },
      { id: 'night_drive', type: 'radio', label: 'Conduisez-vous la nuit ?', options: [['never', 'jamais'], ['rarely', 'rarement'], ['regularly', 'régulièrement'], ['often', 'souvent']], required: true, cols: 2 },
    ],
  },
  {
    id: 'vision',
    branch: 'B',
    title: 'Votre vision au quotidien',
    intro: 'Il existe plusieurs façons de corriger la vue. Ces questions servent à choisir celle qui correspond à votre façon de vivre. Le choix final se fait en consultation, après examen.',
    fields: [
      { id: 'sunday', type: 'radio', label: 'Un dimanche libre, vous le passez plutôt', options: [['far', 'dehors, à marcher, à faire du sport ou à conduire'], ['mid', 'à cuisiner, bricoler ou devant l\u2019ordinateur'], ['near', 'à lire, sur le téléphone ou à des travaux minutieux']], required: true },
      { id: 'evening', type: 'radio', label: 'Le soir, le plus souvent', options: [['far', 'télévision ou sortie'], ['mid', 'ordinateur, tablette ou jeux'], ['near', 'livre, téléphone ou couture']], required: true },
      { id: 'occupation', type: 'radio', label: 'Dans vos occupations principales, vous êtes surtout', options: [['far', 'à l\u2019extérieur ou en déplacement'], ['mid', 'à un bureau devant un écran'], ['near', 'sur des tâches de précision ou des petits caractères']], required: true },
      { id: 'activities', type: 'checks', label: 'Vos activités où la vue compte le plus', required: true, cols: 2, options: [
        ['reading', 'lecture'], ['screen', 'écran'], ['golf', 'golf'], ['tennis', 'tennis'], ['bike', 'vélo'], ['shooting', 'tir ou chasse'], ['diy', 'bricolage'], ['sewing', 'couture'], ['music', 'musique sur partition'], ['gaming', 'jeux vidéo'], ['cinema', 'cinéma'], ['other', 'autre'],
      ] },
      { id: 'near_time', type: 'radio', label: 'Temps de lecture ou de travail de près par jour', options: [['lt1', 'moins de 1 h'], ['1-3', '1 à 3 h'], ['gt3', 'plus de 3 h']], required: true, cols: 3 },
      { id: 'night_drive_b', type: 'radio', label: 'Conduisez-vous la nuit ?', options: [['never', 'jamais'], ['rarely', 'rarement'], ['regularly', 'régulièrement'], ['often', 'souvent, c’est une part importante de mon activité']], required: true },
      { id: 'low_light', type: 'radio', label: 'Votre travail vous amène-t-il à voir en faible lumière ?', help: 'Chauffeur, pilote, pompier, travail de nuit.', options: YN, required: true, cols: 2 },
      { id: 'headlights', type: 'radio', label: 'Comment percevez-vous les phares la nuit aujourd’hui ?', options: [['ok', 'sans problème'], ['some', 'un peu éblouissant'], ['very', 'très éblouissant']], required: true, cols: 3 },
      { id: 'work_env', type: 'radio', label: 'Vous travaillez surtout', options: [['bright', 'dans un bureau lumineux'], ['dim', 'en éclairage faible'], ['outdoor', 'en extérieur'], ['varies', 'cela varie']], required: true, cols: 2 },
      { id: 'progressives', type: 'radio', label: 'Avez-vous déjà porté des lunettes progressives ou des lentilles multifocales ?', options: [['ok', 'oui, à l’aise'], ['never_used_to', 'oui, jamais habitué'], ['no', 'non']], required: true, cols: 3 },
      { id: 'temperament', type: 'radio', label: 'Vous vous reconnaissez plutôt dans', options: [['adapt', 'je m’adapte vite à un changement'], ['time', 'il me faut un peu de temps'], ['detail', 'je remarque tout de suite le moindre détail']], required: true },
      { id: 'night_vs_read', type: 'radio', label: 'Entre une vision de nuit très nette et une lecture très fine, laquelle placeriez-vous en premier ?', options: [['night', 'vision de nuit'], ['read', 'lecture fine'], ['dk', 'je ne sais pas']], required: true, cols: 3 },
      { id: 'entourage', type: 'radio', label: 'Quelqu’un de votre entourage a-t-il été opéré ? Son expérience vous a-t-elle plutôt rassuré ou inquiété ?', options: [['no', 'non, personne'], ['reassured', 'oui, plutôt rassuré'], ['worried', 'oui, plutôt inquiété'], ['mixed', 'oui, les deux']], required: true, cols: 2 },
      { id: 'entourage_detail', type: 'text', label: 'Quelques mots si vous le souhaitez', optional: true, maxlen: 200, cond: { field: 'entourage', in: ['reassured', 'worried', 'mixed'] } },
    ],
  },
  {
    id: 'mots',
    title: 'Vos mots',
    fields: [
      { id: 'why', type: 'textarea', label: 'Qu’est-ce qui vous amène à envisager cette chirurgie maintenant ?', required: true, maxlen: 2000 },
      { id: 'concerns', type: 'textarea', label: 'Y a-t-il quelque chose qui vous préoccupe ?', optional: true, maxlen: 2000 },
      { id: 'closing', type: 'closing', text: 'Ces réponses servent à préparer la discussion. Le choix de la technique se fait en consultation, après examen, en fonction de ce que vos yeux permettent.' },
      { id: 'consent', type: 'consent', required: true, label: 'J’accepte que ces informations soient transmises au Dr Sanak pour préparer ma consultation. Elles ne sont pas conservées sur ce site et sont traitées conformément à la <a href="/confidentialite/">politique de confidentialité</a>.' },
    ],
  },
];

/* Textes de l'interface (FR). */
export const UI = {
  stepOf: 'Étape {n} sur {t}',
  next: 'Continuer',
  back: 'Retour',
  send: 'Envoyer',
  sending: 'Envoi en cours',
  optional: 'facultatif',
  required: 'Cette réponse est nécessaire pour continuer.',
  invalidNumber: 'Indiquez un nombre entre {min} et {max}.',
  invalidDate: 'Indiquez une date valide.',
  consentRequired: 'Votre accord est nécessaire pour envoyer le questionnaire.',
  fixErrors: 'Certaines réponses manquent. Elles sont signalées ci-dessus.',
  sendError: 'L’envoi n’a pas abouti. Vérifiez votre connexion et réessayez dans un instant.',
  tooMany: 'Trop d’envois depuis cette connexion. Réessayez dans une heure.',
  rankUp: 'Monter',
  rankDown: 'Descendre',
  lensStop: 'Arrêt des lentilles avant le bilan : {days}.',
  lensStopDays: { 2: '48 heures', 7: 'une semaine' },
  lensStopFrom: 'Pour un rendez-vous le {date}, dernier jour de port : {last}.',
  lensWarn: 'Le rendez-vous est trop proche pour respecter ce délai. Retirez vos lentilles dès maintenant ; certaines mesures devront peut-être être refaites.',
  doneTitle: 'Questionnaire envoyé',
  doneThanks: 'Merci. Vos réponses ont été transmises au Dr Sanak pour préparer votre consultation.',
  doneRdv: 'Rendez-vous le {date}, site {site}.',
  doneLens: 'Rappel pour vos lentilles : arrêt {days} avant le rendez-vous.',
  doneInfo: 'Le bilan dure environ une heure. Les pupilles sont dilatées pendant l’examen, ce qui trouble la vision de près pendant deux à trois heures : il ne faut pas conduire au retour.',
  addCal: 'Ajouter le rendez-vous à mon agenda',
  calTitle: 'Bilan préopératoire, Dr Sanak',
  calDesc: 'Bilan préopératoire. Environ une heure. Dilatation des pupilles, pas de conduite au retour.',
  siteLabel: 'Site',
};

/* Nombre de jours entre aujourd'hui (minuit local) et une date AAAA-MM-JJ. */
export function daysUntil(dateStr, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return null;
  const target = new Date(+m[1], +m[2] - 1, +m[3]);
  const today = now ? new Date(now) : new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export function branchFor(age) {
  return Number(age) >= BRANCH_AGE ? 'B' : 'A';
}

/* Évalue une condition d'affichage sur les réponses. */
export function condOk(cond, answers) {
  if (!cond) return true;
  const v = answers[cond.field];
  if ('eq' in cond) return v === cond.eq;
  if ('in' in cond) return cond.in.indexOf(v) !== -1;
  return true;
}

/* Étapes servies pour une branche donnée, dans l'ordre. */
export function stepsFor(branch) {
  return STEPS.filter((s) => !s.branch || s.branch === branch);
}

export function fieldById(id) {
  for (const s of STEPS) for (const f of s.fields) if (f.id === id) return f;
  return null;
}

export function optionLabel(field, code) {
  if (!field || !field.options) return code;
  for (const o of field.options) if (o[0] === code) return o[1];
  return code;
}
