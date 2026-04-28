/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_STARTER_LATITUDE?: string;
  readonly VITE_STARTER_LONGITUDE?: string;
  readonly VITE_STARTER_NAME?: string;
  readonly VITE_STARTER_ADMIN1?: string;
  readonly VITE_STARTER_COUNTRY?: string;
  readonly VITE_STARTER_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
