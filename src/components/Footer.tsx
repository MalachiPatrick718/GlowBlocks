import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/10 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <Link href="/" className="text-lg font-bold gradient-text hover:opacity-80 transition-opacity">GlowBlocks Studio</Link>
              <p className="text-sm text-cyan-400 mt-1 tracking-widest">BUILD. CONNECT. GLOW.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/customize" className="hover:text-white transition-colors">Customize</Link>
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/reviews" className="hover:text-white transition-colors">Reviews</Link>
              <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
              <Link href="/returns" className="hover:text-white transition-colors">Return Policy</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center">&copy; {new Date().getFullYear()} GlowBlocks Studio. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
