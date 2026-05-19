import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Send, Brain, Loader2, Zap, Image as ImageIcon } from "lucide-react";
import { Product, ProductUpdates } from '@/types/index';
import { getAiInsights } from "@/services/geminiService";
import { logger } from "@/lib/logger";
import Markdown from "react-markdown";

interface AiCopilotProps {
  data: Product[];
  activeChart?: string;
  actions: {
    handleDelete: (ids: string[]) => void;
    handleUpdate: (p: Product) => void;
    handleBatchUpdate: (ids: string[], updates: ProductUpdates) => void;
    handleImportData: (data: Product[]) => void;
  };
}

export const AiCopilot: React.FC<AiCopilotProps> = React.memo(({
  data,
  activeChart,
  actions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDeepThinking, setIsDeepThinking] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<
    {
      role: "user" | "assistant";
      content: string;
      suggestedAction?: {
        type: string;
        payload:
          | string[]
          | Product
          | { ids: string[]; updates: ProductUpdates };
        label: string;
      };
    }[]
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const parseAction = (content: string) => {
    // Basic parser for structured actions in AI response
    // Format: [[ACTION:TYPE:PAYLOAD:LABEL]]
    // Example: [[ACTION:DELETE:["id1"]:Delete suggested duplicates]]
    const regex = /\[\[ACTION:(\w+):(.+):(.+)\]\]/;
    const match = content.match(regex);
    if (match) {
      try {
        return {
          type: match[1],
          payload: JSON.parse(match[2]),
          label: match[3],
          cleanContent: content.replace(regex, "").trim(),
        };
      } catch (e) {
        logger.error("Failed to parse AI action:", e);
      }
    }
    return null;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!query.trim() && !imageBase64) || isTyping) return;

    const userMessage = query.trim();
    setQuery("");
    
    // Create the message payload
    const userMessageObj: { role: "user" | "assistant"; content: string; [key: string]: unknown } = { role: "user", content: userMessage };
    if (imageBase64) {
      // Small visual indicator for the user message
       userMessageObj.content = `[Image attached]\n${userMessage}`;
    }
    
    setMessages((prev) => [...prev, userMessageObj]);
    setIsTyping(true);

    let imagePart = undefined;
    if (imageBase64) {
      const mimeType = imageFile?.type || "image/jpeg";
      const data = imageBase64.split(",")[1]; // remove data:image/jpeg;base64,
      imagePart = { inlineData: { data, mimeType } };
    }
    
    // Clear image after sending
    clearImage();

    try {
      const insight = await getAiInsights(data, {
        query: userMessage,
        isDeepThinking,
        imagePart
      });
      const action = parseAction(insight || "");

      if (action) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: action.cleanContent,
            suggestedAction: {
              type: action.type,
              payload: action.payload,
              label: action.label,
            },
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: insight || "I couldn't generate an insight at this time.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I encountered an error connecting to the AI service. 🧪",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const executeAction = (action: {
    type: string;
    payload:
      | string[]
      | Product
      | { ids: string[]; updates: ProductUpdates }
      | unknown;
  }) => {
    switch (action.type) {
      case "DELETE":
        actions.handleDelete(action.payload as string[]);
        break;
      case "UPDATE":
        actions.handleUpdate(action.payload as Product);
        break;
      case "BATCH_UPDATE": {
        const batchPayload = action.payload as {
          ids: string[];
          updates: ProductUpdates;
        };
        actions.handleBatchUpdate(batchPayload.ids, batchPayload.updates);
        break;
      }
      case "IMPORT":
        actions.handleImportData(action.payload as Product[]);
        break;
      default:
        logger.warn("Unknown action type:", action.type);
    }
  };

  const generateAutoInsight = async () => {
    if (isTyping) return;
    setIsTyping(true);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Analyzing your current data view... 🔍" },
    ]);

    try {
      const insight = await getAiInsights(
        data,
        activeChart
          ? `Analyze this data with focus on the ${activeChart} view.`
          : undefined,
      );
      setMessages((prev) => [
        ...prev.filter(
          (m) => m.content !== "Analyzing your current data view... 🔍",
        ),
        {
          role: "assistant",
          content: insight || "No automated insights available.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.filter(
          (m) => m.content !== "Analyzing your current data view... 🔍",
        ),
        {
          role: "assistant",
          content: "Connection failed. Please check your API key.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-8 right-8 z-[60]">
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-gradient-to-br from-indigo-600 via-primary-500 to-emerald-500 rounded-2xl shadow-2xl flex items-center justify-center text-white relative group overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 animate-shimmer bg-[length:200%_100%] opacity-30" />
          <AnimatePresence mode="wait">
            {isOpen ? (
              <X key="x" size={24} />
            ) : (
              <Sparkles key="sparkle" size={24} className="animate-pulse" />
            )}
          </AnimatePresence>

          {/* Status Indicator */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full glow-pulse" />
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ai-copilot-container"
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            className="fixed bottom-24 right-8 w-full sm:w-[400px] max-h-[600px] h-[70vh] glass-card z-[60] flex flex-col overflow-hidden"
          >
            {/* Top Bar */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 dark:bg-slate-900/5 backdrop-blur-3xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/10 rounded-xl text-primary-500">
                  <Brain size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">
                    ResinAI Copilot
                  </h4>
                  <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    {isDeepThinking ? 'Deep Thinking' : 'Thinking Online'}
                  </div>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9, rotate: -45 }}
                whileHover={{
                  scale: 1.1,
                  backgroundColor: "rgba(244, 63, 94, 0.1)",
                  color: "#f43f5e",
                }}
                onClick={() => setMessages([])}
                className="p-2 text-slate-400 dark:text-slate-500 transition-all rounded-xl focus:outline-none"
                title="Clear Chat"
              >
                <Zap size={14} />
              </motion.button>
            </div>

            {/* Chat Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30 space-y-4"
            >
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4"
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="p-4 bg-primary-500/5 rounded-3xl border border-primary-500/10"
                  >
                    <Sparkles
                      size={32}
                      className="text-primary-500 opacity-50"
                    />
                  </motion.div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">
                      Technical Assistant
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[240px]">
                      I can analyze properties, compare grades, and suggest
                      applications based on your current data view.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{
                      scale: 1.05,
                      boxShadow: "0 10px 15px -3px rgba(99, 102, 241, 0.3)",
                    }}
                    whileTap={{ scale: 0.95 }}
                    onClick={generateAutoInsight}
                    className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-[10px] font-black shadow-sm transition-all text-primary-600 dark:text-primary-400 uppercase tracking-widest flex items-center gap-2"
                  >
                    <Brain size={12} className="text-primary-500" />{" "}
                    Auto-Analyze Data
                  </motion.button>
                </motion.div>
              )}

              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl text-[11px] shadow-sm border ${
                      m.role === "user"
                        ? "bg-primary-600 text-white border-primary-700 rounded-br-none"
                        : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 rounded-bl-none"
                    }`}
                  >
                    <div className="markdown-body prose prose-sm prose-slate dark:prose-invert max-w-none">
                      <Markdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0 leading-relaxed">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-4 mb-2 space-y-1">
                              {children}
                            </ul>
                          ),
                          li: ({ children }) => (
                            <li className="mb-1">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-black text-primary-500">
                              {children}
                            </strong>
                          ),
                          code: ({ children }) => (
                            <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {m.content}
                      </Markdown>
                    </div>

                    {m.suggestedAction && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          m.suggestedAction && executeAction(m.suggestedAction)
                        }
                        className="mt-4 w-full py-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-400 border border-primary-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Zap size={12} />
                        {m.suggestedAction.label}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <Loader2
                      size={12}
                      className="animate-spin text-primary-500"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      GenAI is thinking...
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 shrink-0 flex flex-col gap-2">
              {imageBase64 && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                  <img src={imageBase64} alt="Upload preview" className="w-full h-full object-cover" />
                  <button onClick={clearImage} className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors">
                    <X size={10} />
                  </button>
                </div>
              )}
              
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => setIsDeepThinking(!isDeepThinking)}
                  className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded transition-colors ${
                    isDeepThinking 
                      ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' 
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Brain size={12} />
                  Deep Thinking
                </button>
                <div className="flex gap-1">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                  >
                    <ImageIcon size={14} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2 p-1.5 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl shadow-inner group-focus-within:ring-2 ring-primary-500/50 transition-all">
                <motion.input
                  whileFocus={{ x: 2 }}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask ResinAI..."
                  className="flex-1 bg-transparent border-none outline-none px-3 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-bold placeholder:uppercase placeholder:tracking-widest"
                />
                <motion.button
                  whileHover={{ scale: 1.1, x: 4, backgroundColor: "#4f46e5" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSend}
                  disabled={(!query.trim() && !imageBase64) || isTyping}
                  className="p-2.5 bg-primary-600 disabled:opacity-50 text-white rounded-xl shadow-lg transition-all"
                >
                  <Send size={16} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
