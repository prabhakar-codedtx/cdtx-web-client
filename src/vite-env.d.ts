/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PRODUCT: string;
  readonly VITE_DT: string;
  readonly VITE_DETAIL_PAGES: string;
  readonly VITE_DEFAULT_REGION: string;
  readonly VITE_DEFAULT_LOCALE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
