type Listener = (...args: unknown[]) => void;

class GameEventBus {
	private listeners = new Map<string, Set<Listener>>();

	on(event: string, callback: Listener): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);
	}

	off(event: string, callback: Listener): void {
		this.listeners.get(event)?.delete(callback);
	}

	emit(event: string, ...args: unknown[]): void {
		this.listeners.get(event)?.forEach((cb) => cb(...args));
	}

	removeAll(): void {
		this.listeners.clear();
	}
}

export const EventBus = new GameEventBus();
