/**
 * Production JWT authentication client for React Native Expo.
 * Security: Tokens stored in Secure Storage (not AsyncStorage - debuggable).
 * Authentication flow: httpOnly cookies + in-memory access tokens.
 */

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { BACKEND_URL } from "../constants/config";

// ============================================================================
// Constants
// ============================================================================

const SECURE_STORAGE_KEY_ACCESS_TOKEN = "system_access_token";
const SECURE_STORAGE_KEY_USER_ID = "system_user_id";
const SECURE_STORAGE_KEY_TOKEN_EXPIRY = "system_token_expiry";

// Fallback for web platform (doesn't support SecureStore)
const MEMORY_FALLBACK: Map<string, string> = new Map();

// ============================================================================
// SecureAuthClient class
// ============================================================================

export class SecureAuthClient {
  /**
   * Modern approach to authentication:
   * 1. Access token: Short-lived (30 min), stored in memory on mobile
   * 2. Refresh token: Long-lived (7 days), stored in httpOnly cookie (browser)
   * 3. On app startup: Use refresh token to get new access token
   *
   * NEVER store tokens in AsyncStorage (Android debuggable via adb shell):
   *   $ adb shell
   *   $ cat /data/data/com.example.app/cache/RKStorage/index.json
   *   → Tokens exposed in plaintext
   *
   * ALWAYS use SecureStore (Android: Keystore, iOS: Keychain):
   *   - Encrypted, isolated per app
   *   - Cannot export via USB debugging
   */

  /**
   * Store access token in secure storage.
   * Called after login or refresh.
   */
  static async setAccessToken(accessToken: string, expiryMs: number): Promise<void> {
    try {
      if (Platform.OS === "web") {
        // Web: store in memory (loses on page reload - force re-login)
        MEMORY_FALLBACK.set(SECURE_STORAGE_KEY_ACCESS_TOKEN, accessToken);
        MEMORY_FALLBACK.set(SECURE_STORAGE_KEY_TOKEN_EXPIRY, expiryMs.toString());
      } else {
        // Mobile: SecureStore (encrypted)
        await SecureStore.setItemAsync(SECURE_STORAGE_KEY_ACCESS_TOKEN, accessToken);
        await SecureStore.setItemAsync(SECURE_STORAGE_KEY_TOKEN_EXPIRY, expiryMs.toString());
      }
    } catch (error) {
      console.error("[AUTH_ERROR] Failed to store access token:", error);
      throw error;
    }
  }

  /**
   * Retrieve access token from secure storage.
   * Returns null if not found or expired.
   */
  static async getAccessToken(): Promise<string | null> {
    try {
      let token: string | null;
      let expiryMs: string | null;

      if (Platform.OS === "web") {
        token = MEMORY_FALLBACK.get(SECURE_STORAGE_KEY_ACCESS_TOKEN) || null;
        expiryMs = MEMORY_FALLBACK.get(SECURE_STORAGE_KEY_TOKEN_EXPIRY) || null;
      } else {
        token = await SecureStore.getItemAsync(SECURE_STORAGE_KEY_ACCESS_TOKEN);
        expiryMs = await SecureStore.getItemAsync(SECURE_STORAGE_KEY_TOKEN_EXPIRY);
      }

      if (!token || !expiryMs) {
        return null;
      }

      // Check if token expired
      const now = Date.now();
      const expiry = parseInt(expiryMs, 10);

      if (now > expiry) {
        console.log("[AUTH] Access token expired, needs refresh");
        await SecureAuthClient.clearAccessToken();
        return null;
      }

      return token;
    } catch (error) {
      console.error("[AUTH_ERROR] Failed to retrieve access token:", error);
      return null;
    }
  }

  /**
   * Clear access token from secure storage.
   * Called on logout or token refresh.
   */
  static async clearAccessToken(): Promise<void> {
    try {
      if (Platform.OS === "web") {
        MEMORY_FALLBACK.delete(SECURE_STORAGE_KEY_ACCESS_TOKEN);
        MEMORY_FALLBACK.delete(SECURE_STORAGE_KEY_TOKEN_EXPIRY);
      } else {
        await SecureStore.deleteItemAsync(SECURE_STORAGE_KEY_ACCESS_TOKEN);
        await SecureStore.deleteItemAsync(SECURE_STORAGE_KEY_TOKEN_EXPIRY);
      }
    } catch (error) {
      console.error("[AUTH_ERROR] Failed to clear access token:", error);
    }
  }

