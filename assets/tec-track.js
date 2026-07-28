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

  // PostHog's project token is a public, write-only browser key. Keep the
  // school site cookieless and capture only the explicit events below.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  window.posthog.init('phc_w7ATS3q7xnYq3ozyKgVeeeREh6zyiVit2qvvFDvT4LYg', {
    api_host: 'https://eu.i.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    persistence: 'memory'
  });

  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

  function trackEvent(name, data) {
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
    trackEvent('enquiry_submit', { page: location.pathname, form: label });

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
