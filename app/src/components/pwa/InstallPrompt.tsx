"use client";

import { useEffect, useState } from "react";

export default function InstallPrompt() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isDismissed, setIsDismissed] = useState(true); // Default to true to prevent hydration mismatch flashes

    useEffect(() => {
        // Check dismissal state
        const dismissed = localStorage.getItem("pwa-install-dismissed") === "true";
        setIsDismissed(dismissed);

        if (dismissed) return;

        // iOS Detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

        // Check if already installed
        const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true;

        setIsStandalone(isStandaloneMode);

        if (isIosDevice && isSafari && !isStandaloneMode) {
            setIsIOS(true);
        }

        // Android/Chrome beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem("pwa-install-dismissed", "true");
    };

    if (isStandalone || isDismissed) {
        return null;
    }

    // Android Prompt
    if (deferredPrompt) {
        return (
            <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-[#161616] border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div className="flex items-center gap-3">
                    <img src="/icon-192x192.png" alt="Wealth AI" className="w-12 h-12 rounded-xl" />
                    <div>
                        <h3 className="text-white font-medium text-sm">Install Wealth AI</h3>
                        <p className="text-gray-400 text-xs">Add to home screen for quick access.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDismiss}
                        className="text-gray-400 p-2 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-center h-10 w-10"
                        aria-label="Dismiss"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                    <button
                        onClick={handleInstallClick}
                        className="bg-white text-black px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors h-10"
                    >
                        Install
                    </button>
                </div>
            </div>
        );
    }

    // iOS Safari Prompt
    if (isIOS) {
        return (
            <div className="fixed bottom-20 left-4 right-4 z-[9999] bg-[#161616] border border-white/10 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                        <img src="/icon-192x192.png" alt="Wealth AI" className="w-10 h-10 rounded-xl" />
                        <h3 className="text-white font-medium text-sm">Install Wealth AI</h3>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-gray-400 p-1 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center p-2"
                        aria-label="Dismiss"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                    Install this app on your device: tap <span className="inline-flex items-center justify-center w-6 h-6 bg-white/10 rounded mx-1"><span className="material-symbols-outlined text-[16px] text-[#007AFF]">ios_share</span></span> and then select <strong>Add to Home Screen</strong>.
                </p>
                <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 bg-[#161616] border-b border-r border-white/10 transform rotate-45"></div>
            </div>
        );
    }

    return null;
}
