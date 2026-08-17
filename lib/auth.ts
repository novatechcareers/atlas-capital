export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'suspended';

export type UserAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
};

export type AuthSession = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
};

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  password: string;
  confirmPassword: string;
};

export const ACCOUNTS_KEY = 'atlas-accounts';
export const SESSION_KEY = 'atlas-session';

import { supabase } from './supabase.ts';

export const SUPPORT_EMAIL = 'workdaysupport.novatech@gmail.com';

// Admin credentials may be provided via NEXT_PUBLIC_ env vars for local/demo use.
// These are intentionally NEXT_PUBLIC_ so the login helper (client-side) can access them.
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'admin@atlascapital.com';
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'Admin@123!';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hasValidPassword(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password.trim());
}

export async function hashPassword(password: string) {
  if (typeof window === 'undefined' || !globalThis.crypto?.subtle) {
    return password;
  }

  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getStoredAccounts(): UserAccount[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredAccounts(accounts: UserAccount[]) {
  if (typeof window === 'undefined') {
    return accounts;
  }

  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  return accounts;
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AuthSession;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function getCurrentAccountId() {
  return getSession()?.id ?? null;
}

export function getUserStorageKey(baseKey: string, userId?: string | null) {
  const resolvedId = userId ?? getCurrentAccountId() ?? getSelectedAdminUserId() ?? 'guest';
  return `${baseKey}-${resolvedId}`;
}

export function getSelectedAdminUserId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem('atlas-selected-admin-user');
}

export function setSelectedAdminUserId(userId: string | null) {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!userId) {
    window.sessionStorage.removeItem('atlas-selected-admin-user');
    return null;
  }

  window.sessionStorage.setItem('atlas-selected-admin-user', userId);
  return userId;
}

export function getSelectedAdminUser() {
  const selectedUserId = getSelectedAdminUserId();
  if (!selectedUserId) {
    return null;
  }

  return getAccountById(selectedUserId);
}

export function getScopedStorageKey(baseKey: string, userId = getSelectedAdminUserId()) {
  return `${baseKey}-${userId ?? 'guest'}`;
}

export function clearStaleLocalUserState(currentUserId: string) {
  if (typeof window === 'undefined') return;

  const prefixes = [
    'atlas-balance-',
    'atlas-subscriptions-',
    'atlas-verify-',
    'atlas-withdrawal-requests-',
    'atlas-withdrawal-fee-',
    'atlas-auto-trade-',
    'atlas-live-trade-',
    'atlas-profile-',
    'atlas-profile-lock-',
    'atlas-admin-funding-history-',
  ];

  const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter(Boolean) as string[];
  for (const key of keys) {
    const matchesPrefix = prefixes.some((prefix) => key.startsWith(prefix));
    const stillCurrent = key.endsWith(`-${currentUserId}`) || key === `${currentUserId}`;
    if (matchesPrefix && !stillCurrent) {
      window.localStorage.removeItem(key);
    }
  }
}

export function setSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return session;
  }

  clearStaleLocalUserState(session.id);
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(SESSION_KEY);
}

export function getAccountById(accountId: string) {
  return getStoredAccounts().find((account) => account.id === accountId) ?? null;
}

export function updateAccount(accountId: string, updates: Partial<UserAccount>) {
  const accounts = getStoredAccounts();
  const index = accounts.findIndex((account) => account.id === accountId);

  if (index === -1) {
    return null;
  }

  const updated = { ...accounts[index], ...updates };
  accounts[index] = updated;
  saveStoredAccounts(accounts);
  return updated;
}

export async function registerAccount(input: RegisterInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizeEmail(input.email);
  const phone = input.phone.trim();
  const country = input.country.trim();

  if (!firstName || !lastName || !email || !phone || !country) {
    throw new Error('Please complete all required account fields.');
  }

  if (!hasValidPassword(input.password)) {
    throw new Error('Password must be at least 6 characters long and include both letters and numbers.');
  }

  if (input.password !== input.confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  // If Supabase is configured, use Supabase Auth to sign up
  try {
    if (supabase) {
      // @ts-ignore
      const { data, error } = await supabase.auth.signUp({ email, password: input.password }, { data: { firstName, lastName, phone, country } });
      if (error) throw error;
      const createdUser = data?.user;

      if (createdUser?.id) {
        // attempt to create a profiles row server-side using the service role key
        try {
          await fetch('/api/create-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: createdUser.id, firstName, lastName, phone, country, email, password: input.password }),
          });
        } catch (e) {
          // ignore — profile creation is best-effort
          console.warn('create-profile API call failed:', e);
        }
      }

      return {
        id: createdUser?.id ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        firstName,
        lastName,
        email,
        phone,
        country,
        passwordHash: await hashPassword(input.password),
        role: 'user',
        status: 'pending',
        createdAt: new Date().toISOString(),
      } as UserAccount;
    }
  } catch (err) {
    console.warn('Supabase signup failed, falling back to local storage:', err);
  }

  const accounts = getStoredAccounts();
  const emailInUse = accounts.some((account) => account.email === email);
  if (emailInUse) {
    throw new Error('An account with this email already exists.');
  }

  const newUser: UserAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    firstName,
    lastName,
    email,
    phone,
    country,
    passwordHash: await hashPassword(input.password),
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  saveStoredAccounts([...accounts, newUser]);
  return newUser;
}

export async function loginAccount(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return {
      user: {
        id: 'admin-system',
        email: ADMIN_EMAIL,
        role: 'admin' as const,
        name: 'Atlas Admin',
      },
      isAdmin: true,
    };
  }
  // Try Supabase auth first if available
  try {
    if (supabase) {
      // @ts-ignore
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (!error && data?.user) {
        const u = data.user;
        let role: UserRole = 'user';
        let name = (u.user_metadata?.firstName && u.user_metadata?.lastName)
          ? `${u.user_metadata.firstName} ${u.user_metadata.lastName}`
          : (u.email as string) ?? normalizedEmail;

        try {
          // @ts-ignore
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role, first_name, last_name')
            .eq('id', u.id)
            .maybeSingle();

          if (!profileError && profileData) {
            role = profileData.role === 'admin' ? 'admin' : 'user';
            const profileName = [profileData.first_name, profileData.last_name].filter(Boolean).join(' ').trim();
            if (profileName) {
              name = profileName;
            }
          }
        } catch {
          role = 'user';
        }

        return {
          user: {
            id: u.id,
            email: (u.email as string) ?? normalizedEmail,
            role,
            name,
          },
          isAdmin: role === 'admin',
        };
      }
      if (error) {
        console.warn('Supabase login error:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase login failed, falling back to local storage:', err);
  }

  const accounts = getStoredAccounts();
  const existingUser = accounts.find((account) => account.email === normalizedEmail);

  if (!existingUser) {
    return { user: null, isAdmin: false };
  }

  const hashedPassword = await hashPassword(password);
  if (existingUser.passwordHash !== hashedPassword) {
    return { user: null, isAdmin: false };
  }

  return {
    user: {
      id: existingUser.id,
      email: existingUser.email,
      role: existingUser.role,
      name: `${existingUser.firstName} ${existingUser.lastName}`,
    },
    isAdmin: false,
  };
}
