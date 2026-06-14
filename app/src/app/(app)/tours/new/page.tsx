'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';

export default function NewTourPage() {
    const [name, setName] = useState('');
    const [participants, setParticipants] = useState<string[]>(['', '']); // Start with 2 empty
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleAddParticipant = () => {
        setParticipants([...participants, '']);
    };

    const handleRemoveParticipant = (index: number) => {
        if (participants.length <= 2) return; // Minimum 2
        setParticipants(participants.filter((_, i) => i !== index));
    };

    const handleParticipantChange = (index: number, value: string) => {
        const newP = [...participants];
        newP[index] = value;
        setParticipants(newP);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validParticipants = participants.filter(p => p.trim() !== '');
        if (!name.trim() || validParticipants.length < 2) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/bill-splits/tours', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, participants: validParticipants })
            });
            const data = await res.json();
            if (data.success) {
                router.push(`/tours/${data.tour.id}`);
            } else {
                alert(data.error);
                setIsSubmitting(false);
            }
        } catch (err) {
            alert('Failed to create tour');
            setIsSubmitting(false);
        }
    };

    return (
        <PageTransition>
            <div className="p-4 lg:p-8 max-w-2xl mx-auto min-h-screen pt-20">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white mb-8 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Back
                </button>

                <div className="mb-10">
                    <h1 className="text-4xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Start a new tour</h1>
                    <p className="text-gray-500 font-medium mt-2">Who is coming with you?</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Tour Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold uppercase tracking-wider text-gray-500 ml-1">Tour / Trip Name</label>
                        <div className="relative flex items-center group">
                            <span className="material-symbols-outlined absolute left-4 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors">
                                map
                            </span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="E.g., Bali Summer Trip"
                                className="w-full rounded-2xl border border-gray-200 bg-white/80 pl-12 pr-4 py-4 text-lg font-bold text-gray-900 outline-none backdrop-blur-lg placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-white/10 dark:bg-[#0A0A0C]/80 dark:text-white dark:placeholder:text-gray-600 transition-all shadow-sm"
                                required
                            />
                        </div>
                    </div>

                    {/* Participants */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold uppercase tracking-wider text-gray-500 ml-1">Participants</label>
                        <AnimatePresence mode="popLayout">
                            {participants.map((p, index) => (
                                <motion.div
                                    key={index}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className="flex items-center gap-3"
                                >
                                    <div className="relative flex-1 group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors">
                                            {index === 0 ? 'person' : 'person_add'}
                                        </span>
                                        <input
                                            type="text"
                                            value={p}
                                            onChange={(e) => handleParticipantChange(index, e.target.value)}
                                            placeholder={index === 0 ? "You (Organizer)" : `Participant ${index + 1}`}
                                            className="w-full rounded-2xl border border-gray-200 bg-white/80 pl-12 pr-4 py-3 text-base font-semibold text-gray-900 outline-none backdrop-blur-lg placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-white/10 dark:bg-[#0A0A0C]/80 dark:text-white dark:placeholder:text-gray-600 transition-all shadow-sm"
                                            required={index < 2} // First two are required
                                        />
                                    </div>
                                    {participants.length > 2 && index >= 2 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveParticipant(index)}
                                            className="w-12 h-12 flex items-center justify-center shrink-0 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-colors"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        <button
                            type="button"
                            onClick={handleAddParticipant}
                            className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 mt-2 transition-colors rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 w-fit"
                        >
                            <span className="material-symbols-outlined text-[20px]">add_circle</span>
                            Add another person
                        </button>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim() || participants.filter(p => p.trim() !== '').length < 2}
                            className="w-full rounded-2xl bg-blue-600 px-6 py-4 text-center text-lg font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {isSubmitting ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Creating...</span>
                                </div>
                            ) : 'Create Tour Budget'}
                        </button>
                    </div>
                </form>
            </div>
        </PageTransition>
    );
}

