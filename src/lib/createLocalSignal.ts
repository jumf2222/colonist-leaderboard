import { createSignal, type Accessor, type Setter } from "solid-js";

export function createLocalSignal<T>(key: string, defaultValue: T): [Accessor<T>, Setter<T>] {
    let stored = null;
    const isServer = typeof window !== "undefined";
    if (!isServer) {
        stored = localStorage.getItem(key);
    }
    let initial = defaultValue;
    if (stored !== null) {
        try {
            initial = JSON.parse(stored);
        } catch {}
    }
    const [value, setValue] = createSignal<T>(initial as any);

    const setAndPersist = ((v: any) => {
        const result = setValue(v);
        if (!isServer) {
            localStorage.setItem(key, JSON.stringify(typeof v === "function" ? v(value()) : v));
        }
        return result;
    }) as Setter<T>;

    return [value, setAndPersist];
}
