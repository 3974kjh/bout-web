/** 경험치 & 레벨업 시스템 */
/** 게임 시작(및 reset) 시 플레이어 레벨 — 높이려면 이 값만 바꿔도 됨 */
export const GAME_START_LEVEL = 1;

export class LevelSystem {
	level = GAME_START_LEVEL;
	exp = 0;
	expToNext: number;

	constructor() {
		this.expToNext = this.calcRequired(this.level);
	}

	private calcRequired(lv: number): number {
		return Math.floor(20 * Math.pow(1.38, lv - 1));
	}

	/** EXP 추가 → 레벨업 여부 반환 */
	addExp(amount: number): boolean {
		this.exp += amount;
		if (this.exp >= this.expToNext) {
			this.exp -= this.expToNext;
			this.level++;
			this.expToNext = this.calcRequired(this.level);
			return true;
		}
		return false;
	}

	/** 현재 레벨 내 진행률 0~1 */
	get progress(): number {
		return this.exp / this.expToNext;
	}

	reset(): void {
		this.level = GAME_START_LEVEL;
		this.exp = 0;
		this.expToNext = this.calcRequired(this.level);
	}
}
