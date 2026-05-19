import React, {
  useState,
  useMemo,
  useCallback,
  Suspense,
  lazy,
  memo,
} from "react";

// --- ResizeObserver Error Suppression ---
// We suppress the Vite error overlay for ResizeObserver loop errors instead of patching ResizeObserver,
// because patching ResizeObserver with requestAnimationFrame breaks @tanstack/react-virtual synchronous layout during zoom/resize.
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    if (
      e.message === "ResizeObserver loop limit exceeded" ||
      e.message ===
        "ResizeObserver loop completed with undelivered notifications."
    ) {
      // e.stopImmediatePropagation() sometimes doesn't stop Vite's overlay,
      // so we actively remove it if it pops up.
      const overlay = document.querySelector("vite-error-overlay");
      if (overlay) overlay.remove();
    }
  });
}

import { CATEGORY_TREE } from "../constants";
import {
  Manufacturer,
} from "../types";
import { TreeSidebar } from "./TreeSidebar";
import { TopBar } from "./TopBar";
import { AuthScreen } from "./AuthScreen";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";


import { LanguageProvider, useLanguage } from "../contexts/LanguageContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useToasts } from "../contexts/ToastContext";
import { useUI } from "../contexts/UIContext";
import { useData } from "../contexts/DataContext";
import { useModals } from "../contexts/ModalContext";

// New Components
import { ToastContainer } from "./ToastContainer";
import { BatchActionBar } from "./BatchActionBar";
import { useShortcuts } from "../hooks/useShortcuts";
import { useSavedViews } from "../hooks/useSavedViews";
import { useExportData } from "../hooks/useExportData";

