import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).substring(2, 9)}`;
}

export const safeStorage = {
  local: {
    getItem(key: string): string | null {
      try {
        return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof window !== 'undefined') localStorage.setItem(key, value);
      } catch {
        // Safe fail
      }
    },
    removeItem(key: string): void {
      try {
        if (typeof window !== 'undefined') localStorage.removeItem(key);
      } catch {
        // Safe fail
      }
    },
    clear(): void {
      try {
        if (typeof window !== 'undefined') localStorage.clear();
      } catch {
        // Safe fail
      }
    }
  },
  session: {
    getItem(key: string): string | null {
      try {
        return typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof window !== 'undefined') sessionStorage.setItem(key, value);
      } catch {
        // Safe fail
      }
    },
    removeItem(key: string): void {
      try {
        if (typeof window !== 'undefined') sessionStorage.removeItem(key);
      } catch {
        // Safe fail
      }
    },
    clear(): void {
      try {
        if (typeof window !== 'undefined') sessionStorage.clear();
      } catch {
        // Safe fail
      }
    }
  }
};
