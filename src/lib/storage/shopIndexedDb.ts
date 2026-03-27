import {
	DEFAULT_SHOP_SETTINGS,
	SHOP_STORAGE_KEY,
	normalizeShopSettings,
	type ShopSettings
} from '$lib/game/shopSettings';

const DB_NAME = 'bout-web';
const DB_VERSION = 1;
const STORE = 'kv';
const IDB_KEY = 'shopSettings';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = (): void => reject(req.error ?? new Error('indexedDB.open failed'));
		req.onsuccess = (): void => resolve(req.result);
		req.onupgradeneeded = (): void => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
	});
}

function readRaw(db: IDBDatabase): Promise<unknown | undefined> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const st = tx.objectStore(STORE);
		const g = st.get(IDB_KEY);
		g.onerror = (): void => reject(g.error);
		g.onsuccess = (): void => resolve(g.result as unknown);
	});
}

function writeRaw(db: IDBDatabase, value: ShopSettings): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		const st = tx.objectStore(STORE);
		const p = st.put(value, IDB_KEY);
		p.onerror = (): void => reject(p.error);
		p.onsuccess = (): void => resolve();
	});
}

/** 예전 localStorage 데이터를 한 번만 IDB로 옮김 */
function migrateFromLocalStorage(): ShopSettings | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(SHOP_STORAGE_KEY);
		if (!raw) return null;
		const j = JSON.parse(raw) as unknown;
		const s = normalizeShopSettings(j);
		localStorage.removeItem(SHOP_STORAGE_KEY);
		return s;
	} catch {
		return null;
	}
}

export async function readShopSettingsFromIndexedDb(): Promise<ShopSettings> {
	if (typeof indexedDB === 'undefined') return { ...DEFAULT_SHOP_SETTINGS };

	const db = await openDb();
	let row = await readRaw(db);

	if (row === undefined) {
		const migrated = migrateFromLocalStorage();
		if (migrated) {
			await writeRaw(db, migrated);
			row = migrated;
		}
	}

	db.close();

	if (row === undefined) return { ...DEFAULT_SHOP_SETTINGS };
	return normalizeShopSettings(row);
}

export async function writeShopSettingsToIndexedDb(s: ShopSettings): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const payload = normalizeShopSettings(s);
	const db = await openDb();
	await writeRaw(db, payload);
	db.close();
}
