import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition active:scale-95"
        title="Install as Progressive Web App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 text-xs font-medium transition"
          title="Install on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Add to iOS Home</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  Install on iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-900 text-cyan-300 font-bold flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Tap the <strong>Share</strong> button (box with upward arrow) in the Safari bottom toolbar.</span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-900 text-cyan-300 font-bold flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>Scroll down the share sheet and tap <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-900 text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3" />
                  </span>
                  <span>Tap <strong>Add</strong> in the top right. The app will launch standalone without browser bars!</span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 py-2.5 text-xs font-semibold text-white transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
