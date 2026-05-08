"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function getDismissedState() {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("pwa-install-dismissed") === "true";
}

function getStandaloneState() {
    if (typeof window === "undefined") return false;
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function getIOSInstallState() {
    if (typeof window === "undefined") return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    return isIosDevice && isSafari && !getStandaloneState();
}

export default function InstallPrompt() {
    const [isDismissed, setIsDismissed] = useState(getDismissedState);
    const [isStandalone] = useState(getStandaloneState);
    const [isIOS] = useState(getIOSInstallState);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        if (isDismissed) return;

        // Android/Chrome beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, [isDismissed]);

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
                    <Image src="/icon-192x192.png" alt="Wealth AI" width={48} height={48} className="w-12 h-12 rounded-xl" />
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
                        <Image src="/icon-192x192.png" alt="Wealth AI" width={40} height={40} className="w-10 h-10 rounded-xl" />
                        <h3 className="text-white font-medium text-sm">Install Wealth AI</h3>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-gray-400 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center p-2"
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
