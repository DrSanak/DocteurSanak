/* Score SPEED, drapeaux et grille d'orientation. Calculés uniquement ici,
   côté fonction ; rien de tout cela n'est renvoyé au navigateur. */
import { LENS_STOP, daysUntil } from '../../../site_final-3-6/js/questionnaire-schema.js';

export const SPEED_MAX = 28;

export function speedScore(a) {
  let total = 0;
  for (let i = 1; i <= 4; i++) total += Number(a['s' + i + '_freq'] || 0) + Number(a['s' + i + '_sev'] || 0);
  return total;
}

export function speedLevel(score) {
  if (score >= 12) return 'sévère';
  if (score >= 6) return 'léger à modéré';
  return 'normal';
}

function has(arr, code) { return Array.isArray(arr) && arr.indexOf(code) !== -1; }

/* Consigne d'arrêt des lentilles et respect du délai avant le rendez-vous. */
export function lensPlan(a, now) {
  if (a.lenses !== 'yes' || !a.lens_type) return null;
  const days = LENS_STOP[a.lens_type];
  const until = daysUntil(a.rdv, now);
  return { days: days, label: days === 2 ? '48 heures' : 'une semaine', until: until, tooClose: until != null && until < days };
}

export function analyse(a, branch, now) {
  const score = speedScore(a);
  const red = [];
  const orange = [];
  const orientation = [];

  if (score >= 12) red.push('Score SPEED de ' + score + ' sur 28 (12 ou plus)');
  if (a.pain === 'yes') red.push('Douleurs oculaires marquées sans cause trouvée');
  if (has(a.conditions, 'autoimmune')) red.push('Maladie auto-immune déclarée (Sjögren, polyarthrite, lupus)');
  if (has(a.meds, 'isotretinoin')) red.push('Isotrétinoïne (Roaccutane) en cours');
  if (has(a.conditions, 'rosacea')) red.push('Rosacée déclarée');
  if (a.pregnancy === 'yes') red.push('Grossesse, allaitement ou projet de grossesse dans l’année');
  if (a.family_cornea === 'yes') red.push('Maladie de la cornée dans la famille proche');
  if (a.rx_changed === 'yes') red.push('Correction modifiée au cours des 12 derniers mois');

  if (score >= 6 && score <= 11) orange.push('Score SPEED de ' + score + ' sur 28 (6 à 11, seuil ASCRS)');
  if (score > 0 && a.duration === 'more3') orange.push('Symptômes de sécheresse présents depuis plus de 3 mois');
  if (a.retina === 'yes' || a.family_retina === 'yes') {
    const who = a.retina === 'yes' ? (a.family_retina === 'yes' ? 'personnel et familial' : 'personnel') : 'familial';
    orange.push('Antécédent ' + who + ' de décollement ou de déchirure de rétine');
  }
  if (a.lens_tol === 'less' || a.lens_tol === 'bad') orange.push('Lentilles ' + (a.lens_tol === 'bad' ? 'mal tolérées' : 'de moins en moins tolérées'));
  const medNames = { antihist: 'antihistaminiques réguliers', antidep: 'antidépresseurs', hormones: 'traitement hormonal ou contraception' };
  const medsFlag = Object.keys(medNames).filter((m) => has(a.meds, m));
  if (medsFlag.length) orange.push('Traitement en cours : ' + medsFlag.map((m) => medNames[m]).join(', '));
  if (a.screen === 'gt8') orange.push('Plus de 8 heures d’écran par jour');
  const lens = lensPlan(a, now);
  if (lens && lens.tooClose) {
    const j = lens.until <= 0 ? 'rendez-vous aujourd’hui ou passé' : 'rendez-vous dans ' + lens.until + ' jour' + (lens.until > 1 ? 's' : '');
    orange.push('Délai d’arrêt des lentilles non respectable avant le rendez-vous (' + lens.label + ' requis, ' + j + ')');
  }

  /* Grille d'orientation : éléments à aborder en consultation. */
  const first = Array.isArray(a.priorities) ? a.priorities[0] : null;
  if (branch === 'B') {
    if (a.night_drive_b === 'often' || a.headlights === 'very') orientation.push(['Conduite de nuit importante ou phares très éblouissants', 'Éviter la trifocale, discuter EDOF ou monofocale']);
    if (first === 'far' && a.near_time === 'lt1') orientation.push(['Priorité loin en premier, lecture peu fréquente', 'Monofocale ou EDOF']);
    if (first === 'near' && (a.night_drive_b === 'never' || a.night_drive_b === 'rarely')) orientation.push(['Priorité lecture en premier, conduite de nuit rare', 'Trifocale envisageable']);
    if (a.night_vs_read === 'night') orientation.push(['Vision de nuit placée avant lecture fine', 'Monofocale ou EDOF']);
    if (a.temperament === 'detail') orientation.push(['Tempérament : remarque le moindre détail', 'Prudence avec multifocale, entretien approfondi']);
    if (a.progressives === 'never_used_to') orientation.push(['Progressives jamais supportées', 'Signal défavorable pour multifocale']);
  }
  if (branch === 'A') {
    if (Array.isArray(a.sports) && a.sports.some((s) => s !== 'none')) orientation.push(['Sport de contact', 'SMILE ou PRK plutôt que LASIK']);
    if (a.work_off === '1-2') orientation.push(['Arrêt de travail 1 à 2 jours seulement', 'LASIK ou SMILE plutôt que PRK']);
  }
  if (a.pregnancy === 'yes') orientation.push(['Projet de grossesse dans l’année', 'Reporter']);
  if (branch === 'B') {
    if (a.better_without === 'near') orientation.push(['Voit mieux de près sans lunettes (myope)', 'Vérifier longueur axiale au bilan ; si supérieure à 26 mm et moins de 55 ans, ICL ou laser plutôt que CLE (risque rétinien)']);
    if (a.better_without === 'far') orientation.push(['Voit mieux de loin sans lunettes (hypermétrope) et presbyte', 'CLE, candidat favorable']);
    if (a.retina === 'yes' || a.family_retina === 'yes') orientation.push(['Antécédent rétinien personnel ou familial', 'Prudence CLE, avis rétine si doute']);
  }

  return { score: score, level: speedLevel(score), red: red, orange: orange, orientation: orientation, lens: lens };
}
