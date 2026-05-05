import { APP_NAME, DEFAULTS, STORAGE_KEY } from './config.js';

async function readState() {
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: DEFAULTS });
  return { ...DEFAULTS, ...(result[STORAGE_KEY] || {}) };
}

async function writeActionState(enabled) {
  await chrome.action.setBadgeBackgroundColor({ color: '#ff4757' });
  await chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  await chrome.action.setTitle({
    title: enabled ? `${APP_NAME} — ON` : `${APP_NAME} — OFF`,
  });
}

async function toggleEnabled() {
  const state = await readState();
  const next = { ...state, enabled: !state.enabled };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  await writeActionState(next.enabled);
}

function initActionState() {
  readState()
    .then((state) => writeActionState(Boolean(state.enabled)))
    .catch((error) => console.error(`[${APP_NAME}] init failed:`, error));
}

chrome.runtime.onInstalled.addListener(initActionState);
chrome.runtime.onStartup.addListener(initActionState);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
  const next = Boolean(changes[STORAGE_KEY].newValue?.enabled);
  writeActionState(next).catch((error) => {
    console.error(`[${APP_NAME}] badge update failed:`, error);
  });
});

chrome.action.onClicked.addListener(() => {
  toggleEnabled().catch((error) => {
    console.error(`[${APP_NAME}] toggle failed:`, error);
  });
});
