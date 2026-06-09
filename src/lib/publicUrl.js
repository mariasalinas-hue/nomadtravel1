// Base URL for public, client-facing links.
//
// Must be the public PRODUCTION domain — not window.location.origin, because
// when an agent is on a Vercel preview/deployment URL (e.g.
// nomadtravel1-<hash>-<team>.vercel.app) those are protected by a Vercel login,
// so any link built from them would ask the client to log in.
export const PUBLIC_BASE_URL = 'https://nomadtravel1.vercel.app';
