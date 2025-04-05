import type { SketchfabAuth, SketchfabDownloadResult, SketchfabModel, SketchfabSearchResult } from "./types";

const SKETCHFAB_API_BASE = "https://api.sketchfab.com/v3";
const SKETCHFAB_SEARCH_URL = `${SKETCHFAB_API_BASE}/search`;

let authTokenCache: nully<SketchfabAuth> = null;
let authTokenExpiry: nully<number> = null;

export class Sketchfab {
  static async isAuthenticated(): Promise<boolean> {
    try {
      const response = await fetch("/api/auth/status");
      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.authenticated && data.expiresAt) {
        authTokenExpiry = data.expiresAt;

        // if token was refreshed, update local cache placeholder
        if (data.refreshed) {
          authTokenCache = {
            access_token: "valid_session_exists",
            expires_in: Math.floor((data.expiresAt - Date.now()) / 1000),
            token_type: "bearer",
          };
        }
      }

      return data.authenticated === true;
    } catch (error) {
      console.error("Error checking authentication status:", error);
      return false;
    }
  }

  static getLoginUrl(): string | null {
    if (typeof window !== "undefined") {
      const clientId = process.env.NEXT_PUBLIC_SKETCHFAB_CLIENT_ID;
      const redirectUri = process.env.NEXT_PUBLIC_SKETCHFAB_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        console.error("Missing OAuth configuration");
        return null;
      }

      return `https://sketchfab.com/oauth2/authorize/?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
    }

    return null;
  }

  static async authenticate(): Promise<SketchfabAuth | null> {
    // check if there's a valid token in the cache
    if (authTokenCache && authTokenExpiry && Date.now() < authTokenExpiry) {
      return authTokenCache;
    }

    try {
      const authStatus = await Sketchfab.isAuthenticated();
      if (!authStatus) return null;

      // for authenticated requests, we'll use the token that's stored in cookies
      // the actual token is managed by the server and not exposed to the client
      // this is just a placeholder to indicate we have a valid auth session
      authTokenCache = {
        access_token: "valid_session_exists",
        expires_in: authTokenExpiry ? Math.floor((authTokenExpiry - Date.now()) / 1000) : 3600,
        token_type: "bearer",
      };

      // if we don't have an expiry time from the server, set a default
      if (!authTokenExpiry) {
        authTokenExpiry = Date.now() + 3600 * 1000;
      }

      return authTokenCache;
    } catch (error) {
      console.error("Authentication error:", error);
      return null;
    }
  }

  static async searchModels(
    query: string,
    options: {
      cursor?: string;
      categories?: string[];
      count?: number;
      downloadable?: boolean;
      sortBy?: string;
    } = {}
  ): Promise<SketchfabSearchResult | null> {
    try {
      const params = new URLSearchParams({
        q: query,
        type: "models",
        count: options.count?.toString() || "24",
        archives_flavours: "false",
      });

      if (options.downloadable) params.append("downloadable", "true");
      if (options.cursor) params.append("cursor", options.cursor);
      if (options.categories && options.categories.length > 0) params.append("categories", options.categories.join(","));

      const response = await fetch(`${SKETCHFAB_SEARCH_URL}?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);

      const data = await response.json();
      return {
        results: data.results || [],
        next: data.next || null,
        previous: data.previous || null,
        totalCount: data.totalCount || data.results.length,
      };
    } catch (error) {
      console.error("Sketchfab search error:", error);
      return null;
    }
  }

  static async getModelDetails(modelId: string): Promise<SketchfabModel | null> {
    try {
      const response = await fetch(`${SKETCHFAB_API_BASE}/models/${modelId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch model details: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching model details:", error);
      return null;
    }
  }

  static async downloadModel(modelId: string): Promise<string | null> {
    try {
      const isAuth = await Sketchfab.isAuthenticated();
      if (!isAuth) {
        throw new Error("Authentication required to download models");
      }

      // we need to make an authenticated request to the server
      // the server will use the stored token to download the model
      const response = await fetch(`/api/download?modelId=${modelId}`, {
        method: "GET",
        // include cookies for auth
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Download failed: ${error}`);
      }

      const data = (await response.json()) as SketchfabDownloadResult;
      return data.downloadUrl;
    } catch (error) {
      console.error("Download error:", error);
      return null;
    }
  }

  static async getFeaturedModels(count = 12): Promise<SketchfabSearchResult | null> {
    try {
      const params = new URLSearchParams({
        sort_by: "-publishedAt",
        count: count.toString(),
        downloadable: "true",
        type: "models",
      });

      const response = await fetch(`${SKETCHFAB_API_BASE}/models?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch featured models: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        results: data.results || [],
        next: data.next || null,
        previous: data.previous || null,
        totalCount: data.totalCount || data.results.length,
      };
    } catch (error) {
      console.error("Error fetching featured models:", error);
      return null;
    }
  }
}