// Lazy loaded modals and heavy components
const FilterPanel = lazy(() =>
  import("./FilterPanel").then((m) => ({ default: m.FilterPanel })),
);
const ImportModal = lazy(() =>
  import("./ImportModal").then((m) => ({ default: m.ImportModal })),
);
const ProfileModal = lazy(() =>
  import("./ProfileModal").then((m) => ({ default: m.ProfileModal })),
);
const AdminModal = lazy(() =>
  import("./AdminModal").then((m) => ({ default: m.AdminModal })),
);
const ProductDetailDrawer = lazy(() =>
  import("./ProductDetailDrawer").then((m) => ({
    default: m.ProductDetailDrawer,
  })),
);
const ComparisonView = lazy(() =>
  import("./ComparisonView").then((m) => ({ default: m.ComparisonView })),
);
const PivotView = lazy(() =>
  import("./PivotView").then((m) => ({ default: m.PivotView })),
);
const BatchEditModal = lazy(() =>
  import("./BatchEditModal").then((m) => ({ default: m.BatchEditModal })),
);
const SystemHealthModal = lazy(() =>
  import("./SystemHealthModal").then((m) => ({ default: m.SystemHealthModal })),
);
const ShortcutsModal = lazy(() =>
  import("./ShortcutsModal").then((m) => ({ default: m.ShortcutsModal })),
);
const CommandPalette = lazy(() =>
  import("./CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
const OnboardingTour = lazy(() =>
  import("./OnboardingTour").then((m) => ({ default: m.OnboardingTour })),
);
const FeedbackModal = lazy(() =>
  import("./FeedbackModal").then((m) => ({ default: m.FeedbackModal })),
);
const HelpModal = lazy(() => import("./HelpModal"));
const FormulaEditorModal = lazy(() =>
  import("./modals/FormulaEditorModal").then((m) => ({
    default: m.FormulaEditorModal,
  })),
);
const HistoryDrawer = lazy(() =>
  import("./HistoryDrawer").then((m) => ({ default: m.HistoryDrawer }))
);

import { Loader2 } from "lucide-react";

const DashboardView = lazy(() =>
  import("./DashboardView").then((m) => ({ default: m.DashboardView })),
);
const AnalyticsView = lazy(() =>
  import("./AnalyticsView").then((m) => ({ default: m.AnalyticsView })),
);

import { ToastProvider } from "../contexts/ToastContext";
import { ModalProvider } from "../contexts/ModalContext";
import { AuthProvider } from "../contexts/AuthContext";
import { UIProvider } from "../contexts/UIContext";
import { DataProvider } from "../contexts/DataContext";

// --- Main App Component ---

import { FloatingParticles } from "./FloatingParticles";
import { AiCopilot } from "./AiCopilot";

import { MobileBottomNav } from "./MobileBottomNav";
import { SystemNav } from "./SystemNav";
import { AddProductModal } from "./AddProductModal";
import { SmartAnalysisModal } from "./SmartAnalysisModal";

// Memoized components to prevent unnecessary flickering and re-renders
const MemoizedTopBar = memo(TopBar);
const MemoizedTreeSidebar = memo(TreeSidebar);
const MemoizedDashboardView = memo(DashboardView);
const MemoizedAnalyticsView = memo(AnalyticsView);

const AppContent = memo(() => {
  const { t } = useLanguage();
  const { toggleTheme } = useTheme();
  const { currentUser, login, updateUserProfile } = useAuth();
  const { toasts, removeToast } = useToasts();
  const {
    activeView,
    setActiveView,
    showSidebar,
    setShowSidebar,
    showFilters,
    setShowFilters,
    systemStatus,
    isHistoryOpen,
    setHistoryOpen,
  } = useUI();
  const {
    allProducts,
    isLoading,
    filteredData,
    searchQuery,
    setSearchQuery,
    selectedCategoryIds,
    setSelectedCategoryIds,
    advancedFilterGroup,
    setAdvancedFilterGroup,
    columns,
    setColumns,
    categoryCounts,
    selectedIds,
    setSelectedIds,
    handleDelete,
    handleUpdate,
    handleCreate,
    handleBatchUpdate,
    handleImportData,
    minCompleteness,
    setMinCompleteness,
    formulas,
    addFormula,
    updateFormula,
    removeFormula,
  } = useData();

  const {
    viewingProduct,
    analyzingProduct,
    openModal,
    closeModal,
    closeAllModals,
    setViewingProduct,
    closeDetail,
    isModalOpen,
  } = useModals();

  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem("resindb-tour-completed"),
  );
  const [lastSyncTime] = useState<string>(new Date().toLocaleTimeString());
  const [showAppMenu, setShowAppMenu] = useState(false);

  // Still use saved views hook but it can be refactored into context later
  const {
    savedViews,
    saveView,
    applyView,
    deleteView,
  } = useSavedViews(
    searchQuery,
    advancedFilterGroup,
    columns,
    setSearchQuery,
    setAdvancedFilterGroup,
    setColumns,
    () => {}, // Placeholder for addToast check if needed
    t
  );

  const applicationActions = {
    handleDelete,
    handleUpdate,
    handleCreate,
    handleBatchUpdate,
    handleImportData,
    handleUpdateUserProfile: updateUserProfile
  };

  // Re-use some hooks from original implementation
  const { isExporting, handleExport } = useExportData(filteredData, () => {}, t);

  const handleExportPdf = useCallback(async () => {
      console.log("生成报告中 (Generating PDF Print View)...");
      try {
         // Create a simple @media print styled report.
         document.body.classList.add("printing-mode");
         window.print();
      } finally {
         document.body.classList.remove("printing-mode");
      }
  }, []);

  useShortcuts({
    closeAllModals,
    openModal,
    setShowSidebar,
    selectedIds,
    handleExport,
  });

  const toggleCategory = useCallback(
    (id: string) => {
      setSelectedCategoryIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedCategoryIds],
  );

  const manufacturers = useMemo(() => {
    const uniqueNames = Array.from(
      new Set(allProducts.map((p) => p.manufacturer)),
    );
    return uniqueNames.map((name) => ({ id: `m-${name}`, name }));
  }, [allProducts]);

  if (!currentUser) return <AuthScreen onLogin={login} />;

  if (activeView === "dashboard" && allProducts.length === 0 && isLoading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <FloatingParticles />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 mb-6 relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary-500/20 animate-pulse" />
            <div className="absolute inset-0 rounded-full border-t-4 border-primary-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-500" />
            </div>
          </div>
          <h2 className="text-xl font-black tracking-tight mb-2 uppercase italic">{t("initializing", "Initializing ResinDB")}</h2>
          <p className="text-slate-500 dark:text-slate-400 font-mono text-xs animate-pulse">
            {t("warmingUp", "Warming up hyper-threaded data index...")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <FloatingParticles />

      <div className="print:hidden">
        <SystemNav
          activeView={activeView}
          setActiveView={setActiveView}
          showAppMenu={showAppMenu}
          setShowAppMenu={setShowAppMenu}
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          systemStatus={systemStatus}
          openModal={openModal}
          t={t}
        />
      </div>

      <LayoutGroup>
        <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-slate-50 dark:bg-slate-950">
          <div className="shrink-0 z-[60] relative print:hidden">
            <MemoizedTopBar
              onExport={handleExport}
              onExportPdf={handleExportPdf}
              isExporting={isExporting}
              savedViews={savedViews}
              onSaveView={saveView}
              onApplyView={applyView}
              onDeleteView={deleteView}
              lastSyncTime={lastSyncTime}
            />
          </div>

          <div className="flex-1 flex overflow-hidden relative bg-white dark:bg-slate-950">
            <motion.div
              animate={{
                width:
                  showSidebar &&
                  (activeView === "dashboard" || activeView === "analytics")
                    ? window.innerWidth >= 1024
                      ? 256
                      : 224
                    : 0,
                opacity:
                  showSidebar &&
                  (activeView === "dashboard" || activeView === "analytics")
                    ? 1
                    : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 32,
                restDelta: 0.001,
              }}
              className="shrink-0 border-r border-slate-200/50 dark:border-slate-800/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl flex flex-col z-[60] relative h-full overflow-hidden will-change-[width,opacity] transform-gpu print:hidden"
            >
              <div className="w-64 h-full">
                <MemoizedTreeSidebar
                  categories={CATEGORY_TREE}
                  selectedCategoryIds={selectedCategoryIds}
                  onToggleCategory={toggleCategory}
                  onClearCategories={() => setSelectedCategoryIds(new Set())}
                  totalCount={allProducts.length}
                  counts={categoryCounts}
                  minCompleteness={minCompleteness}
                  onMinCompletenessChange={setMinCompleteness}
                  isLoading={isLoading}
                  className="h-full border-none shadow-none"
                />
              </div>
            </motion.div>

            <AnimatePresence>
              {showSidebar &&
                (activeView === "dashboard" || activeView === "analytics") && (
                  <motion.div
                    key="sidebar-overlay-mobile"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowSidebar(false)}
                    className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[55]"
                  />
                )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col min-h-0 min-w-0 relative bg-white dark:bg-slate-950 overflow-hidden transform-gpu">
              <div className="absolute inset-0 z-0">
                <motion.div
                  initial={false}
                  animate={{ opacity: activeView === "dashboard" ? 1 : 0, zIndex: activeView === "dashboard" ? 10 : 0 }}
                  className={`absolute inset-0 ${activeView === "dashboard" ? "pointer-events-auto" : "pointer-events-none"}`}
                >
                  <Suspense
                    fallback={
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50">
                        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                      </div>
                    }
                  >
                    <MemoizedDashboardView />
                  </Suspense>
                </motion.div>

                <motion.div
                  initial={false}
                  animate={{ opacity: activeView === "analytics" ? 1 : 0, zIndex: activeView === "analytics" ? 10 : 0 }}
                  className={`absolute inset-0 ${activeView === "analytics" ? "pointer-events-auto" : "pointer-events-none"}`}
                >
                  <Suspense
                    fallback={
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50">
                        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                      </div>
                    }
                  >
                    <MemoizedAnalyticsView />
                  </Suspense>
                </motion.div>

                <motion.div
                  initial={false}
                  animate={{ opacity: activeView === "pivot" ? 1 : 0, zIndex: activeView === "pivot" ? 10 : 0 }}
                  className={`absolute inset-0 ${activeView === "pivot" ? "pointer-events-auto" : "pointer-events-none"}`}
                >
                  <Suspense
                    fallback={
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50">
                        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                      </div>
                    }
                  >
                    <PivotView data={filteredData} columns={columns} formulas={formulas} />
                  </Suspense>
                </motion.div>
              </div>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {selectedIds.size > 0 && (
              <BatchActionBar
                key="batch-bar"
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                setIsComparisonOpen={(val) =>
                  val ? openModal("comparison") : closeModal("comparison")
                }
                setIsBatchEditOpen={(val) =>
                  val ? openModal("batchEdit") : closeModal("batchEdit")
                }
                handleExport={handleExport}
                handleDelete={(ids) => handleDelete(ids)}
                addToast={() => {}} // simplified
              />
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      <Suspense fallback={null}>
        <MobileBottomNav
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenAdmin={() => openModal("admin")}
          t={t}
        />
        <ImportModal
          isOpen={isModalOpen("import")}
          onClose={() => closeModal("import")}
          onImport={(data) => {
            handleImportData(data);
            closeModal("import");
          }}
        />
        <ProfileModal
          isOpen={isModalOpen("profile")}
          onClose={() => closeModal("profile")}
          user={currentUser}
          onSave={(data) => {
            updateUserProfile(data);
            closeModal("profile");
          }}
          onAddToast={() => {}} // simplified
        />
        <AdminModal isOpen={isModalOpen("admin")} onClose={() => closeModal("admin")} />
        <SystemHealthModal
          isOpen={isModalOpen("systemHealth")}
          onClose={() => closeModal("systemHealth")}
          status={systemStatus}
          lastSync={lastSyncTime}
          addToast={() => {}} // simplified
        />
        <FeedbackModal
          isOpen={isModalOpen("feedback")}
          onClose={() => closeModal("feedback")}
        />
        <HelpModal isOpen={isModalOpen("help")} onClose={() => closeModal("help")} />
        <ShortcutsModal
          isOpen={isModalOpen("shortcuts")}
          onClose={() => closeModal("shortcuts")}
        />
        <CommandPalette
          isOpen={isModalOpen("commandPalette")}
          onClose={() => closeModal("commandPalette")}
          onNavigate={(view) => {
            setActiveView(view);
            closeModal("commandPalette");
          }}
          onToggleTheme={toggleTheme}
          onOpenProfile={() => openModal("profile")}
          onOpenHelp={() => openModal("help")}
          onOpenFeedback={() => openModal("feedback")}
          onOpenAdmin={() => openModal("admin")}
          products={allProducts}
          manufacturers={manufacturers as Manufacturer[]}
          onViewProduct={setViewingProduct}
        />
        <ProductDetailDrawer
          isOpen={!!viewingProduct}
          product={viewingProduct!}
          allProducts={allProducts}
          onClose={closeDetail}
          onCategoryClick={(id) => setSelectedCategoryIds(new Set([id]))}
          onProductClick={setViewingProduct}
          onAddToast={() => {}} // simplified
        />
        <AddProductModal
          isOpen={isModalOpen("addProduct")}
          onClose={() => closeModal("addProduct")}
          onSave={handleCreate}
        />
        <SmartAnalysisModal
          isOpen={isModalOpen("smartAnalysis")}
          onClose={() => closeModal("smartAnalysis")}
          product={analyzingProduct}
        />
        <ComparisonView
          isOpen={isModalOpen("comparison")}
          products={allProducts.filter((p) => selectedIds.has(p.id))}
          onClose={() => closeModal("comparison")}
          onRemoveProduct={(id) => {
            const next = new Set(selectedIds);
            next.delete(id);
            setSelectedIds(next);
            if (next.size < 2) closeModal("comparison");
          }}
        />
        <AnimatePresence mode="popLayout">
          {showFilters && (
            <motion.div
              key="filter-panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[140]"
            />
          )}
          {showFilters && (
            <FilterPanel
              key="filter-panel-main"
              isOpen={true}
              onClose={() => setShowFilters(false)}
              columns={columns}
              filterGroup={advancedFilterGroup}
              onFilterChange={setAdvancedFilterGroup}
              onClearFilters={() =>
                setAdvancedFilterGroup({
                  id: "root",
                  type: "group",
                  logic: "AND",
                  conditions: [],
                })
              }
            />
          )}
        </AnimatePresence>
        <BatchEditModal
          isOpen={isModalOpen("batchEdit")}
          onClose={() => closeModal("batchEdit")}
          onSave={handleBatchUpdate}
          selectedProducts={allProducts.filter((p) => selectedIds.has(p.id))}
        />
        <FormulaEditorModal
          isOpen={isModalOpen("formulaEditor")}
          onClose={() => closeModal("formulaEditor")}
          formulas={formulas}
          onAdd={addFormula}
          onUpdate={updateFormula}
          onRemove={removeFormula}
          allProducts={allProducts}
        />
        <AiCopilot
          data={filteredData}
          activeChart={activeView === "analytics" ? "Visualizer" : undefined}
          actions={applicationActions}
        />
        <HistoryDrawer 
          isOpen={isHistoryOpen} 
          onClose={() => setHistoryOpen(false)} 
        />
        <AnimatePresence>
          {showTour && (
            <OnboardingTour
              key="onboarding-tour-root"
              onComplete={() => {
                setShowTour(false);
                localStorage.setItem("resindb-tour-completed", "true");
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
});

async function startApp() {
  // Any async bootstrap logic here
}
startApp();

const App: React.FC = () => (
  <LanguageProvider>
    <ToastProvider>
      <AuthProvider>
        <UIProvider>
          <DataProvider>
            <ModalProvider>
              <ThemeProvider>
                <AppContent />
              </ThemeProvider>
            </ModalProvider>
          </DataProvider>
        </UIProvider>
      </AuthProvider>
    </ToastProvider>
  </LanguageProvider>
);

export default App;
