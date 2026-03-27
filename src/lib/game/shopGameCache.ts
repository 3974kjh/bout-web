import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from './shopSettings';
import { readShopSettingsFromIndexedDb } from '$lib/storage/shopIndexedDb';

let gameShopCache: ShopSettings = { ...DEFAULT_SHOP_SETTINGS };

/** 게임 첫 마운트 전에 호출 — IDB에서 설정 로드 */
export async function primeShopSettingsForGame(): Promise<void> {
	gameShopCache = await readShopSettingsFromIndexedDb();
}

/** 재시작 시 최신 정비소 설정 반영 */
export async function refreshShopSettingsForGame(): Promise<void> {
	gameShopCache = await readShopSettingsFromIndexedDb();
}

/** 동기 읽기 — GameEngine.initGame 전용 */
export function getShopSettingsForGame(): ShopSettings {
	return { ...gameShopCache };
}
