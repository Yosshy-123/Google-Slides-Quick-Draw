(async () => {
  const FLAG = '__INITIALIZED__';
  if (globalThis[FLAG]) return;
  globalThis[FLAG] = true;

  try {
    const moduleUrl = chrome.runtime.getURL('app.js');
    const { bootSlidesQuickDraw } = await import(moduleUrl);
    await bootSlidesQuickDraw();
  } catch (error) {
    console.error('[Google Slides Quick Draw] init failed:', error);
  }
})();
