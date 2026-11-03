// Two forms post here:
// - "Send us a job" on /estimating: adds the lead to the "TakeoffAI Lead CRM" Google Sheet
//   (Leads tab, same columns as the Meta lead sync, Source = "Estimating page") and emails info@.
// - Client setup on /estimating/setup (form = "setup"): adds a row to the "Client setup" tab
//   (created on first use), notes it on the client's Leads row if their email matches, and emails info@.
// No dependencies: the service-account JWT is signed with node:crypto.
//
// Vercel env vars: GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY, CRM_SHEET_ID,
// RESEND_API_KEY, LEAD_NOTIFY_EMAIL (defaults to info@takeoffai.com.au).
const crypto = require('crypto');

const NOTIFY = process.env.LEAD_NOTIFY_EMAIL || 'info@takeoffai.com.au';
const LIMITS = { name: 100, company: 150, phone: 40, email: 200, job_type: 20, job_size: 40, deadline: 20,
  plans_link: 1000, quoting_software: 150, notes: 3000, source_page: 200, utm_source: 100,
  utm_medium: 100, utm_campaign: 150, utm_content: 150, referrer: 500 };

function clean(body) {
  const out = {};
  for (const k of Object.keys(LIMITS)) out[k] = String((body && body[k]) || '').trim().slice(0, LIMITS[k]);
  return out;
}

// Stop sheet formulas being injected through form text
const cell = (v) => (/^[=+\-@]/.test(v) ? "'" + v : v);

function melbourneNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

function formatDeadline(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

async function googleToken() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: process.env.GOOGLE_SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const key = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google auth failed: ' + JSON.stringify(j));
  return j.access_token;
}

