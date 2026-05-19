import React from "react";

export const FloatingParticles: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.02),transparent_50%)] animate-pulse" />
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-float opacity-50" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] animate-float-delayed opacity-50" />
      <style
        dangerouslySetInnerHTML={{
          __html: `
                @keyframes float {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(5%, 5%) scale(1.05); }
                }
                @keyframes float-delayed {
                    0%, 100% { transform: translate(0, 0) scale(1.05); }
                    50% { transform: translate(-5%, -5%) scale(1); }
                }
                .animate-float { animation: float 15s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 18s ease-in-out infinite; }
            `,
        }}
      />
    </div>
  );
};
