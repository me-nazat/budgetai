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
                    <div className="relative">
                        <input
                            type="text"
                            id="tour_name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder=" "
                            className="peer w-full border-b-2 border-gray-200 bg-transparent px-0 py-3 text-2xl font-bold text-gray-900 focus:border-primary focus:outline-none dark:border-white/10 dark:text-white"
                            required
                        />
                        <label htmlFor="tour_name" className="pointer-events-none absolute left-0 top-3 origin-[0] -translate-y-6 scale-75 transform text-sm font-bold text-gray-400 transition-all peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-primary">
                            Tour / Trip Name
                        </label>
                    </div>

                    {/* Participants */}
                    <div className="space-y-4">
                        <label className="text-sm font-black uppercase tracking-wider text-gray-500">Participants</label>
                        <AnimatePresence>
                            {participants.map((p, index) => (
                                <motion.div
                                    key={`p-${index}`}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-end gap-4"
                                >
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={p}
                                            onChange={(e) => handleParticipantChange(index, e.target.value)}
                                            placeholder=" "
                                            className="peer w-full border-b-2 border-gray-200 bg-transparent px-0 py-2 text-lg font-bold text-gray-900 focus:border-primary focus:outline-none dark:border-white/10 dark:text-white"
                                            required={index < 2} // First two are required
                                        />
                                        <label className="pointer-events-none absolute left-0 top-2 origin-[0] -translate-y-5 scale-75 transform text-xs font-bold text-gray-400 transition-all peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-primary">
                                            {index === 0 ? 'You (Organizer)' : `Participant ${index + 1}`}
                                        </label>
                                    </div>
                                    {participants.length > 2 && index >= 2 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveParticipant(index)}
                                            className="pb-2 text-rose-500 hover:text-rose-600 transition-colors"
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
                            className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-hover mt-4 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Add another person
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !name.trim() || participants.filter(p => p.trim() !== '').length < 2}
                        className="w-full rounded-2xl bg-primary px-6 py-4 text-center font-bold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Tour Budget'}
                    </button>
                </form>
            </div>
        </PageTransition>
    );
}
