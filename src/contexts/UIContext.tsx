import React, { createContext, useContext, useState } from "react";
import { AppView } from '@/types/index';
import { safeStorage } from '@/lib/utils';

interface UIContextType {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  showSidebar: boolean;
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  systemStatus: "online" | "syncing" | "error";
  setSystemStatus: (status: "online" | "syncing" | "error") => void;
  showWelcome: boolean;
  setShowWelcome: (show: boolean) => void;
  showSummary: boolean;
  setShowSummary: (show: boolean) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  isHistoryOpen: boolean;
  setHistoryOpen: (show: boolean) => void;
  clickFeedbackEnabled: boolean;
  setClickFeedbackEnabled: (enabled: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [showSidebar, setShowSidebar] = useState(true);
  const [systemStatus, setSystemStatus] = useState<"online" | "syncing" | "error">("online");
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return !safeStorage.local.getItem("resindb-welcome-dismissed");
    } catch {
      return true;
    }
  });
  const [showSummary, setShowSummary] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [clickFeedbackEnabled, setClickFeedbackEnabledState] = useState<boolean>(() => {
    try {
      const stored = safeStorage.local.getItem("resindb-click-feedback");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const setClickFeedbackEnabled = (enabled: boolean) => {
    setClickFeedbackEnabledState(enabled);
    try {
      safeStorage.local.setItem("resindb-click-feedback", String(enabled));
    } catch {
      // ignore
    }
  };

  return (
    <UIContext.Provider
      value={{
        activeView,
        setActiveView,
        showSidebar,
        setShowSidebar,
        systemStatus,
        setSystemStatus,
        showWelcome,
        setShowWelcome,
        showSummary,
        setShowSummary,
        showFilters,
        setShowFilters,
        isHistoryOpen,
        setHistoryOpen,
        clickFeedbackEnabled,
        setClickFeedbackEnabled,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

 
export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
};

// v3.1.0-sync

// v3.1.0-sync-fixed
