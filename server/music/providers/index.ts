import { env } from "cloudflare:workers";
import { JamendoProvider } from "./jamendo";
import type { MusicProvider, MusicProviderName } from "../types";

const DEFAULT_ALLOWED_LICENSES = [
  "https://creativecommons.org/publicdomain/zero/",
  "https://creativecommons.org/licenses/by/",
];

export function getProvider(name: string): MusicProvider {
  if (name !== "jamendo") throw new Error(`Unsupported music provider: ${name}`);
  if (!env.JAMENDO_CLIENT_ID) throw new Error("Jamendo is not configured. Add JAMENDO_CLIENT_ID to the runtime environment.");
  const prefixes = env.ALLOWED_LICENSE_URL_PREFIXES?.split(",").map((value) => value.trim()).filter(Boolean) ?? DEFAULT_ALLOWED_LICENSES;
  return new JamendoProvider(env.JAMENDO_CLIENT_ID, prefixes);
}

export function isProviderName(name: string): name is MusicProviderName {
  return name === "jamendo";
}
