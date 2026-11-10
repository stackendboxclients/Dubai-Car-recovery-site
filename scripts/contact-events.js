(() => {
  'use strict';

  const campaignId = '24440969896';
  const storageKey = 'dcr_ads_campaign';
  const consentKey = 'dcr_contact_analytics_choice';
  const campaignParameter = new URLSearchParams(location.search).get('dcr_campaign');
  let attributed = campaignParameter === campaignId;
  let choice;

  try {
    choice = sessionStorage.getItem(consentKey);
    if (campaignParameter === null) attributed = sessionStorage.getItem(storageKey) === campaignId;
    else if (!attributed) sessionStorage.removeItem(storageKey);
  } catch {
    // A choice can still be made for the current page.
  }

  const privacySignal = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  if (privacySignal) choice = 'deny';
  const canMeasure = () => attributed && choice === 'allow' && !privacySignal;
  let bookingRecorded = false;
  let lastEvent;
  let lastEventAt = 0;

  function record(event, contactSurface, afterSend) {
    if (!canMeasure()) return false;
    const now = Date.now();
    if (event === lastEvent && now - lastEventAt < 800) return false;
    lastEvent = event;
    lastEventAt = now;
    if (afterSend) {
      const callback = afterSend;
      let completed = false;
      const finish = () => {
        if (completed) return;
        completed = true;
        callback();
      };
      setTimeout(finish, 350);
      afterSend = finish;
    }
    (window.dataLayer ||= []).push({
      event,
      dcr_campaign_id: campaignId,
      dcr_contact_surface: contactSurface,
      ...(afterSend && { eventCallback: afterSend, eventTimeout: 350 }),
    });
    return true;
  }

  function persistChoice() {
    try {
      sessionStorage.setItem(consentKey, choice);
      if (canMeasure()) sessionStorage.setItem(storageKey, campaignId);
      else sessionStorage.removeItem(storageKey);
    } catch {
      // Contact features work when storage is unavailable.
    }
  }

  function renderChoices() {
    const isPrivacyPage = location.pathname === '/privacy/';
    if ((!attributed && !isPrivacyPage) || (!isPrivacyPage && choice) || privacySignal) return;
    const panel = document.createElement('aside');
    panel.className = 'wrap';
    panel.setAttribute('aria-label', 'Optional contact analytics');
    panel.innerHTML = '<p>Optional analytics counts taps on contact buttons. You can use every contact option either way. <a href="/privacy/">Privacy details</a></p><button type="button" data-dcr-choice="allow">Allow analytics</button> <button type="button" data-dcr-choice="deny">Decline analytics</button>';
    panel.addEventListener('click', (event) => {
      const selected = event.target.closest('[data-dcr-choice]')?.dataset.dcrChoice;
      if (!selected) return;
      choice = selected;
      window['ga-disable-G-LD89L3NJHQ'] = choice !== 'allow';
      persistChoice();
      panel.replaceChildren(document.createTextNode(choice === 'allow' ? 'Analytics allowed for this tab.' : 'Analytics declined for this tab.'));
    });
    document.querySelector('main')?.prepend(panel);
  }

  if (canMeasure()) persistChoice();
  document.addEventListener('DOMContentLoaded', renderChoices, { once: true });
  if (!attributed) return;

  document.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || event.defaultPrevented) return;

    if (anchor.protocol === 'tel:' && anchor.pathname.replace(/\D/g, '') === '971501263137') {
      if (window.dcrPreviewContactTest) event.preventDefault();
      record('dcr_telephone_tap', 'telephone_link');
    } else if (anchor.protocol === 'https:' && anchor.hostname === 'wa.me' && anchor.pathname === '/971501263137') {
      if (window.dcrPreviewContactTest) event.preventDefault();
      if (anchor.classList.contains('prepared-link')) {
        if (!bookingRecorded) bookingRecorded = record('dcr_booking_whatsapp_handoff', 'booking_form');
      } else if (!window.dcrPreviewContactTest && (!anchor.target || anchor.target === '_self') && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && canMeasure()) {
        if (record('dcr_whatsapp_open', 'whatsapp_link', () => location.assign(anchor.href))) event.preventDefault();
      } else {
        record('dcr_whatsapp_open', 'whatsapp_link');
      }
    }
  });

  document.addEventListener('dcr:booking-whatsapp-open', (event) => {
    if (window.dcrPreviewContactTest) event.preventDefault();
    const continueHandoff = window.dcrPreviewContactTest ? undefined : event.detail?.continueHandoff;
    const recorded = record('dcr_booking_whatsapp_handoff', 'booking_form', continueHandoff);
    bookingRecorded ||= recorded;
    if (recorded && continueHandoff) event.preventDefault();
  });
})();
