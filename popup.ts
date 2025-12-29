import { SETTINGS_DEFAULTS, Settings, SettingsRecord } from "./settings";

declare const chrome: {
  runtime?: { lastError?: unknown };
  storage?: StorageApi;
};

declare const browser: {
  storage?: StorageApi;
};

type StorageAreaLike = {
  get: (
    keys: SettingsRecord,
    cb: (res: Record<string, unknown>) => void
  ) => void | Promise<Record<string, unknown>>;
  set: (values: Record<string, unknown>, cb: () => void) => void | Promise<void>;
};

type StorageApi = {
  sync?: StorageAreaLike;
  local?: StorageAreaLike;
};

function toError(err: unknown, fallback: string) {
  return err instanceof Error ? err : new Error(fallback);
}

function isThenable<T>(value: void | Promise<T>): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === "function";
}

function mustGetElement<T extends HTMLElement>(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el as T;
}

const hintEl = mustGetElement<HTMLElement>("hint");
const selectEl = mustGetElement<HTMLSelectElement>("skipKey");
const holdEl = mustGetElement<HTMLInputElement>("holdToSend");
const autoExpandEl = mustGetElement<HTMLInputElement>("autoExpandChats");
const autoTempChatEl = mustGetElement<HTMLInputElement>("autoTempChat");

function setHint(skipKey: string, holdToSend: boolean) {
  if (skipKey === "None") {
    hintEl.textContent = holdToSend
      ? "Auto-send is disabled because no modifier key is selected."
      : "Auto-send always happens when you accept dictation.";
    return;
  }

  hintEl.textContent = holdToSend
    ? `Auto-send happens only while holding ${skipKey} when you accept dictation.`
    : `Hold ${skipKey} while accepting dictation to skip auto-send.`;
}

function getStorageArea(preferSync = true) {
  const api = (typeof browser !== "undefined" ? browser : chrome) as
    | { storage?: StorageApi }
    | undefined;
  const storage = api && api.storage ? api.storage : null;
  if (!storage) return null;
  if (preferSync && storage.sync) return storage.sync;
  if (storage.local) return storage.local;
  return null;
}

async function storageGet(keys: SettingsRecord) {
  const areaSync = getStorageArea(true);
  const areaLocal = getStorageArea(false);

  const tryGet = (area: StorageAreaLike) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      try {
        const r = area.get(keys, (res) => {
          const err = chrome?.runtime?.lastError ?? null;
          if (err) reject(toError(err, "Storage get failed"));
          else resolve(res);
        });
        if (isThenable(r)) r.then(resolve, reject);
      } catch (e) {
        reject(toError(e, "Storage get failed"));
      }
    });

  try {
    if (areaSync) return await tryGet(areaSync);
  } catch {}

  if (areaLocal) return await tryGet(areaLocal);
  return {};
}

async function storageSet(obj: Record<string, unknown>) {
  const areaSync = getStorageArea(true);
  const areaLocal = getStorageArea(false);

  const trySet = (area: StorageAreaLike) =>
    new Promise<void>((resolve, reject) => {
      try {
        const r = area.set(obj, () => {
          const err = chrome?.runtime?.lastError ?? null;
          if (err) reject(toError(err, "Storage set failed"));
          else resolve();
        });
        if (isThenable(r)) r.then(() => resolve(), reject);
      } catch (e) {
        reject(toError(e, "Storage set failed"));
      }
    });

  let syncOk = false;
  try {
    if (areaSync) {
      await trySet(areaSync);
      syncOk = true;
    }
  } catch {}

  if (!syncOk && areaLocal) {
    await trySet(areaLocal);
  }
}

function normalizeSettings(value: Record<string, unknown> | null | undefined): Settings {
  const base = SETTINGS_DEFAULTS;
  const data = value ?? {};
  return {
    skipKey: typeof data.skipKey === "string" ? data.skipKey : base.skipKey,
    holdToSend: typeof data.holdToSend === "boolean" ? data.holdToSend : base.holdToSend,
    autoExpandChats:
      typeof data.autoExpandChats === "boolean" ? data.autoExpandChats : base.autoExpandChats,
    autoTempChat: typeof data.autoTempChat === "boolean" ? data.autoTempChat : base.autoTempChat,
    tempChatEnabled:
      typeof data.tempChatEnabled === "boolean" ? data.tempChatEnabled : base.tempChatEnabled
  };
}

async function load() {
  const data = await storageGet(SETTINGS_DEFAULTS);
  const settings = normalizeSettings(data);

  selectEl.value = settings.skipKey;
  holdEl.checked = settings.holdToSend;
  autoExpandEl.checked = settings.autoExpandChats;
  autoTempChatEl.checked = settings.autoTempChat;

  setHint(settings.skipKey, settings.holdToSend);
}

async function save() {
  const skipKey = selectEl.value;
  const holdToSend = !!holdEl.checked;
  const autoExpandChats = !!autoExpandEl.checked;
  const autoTempChat = !!autoTempChatEl.checked;

  await storageSet({
    skipKey,
    holdToSend,
    autoExpandChats,
    autoTempChat,
    tempChatEnabled: autoTempChat
  });

  setHint(skipKey, holdToSend);
}

selectEl.addEventListener("change", () => void save().catch(() => {}));
holdEl.addEventListener("change", () => void save().catch(() => {}));
autoExpandEl.addEventListener("change", () => void save().catch(() => {}));
autoTempChatEl.addEventListener("change", () => void save().catch(() => {}));

void load().catch(() => {});
