'use client';

import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const testimonials = [
  { quote: "Wealth AI completely changed how I look at my monthly budget. It feels less like a finance app and more like having a personal CFO in my pocket.", author: "Nazat Al Mahmud", role: "Product Designer and Manager, Bangladesh", initials: "NM" },
  { quote: "The AI coach helped me identify spending patterns I never noticed. Saved me over $400 in the first month alone.", author: "Sarah Chen", role: "Software Engineer, Singapore", initials: "SC" },
  { quote: "Finally, a finance app that doesn't look like it was built in 2010. The design is absolutely stunning and the insights are genuinely useful.", author: "James O'Brien", role: "Investment Analyst, London", initials: "JO" },
];

export function Testimonials() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <p className="text-sm font-medium text-accent-emerald mb-3">Testimonials</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-text-primary text-balance">Loved by thousands.</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, index) => (
            <motion.div key={t.author} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }}>
              <div className="glass rounded-2xl border border-border-default p-6 h-full flex flex-col">
                <Quote size={24} className="text-accent-emerald/30 mb-4" />
                <p className="text-text-secondary leading-relaxed flex-1 mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">{t.initials}</div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{t.author}</p>
                    <p className="text-xs text-text-tertiary">{t.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
