'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function NewTourPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [participants, setParticipants] = useState([{ id: 1, name: '' }]);
    const [loading, setLoading] = useState(false);

    const addParticipant = () => {
        setParticipants([...participants, { id: Date.now(), name: '' }]);
    };

    const removeParticipant = (id: number) => {
        if (participants.length <= 1) return;
        setParticipants(participants.filter(p => p.id !== id));
    };

    const updateParticipant = (id: number, newName: string) => {
        setParticipants(participants.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            toast.error("Tour name is required");
            return;
        }

        const validParticipants = participants.filter(p => p.name.trim());
        if (validParticipants.length === 0) {
            toast.error("At least one participant is required");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/bill-splits/tours', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name, 
                    participants: validParticipants.map(p => ({ name: p.name.trim() })) 
                })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                toast.success('Tour created successfully');
                router.push(`/tours/${data.tourId}`);
            } else {
                throw new Error(data.error || 'Failed to create tour');
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const springTransition = {
        type: "spring",
        stiffness: 400,
        damping: 30
    };

    return (
        <div className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-8 relative">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springTransition as any}
                className="glass-panel p-8"
            >
                <div className="flex items-center gap-4 mb-8">
                    <button 
                        onClick={() => router.back()}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading tracking-tight">Create a Trip</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Set up a shared budget for your next adventure</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Tour Name Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Trip Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Weekend in Paris"
                            className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                    </div>

                    {/* Participants List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Participants</label>
                            <span className="text-xs text-gray-500 font-medium bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-full">{participants.length}</span>
                        </div>
                        
                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {participants.map((p, index) => (
                                    <motion.div 
                                        key={p.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                                        transition={springTransition as any}
                                        className="flex items-center gap-2"
                                    >
                                        <div className="relative flex-1 group">
                                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                                                person
                                            </span>
                                            <input
                                                type="text"
                                                value={p.name}
                                                onChange={(e) => updateParticipant(p.id, e.target.value)}
                                                placeholder={`Participant ${index + 1}`}
                                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                        </div>
                                        {participants.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeParticipant(p.id)}
                                                className="w-[42px] h-[42px] shrink-0 rounded-xl flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">close</span>
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        <button
                            type="button"
                            onClick={addParticipant}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/5 transition-all font-medium text-sm flex items-center justify-center gap-2 group"
                        >
                            <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">add</span>
                            Add Participant
                        </button>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-2xl bg-primary text-white py-4 font-semibold shadow-lg shadow-primary/25 hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Create Trip
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
