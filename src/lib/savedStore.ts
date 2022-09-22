import { browser } from "$app/environment";
import { writable, type Writable } from "svelte/store";

interface SavedStore {
    <T>(name: string, defaultValue: T): Writable<T>;
    <T>(name: string, defaultValue?: T): Writable<T | undefined>;
}

export const savedStore: SavedStore = <T>(name: string, defaultValue?: T) => {
    const data = browser && localStorage.getItem(name);
    const parsed = data ? JSON.parse(data) : defaultValue;
    const store = writable<T>(parsed);
    store.subscribe(data => { if (browser) localStorage.setItem(name, JSON.stringify(data)); });
    return store;
};