  /**
   * Store user ID for reference (non-sensitive).
   */
  static async setUserId(userId: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        MEMORY_FALLBACK.set(SECURE_STORAGE_KEY_USER_ID, userId);
      } else {
        await SecureStore.setItemAsync(SECURE_STORAGE_KEY_USER_ID, userId);
      }
    } catch (error) {
      console.error("[AUTH_ERROR] Failed to store user ID:", error);
    }
  }

  /**
   * Retrieve stored user ID.
   */
  static async getUserId(): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return MEMORY_FALLBACK.get(SECURE_STORAGE_KEY_USER_ID) || null;
      }
      return await SecureStore.getItemAsync(SECURE_STORAGE_KEY_USER_ID);
    } catch (error) {
      console.error("[AUTH_ERROR] Failed to retrieve user ID:", error);
      return null;
    }
  }

  /**
   * Clear user ID on logout.
   */
  static async clearUserId(): Promise<void> {
    try {
      if (Platform.OS === "web") {
        MEMORY_FALLBACK.delete(SECURE_STORAGE_KEY_USER_ID);
      } else {
        await SecureStore.deleteItemAsync(SECURE_STORAGE_KEY_USER_ID);
      }
    } catch (error) {
      console.error("[AUTH_ERROR] Failed to clear user ID:", error);
    }
  }

  /**
   * Login: authenticate with username + password.
   *
   * Flow:
   * 1. POST /api/auth/login { username, password }
   * 2. Server responds with access_token + sets refresh_token httpOnly cookie
   * 3. Client stores access_token in SecureStore with expiry (30 min from now)
   * 4. Browser automatically stores refresh_token cookie
   *
   * WHY credentials: 'include':
   * - Tells fetch to include all cookies (refresh_token) in request
   * - Required for httpOnly cookie flow
   */
  static async login(username: string, password: string): Promise<{
    success: boolean;
    user_id: string;
    access_token: string;
  }> {
    try {
      console.log("[AUTH] Attempting login for", username);

      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // CRITICAL: include cookies (refresh_token)
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();
      const { user_id, access_token } = data;

      if (!access_token) {
        throw new Error("No access token received");
      }

      // Calculate expiry: 30 minutes from now (same as server TTL)
      const expiryMs = Date.now() + 30 * 60 * 1000;

      // Store in secure storage
      await SecureAuthClient.setAccessToken(access_token, expiryMs);
      await SecureAuthClient.setUserId(user_id);

      // Remove old AsyncStorage session (cleanup)
      try {
        await AsyncStorage.removeItem("user_session");
      } catch {}

      console.log("[AUTH_SUCCESS] Login successful for user", user_id);

      return {
        success: true,
        user_id,
        access_token,
      };
    } catch (error) {
      console.error("[AUTH_ERROR] Login failed:", error);
      throw error;
    }
  }

  /**
   * Refresh: get new access token using refresh_token cookie.
   *
   * Called:
   * - On app startup (restore session)
   * - When access token is near expiry
   * - When a 401 Unauthorized response received
   *
   * Flow:
   * 1. POST /api/auth/refresh with httpOnly cookie (automatic via credentials: 'include')
   * 2. Server verifies refresh_token
   * 3. Server issues new access_token
   * 4. Client stores new access_token
   *
   * WHY: Access token expires every 30 min. Without refresh, user gets 401 after 30 min.
   * Refresh token can be revoked server-side (on logout), access token cannot.
   */
  static async refresh(): Promise<{ access_token: string } | null> {
    try {
      console.log("[AUTH] Attempting to refresh access token");

      const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include", // CRITICAL: include refresh_token cookie
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log("[AUTH] Refresh token invalid or revoked");
          await SecureAuthClient.clearAll();
          return null;
        }
        throw new Error(`Refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      const { access_token } = data;

      if (!access_token) {
        throw new Error("No access token in refresh response");
      }

      // Store new access token
      const expiryMs = Date.now() + 30 * 60 * 1000;
      await SecureAuthClient.setAccessToken(access_token, expiryMs);

      console.log("[AUTH_SUCCESS] Token refreshed");

      return { access_token };
    } catch (error) {
      console.error("[AUTH_ERROR] Refresh failed:", error);
      return null;
    }
  }

  /**
   * Logout: invalidate tokens and clear storage.
   *
   * Flow:
   * 1. POST /api/auth/logout with access token
   * 2. Server deletes refresh_token cookie
   * 3. Server marks refresh_token as revoked in database
   * 4. Client clears access_token from SecureStore
   * 5. Browser automatically deletes refresh_token cookie
   *
   * WHY: No way for attacker to use stolen tokens after logout.
   */
  static async logout(): Promise<void> {
    try {
      console.log("[AUTH] Attempting logout");

      const accessToken = await SecureAuthClient.getAccessToken();
      if (!accessToken) {
        console.warn("[AUTH] No access token found, clearing locally");
        await SecureAuthClient.clearAll();
        return;
      }

      // Try to revoke server-side
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
        });

        if (!response.ok) {
          console.warn("[AUTH] Logout API failed:", response.statusText);
        }
      } catch (error) {
        console.error("[AUTH_ERROR] Logout API error:", error);
        // Continue with local cleanup even if API fails
      }

      // Clear local storage
      await SecureAuthClient.clearAll();

      console.log("[AUTH_SUCCESS] Logout complete");
    } catch (error) {
      console.error("[AUTH_ERROR] Logout error:", error);
      // Ensure local cleanup happens
      await SecureAuthClient.clearAll();
    }
  }

  /**
   * Clear all authentication data from storage.
   */
  static async clearAll(): Promise<void> {
    try {
      await SecureAuthClient.clearAccessToken();
      await SecureAuthClient.clearUserId();

      // Clear old AsyncStorage auth data
      try {
        await AsyncStorage.removeItem("user_session");
        await AsyncStorage.removeItem("access_token");
        await AsyncStorage.removeItem("user_id");
      } catch {}
    } catch (error) {
      console.error("[AUTH_ERROR] Failed to clear all auth data:", error);
    }
  }

  /**
   * Get Authorization header for API requests.
   *
   * Usage:
   *   const headers = await SecureAuthClient.getAuthHeader();
   *   fetch(url, { headers })
   *
   * Returns null if no valid token (user must re-login).
   */
  static async getAuthHeader(): Promise<{ Authorization: string } | null> {
    const token = await SecureAuthClient.getAccessToken();
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Check if user is authenticated (has valid access token).
   *
   * Usage:
   *   const isLoggedIn = await SecureAuthClient.isAuthenticated();
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await SecureAuthClient.getAccessToken();
    return !!token;
  }

  /**
   * Restore session on app startup.
   *
   * Flow:
   * 1. Check if access token exists and is valid
   * 2. If expired/missing, try to refresh using refresh_token cookie
   * 3. If refresh fails, return null (user must re-login)
   * 4. If refresh succeeds, return user data
   *
   * Usage in app root (_layout.tsx):
   *   const [user, setUser] = useState(null);
   *
   *   useEffect(() => {
   *     SecureAuthClient.restoreSession().then(setUser);
   *   }, []);
   */
  static async restoreSession(): Promise<{ user_id: string } | null> {
    try {
      console.log("[AUTH] Restoring session on app startup");

      // Check if access token is valid
      const accessToken = await SecureAuthClient.getAccessToken();
      if (accessToken) {
        console.log("[AUTH_SUCCESS] Session restored from stored token");
        const user_id = await SecureAuthClient.getUserId();
        return user_id ? { user_id } : null;
      }

      // Try to refresh using refresh_token cookie
      console.log("[AUTH] Access token missing/expired, attempting refresh");
      const refreshed = await SecureAuthClient.refresh();
      if (!refreshed) {
        console.log("[AUTH] Refresh failed, user must re-login");
        return null;
      }

      const user_id = await SecureAuthClient.getUserId();
      console.log("[AUTH_SUCCESS] Session restored via refresh");
      return user_id ? { user_id } : null;
    } catch (error) {
      console.error("[AUTH_ERROR] Session restore failed:", error);
      return null;
    }
  }
}

// ============================================================================
// HTTP interceptor for automatic token refresh on 401
// ============================================================================

/**
 * Wrap API calls to automatically refresh token on 401 Unauthorized.
 *
 * Usage:
 *   const response = await authFetch(url, options);
 *
 * If server returns 401:
 * 1. Attempt to refresh access token
 * 2. Retry the original request
 * 3. If refresh fails, return 401 (user must re-login)
 */
export async function authFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Get auth header if available
  const authHeader = await SecureAuthClient.getAuthHeader();

  const headers = {
    ...options?.headers,
    ...(authHeader || {}),
  };

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Include refresh_token cookie
  });

  // If 401 Unauthorized, try to refresh and retry
  if (response.status === 401) {
    console.log("[AUTH] Received 401, attempting token refresh");

    const refreshed = await SecureAuthClient.refresh();
    if (refreshed) {
      // Retry with new token
      const newAuthHeader = await SecureAuthClient.getAuthHeader();
      const newHeaders = {
        ...options?.headers,
        ...newAuthHeader,
      };

      response = await fetch(url, {
        ...options,
        headers: newHeaders,
        credentials: "include",
      });
    }
  }

  return response;
}

// ============================================================================
// Export for use in context providers
// ============================================================================

export default SecureAuthClient;
