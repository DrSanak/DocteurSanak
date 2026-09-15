/* PDF récapitulatif A4 (une à deux pages) pour le Dr Sanak. Polices standard
   du PDF (Helvetica) : les réponses libres sont reproduites mot pour mot, seuls
   les caractères hors Latin-1 (emoji, etc.) sont remplacés par « ? ». */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { STEPS, SITES, fieldById, optionLabel } from '../../../site_final-3-6/js/questionnaire-schema.js';
import { LOGO_PNG_BASE64 } from './logo.js';

const A4 = [595.28, 841.89];
const M = 46;               // marge
const W = A4[0] - 2 * M;    // largeur utile
const FOOT = 40;            // réserve bas de page
const BLUE = rgb(0.08, 0.24, 0.42);
const BLUE_LIGHT = rgb(0.92, 0.95, 0.98);
const RED = rgb(0.62, 0.13, 0.13);
const ORANGE = rgb(0.62, 0.36, 0);
const GREEN = rgb(0.06, 0.43, 0.34);
const TEXT = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.38);
const LINE = rgb(0.85, 0.85, 0.82);

/* Jeu WinAnsi (Latin-1 plus quelques signes typographiques). */
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export function safe(s) {
  if (s == null) return '';
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c === 9 || c === 10) out += ch;
    else if (c >= 32 && c <= 126) out += ch;
    else if (c >= 160 && c <= 255) out += ch;
    else if (WINANSI_EXTRA.indexOf(ch) !== -1) out += ch;
    else if (c < 32 || (c >= 127 && c < 160)) continue;
    else out += '?';
  }
  return out;
}

const BRANCH_LABEL = { A: 'A (moins de 45 ans)', B: 'B (45 ans et plus)' };

function siteName(code) { for (const s of SITES) if (s[0] === code) return s[1]; return code; }

function fmtDateFr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(+m[1], +m[2] - 1, +m[3]));
}

export function brusselsParts(date) {
  const p = {};
  new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date).forEach((x) => { p[x.type] = x.value; });
  return { date: p.day + '/' + p.month + '/' + p.year, time: p.hour + ':' + p.minute, iso: p.year + '-' + p.month + '-' + p.day, hm: p.hour + p.minute };
}

/* Valeur lisible d'une réponse, à partir du schéma (libellés français). */
function display(id, answers) {
  const f = fieldById(id);
  const v = answers[id];
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
  if (!f) return String(v);
  if (f.type === 'checks') return v.map((c) => optionLabel(f, c)).join(', ');
  if (f.type === 'rank') return v.map((c, i) => (i + 1) + '. ' + optionLabel(f, c)).join('   ');
  if (f.type === 'radio' || f.type === 'select') return optionLabel(f, v);
  if (f.type === 'number') return String(v) + (f.unit ? ' ' + f.unit : '');
  if (f.type === 'date') return fmtDateFr(v);
  return String(v);
}
function question(id) {
  const f = fieldById(id);
  if (!f) return id;
  return f.label || f.heading || f.sub || id;
}

