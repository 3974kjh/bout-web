/** KeyboardEvent.code → 짧은 표시 문자열 */
export function formatKeyboardCode(code: string): string {
	if (code === 'Space') return 'Space';
	if (code.startsWith('Key')) return code.slice(3);
	if (code.startsWith('Digit')) return code.slice(5);
	if (code === 'ShiftLeft') return 'Shift L';
	if (code === 'ShiftRight') return 'Shift R';
	if (code === 'ControlLeft') return 'Ctrl L';
	if (code === 'ControlRight') return 'Ctrl R';
	if (code === 'AltLeft') return 'Alt L';
	if (code === 'AltRight') return 'Alt R';
	if (code === 'ArrowUp') return '↑';
	if (code === 'ArrowDown') return '↓';
	if (code === 'ArrowLeft') return '←';
	if (code === 'ArrowRight') return '→';
	return code;
}

export function formatGamepadButton(i: number): string {
	const labels: Record<number, string> = {
		0: '0 · A',
		1: '1 · B',
		2: '2 · X',
		3: '3 · Y',
		4: '4 · LB',
		5: '5 · RB',
		6: '6 · LT',
		7: '7 · RT',
		8: '8 · Back',
		9: '9 · Menu',
		10: '10 · L3',
		11: '11 · R3',
		12: '12 · ↑',
		13: '13 · ↓',
		14: '14 · ←',
		15: '15 · →'
	};
	return labels[i] ?? `${i}`;
}
