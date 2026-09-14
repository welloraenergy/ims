(() => {
  const GOLD = '#d3af36';

  function brandLoadingScreen() {
    const text = document.body?.textContent || '';
    if (!text.includes('Authenticating')) return false;

    const match = text.match(/Authenticating\s+([^…\.]+)[…\.]?/i);
    const role = (match?.[1] || window.IMS_ROLE || '').trim();

    document.body.innerHTML = `
      <div style="min-height:100dvh;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-sizing:border-box;">
        <div style="text-align:center;">
          <img src="./icon-192.png" width="192" height="192" alt="Wellora Energy" draggable="false" style="width:112px;height:112px;object-fit:contain;margin:0 auto 14px;display:block;">
          <div style="font-size:28px;line-height:1.1;font-weight:900;letter-spacing:-0.02em;color:#fff;">IMS</div>
          <div style="margin-top:8px;font-size:12px;line-height:1.4;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:${GOLD};">Authenticating ${role}</div>
        </div>
      </div>`;
    return true;
  }

  if (brandLoadingScreen()) return;

  const observer = new MutationObserver(() => {
    if (brandLoadingScreen()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
