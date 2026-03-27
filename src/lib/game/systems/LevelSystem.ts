/** 경험치 & 레벨업 시스템 */
export class LevelSystem {
	level = 1;
	exp = 0;
	expToNext: number;

	constructor() {
		this.expToNext = this.calcRequired(1);
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
		this.level = 1;
		this.exp = 0;
		this.expToNext = this.calcRequired(1);
	}
}
