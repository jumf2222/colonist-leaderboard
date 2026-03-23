import { createSignal, type Accessor, type Setter } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createLocalSignal<T>(key: string, defaultValue: T): [Accessor<T>, Setter<T>] {
	const stored = !isServer ? localStorage.getItem(key) : null;
	let initial = defaultValue;
	if (stored !== null) {
		try {
			initial = JSON.parse(stored);
		} catch {}
	}
	const [value, setValue] = createSignal<T>(initial);

	const setAndPersist = ((v: any) => {
		const result = setValue(v);
		if (!isServer) {
			localStorage.setItem(key, JSON.stringify(typeof v === 'function' ? v(value()) : v));
		}
		return result;
	}) as Setter<T>;

	return [value, setAndPersist];
}
