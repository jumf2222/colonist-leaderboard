import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const prerender = true;

export const load: PageLoad = ({ url }) => {
  if (url.pathname !== "/") {
    throw redirect(301, '/');
  }
};