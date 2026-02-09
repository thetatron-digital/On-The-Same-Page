// ============================================
// GOOGLE AUTHENTICATION SERVICE
// ============================================
// Uses Google Identity Services for OAuth 2.0
// Completely free - no server costs

import { GOOGLE_CONFIG, STORAGE_KEYS, type User } from '../types/user';

// Type declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (notification?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
            getNotDisplayedReason: () => string;
            getSkippedReason: () => string;
            getDismissedReason: () => string;
          }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
            }
          ) => void;
          disableAutoSelect: () => void;
          revoke: (email: string, callback: () => void) => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string; message: string }) => void;
          }) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
          hasGrantedAllScopes: (tokenResponse: TokenResponse, ...scopes: string[]) => boolean;
        };
      };
    };
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

// Callback type for auth state changes
type AuthCallback = (user: User | null) => void;

class GoogleAuthService {
  private tokenClient: TokenClient | null = null;
  private callbacks: Set<AuthCallback> = new Set();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Initialize the Google Identity Services library
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      // Check if client ID is configured
      if (!GOOGLE_CONFIG.CLIENT_ID) {
        console.warn('Google Client ID not configured. Cloud features will be disabled.');
        this.isInitialized = true;
        resolve();
        return;
      }

      // Load Google Identity Services script
      if (!document.getElementById('google-gsi-script')) {
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;

        script.onload = () => {
          this.setupTokenClient();
          this.isInitialized = true;
          resolve();
        };

        script.onerror = () => {
          console.error('Failed to load Google Identity Services');
          this.isInitialized = true;
          resolve(); // Still resolve to allow offline usage
        };

        document.head.appendChild(script);
      } else if (window.google?.accounts) {
        this.setupTokenClient();
        this.isInitialized = true;
        resolve();
      } else {
        // Script exists but not loaded yet, wait for it
        const checkGoogle = setInterval(() => {
          if (window.google?.accounts) {
            clearInterval(checkGoogle);
            this.setupTokenClient();
            this.isInitialized = true;
            resolve();
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkGoogle);
          this.isInitialized = true;
          resolve();
        }, 10000);
      }
    });

    return this.initPromise;
  }

  private setupTokenClient(): void {
    if (!window.google?.accounts?.oauth2 || !GOOGLE_CONFIG.CLIENT_ID) return;

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.CLIENT_ID,
      scope: GOOGLE_CONFIG.SCOPES,
      callback: (response) => this.handleTokenResponse(response),
      error_callback: (error) => {
        console.error('OAuth error:', error);
        this.notifyCallbacks(null);
      },
    });
  }

  private async handleTokenResponse(response: TokenResponse): Promise<void> {
    if (response.error) {
      console.error('Token error:', response.error_description);
      this.notifyCallbacks(null);
      return;
    }

    try {
      // Fetch user info
      const userInfo = await this.fetchUserInfo(response.access_token);

      const user: User = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        accessToken: response.access_token,
        expiresAt: Date.now() + response.expires_in * 1000,
      };

      // Save to local storage
      this.saveUser(user);
      this.notifyCallbacks(user);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      this.notifyCallbacks(null);
    }
  }

  private async fetchUserInfo(accessToken: string): Promise<{
    id: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return response.json();
  }

  // Sign in with Google
  signIn(): void {
    if (!this.tokenClient) {
      console.error('Google Auth not initialized or Client ID not configured');
      return;
    }

    this.tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  // Sign out
  signOut(): void {
    const user = this.getStoredUser();

    if (user?.accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(user.accessToken, () => {
        console.log('Token revoked');
      });
    }

    // Clear local storage
    localStorage.removeItem(STORAGE_KEYS.USER);
    this.notifyCallbacks(null);
  }

  // Get stored user from local storage
  getStoredUser(): User | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER);
      if (!stored) return null;

      const user: User = JSON.parse(stored);

      // Check if token is expired
      if (user.expiresAt && Date.now() >= user.expiresAt) {
        console.log('Token expired');
        localStorage.removeItem(STORAGE_KEYS.USER);
        return null;
      }

      return user;
    } catch {
      return null;
    }
  }

  // Save user to local storage
  private saveUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  // Refresh token if needed
  async refreshTokenIfNeeded(): Promise<User | null> {
    const user = this.getStoredUser();
    if (!user) return null;

    // If token expires in less than 5 minutes, refresh it
    const fiveMinutes = 5 * 60 * 1000;
    if (user.expiresAt && Date.now() >= user.expiresAt - fiveMinutes) {
      // Request new token silently
      return new Promise((resolve) => {
        if (!this.tokenClient) {
          resolve(null);
          return;
        }

        this.tokenClient.requestAccessToken({ prompt: '' });

        // The callback will update the user, we just need to wait
        setTimeout(() => {
          resolve(this.getStoredUser());
        }, 3000);
      });
    }

    return user;
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: AuthCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(user: User | null): void {
    this.callbacks.forEach((callback) => callback(user));
  }

  // Check if client ID is configured
  isConfigured(): boolean {
    return !!GOOGLE_CONFIG.CLIENT_ID;
  }

  // Get access token for API calls
  async getAccessToken(): Promise<string | null> {
    const user = await this.refreshTokenIfNeeded();
    return user?.accessToken || null;
  }
}

// Singleton instance
export const googleAuth = new GoogleAuthService();
