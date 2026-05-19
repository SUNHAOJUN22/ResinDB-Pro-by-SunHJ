import React, { useState } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "motion/react";
import { GripHorizontal } from "lucide-react";
import { WelcomeBanner } from "@/components/DashboardComponents";
import { DataGrid } from "@/components/DataGrid";
import { DashboardStats } from "@/components/DashboardStats";
import { ControlToolbar } from "@/components/ControlToolbar";
import { SystemAlert } from "@/components/SystemAlert";
import { MarketTrendsSection } from "@/components/MarketTrendsSection";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUI } from "@/contexts/UIContext";
import { useData } from "@/contexts/DataContext";
import { useModals } from "@/contexts/ModalContext";

const DEFAULT_LAYOUT = ["stats", "trends", "grid"];

const DraggableSection = ({ 
  itemKey, 
  className, 
  gripClassName = "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-opacity z-50",
  children 
}: { 
  itemKey: string; 
  className: string; 
  gripClassName?: string;
  children: React.ReactNode;
}) => {
  const controls = useDragControls();
  return (
    <Reorder.Item 
      value={itemKey} 
      className={className} 
      dragListener={false} 
      dragControls={controls}
    >
      <div 
        onPointerDown={(e) => controls.start(e)}
        className={gripClassName}
        style={{ touchAction: "none" }}
      >
        <GripHorizontal size={20} />
      </div>
      {children}
    </Reorder.Item>
  );
};

export const DashboardView = React.memo(() => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const {
    showWelcome,
    setShowWelcome,
    systemStatus,
    setSystemStatus,
    showSummary,
    setShowSummary,
  } = useUI();
  const {
    allProducts,
    filteredData,
    isLoading,
    isRefreshing,
    refreshData,
    columns,
    searchQuery,
    setSearchQuery,
    selectedIds,
    setSelectedIds,
    handleDelete,
    handleUpdate,
    handleBatchUpdate,
    selectSingleCategory,
    clearFilters,
    moveColumn,
    activeFilters,
  } = useData();
  const { setViewingProduct } = useModals();

  const [layoutOrder, setLayoutOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("resindb-dashboard-layout");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 3) return parsed;
      } catch {
        // ignore JSON parse error
      }
    }
    return DEFAULT_LAYOUT;
  });

  const handleReorder = (newOrder: string[]) => {
    setLayoutOrder(newOrder);
    localStorage.setItem("resindb-dashboard-layout", JSON.stringify(newOrder));
  };

  const renderLayoutItem = (key: string) => {
    switch (key) {
      case "stats":
        return (
          <DraggableSection key="stats" itemKey="stats" className="w-full relative group">
            <DashboardStats allProducts={allProducts} showSummary={showSummary} t={t} />
          </DraggableSection>
        );
      case "trends":
        return showSummary ? (
          <DraggableSection 
            key="trends" 
            itemKey="trends" 
            className="w-full relative group"
            gripClassName="absolute -left-6 top-6 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-opacity z-50"
          >
            <MarketTrendsSection products={allProducts} t={t} />
          </DraggableSection>
        ) : null;
      case "grid":
        return (
          <DraggableSection 
            key="grid" 
            itemKey="grid" 
            className="w-full flex-1 min-h-[400px] flex relative group"
            gripClassName="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-opacity z-50 w-6 flex justify-center items-center h-20 bg-slate-100/50 dark:bg-slate-800/50 rounded-r-none rounded-l-md border border-r-0 border-slate-200 dark:border-slate-700"
          >
            <div className="flex-1 min-h-0 flex relative">
              <div className="flex-1 min-h-0 min-w-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden relative">
                <DataGrid
                  data={filteredData}
                  columns={columns}
                  isLoading={isLoading}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  onBatchUpdate={handleBatchUpdate}
                  onCategorySelect={selectSingleCategory}
                  onSearchChange={setSearchQuery}
                  onViewDetails={setViewingProduct}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  onClearFilters={clearFilters}
                  activeFilters={activeFilters}
                  onMoveColumn={moveColumn}
                />
              </div>
            </div>
          </DraggableSection>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      key="dashboard-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute inset-0 flex flex-col gap-5 lg:gap-6 p-4 md:p-6 lg:p-8 pl-8 md:pl-10 overflow-x-hidden overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50"
    >
      <AnimatePresence mode="popLayout">
        {showWelcome && currentUser && (
          <motion.div
            key="dashboard-welcome-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 overflow-hidden"
          >
            <WelcomeBanner
              userName={currentUser.name}
              onDismiss={() => {
                setShowWelcome(false);
                localStorage.setItem("resindb-welcome-dismissed", "true");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <SystemAlert
        systemStatus={systemStatus}
        setSystemStatus={setSystemStatus}
        t={t}
      />

      <ControlToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isRefreshing={isRefreshing}
        handleRefreshStats={refreshData}
        showSummary={showSummary}
        setShowSummary={setShowSummary}
        t={t}
      />

      <Reorder.Group 
        axis="y" 
        values={layoutOrder} 
        onReorder={handleReorder} 
        className="flex-1 flex flex-col gap-5 lg:gap-6 min-h-0"
      >
        {layoutOrder.map((key) => renderLayoutItem(key))}
      </Reorder.Group>
    </motion.div>
  );
});
