import { goto } from '$app/navigation';

/** Esc — `BackToHomeButton` 과 동일하게 메인(/)으로 이동 */
export function goHomeOnEscape(e: KeyboardEvent): void {
	if (e.key !== 'Escape') return;
	e.preventDefault();
	void goto('/');
}
