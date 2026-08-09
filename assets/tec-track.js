/* TEC privacy-conscious visitor tracking.
   - Persists an anonymous PostHog identity in localStorage (no analytics
     cookies) so one visit is not split into a new person on every page.
   - Persists UTM tags + first external referrer in sessionStorage so the
     source survives internal navigation.
   - Injects a readable "Found via" field into every enquiry form, so each
     FormSubmit email says where the person came from.
   - Fires Vercel Web Analytics custom events for LINE / phone / email clicks,
     PDF downloads, and form submissions. Safe no-op if analytics is disabled.
   - Loads the Meta Pixel only after explicit marketing consent, and never for
     browsers marked as internal/test users.
   - POSTs a copy of each enquiry to the Notion enquiry-webhook worker, which
     files it in "DB: Enquiries (TEC)". FormSubmit email is unaffected. */
(function () {
  var ENQUIRY_WEBHOOK = 'https://www.notion.so/webhooks/worker/d04bd900-8630-4051-9599-ec4f025fa497/019f2667-71e8-7ac3-9781-c262b343ab30/meqbMk0s9tX2Qd1z/onEnquiry';
  var INTERNAL_STORAGE_KEY = 'posthog_internal_user';
  var MARKETING_CONSENT_KEY = 'tec_marketing_consent_v1';
  var META_PIXEL_ID = '1042058091805047';
  var isInternal = false;
  var metaPixelLoaded = false;

  try {
    var internalParams = new URLSearchParams(location.search);
    var internalParam = internalParams.get('posthog_internal');
    if (internalParam === '1') localStorage.setItem(INTERNAL_STORAGE_KEY, 'true');
    if (internalParam === '0') localStorage.removeItem(INTERNAL_STORAGE_KEY);
    isInternal = localStorage.getItem(INTERNAL_STORAGE_KEY) === 'true';
    if (internalParam === '1' || internalParam === '0') {
      internalParams.delete('posthog_internal');
      var cleanQuery = internalParams.toString();
      history.replaceState(null, '', location.pathname + (cleanQuery ? '?' + cleanQuery : '') + location.hash);
    }
  } catch (e) { /* storage unavailable: treat the browser as external */ }

  // PostHog's project token is a public, write-only browser key. Keep the
  // school site free of analytics cookies and capture only useful events.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  window.posthog.init('phc_w7ATS3q7xnYq3ozyKgVeeeREh6zyiVit2qvvFDvT4LYg', {
    api_host: 'https://eu.i.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    persistence: 'localStorage'
  });
  window.posthog.register({ is_internal_user: isInternal });
  window.posthog.capture('$pageview', { is_internal_user: isInternal });

  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

  function getMarketingConsent() {
    try { return localStorage.getItem(MARKETING_CONSENT_KEY); }
    catch (e) { return null; }
  }

  function loadMetaPixel() {
    if (metaPixelLoaded || isInternal || getMarketingConsent() !== 'accepted') return;
    metaPixelLoaded = true;

    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('consent', 'grant');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function removeMetaCookies() {
    var names = ['_fbp', '_fbc'];
    var domains = ['', location.hostname, '.' + location.hostname, '.tecschool.org'];
    names.forEach(function (name) {
      domains.forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; path=/' +
          (domain ? '; domain=' + domain : '') + '; SameSite=Lax';
      });
    });
  }

  function setMarketingConsent(choice) {
    var previous = getMarketingConsent();
    try { localStorage.setItem(MARKETING_CONSENT_KEY, choice); }
    catch (e) { return; }

    if (choice === 'accepted') {
      if (isInternal) return;
      if (metaPixelLoaded && window.fbq) {
        window.fbq('consent', 'grant');
        if (previous !== 'accepted') window.fbq('track', 'PageView');
      } else {
        loadMetaPixel();
      }
    } else {
      if (window.fbq) window.fbq('consent', 'revoke');
      removeMetaCookies();
    }
  }

  function trackMeta(eventName, data) {
    if (isInternal || getMarketingConsent() !== 'accepted') return;
    loadMetaPixel();
    if (window.fbq) window.fbq('track', eventName, data || {});
  }

  function setupMarketingConsent() {
    var style = document.createElement('style');
    style.textContent =
      '#tec-marketing-consent{position:fixed;z-index:99999;left:16px;right:16px;bottom:16px;max-width:720px;margin:auto;background:#fff;color:#1a1a1a;border:2px solid #1a1a1a;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.24);padding:18px;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}' +
      '#tec-marketing-consent h2{font:700 20px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;margin:0 0 8px;padding:0}' +
      '#tec-marketing-consent p{margin:0 0 12px}' +
      '#tec-marketing-consent a{color:#b0005c;font-weight:700}' +
      '.tec-consent-actions{display:flex;gap:10px;flex-wrap:wrap}' +
      '.tec-consent-actions button,#tec-privacy-choices{appearance:none;border:2px solid #1a1a1a;border-radius:999px;padding:10px 16px;font:700 14px/1 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer}' +
      '.tec-consent-allow{background:#fed501;color:#1a1a1a}' +
      '.tec-consent-decline{background:#fff;color:#1a1a1a}' +
      '#tec-privacy-choices{position:fixed;z-index:99998;left:12px;bottom:12px;background:#fff;color:#1a1a1a;box-shadow:0 4px 16px rgba(0,0,0,.16);font-size:12px;padding:8px 12px}' +
      '@media(max-width:520px){#tec-marketing-consent{left:10px;right:10px;bottom:10px;padding:16px}.tec-consent-actions button{width:100%}}';
    document.head.appendChild(style);

    var choicesButton = document.createElement('button');
    choicesButton.id = 'tec-privacy-choices';
    choicesButton.type = 'button';
    choicesButton.textContent = 'Privacy choices / ตั้งค่าความเป็นส่วนตัว';
    choicesButton.setAttribute('aria-haspopup', 'dialog');

    function closePanel() {
      var oldPanel = document.getElementById('tec-marketing-consent');
      if (oldPanel) oldPanel.remove();
      choicesButton.hidden = false;
    }

    function showPanel() {
      var oldPanel = document.getElementById('tec-marketing-consent');
      if (oldPanel) return;
      choicesButton.hidden = true;

      var panel = document.createElement('aside');
      panel.id = 'tec-marketing-consent';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-labelledby', 'tec-consent-title');
      panel.innerHTML =
        '<h2 id="tec-consent-title">Advertising privacy / ความเป็นส่วนตัวด้านโฆษณา</h2>' +
        '<p>With your permission, TEC uses the Meta Pixel to measure ads and show relevant TEC ads to past website visitors. It stays off unless you allow it. We never send your form answers. <a href="/privacy/#marketing">Read more / อ่านเพิ่มเติม</a></p>' +
        '<div class="tec-consent-actions">' +
          '<button type="button" class="tec-consent-allow">Allow marketing / ยอมรับ</button>' +
          '<button type="button" class="tec-consent-decline">No thanks / ไม่ยอมรับ</button>' +
        '</div>';
      document.body.appendChild(panel);

      panel.querySelector('.tec-consent-allow').addEventListener('click', function () {
        setMarketingConsent('accepted');
        closePanel();
      });
      panel.querySelector('.tec-consent-decline').addEventListener('click', function () {
        setMarketingConsent('declined');
        closePanel();
      });
      panel.querySelector('button').focus();
    }

    choicesButton.addEventListener('click', showPanel);
    document.body.appendChild(choicesButton);
    window.tecOpenMarketingPreferences = showPanel;

    if (getMarketingConsent()) choicesButton.hidden = false;
    else showPanel();
  }

  loadMetaPixel();

  function trackEvent(name, data) {
    data = data || {};
    data.is_internal_user = isInternal;
    window.va('event', { name: name, data: data });
    window.posthog.capture(name, data);
  }

  function clickData(el, href) {
    return {
      page: location.pathname,
      href: href,
      label: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 120),
      language: document.documentElement.lang || ''
    };
  }

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

    var thanksPanels = document.querySelectorAll('.form-thanks');
    for (var j = 0; j < thanksPanels.length; j++) {
      (function (panel) {
        var observer = new MutationObserver(function () {
          if (panel.hidden || panel.getAttribute('data-analytics-confirmed') === 'true') return;
          panel.setAttribute('data-analytics-confirmed', 'true');
          trackEvent('enquiry_submitted', {
            page: location.pathname,
            form: panel.id || 'enquiry-form'
          });
          trackMeta('Lead', {
            content_name: panel.id || 'enquiry-form',
            content_category: document.documentElement.lang || 'website'
          });
          observer.disconnect();
        });
        observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
      })(thanksPanels[j]);
    }

    setupMarketingConsent();
  });

  document.addEventListener('click', function (ev) {
    var clicked = ev.target;
    var button = clicked;
    while (button && button.tagName !== 'BUTTON') button = button.parentElement;
    if (button) {
      if (button.id === 'open-callback') {
        trackEvent('placement_interview_clicked', clickData(button, '#callback-section'));
      }
      if (button.getAttribute('data-video')) {
        trackEvent('testimonial_played', clickData(button, button.getAttribute('data-video')));
      }
    }

    var el = clicked;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var page = location.pathname;
    var data = clickData(el, href);

    if (href.indexOf('line.me') !== -1) {
      trackEvent('line_click', data);
    } else if (href.indexOf('tel:') === 0) {
      trackEvent('phone_click', data);
    } else if (href.indexOf('mailto:') === 0) {
      trackEvent('email_click', data);
    } else if (/\.pdf($|\?)/.test(href)) {
      trackEvent('pdf_download', data);
    }

    if (/^\/?(english|thai|chinese)(\/|$)/.test(href)) {
      trackEvent('language_selected', data);
    }
    if (href.indexOf('/courses/') === 0 ||
        (page === '/courses/' && /^[^?#]+\.html($|\?)/.test(href))) {
      trackEvent('course_opened', data);
    }
    if (href.indexOf('#callback-section') !== -1) {
      trackEvent('placement_interview_clicked', data);
    }
    if (href.indexOf('google.com/maps') !== -1) {
      trackEvent('directions_clicked', data);
    }
    if (/facebook\.com|youtube\.com|tiktok\.com/.test(href)) {
      trackEvent('social_link_clicked', data);
    }
  }, true);

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    var subjectField = form.querySelector('input[name="_subject"]');
    var label = (subjectField && subjectField.value) || form.id || 'form';
    trackEvent('enquiry_started', { page: location.pathname, form: label });

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
