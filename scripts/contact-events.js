(() => {
  'use strict';

  const campaignId = '24440969896';
  const storageKey = 'dcr_ads_campaign';
  const campaignParameter = new URLSearchParams(location.search).get('dcr_campaign');
  let attributed = campaignParameter === campaignId;

  try {
    if (campaignParameter !== null) {
      sessionStorage.removeItem(storageKey);
      if (attributed) sessionStorage.setItem(storageKey, campaignId);
    } else {
      attributed = sessionStorage.getItem(storageKey) === campaignId;
    }
  } catch {
    // A browser that blocks session storage can still measure the landing page.
  }

  if (!attributed) return;

  function record(event, contactSurface) {
    (window.dataLayer ||= []).push({
      event,
      dcr_campaign_id: campaignId,
      dcr_contact_surface: contactSurface,
      dcr_page_path: location.pathname,
    });
  }

  document.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor) return;

    if (anchor.protocol === 'tel:' && anchor.pathname.replace(/\D/g, '') === '971501263137') {
      record('dcr_telephone_tap', 'telephone_link');
    } else if (anchor.protocol === 'https:' && anchor.hostname === 'wa.me' && anchor.pathname === '/971501263137') {
      record('dcr_whatsapp_open', 'whatsapp_link');
    }
  });

  document.addEventListener('dcr:booking-whatsapp-open', () => {
    record('dcr_booking_whatsapp_handoff', 'booking_form');
  });
})();
