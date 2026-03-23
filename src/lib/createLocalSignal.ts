import { ComputeFunction, createEffect, createSignal, Signal, SignalOptions } from "solid-js";

export function createLocalSignal<T>(key: string): Signal<T | undefined>;
export function createLocalSignal<T>(
    key: string,
    value: Exclude<T, Function>,
    options?: SignalOptions<T>,
): Signal<T>;
export function createLocalSignal<T>(
    key: string,
    fn: ComputeFunction<T>,
    initialValue?: T,
    options?: SignalOptions<T>,
): Signal<T>;
export function createLocalSignal<T>(key: string, fn?: any, defaultValue?: any, options?: any) {
    let stored = null;
    const isServer = typeof window === "undefined";
    if (!isServer) {
        stored = localStorage.getItem(key);
    }
    let initial = typeof fn == "function" ? defaultValue : fn;
    if (stored !== null) {
        try {
            initial = JSON.parse(stored);
        } catch {}
    }
    const [value, setValue] = createSignal<T>(
        typeof fn == "function" ? fn : initial,
        typeof fn == "function" ? initial : options,
        typeof fn == "function" ? options : undefined,
    );

    createEffect(value, (value) => {
        if (!isServer) {
            localStorage.setItem(key, JSON.stringify(value));
        }
    });

    return [value, setValue];
}
