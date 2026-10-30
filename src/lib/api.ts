// The compiler server only allows requests from the production domain, so other
// origins (preview, lovable.app) go through the backend proxy function.
const DIRECT_URL = import.meta.env.VITE_API_URL || 'https://compiler-backend-perc.onrender.com';
const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compiler-proxy`;
const isProdDomain =
  typeof window !== 'undefined' && /(^|\.)javalabs\.tech$/.test(window.location.hostname);

export const API_BASE_URL = isProdDomain ? DIRECT_URL : PROXY_URL;
