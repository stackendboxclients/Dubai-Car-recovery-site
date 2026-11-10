(() => {
  try {
    if (new URLSearchParams(location.search).get('dcr_test') === '1') {
      sessionStorage.setItem('dcr_preview_contact_test', '1');
    }
    window.dcrPreviewContactTest = sessionStorage.getItem('dcr_preview_contact_test') === '1';
  } catch {
    return;
  }
  if (!window.dcrPreviewContactTest) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const url = new URL(entry.name);
      if (!/(^|\.)google-analytics\.com$/.test(url.hostname) || url.pathname !== '/g/collect') continue;
      const query = url.searchParams;
      console.info('DCR preview GA4 request', JSON.stringify({
        event: query.get('en'),
        destination: query.get('tid'),
        campaign: query.get('ep.dcr_campaign_id') || query.get('epn.dcr_campaign_id'),
        status: entry.responseStatus || null,
      }));
    }
  });
  observer.observe({ type: 'resource', buffered: true });
})();
