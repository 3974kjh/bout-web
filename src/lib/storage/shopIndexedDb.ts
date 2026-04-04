import {
	DEFAULT_SHOP_SETTINGS,
	SHOP_STORAGE_KEY,
	normalizeShopSettings,
	type ShopSettings
} from '$lib/game/shopSettings';

const DB_NAME = 'bout-web';
const DB_VERSION = 1;
const STORE = 'kv';

/** 비로그인 전용 — 클라우드 동기화로 덮어쓰지 않음 */
const IDB_KEY_GUEST = 'shopSettings_guest';
/** 예전 단일 키 (마이그레이션용) */
const IDB_KEY_LEGACY = 'shopSettings';
/** 로그인 중 클라우드 데이터 캐시 — 게스트 슬롯과 분리 */
const IDB_KEY_CLOUD_MIRROR = 'shopSettings_cloud_mirror';

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

function readRawKey(db: IDBDatabase, idbKey: string): Promise<unknown | undefined> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const st = tx.objectStore(STORE);
		const g = st.get(idbKey);
		g.onerror = (): void => reject(g.error);
		g.onsuccess = (): void => resolve(g.result as unknown);
	});
}

function writeRawKey(db: IDBDatabase, idbKey: string, value: ShopSettings): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		const st = tx.objectStore(STORE);
		const p = st.put(value, idbKey);
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

/**
 * 비로그인 시 사용. 로그인 상태에서 클라우드가 이 값을 덮어쓰지 않음.
 * 최초: guest 비어 있으면 legacy → guest 복사, localStorage 마이그레이션.
 */
export async function readShopSettingsGuestFromIndexedDb(): Promise<ShopSettings> {
	if (typeof indexedDB === 'undefined') return { ...DEFAULT_SHOP_SETTINGS };

	const db = await openDb();
	let row: unknown;

	try {
		row = await readRawKey(db, IDB_KEY_GUEST);
		if (row === undefined) {
			const legacy = await readRawKey(db, IDB_KEY_LEGACY);
			if (legacy !== undefined) {
				const s = normalizeShopSettings(legacy);
				await writeRawKey(db, IDB_KEY_GUEST, s);
				row = s;
			}
		}
		if (row === undefined) {
			const migrated = migrateFromLocalStorage();
			if (migrated) {
				await writeRawKey(db, IDB_KEY_GUEST, migrated);
				row = migrated;
			}
		}
	} finally {
		db.close();
	}

	if (row === undefined) return { ...DEFAULT_SHOP_SETTINGS };
	return normalizeShopSettings(row);
}

export async function writeShopSettingsGuestToIndexedDb(s: ShopSettings): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const payload = normalizeShopSettings(s);
	const db = await openDb();
	await writeRawKey(db, IDB_KEY_GUEST, payload);
	db.close();
}

/** 로그인 시 클라우드 반영분만 캐시 (게임·정비소 로그인 모드용) */
export async function readShopSettingsCloudMirrorFromIndexedDb(): Promise<ShopSettings | null> {
	if (typeof indexedDB === 'undefined') return null;
	const db = await openDb();
	try {
		const row = await readRawKey(db, IDB_KEY_CLOUD_MIRROR);
		if (row === undefined) return null;
		return normalizeShopSettings(row);
	} finally {
		db.close();
	}
}

export async function writeShopSettingsCloudMirrorToIndexedDb(s: ShopSettings): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const payload = normalizeShopSettings(s);
	const db = await openDb();
	await writeRawKey(db, IDB_KEY_CLOUD_MIRROR, payload);
	db.close();
}

/** @deprecated 게스트 전용 — readShopSettingsGuestFromIndexedDb 사용 권장 */
export async function readShopSettingsFromIndexedDb(): Promise<ShopSettings> {
	return readShopSettingsGuestFromIndexedDb();
}

/** @deprecated 용도에 따라 guest / cloud mirror 구분 */
export async function writeShopSettingsToIndexedDb(s: ShopSettings): Promise<void> {
	return writeShopSettingsGuestToIndexedDb(s);
}
