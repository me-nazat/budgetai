export function reportWebVitals(metric: any) {
  const body = JSON.stringify(metric);
  const url = '/api/analytics';

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body);
  } else {
    fetch(url, { body, method: 'POST', keepalive: true });
  }
}