/* ── Mise en page ─────────────────────────────────────────────────────── */
class Layout {
  constructor(doc, fonts, logo, footerText) {
    this.doc = doc; this.f = fonts; this.logo = logo; this.footerText = footerText;
    this.pages = [];
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - M;
    if (this.pages.length > 1) { this.y -= 4; }
  }
  ensure(h) { if (this.y - h < M + FOOT) this.newPage(); }
  wrap(text, size, bold, width) {
    const font = bold ? this.f.bold : this.f.reg;
    const lines = [];
    for (const para of safe(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(t, size) <= width) line = t;
        else {
          if (line) lines.push(line);
          // mot plus long que la ligne : coupé brutalement
          let chunk = w;
          while (font.widthOfTextAtSize(chunk, size) > width && chunk.length > 1) {
            let cut = chunk.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(chunk.slice(0, cut), size) > width) cut--;
            lines.push(chunk.slice(0, cut));
            chunk = chunk.slice(cut);
          }
          line = chunk;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  text(str, o) {
    o = o || {};
    const size = o.size || 10, lh = o.lh || size * 1.32;
    const x = o.x != null ? o.x : M, width = o.width || (M + W - x);
    const lines = this.wrap(str, size, o.bold, width);
    for (const line of lines) {
      this.ensure(lh);
      this.page.drawText(line, { x: x, y: this.y - size, size: size, font: o.bold ? this.f.bold : this.f.reg, color: o.color || TEXT });
      this.y -= lh;
    }
    if (o.after) this.y -= o.after;
    return lines.length * lh;
  }
  heading(str) {
    this.ensure(64);
    this.y -= 6;
    this.page.drawText(safe(str).toUpperCase(), { x: M, y: this.y - 9, size: 9, font: this.f.bold, color: BLUE });
    this.y -= 12;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + W, y: this.y }, thickness: 0.6, color: BLUE });
    this.y -= 6;
  }
  kv(label, value, o) {
    if (value == null) return;
    o = o || {};
    const size = 9.3, lh = 11.4;
    const labW = o.labW || 190;
    const labLines = this.wrap(label, size, false, labW - 8);
    const valLines = this.wrap(value, size, o.bold, W - labW);
    const n = Math.max(labLines.length, valLines.length);
    this.ensure(n * lh + 3);
    labLines.forEach((l, i) => this.page.drawText(l, { x: M, y: this.y - size - i * lh, size: size, font: this.f.reg, color: MUTED }));
    valLines.forEach((l, i) => this.page.drawText(l, { x: M + labW, y: this.y - size - i * lh, size: size, font: o.bold ? this.f.bold : this.f.reg, color: o.color || TEXT }));
    this.y -= n * lh + 2;
  }
  gap(h) { this.y -= h; }
  checkbox(x, y, size) {
    this.page.drawRectangle({ x: x, y: y - size + 2, width: size, height: size, borderColor: TEXT, borderWidth: 0.7 });
  }
  rule() {
    this.ensure(6);
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + W, y: this.y }, thickness: 0.4, color: LINE });
    this.y -= 6;
  }
  header(title, sub) {
    const lw = 110, lh = lw * (this.logo.height / this.logo.width);
    this.page.drawImage(this.logo, { x: M, y: this.y - lh, width: lw, height: lh });
    this.page.drawText(safe(title), { x: M + W - this.f.bold.widthOfTextAtSize(safe(title), 14), y: this.y - 14, size: 14, font: this.f.bold, color: BLUE });
    this.page.drawText(safe(sub), { x: M + W - this.f.reg.widthOfTextAtSize(safe(sub), 9), y: this.y - 28, size: 9, font: this.f.reg, color: MUTED });
    this.y -= lh + 6;
  }
  footers() {
    const n = this.pages.length;
    this.pages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: M + 14 }, end: { x: M + W, y: M + 14 }, thickness: 0.4, color: LINE });
      p.drawText(safe(this.footerText), { x: M, y: M, size: 7.5, font: this.f.reg, color: MUTED });
      const pg = 'Page ' + (i + 1) + ' / ' + n;
      p.drawText(pg, { x: M + W - this.f.reg.widthOfTextAtSize(pg, 7.5), y: M, size: 7.5, font: this.f.reg, color: MUTED });
    });
  }
}

