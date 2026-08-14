// @types/webextension-polyfill is generated from Mozilla's schemas and has not
// been regenerated since publicSuffix landed, so it is declared here instead.
// Merging into the polyfill's own Browser interface keeps `browser` fully
// typed, which a local `declare const browser` would shadow.
declare module 'webextension-polyfill' {
  namespace PublicSuffix {
    interface GetDomainOptions {
      /** treat a suffix the list does not know as a suffix anyway */
      allowUnknownSuffix?: boolean;
      allowIPAddress?: boolean;
      allowPlainSuffix?: boolean;
    }

    interface Static {
      /**
       * Registrable domain (eTLD+1) of hostname, or null when there is none.
       *
       * Permissions: "publicSuffix"
       */
      getDomain(hostname: string, options?: GetDomainOptions): string | null;

      /**
       * Public suffix of hostname, or null when it is not a known one.
       *
       * Permissions: "publicSuffix"
       */
      getKnownSuffix(hostname: string): string | null;

      /**
       * Permissions: "publicSuffix"
       */
      isKnownSuffix(hostname: string): boolean;
    }
  }

  interface Browser {
    publicSuffix: PublicSuffix.Static;
  }
}

export {};
