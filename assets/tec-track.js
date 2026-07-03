/* TEC cookieless visitor tracking.
   - Persists UTM tags + first external referrer in sessionStorage (no cookies,
     per the privacy page promise) so the source survives internal navigation.
   - Injects a readable "Found via" field into every enquiry form, so each
     FormSubmit email says where the person came from.
   - Fires Vercel Web Analytics custom events for LINE / phone / email clicks,
     PDF downloads, and form submissions. Safe no-op if analytics is disabled.
   - POSTs a copy of each enquiry to the Notion enquiry-webhook worker, which
     files it in "DB: Enquiries (TEC)". FormSubmit email is unaffected. */
(function () {
  var ENQUIRY_WEBHOOK = 'https://www.notion.so/webhooks/worker/d04bd900-8630-4051-9599-ec4f025fa497/019f2667-71e8-7ac3-9781-c262b343ab30/meqbMk0s9tX2Qd1z/onEnquiry';
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  try {
    var params = new URLSearchParams(location.search);
    var utm = {};
    var found = false;
    UTM_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) { utm[k] = v; found = true; }
    });
    if (found) sessionStorage.setItem('tec_utm', JSON.stringify(utm));
    if (!sessionStorage.getItem('tec_ref') && document.referrer &&
        document.referrer.indexOf(location.host) === -1) {
      sessionStorage.setItem('tec_ref', document.referrer);
    }
  } catch (e) { /* storage unavailable: tracking degrades, site unaffected */ }

  function sourceLabel() {
    var utm = {};
    var ref = '';
    try {
      utm = JSON.parse(sessionStorage.getItem('tec_utm') || '{}');
      ref = sessionStorage.getItem('tec_ref') || '';
    } catch (e) {}
    if (utm.utm_source) {
      return [utm.utm_source, utm.utm_medium, utm.utm_campaign, utm.utm_content]
        .filter(Boolean).join(' / ');
    }
    return ref || 'direct or unknown';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'Found via';
      input.value = sourceLabel();
      forms[i].appendChild(input);
    }
  });

  document.addEventListener('click', function (ev) {
    var el = ev.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var page = location.pathname;
    if (href.indexOf('line.me') !== -1) {
      window.va('event', { name: 'line_click', data: { page: page } });
    } else if (href.indexOf('tel:') === 0) {
      window.va('event', { name: 'phone_click', data: { page: page } });
    } else if (href.indexOf('mailto:') === 0) {
      window.va('event', { name: 'email_click', data: { page: page } });
    } else if (/\.pdf($|\?)/.test(href)) {
      window.va('event', { name: 'pdf_download', data: { page: page, file: href } });
    }
  }, true);

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    var subjectField = form.querySelector('input[name="_subject"]');
    var label = (subjectField && subjectField.value) || form.id || 'form';
    window.va('event', { name: 'enquiry_submit', data: { page: location.pathname, form: label } });

    try {
      var fd = new FormData(form);
      if (fd.get('_honey')) return; // bot filled the honeypot: no copy
      var path = location.pathname;
      var programme = path.indexOf('/chinese') === 0 ? 'Chinese'
                    : path.indexOf('/thai') === 0 ? 'Thai'
                    : 'English';
      var payload = JSON.stringify({
        name: fd.get('Name') || '',
        contact: fd.get('LINE or phone') || fd.get('Email') || '',
        location: fd.get('Where are you now') || '',
        programme: programme,
        foundVia: sourceLabel(),
        page: location.href
      });
      // text/plain keeps this a CORS "simple request" (no preflight);
      // fire-and-forget — the enquiry email works even if this fails.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENQUIRY_WEBHOOK, new Blob([payload], { type: 'text/plain' }));
      } else {
        fetch(ENQUIRY_WEBHOOK, {
          method: 'POST', mode: 'no-cors', keepalive: true,
          headers: { 'Content-Type': 'text/plain' }, body: payload
        });
      }
    } catch (e) { /* copy failed: FormSubmit email still goes out */ }
  }, true);
})();