/* ── Construction du document ─────────────────────────────────────────── */
export async function buildPdf(input) {
  const { answers: a, branch, lang, result, receivedAt } = input;
  const rec = brusselsParts(receivedAt);
  const doc = await PDFDocument.create();
  doc.setTitle('Questionnaire pré-opératoire ' + safe(a.prenom));
  doc.setProducer('docteursanak.com');
  doc.setCreator('docteursanak.com');
  const fonts = { reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'));
  const L = new Layout(doc, fonts, logo, 'Consentement donné le ' + rec.date + ' à ' + rec.time + '. Document généré automatiquement, aucune copie conservée.');

  L.header('Questionnaire pré-opératoire', 'Reçu le ' + rec.date + ' à ' + rec.time + ' (heure de Bruxelles)');

  /* 1. Identification */
  L.heading('1. Patient et rendez-vous');
  L.kv('Prénom', a.prenom, { bold: true });
  L.kv('Âge', a.age + ' ans');
  L.kv('Branche servie', BRANCH_LABEL[branch]);
  L.kv('Rendez-vous', fmtDateFr(a.rdv) + ', site ' + siteName(a.site));
  L.kv('Reçu le', rec.date + ' à ' + rec.time + ' (langue du questionnaire : ' + lang.toUpperCase() + ')');

  /* 2. Synthèse */
  L.heading('2. Synthèse');
  const fx = M + 112, fw = W - 112 - 12, fs = 8.5, flh = 11.5;
  const flagLines = [];
  if (!result.red.length && !result.orange.length) flagLines.push(['Aucun drapeau : profil favorable', GREEN, true]);
  if (result.red.length) {
    flagLines.push(['Drapeaux rouges, à traiter avant toute chirurgie', RED, true]);
    for (const r of result.red) for (const l of L.wrap('\u2022 ' + r, fs, false, fw)) flagLines.push([l, RED, false]);
  }
  if (result.orange.length) {
    flagLines.push(['Drapeaux orange, à préparer ou à surveiller', ORANGE, true]);
    for (const r of result.orange) for (const l of L.wrap('\u2022 ' + r, fs, false, fw)) flagLines.push([l, ORANGE, false]);
  }
  const boxH = Math.max(66, 20 + flagLines.length * flh);
  L.ensure(boxH + 6);
  const top = L.y;
  L.page.drawRectangle({ x: M, y: top - boxH, width: W, height: boxH, color: BLUE_LIGHT });
  const scoreTxt = String(result.score);
  L.page.drawText('SPEED', { x: M + 14, y: top - 16, size: 8, font: fonts.bold, color: BLUE });
  L.page.drawText(scoreTxt, { x: M + 14, y: top - 46, size: 28, font: fonts.bold, color: BLUE });
  L.page.drawText('/ 28', { x: M + 14 + fonts.bold.widthOfTextAtSize(scoreTxt, 28) + 4, y: top - 46, size: 10, font: fonts.reg, color: MUTED });
  L.page.drawText('niveau ' + result.level, { x: M + 14, y: top - 58, size: 8.5, font: fonts.reg, color: BLUE });
  let fy = top - 16;
  for (const [txt, color, bold] of flagLines) {
    L.page.drawText(safe(txt), { x: fx, y: fy, size: fs, font: bold ? fonts.bold : fonts.reg, color: color });
    fy -= flh;
  }
  L.y = top - boxH - 6;

  if (result.orientation.length) {
    L.text('Éléments à aborder en consultation', { size: 9.5, bold: true, color: BLUE, after: 2 });
    for (const o of result.orientation) L.kv(o[0], o[1], { labW: 230 });
  }

  /* 3. Détail SPEED */
  L.heading('3. Détail SPEED');
  const symptoms = ['Sécheresse, sensation de sable ou de grain', 'Douleur ou irritation', 'Brûlure ou larmoiement', 'Fatigue oculaire'];
  symptoms.forEach((s, i) => {
    const n = i + 1;
    L.kv(s, 'fréquence : ' + display('s' + n + '_freq', a) + ' (' + a['s' + n + '_freq'] + ')   |   gêne : ' + display('s' + n + '_sev', a) + ' (' + a['s' + n + '_sev'] + ')');
  });
  L.kv('Présents aujourd’hui', display('today', a));
  L.kv('Depuis', display('duration', a));
  L.kv('Douleurs marquées sans cause trouvée', display('pain', a), { color: a.pain === 'yes' ? RED : TEXT });

  /* 4. Lentilles */
  L.heading('4. Lentilles');
  if (a.lenses !== 'yes') L.kv('Port de lentilles', 'non');
  else {
    L.kv('Type', display('lens_type', a));
    L.kv('Depuis', display('lens_years', a));
    L.kv('Heures de port par jour', display('lens_hours', a));
    L.kv('Tolérance', display('lens_tol', a));
    L.kv('Gêne en fin de journée', display('lens_evening', a));
    if (result.lens) {
      L.kv('Consigne d’arrêt calculée', result.lens.label + ' avant le rendez-vous', { bold: true });
      if (result.lens.tooClose) L.kv('Alerte délai', 'Rendez-vous ' + (result.lens.until <= 0 ? 'aujourd’hui ou passé' : 'dans ' + result.lens.until + ' jour' + (result.lens.until > 1 ? 's' : '')) + ' : le délai ne peut pas être respecté, mesures à refaire si besoin.', { color: ORANGE, bold: true });
    }
  }

  /* 5. Santé générale */
  L.heading('5. Santé générale');
  L.kv('Larmes artificielles ou collyres', display('drops', a) + (a.drops_detail ? ' : ' + a.drops_detail : ''));
  L.kv('Allergies oculaires', display('allergy', a));
  L.kv('Chirurgie ou traumatisme de l’œil', display('eye_surgery', a) + (a.eye_surgery_detail ? ' : ' + a.eye_surgery_detail : ''));
  L.kv('Maladie de la cornée dans la famille', display('family_cornea', a), { color: a.family_cornea === 'yes' ? RED : TEXT });
  L.kv('Décollement, déchirure ou laser rétine', display('retina', a));
  L.kv('Décollement de rétine dans la famille', display('family_retina', a));
  L.kv('Mouches volantes ou éclairs récents', display('floaters', a), { color: a.floaters === 'yes' ? RED : TEXT });
  L.kv('Sans lunettes, voit mieux', display('better_without', a));
  L.kv('Correction recopiée', a.prescription || 'non renseignée');
  L.kv('Correction modifiée en 12 mois', display('rx_changed', a), { color: a.rx_changed === 'yes' ? RED : TEXT });
  L.kv('Traitements', display('meds', a));
  L.kv('Affections', display('conditions', a));
  L.kv('Grossesse, allaitement, projet', display('pregnancy', a), { color: a.pregnancy === 'yes' ? RED : TEXT });
  L.kv('Autres antécédents', a.history || 'aucun signalé');

  /* 6. Mode de vie */
  L.heading('6. Mode de vie');
  if (branch === 'A') {
    L.kv('Temps d’écran', display('screen', a));
    L.kv('Air sec ou climatisé', display('dry_air', a));
    L.kv('Larmoiement au vent, froid, écran', display('wind', a));
    L.kv('Sport de contact ou aquatique', display('sports', a));
    L.kv('Poussière ou projections', display('dust', a));
    L.kv('Arrêt de travail envisageable', display('work_off', a));
  } else {
    L.kv('Activités où la vue compte', display('activities', a));
    L.kv('Lecture ou travail de près', display('near_time', a));
    L.kv('Travail en faible lumière', display('low_light', a));
    L.kv('Environnement de travail', display('work_env', a));
  }

  /* 7. Vision au quotidien et tempérament */
  L.heading('7. Vision au quotidien et tempérament');
  if (branch === 'A') {
    L.kv('Conduite de nuit', display('night_drive', a));
  } else {
    L.kv('Priorités (classement)', display('priorities', a));
    L.kv('Conduite de nuit', display('night_drive_b', a));
    L.kv('Phares la nuit', display('headlights', a));
    L.kv('Progressives ou multifocales', display('progressives', a));
    L.kv('Tempérament', display('temperament', a));
    L.kv('Vision de nuit ou lecture fine', display('night_vs_read', a));
    L.kv('Entourage opéré', display('entourage', a) + (a.entourage_detail ? ' : « ' + a.entourage_detail + ' »' : ''));
  }

  /* 8. Vos mots */
  L.heading('8. Vos mots');
  L.text(question('why'), { size: 9, color: MUTED, after: 1 });
  L.text('« ' + a.why + ' »', { size: 10, after: 6 });
  L.text(question('concerns'), { size: 9, color: MUTED, after: 1 });
  L.text(a.concerns ? '« ' + a.concerns + ' »' : 'Pas de réponse.', { size: 10, after: 4 });

  /* 9. Entretien de consultation */
  const items = [];
  for (const r of result.red) items.push('Rouge : ' + r);
  for (const r of result.orange) items.push('Orange : ' + r);
  for (const o of result.orientation) items.push(o[0] + ' (' + o[1] + ')');
  if (!items.length) items.push('Profil favorable, aucun drapeau');
  const rowH = 34;
  const needed = 40 + items.length * rowH + 56;
  if (L.y - needed < M + FOOT) L.newPage();
  L.heading('9. Entretien de consultation (à compléter à la main)');
  for (const it of items) {
    L.ensure(rowH);
    L.text(it, { size: 9, bold: true, after: 0 });
    const y = L.y - 1;
    const cols = [M, M + 150, M + 340];
    L.checkbox(cols[0], y, 9); L.page.drawText('abordé en consultation', { x: cols[0] + 13, y: y - 7, size: 8.5, font: fonts.reg, color: TEXT });
    L.checkbox(cols[1], y, 9); L.page.drawText('information donnée sur : ______________', { x: cols[1] + 13, y: y - 7, size: 8.5, font: fonts.reg, color: TEXT });
    L.checkbox(cols[2], y, 9); L.page.drawText('décision : _______________ , accord du patient', { x: cols[2] + 13, y: y - 7, size: 8.5, font: fonts.reg, color: TEXT });
    L.y = y - 13;
    L.rule();
  }
  L.gap(4);
  L.ensure(44);
  L.text('Technique / implant retenu : ______________________________________________', { size: 10, after: 10 });
  L.text('Date et signature : ______________________________', { size: 10 });

  L.footers();
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/* Nom de fichier : questionnaire-preop_Prenom_AAAA-MM-JJ_HHMM.pdf */
export function fileName(prenom, receivedAt) {
  const rec = brusselsParts(receivedAt);
  const p = safe(prenom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]+/g, '-').replace(/^-|-$/g, '') || 'Patient';
  return 'questionnaire-preop_' + p + '_' + rec.iso + '_' + rec.hm + '.pdf';
}
