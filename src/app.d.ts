// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

interface ImportMetaEnv {
	readonly PUBLIC_SITE_URL?: string;
}

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient | null;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			session?: Session | null;
			user?: User | null;
			authConfigured?: boolean;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
