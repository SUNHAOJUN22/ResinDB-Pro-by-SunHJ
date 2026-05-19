import React, { createContext, useContext, useState } from "react";
import { AppView } from "../types";

interface UIContextType {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
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
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [showSidebar, setShowSidebar] = useState(true);
  const [systemStatus, setSystemStatus] = useState<"online" | "syncing" | "error">("online");
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem("resindb-welcome-dismissed")
  );
  const [showSummary, setShowSummary] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);

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
