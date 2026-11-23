/* Ad tracking, loaded on every page (in <head>, before the page's own scripts).
 *
 * 1. Attribution: UTMs and ad click IDs from the landing URL are kept for 90 days, so a lead who
 *    lands on one page and fills a form on another still carries them. Read with TKA.attribution().
 * 2. Google tag: stays switched OFF until GOOGLE_TAG_ID is set below. Conversion actions fire only
 *    when their send_to value is filled in too. Enhanced conversions: TKA.conversion() takes the
 *    plain email/phone and gtag hashes them (SHA-256) before they leave the browser.
 * 3. Cal.com: popup/inline bookings on our pages fire "Call booked" (Google) and Schedule (Meta),
 *    and TKA.calParams() passes the UTMs and click IDs into the booking.
 *
 * Every step is wrapped so a tracking failure can never break the page.
 */
(function () {
  // ---- Google Ads: fill these in when the account is set up ----
  var GOOGLE_TAG_ID = 'AW-18590661187';   // Google Ads account tag (switched on 23 Nov 2026)
  var CONVERSIONS = {                     // send_to values from Google Ads → Goals → Conversions
    estimating_enquiry: 'AW-18590661187/OVJvCOenzL0dEMP026BF', // "Estimating – enquiry submitted"
    call_booked: 'AW-18590661187/igWACOqnzL0dEMP026BF'          // "Call booked"
  };

  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'gbraid', 'wbraid', 'fbclid'];
  var STORE = 'tka_attr', MAX_AGE = 90 * 24 * 3600 * 1000;

  function read() {
    try {
      var a = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (a && a.ts && Date.now() - a.ts < MAX_AGE) return a;
    } catch (e) {}
    return null;
  }

  // Capture: an ad click (any UTM or click ID in the URL) replaces whatever was stored before
  var attr = read();
  try {
    var q = new URLSearchParams(location.search), found = {}, any = false;
    KEYS.forEach(function (k) { var v = (q.get(k) || '').trim(); if (v) { found[k] = v.slice(0, 300); any = true; } });
    if (any) {
      found.ts = Date.now();
      found.landing = location.pathname;
      attr = found;
      try { localStorage.setItem(STORE, JSON.stringify(found)); } catch (e) {}
    }
  } catch (e) {}

  var TKA = window.TKA = {};

  // { utm_source, ..., gclid, gbraid, wbraid, fbclid, landing } — only the keys that were set
  TKA.attribution = function () {
    var out = {};
    if (attr) KEYS.concat(['landing']).forEach(function (k) { if (attr[k]) out[k] = attr[k]; });
    return out;
  };

  // True when the visit came from a tagged link or an ad click
  TKA.isTracked = function () {
    var a = TKA.attribution();
    return !!(a.utm_source || a.utm_medium || a.utm_campaign || a.gclid || a.gbraid || a.wbraid || a.fbclid);
  };

  // Random ID shared by the browser pixel and the Conversions API so Meta counts a lead once
  TKA.eventId = function (prefix) {
    var r = '';
    try { r = crypto.getRandomValues(new Uint32Array(2)).join(''); } catch (e) { r = String(Math.random()).slice(2); }
    return (prefix || 'ev') + '-' + Date.now().toString(36) + '-' + r;
  };

  // Meta browser IDs for the Conversions API: _fbp cookie, and _fbc (or one built from the fbclid)
  TKA.metaIds = function () {
    var c = {};
    try { document.cookie.split(';').forEach(function (p) { var i = p.indexOf('='); c[p.slice(0, i).trim()] = p.slice(i + 1); }); } catch (e) {}
    var a = TKA.attribution();
    return { fbp: c._fbp || '', fbc: c._fbc || (a.fbclid ? 'fb.1.' + ((attr && attr.ts) || Date.now()) + '.' + a.fbclid : '') };
  };

  // Australian numbers to E.164 (+61...) for Google enhanced conversions
  TKA.e164 = function (phone) {
    var d = String(phone || '').replace(/[^\d+]/g, '');
    if (!d) return '';
    if (d.charAt(0) === '+') return d;
    if (d.indexOf('61') === 0 && d.length >= 11) return '+' + d;
    if (d.charAt(0) === '0') return '+61' + d.slice(1);
    return '+61' + d;
  };

  // ---- Google tag (dormant until GOOGLE_TAG_ID is set) ----
  var gtagOn = false;
  if (GOOGLE_TAG_ID) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { dataLayer.push(arguments); };
      gtag('js', new Date());
      // Contact details sometimes ride in our own links (/how-it-works?name=&email=, setup links):
      // the page URL Google receives never includes them
      var loc = location.href;
      try {
        var u = new URL(location.href);
        ['name', 'email', 'phone', 'business', 'company'].forEach(function (k) { u.searchParams.delete(k); });
        loc = u.toString();
      } catch (e) {}
      gtag('config', GOOGLE_TAG_ID, {
        page_location: loc,
        allow_enhanced_conversions: true,
        linker: { domains: ['takeoffai.com.au', 'app.takeoffai.com.au'] }
      });
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GOOGLE_TAG_ID);
      document.head.appendChild(s);
      gtagOn = true;
    } catch (e) {}
  }

  // TKA.conversion('estimating_enquiry', { transaction_id, email, phone })
  TKA.conversion = function (key, opts) {
    opts = opts || {};
    if (!gtagOn || !CONVERSIONS[key]) return false;
    try {
      if (opts.email || opts.phone) {
        var ud = {};
        if (opts.email) ud.email = String(opts.email).trim().toLowerCase();
        if (opts.phone) ud.phone_number = TKA.e164(opts.phone);
        gtag('set', 'user_data', ud);
      }
      var ev = { send_to: CONVERSIONS[key] };
      if (opts.transaction_id) ev.transaction_id = opts.transaction_id;
      gtag('event', 'conversion', ev);
      return true;
    } catch (e) { return false; }
  };

  // ---- Cal.com ----
  // Extra booking-page params: Cal.com records utm_* on the booking; click IDs go in as metadata
  TKA.calParams = function () {
    var a = TKA.attribution(), out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) { if (a[k]) out[k] = a[k]; });
    ['gclid', 'gbraid', 'wbraid', 'fbclid'].forEach(function (k) { if (a[k]) out['metadata[' + k + ']'] = a[k]; });
    return out;
  };

  var lastBooking = 0;
  function booked(e) {
    // Cal.com can emit both the old and new event for one booking: count it once
    if (Date.now() - lastBooking < 15000) return;
    lastBooking = Date.now();
    var d = (e && e.detail && e.detail.data) || {};
    var uid = d.uid || (d.booking && d.booking.uid) || TKA.eventId('cal');
    try { if (window.fbq) fbq('track', 'Schedule', { page: location.pathname }, { eventID: 'cal-' + uid }); } catch (x) {}
    TKA.conversion('call_booked', { transaction_id: 'cal-' + uid });
  }
  document.addEventListener('DOMContentLoaded', function () {
    try {
      if (!window.Cal) return;
      Cal('on', { action: 'bookingSuccessfulV2', callback: booked });
      Cal('on', { action: 'bookingSuccessful', callback: booked });
    } catch (e) {}
  });
})();
