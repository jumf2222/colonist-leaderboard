import { ComputeFunction, createEffect, createSignal, Signal, SignalOptions } from "solid-js";

export function createLocalSignal<T>(key: string): Signal<T | undefined>;
export function createLocalSignal<T>(
    key: string,
    // oxlint-disable-next-line typescript/ban-types typescript/no-unsafe-function-type
    value: Exclude<T, Function>,
    options?: SignalOptions<T>,
): Signal<T>;
export function createLocalSignal<T>(
    key: string,
    fn: ComputeFunction<T>,
    initialValue?: T,
    options?: SignalOptions<T>,
): Signal<T>;
export function createLocalSignal<T>(
    key: string,
    // oxlint-disable-next-line typescript/ban-types typescript/no-unsafe-function-type
    fn?: Exclude<T, Function> | ComputeFunction<T>,
    defaultValue?: T | SignalOptions<T>,
    options?: SignalOptions<T>,
) {
    let stored = null;
    const isServer = typeof window === "undefined";
    if (!isServer) {
        stored = localStorage.getItem(key);
    }
    let initial = typeof fn === "function" ? defaultValue : fn;
    if (stored !== null) {
        try {
            initial = JSON.parse(stored) as T;
        } catch {}
    }
    const [value, setValue] = createSignal<T>(
        typeof fn === "function" ? (fn as ComputeFunction<T>) : (initial as ComputeFunction<T>),
        typeof fn === "function" ? (initial as T | undefined) : (options as T | undefined),
        typeof fn === "function" ? options : undefined,
    );

    createEffect(value, (value) => {
        if (!isServer) {
            localStorage.setItem(key, JSON.stringify(value));
        }
    });

    return [value, setValue];
}
