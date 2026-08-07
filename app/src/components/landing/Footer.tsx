import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative py-12 px-6 border-t border-border-subtle">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <span className="font-serif text-lg font-semibold text-text-primary">Wealth AI</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-text-tertiary">
          <Link href="#" className="hover:text-text-secondary transition-colors">Privacy</Link>
          <Link href="#" className="hover:text-text-secondary transition-colors">Terms</Link>
          <Link href="#" className="hover:text-text-secondary transition-colors">Security</Link>
          <Link href="#" className="hover:text-text-secondary transition-colors">Contact</Link>
        </div>
        <p className="text-xs text-text-muted">&copy; {new Date().getFullYear()} Wealth AI. All rights reserved.</p>
      </div>
    </footer>
  );
}
