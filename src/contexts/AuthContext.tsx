import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { User } from '@/types/index';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  updateUserProfile: (data: Partial<User> & { password?: string }) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem("resindb-session") : null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((user: User) => {
    setCurrentUser(user);
    localStorage.setItem("resindb-session", JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem("resindb-session");
  }, []);

  const updateUserProfile = useCallback((updatedData: Partial<User> & { password?: string }) => {
    if (!currentUser) return;
    const newUser = { ...currentUser, ...updatedData };
    setCurrentUser(newUser);
    localStorage.setItem('resindb-session', JSON.stringify(newUser));
  }, [currentUser]);

  const value = useMemo(() => ({
    currentUser,
    setCurrentUser,
    login,
    logout,
    isAuthenticated: !!currentUser,
    updateUserProfile,
  }), [
    currentUser,
    setCurrentUser,
    login,
    logout,
    updateUserProfile,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

 
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

