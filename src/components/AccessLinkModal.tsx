import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  X,
  ExternalLink,
  Smartphone,
  Globe,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

interface AccessLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessLinkModal: React.FC<AccessLinkModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Shared production URL provided for this applet
  const appUrl =
    typeof window !== 'undefined' && window.location.origin.includes('run.app')
      ? window.location.origin
      : 'https://ais-pre-riqfllegfooevtef7kunw6-352365435848.asia-east1.run.app';

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    appUrl
  )}&bgcolor=ffffff&color=0f172a&margin=8`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">PWA Web Access Link</h3>
              <p className="text-xs text-slate-400">
                Share access link for factory supervisors, mixing operators, and store in-charge
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Direct Link Box */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold block flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Public Live Web Application URL:</span>
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 bg-transparent text-xs font-mono text-cyan-300 select-all focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="bg-white p-2 rounded-xl shadow-lg flex-shrink-0">
              <img
                src={qrCodeUrl}
                alt="PWA QR Code"
                className="w-32 h-32 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-white flex items-center justify-center sm:justify-start gap-1.5">
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span>Scan with Phone Camera</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Scan this QR code from an Android phone, iPhone, or iPad to open the app on mobile instantly.
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-[11px] text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>No login or password required</span>
              </div>
            </div>
          </div>

          {/* Installation Instructions */}
          <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-slate-400 text-[11px]">
            <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>How to Install on Mobile & Desktop:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>
                <strong>Android / Chrome / Edge:</strong> Open link and tap the <strong>"Install App"</strong> button or select "Add to Home Screen" from browser menu.
              </li>
              <li>
                <strong>iPhone / iPad (Safari):</strong> Tap the <strong>Share</strong> button, scroll down, and tap <strong>"Add to Home Screen"</strong>.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
