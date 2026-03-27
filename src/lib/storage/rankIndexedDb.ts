import type { MechBase } from '$lib/domain/types';

const DB_NAME = 'bout-web';
const DB_VERSION = 1;
const STORE = 'kv';
const IDB_KEY = 'rankRunRecords';

const MECH_SET = new Set<MechBase>([
	'hypersuit',
	'azonas-v',
	'geren',
	'expressive',
	'soldier'
]);

export type RankRunRecord = {
	id: string;
	playedAt: number;
	mechBase: MechBase;
	scoreTotal: number;
	scoreBoss: number;
	scoreLevel: number;
	scoreTime: number;
	level: number;
	survivalTime: number;
	normalKills: number;
	bossCount: number;
};

type StoredShape = { version: 1; entries: RankRunRecord[] };

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

function normalizeMech(m: unknown): MechBase {
	if (typeof m === 'string' && MECH_SET.has(m as MechBase)) return m as MechBase;
	return 'hypersuit';
}

function normalizeEntry(raw: unknown): RankRunRecord | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const id = typeof o.id === 'string' ? o.id : '';
	if (!id) return null;
	return {
		id,
		playedAt: typeof o.playedAt === 'number' ? o.playedAt : 0,
		mechBase: normalizeMech(o.mechBase),
		scoreTotal: typeof o.scoreTotal === 'number' ? o.scoreTotal : 0,
		scoreBoss: typeof o.scoreBoss === 'number' ? o.scoreBoss : 0,
		scoreLevel: typeof o.scoreLevel === 'number' ? o.scoreLevel : 0,
		scoreTime: typeof o.scoreTime === 'number' ? o.scoreTime : 0,
		level: typeof o.level === 'number' ? o.level : 1,
		survivalTime: typeof o.survivalTime === 'number' ? o.survivalTime : 0,
		normalKills: typeof o.normalKills === 'number' ? o.normalKills : 0,
		bossCount: typeof o.bossCount === 'number' ? o.bossCount : 0
	};
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

function writeRaw(db: IDBDatabase, value: StoredShape): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		const st = tx.objectStore(STORE);
		const p = st.put(value, IDB_KEY);
		p.onerror = (): void => reject(p.error);
		p.onsuccess = (): void => resolve();
	});
}

function sortRecords(a: RankRunRecord, b: RankRunRecord): number {
	if (b.scoreTotal !== a.scoreTotal) return b.scoreTotal - a.scoreTotal;
	return b.playedAt - a.playedAt;
}

export async function readRankRecords(): Promise<RankRunRecord[]> {
	if (typeof indexedDB === 'undefined') return [];
	const db = await openDb();
	let row: unknown;
	try {
		row = await readRaw(db);
	} finally {
		db.close();
	}
	return parseStored(row);
}

const MAX_RECORDS = 2000;

function parseStored(row: unknown): RankRunRecord[] {
	if (row === undefined) return [];
	if (row && typeof row === 'object' && 'entries' in row) {
		const entries = (row as StoredShape).entries;
		if (!Array.isArray(entries)) return [];
		const out: RankRunRecord[] = [];
		for (const e of entries) {
			const n = normalizeEntry(e);
			if (n) out.push(n);
		}
		return out.sort(sortRecords);
	}
	return [];
}

export async function appendRankRunRecord(
	partial: Omit<RankRunRecord, 'id' | 'playedAt'>
): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const rec: RankRunRecord = {
		id: crypto.randomUUID(),
		playedAt: Date.now(),
		...partial
	};
	const db = await openDb();
	try {
		const row = await readRaw(db);
		let list = parseStored(row);
		list.push(rec);
		list.sort(sortRecords);
		if (list.length > MAX_RECORDS) list = list.slice(0, MAX_RECORDS);
		await writeRaw(db, { version: 1, entries: list });
	} finally {
		db.close();
	}
}
