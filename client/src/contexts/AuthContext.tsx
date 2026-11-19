'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { getFirebaseAuth, googleAuthProvider, githubAuthProvider } from '@/lib/firebase';
import type { SecondFactorMethod, User } from '@/types/api';
import { authenticateWithPasskey } from '@/lib/passkey';
import { signInWithPopup, signOut, AuthProvider as FirebaseAuthProvider } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<TwoFactorChallenge>;
  loginWithGitHub: () => Promise<TwoFactorChallenge>;
  verifyTotp: (code: string) => Promise<void>;
  verifyPasskey: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface TwoFactorChallenge {
  twoFactorRequired: boolean;
  methods: SecondFactorMethod[];
  preferred: SecondFactorMethod | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const POPUP_TIMEOUT_MS = 60000;

const withPopupTimeout = <T,>(promise: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('The sign-in window did not complete. Please try again.')),
      POPUP_TIMEOUT_MS
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await api.getCurrentUser();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user?.planExpiresAt || user.plan === 'free') return;

    const checkExpiry = () => {
      const expiresAt = new Date(user.planExpiresAt!).getTime();
      if (Date.now() >= expiresAt) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                plan: 'free',
                isSubscribed: false,
                isPro: false,
                planExpiresAt: null,
              }
            : null
        );
        api.getCurrentUser().then((res) => {
          if (res.success && res.data?.user) {
            setUser(res.data.user);
          }
        }).catch(() => {});
      }
    };

    checkExpiry();
    const timer = setInterval(checkExpiry, 5000);
    return () => clearInterval(timer);
  }, [user?.planExpiresAt, user?.plan]);

  const loginWithProvider = async (provider: FirebaseAuthProvider): Promise<TwoFactorChallenge> => {
    const auth = getFirebaseAuth();

    try {
      const result = await withPopupTimeout(signInWithPopup(auth, provider));
      const idToken = await result.user.getIdToken();

      const response = await api.googleAuth({ idToken });

      // With 2FA on, the identity provider only earns a challenge — the session comes from a second factor.
      if (response.data?.twoFactorRequired) {
        return {
          twoFactorRequired: true,
          methods: response.data.methods || [],
          preferred: response.data.preferred ?? null,
        };
      }

      if (!response.success || !response.data?.user) {
        throw new Error(response.message || 'Social sign-in failed');
      }

      setUser(response.data.user);
      return { twoFactorRequired: false, methods: [], preferred: null };
    } catch (error: any) {
      if (error?.code === 'auth/account-exists-with-different-credential') {
        const other = provider === googleAuthProvider ? 'GitHub' : 'Google';
        throw new Error(`Your email is already linked to ${other}. Please sign in with ${other}.`);
      }
      console.error('Social login error:', error);
      throw error;
    } finally {
      await signOut(auth);
    }
  };

  const loginWithGoogle = () => loginWithProvider(googleAuthProvider);
  const loginWithGitHub = () => loginWithProvider(githubAuthProvider);

  const verifyTotp = async (code: string) => {
    const response = await api.verifyTotp({ code });

    if (!response.success || !response.data?.user) {
      throw new Error(response.message || 'Verification failed');
    }

    setUser(response.data.user);
  };

  const verifyPasskey = async () => {
    const response = await authenticateWithPasskey();

    if (!response.success || !response.data?.user) {
      throw new Error(response.message || 'Verification failed');
    }

    setUser(response.data.user);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginWithGitHub, verifyTotp, verifyPasskey, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};