async function sheets() {
  const token = await googleToken();
  return { api: `https://sheets.googleapis.com/v4/spreadsheets/${process.env.CRM_SHEET_ID}`,
    auth: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

async function addToCrm(f, leadId, notes) {
  const { api, auth } = await sheets();
  // Write at an explicit row, as tools/sync_leads_to_crm_sheet.py does: column A is hidden,
  // so the Sheets "append" API guesses the table starts at B and shifts the row right.
  // Count every used row (any column), so a row with a blank column A is never overwritten.
  const used = await (await fetch(`${api}/values/Leads?majorDimension=ROWS`, { headers: auth })).json();
  if (!used.range) throw new Error('CRM sheet not readable: ' + JSON.stringify(used));
  const next = (used.values || []).length + 1;
  // Lead ID, Date, Name, Email, Phone, Source, Company, Auto Email, Stage, Notes (same columns as the
  // Meta sync). USER_ENTERED so the date is a real date; apostrophes keep IDs and phones as text.
  // Auto Email = manual_contact: Grokbot's 8:05am cold emails pick rows by Stage and skip only
  // manual_contact, and estimating leads must never get the software emails (Jonah, 30 Oct 2026).
  const row = ["'" + leadId, melbourneNow(), cell(f.name), cell(f.email), f.phone ? "'" + f.phone : '',
    'Estimating page', cell(f.company), 'manual_contact', 'New', cell(notes)];
  const r = await fetch(`${api}/values/Leads!A${next}:J${next}?valueInputOption=USER_ENTERED`, {
    method: 'PUT', headers: auth, body: JSON.stringify({ values: [row] }) });
  if (!r.ok) throw new Error(`Sheets write ${r.status}: ${await r.text()}`);
}

// ---- Client setup ----
const SETUP_TAB = 'Client setup';
// [label, form field, max length]; the order is the column order of the "Client setup" tab
const SETUP_FIELDS = [
  ['Business', 'business', 150], ['Name', 'name', 100], ['Phone', 'phone', 40], ['Email', 'email', 200],
  ['Work quoted', 'work_types', 200], ['Jobs a month', 'jobs_per_month', 20], ['Where they work', 'work_area', 300],
  ['Travel charge', 'travel_charge', 300], ['Tradesperson rate ($/hr ex GST)', 'trade_rate', 40],
  ['Apprentice rate ($/hr ex GST)', 'apprentice_rate', 40], ['Charge-out or cost', 'rate_type', 20],
  ['Margin / markup', 'margin', 500], ['Quotes in', 'quoting_software', 150], ['Pricing last updated', 'pricing_updated', 20],
  ['Wholesaler and branch', 'wholesaler', 200], ['Rep name', 'rep_name', 100], ['Rep email', 'rep_email', 200],
  ['OK to contact rep', 'rep_contact_ok', 10], ['Brands', 'brands', 2000], ["Won't install / always exclude", 'exclusions', 2000],
  ['Site loadings', 'loadings', 300], ['Loading amounts', 'loading_amounts', 2000], ['ABN', 'abn', 30],
  ['Licence / REC number', 'licence', 60], ['Standard inclusions and clarifications', 'inclusions', 4000],
  ['Quote validity', 'quote_validity', 60], ['Return format', 'return_format', 150], ['Files link', 'files_link', 1000],
  ['Anything else', 'other_notes', 4000],
];
const SETUP_EXTRA = { source_page: 200, utm_source: 100, utm_medium: 100, utm_campaign: 150 };

function cleanSetup(body) {
  const out = {};
  for (const [, k, max] of SETUP_FIELDS) out[k] = String((body && body[k]) || '').trim().slice(0, max);
  for (const [k, max] of Object.entries(SETUP_EXTRA)) out[k] = String((body && body[k]) || '').trim().slice(0, max);
  return out;
}

async function addSetupToCrm(f, source) {
  const { api, auth } = await sheets();
  const date = melbourneNow();
  // Create the tab with a header row the first time a client fills the form in
  const meta = await (await fetch(`${api}?fields=sheets.properties.title`, { headers: auth })).json();
  if (!meta.sheets) throw new Error('CRM sheet not readable: ' + JSON.stringify(meta));
  if (!meta.sheets.some((sh) => sh.properties.title === SETUP_TAB)) {
    const add = await fetch(`${api}:batchUpdate`, { method: 'POST', headers: auth, body: JSON.stringify({ requests: [
      { addSheet: { properties: { title: SETUP_TAB, gridProperties: { frozenRowCount: 1 } } } }] }) });
    if (!add.ok && !/already exists/.test(await add.text())) throw new Error(`Sheets addSheet ${add.status}`);
    const head = ['Date', 'Lead ID', ...SETUP_FIELDS.map(([label]) => label), 'Source'];
    await fetch(`${api}/values/${encodeURIComponent(`'${SETUP_TAB}'!A1`)}?valueInputOption=RAW`, {
      method: 'PUT', headers: auth, body: JSON.stringify({ values: [head] }) });
  }

  // Their row on the Leads tab (latest one with the same email), so the two can be matched up
  let leadId = '';
  const leads = await (await fetch(`${api}/values/Leads!A:J?majorDimension=ROWS`, { headers: auth })).json();
  const rows = leads.values || [], email = f.email.toLowerCase();
  for (let i = rows.length - 1; i > 0; i--) {
    if ((rows[i][3] || '').trim().toLowerCase() !== email) continue;
    leadId = rows[i][0] || '';
    const note = `Client setup done ${date.slice(0, 10)} (see Client setup tab)`;
    const notes = rows[i][9] ? `${rows[i][9]} | ${note}` : note;
    const r = await fetch(`${api}/values/Leads!J${i + 1}?valueInputOption=RAW`, {
      method: 'PUT', headers: auth, body: JSON.stringify({ values: [[notes]] }) });
    if (!r.ok) console.error('Leads note failed', r.status, await r.text());
    break;
  }

  // Explicit row, as on the Leads tab. Phone, ABN and rates are written as text so Sheets keeps them as typed.
  const used = await (await fetch(`${api}/values/${encodeURIComponent(`'${SETUP_TAB}'!A:B`)}?majorDimension=ROWS`, { headers: auth })).json();
  const next = (used.values || []).length + 1;
  const asText = new Set(['phone', 'abn', 'licence', 'trade_rate', 'apprentice_rate']);
  const row = [date, leadId ? "'" + leadId : '', ...SETUP_FIELDS.map(([, k]) => (asText.has(k) && f[k] ? "'" + f[k] : cell(f[k]))), cell(source)];
  const r = await fetch(`${api}/values/${encodeURIComponent(`'${SETUP_TAB}'!A${next}`)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT', headers: auth, body: JSON.stringify({ values: [row] }) });
  if (!r.ok) throw new Error(`Sheets write ${r.status}: ${await r.text()}`);
}

async function handleSetup(body, res) {
  const f = cleanSetup(body);
  if (!f.business || !f.name || !f.phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
    return res.status(400).json({ ok: false, error: 'Business name, your name, phone and a valid email are needed.' });
  }
  const source = [f.source_page, f.utm_source && `utm_source=${f.utm_source}`, f.utm_medium && `utm_medium=${f.utm_medium}`,
    f.utm_campaign && `utm_campaign=${f.utm_campaign}`].filter(Boolean).join(' · ');
  const lines = SETUP_FIELDS.map(([label, k]) => [label, f[k]]).concat([['Source', source]]);
  const [crm, mail] = await Promise.allSettled([addSetupToCrm(f, source),
    sendEmail(f.email, `Client setup: ${f.business}`, lines, 'The setup is in the CRM sheet, Client setup tab.')]);
  if (crm.status === 'rejected') console.error('Client setup CRM write failed', f.email, crm.reason);
  if (mail.status === 'rejected') console.error('Client setup email failed', f.email, mail.reason);
  if (crm.status === 'rejected' && mail.status === 'rejected') return res.status(502).json({ ok: false, error: 'Could not save the setup.' });
  return res.status(200).json({ ok: true });
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function emailLead(f, lines) {
  const subject = `Estimating job: ${f.company || f.name} (${f.job_type || 'job'}, due ${formatDeadline(f.deadline)})`;
  return sendEmail(f.email, subject, lines,
    'Promised: price and turnaround confirmed the same business day. The lead is in the CRM sheet with Source = Estimating page.');
}

async function sendEmail(replyTo, subject, lines, footer) {
  const text = lines.map(([k, v]) => `${k}: ${v || '—'}`).join('\n') + '\n\n' + footer;
  const html = '<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">' +
    lines.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#5B5B5B;vertical-align:top">${esc(k)}</td>` +
      `<td style="padding:6px 0;color:#111"><b>${esc(v || '—').replace(/\n/g, '<br>')}</b></td></tr>`).join('') +
    `</table><p style="font-family:Arial,sans-serif;font-size:13px;color:#5B5B5B">${esc(footer)}</p>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'TakeoffAI Leads <info@takeoffai.com.au>', to: [NOTIFY],
      reply_to: replyTo || undefined, subject, text, html }) });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'POST only' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  // Honeypot: bots fill the hidden "website" field. Pretend it worked.
  if (body && body.website) return res.status(200).json({ ok: true });
  if (body && body.form === 'setup') return handleSetup(body, res);

  const f = clean(body);
  if (!f.name || !f.phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) || !f.deadline) {
    return res.status(400).json({ ok: false, error: 'Name, phone, a valid email and the tender deadline are needed.' });
  }

  const leadId = 'web-est-' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
  const source = [f.source_page, f.utm_source && `utm_source=${f.utm_source}`, f.utm_medium && `utm_medium=${f.utm_medium}`,
    f.utm_campaign && `utm_campaign=${f.utm_campaign}`, f.utm_content && `utm_content=${f.utm_content}`,
    f.referrer && `referrer=${f.referrer}`].filter(Boolean).join(' · ');
  const notes = [`${f.job_type === 'commercial' ? 'Commercial' : 'Residential'}${f.job_size ? ` (${f.job_size})` : ''}, tender due ${formatDeadline(f.deadline)}`,
    `Plans: ${f.plans_link || 'not linked (may email them)'}`, f.quoting_software && `Quotes in: ${f.quoting_software}`,
    f.notes && `Notes: ${f.notes}`, source && `Source: ${source}`].filter(Boolean).join(' | ');
  const lines = [['Name', f.name], ['Company', f.company], ['Phone', f.phone], ['Email', f.email],
    ['Job type', f.job_type], ['Job size', f.job_size], ['Tender deadline', formatDeadline(f.deadline)],
    ['Plans', f.plans_link || 'No link. They may email the plans.'], ['Quotes in', f.quoting_software],
    ['Notes', f.notes], ['Source', source], ['Lead ID', leadId]];

  const [crm, mail] = await Promise.allSettled([addToCrm(f, leadId, notes), emailLead(f, lines)]);
  if (crm.status === 'rejected') console.error('CRM append failed', leadId, crm.reason);
  if (mail.status === 'rejected') console.error('Lead email failed', leadId, mail.reason);
  // Either one landing is enough for Jonah to follow up; only fail if both did
  if (crm.status === 'rejected' && mail.status === 'rejected') return res.status(502).json({ ok: false, error: 'Could not save the job.' });
  return res.status(200).json({ ok: true });
};
