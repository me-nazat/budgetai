'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export function useVoiceRecognition(onResult: (text: string) => void) {
    const [isListening, setIsListening] = useState(false);
    const [supported, setSupported] = useState(true);
    const [recognition, setRecognition] = useState<any>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSupported(false);
            return;
        }

        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
            const text = event.results[0][0].transcript;
            onResult(text);
            setIsListening(false);
        };

        rec.onerror = (event: any) => {
            console.error('Speech error:', event.error);
            if (event.error !== 'no-speech') {
                toast.error('Voice recognition failed: ' + event.error);
            }
            setIsListening(false);
        };

        rec.onend = () => {
            setIsListening(false);
        };

        setRecognition(rec);
    }, [onResult]);

    const startListening = useCallback(() => {
        if (!recognition) return;
        try {
            recognition.start();
            setIsListening(true);
            toast.info('Listening...', { duration: 2000 });
        } catch (e) {
            console.error(e);
        }
    }, [recognition]);

    const stopListening = useCallback(() => {
        if (!recognition) return;
        recognition.stop();
        setIsListening(false);
    }, [recognition]);

    return { isListening, startListening, stopListening, supported };
}
