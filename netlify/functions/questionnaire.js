/* Réception du questionnaire pré-opératoire.
   Valide les réponses, calcule le score SPEED et les drapeaux, génère le PDF
   et l'envoie par Brevo au cabinet. Rien n'est stocké : ni réponses, ni PDF,
   ni adresse IP en clair (seule une empreinte salée sert à limiter les envois).
   La réponse au navigateur est toujours la même : reçu ou erreur.

   Variables d'environnement (Netlify > Site configuration > Environment variables) :
     BREVO_API_KEY      clé API Brevo (transactionnel)
     QUESTIONNAIRE_TO   adresse de réception du PDF
     QUESTIONNAIRE_FROM adresse expéditrice vérifiée dans Brevo
     RATE_LIMIT_SALT    chaîne aléatoire longue, sert à hacher les adresses IP */
import { createHash, randomBytes } from 'node:crypto';
import { getDeployStore } from '@netlify/blobs';
import { validate } from './lib/validate.js';
import { analyse } from './lib/analyse.js';
import { buildPdf, fileName } from './lib/pdf.js';

const MIN_FILL_MS = 10000;      // durée minimale de remplissage
const MAX_PER_HOUR = 5;         // envois par IP et par heure
const MAX_BODY = 64 * 1024;     // taille maximale du corps JSON
const SUBJECT = 'Nouveau questionnaire préopératoire reçu';
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const ALLOWED_ORIGIN = /^https:\/\/(www\.)?docteursanak\.com$|\.netlify\.app$|^http:\/\/localhost(:\d+)?$/;

const json = (status, ok) => new Response(JSON.stringify({ ok: ok }), {
  status: status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

/* ── Limite d'envois : empreinte salée de l'IP, fenêtre d'une heure ───── */
const salt = process.env.RATE_LIMIT_SALT || randomBytes(32).toString('hex');
const memory = new Map();

function hourBucket(now) { return String(Math.floor(now.getTime() / 3600000)); }
function fingerprint(ip, bucket) { return createHash('sha256').update(salt + ':' + bucket + ':' + ip).digest('hex').slice(0, 32); }

function store() {
  try { return getDeployStore({ name: 'questionnaire-ratelimit', region: 'eu-central-1', consistency: 'strong' }); }
  catch (e) { return null; }
}

/* Renvoie true si l'envoi est autorisé et enregistre le passage. */
async function allow(ip, now) {
  const bucket = hourBucket(now);
  const key = bucket + '/' + fingerprint(ip || 'inconnue', bucket);
  const mem = memory.get(key) || 0;
  if (mem >= MAX_PER_HOUR) return false;
  memory.set(key, mem + 1);
  for (const k of memory.keys()) if (!k.startsWith(bucket + '/')) memory.delete(k);

  const s = store();
  if (!s) return true;
  try {
    const cur = Number((await s.get(key)) || 0);
    if (cur >= MAX_PER_HOUR) return false;
    await s.set(key, String(cur + 1));
    // nettoyage des fenêtres précédentes : aucune empreinte ne survit plus de deux heures
    for (const old of [String(Number(bucket) - 1), String(Number(bucket) - 2)]) {
      const { blobs } = await s.list({ prefix: old + '/' });
      await Promise.all(blobs.map((b) => s.delete(b.key)));
    }
  } catch (e) {
    console.warn('questionnaire: limite d’envois indisponible, mémoire locale seule');
  }
  return true;
}

/* ── Envoi du PDF par Brevo ───────────────────────────────────────────── */
async function sendMail(pdf, name) {
  const key = process.env.BREVO_API_KEY, to = process.env.QUESTIONNAIRE_TO, from = process.env.QUESTIONNAIRE_FROM;
  if (!key || !to || !from) throw new Error('configuration mail absente');
  const r = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'docteursanak.com', email: from },
      to: [{ email: to }],
      subject: SUBJECT,
      textContent: SUBJECT + '. Le récapitulatif est en pièce jointe.',
      attachment: [{ name: name, content: pdf.toString('base64') }],
      tags: ['questionnaire-preop'],
    }),
  });
  if (!r.ok) throw new Error('brevo ' + r.status);
}

/* ── Point d'entrée ───────────────────────────────────────────────────── */
export default async (req, context) => {
  if (req.method !== 'POST') return json(405, false);
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGIN.test(origin)) return json(403, false);
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json(413, false);

  let body;
  try {
    const txt = await req.text();
    if (txt.length > MAX_BODY) return json(413, false);
    body = JSON.parse(txt);
  } catch (e) { return json(400, false); }

  // Pot de miel : un robot qui remplit le champ caché reçoit un accusé neutre.
  if (body && typeof body.website === 'string' && body.website.trim() !== '') return json(200, true);
  if (!body || typeof body.elapsed !== 'number' || body.elapsed < MIN_FILL_MS) return json(400, false);

  const now = new Date();
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '';
  if (!(await allow(ip, now))) return json(429, false);

  const v = validate(body, now);
  if (v.error) return json(400, false);

  try {
    const result = analyse(v.answers, v.branch, now);
    const pdf = await buildPdf({ answers: v.answers, branch: v.branch, lang: v.lang, result: result, receivedAt: now });
    await sendMail(pdf, fileName(v.answers.prenom, now));
  } catch (e) {
    console.error('questionnaire: échec ' + (e && e.message ? e.message.split('\n')[0] : 'inconnu'));
    return json(502, false);
  }
  return json(200, true);
};
