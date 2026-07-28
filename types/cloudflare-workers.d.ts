declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface D1Database {}
