import Link from "next/link";
import FloatingBlocks from "@/components/FloatingBlocks";
import ReviewCarousel from "@/components/ReviewCarousel";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[70vh] sm:min-h-[80vh] px-4 pt-16 sm:pt-20 pb-12 sm:pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.15),transparent_70%)]" />
        <FloatingBlocks />

        <div className="relative z-10 flex flex-col items-center gap-2 text-center max-w-4xl px-2">
          <h1 className="flex flex-col items-center leading-tight">
            <span className="text-5xl sm:text-7xl md:text-8xl font-bold gradient-text tracking-wide">GLOWBLOCKS</span>
            <span className="text-5xl sm:text-7xl md:text-8xl font-bold gradient-text tracking-wide">STUDIO</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-cyan-400 tracking-[0.25em] uppercase mt-1">
            Build. Connect. Glow.
          </p>
          <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed mt-4">
            Personalised letter tiles that light up when they&apos;re together — and go dark the moment they&apos;re apart.
          </p>
          <Link
            href="/customize"
            className="mt-2 inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-base sm:text-lg rounded-full transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
          >
            Build Yours
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-10 sm:py-14 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">How it works</h2>
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
            No plugs. No app. No WiFi. No wires. Just tiles that know when they&apos;re touching.
          </p>
          <p className="text-gray-400 text-base leading-relaxed">
            Place your letters together and they glow. Pull one away and it goes dark. It&apos;s the kind of thing you just have to see to believe.
          </p>
        </div>
      </section>

      {/* Made for Real Life */}
      <section className="py-10 sm:py-14 px-4 bg-gray-950/50">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Made for real life</h2>
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            GlowBlocks look incredible on a nightstand, a bookshelf, a desk, or a kid&apos;s bedroom wall. A soft, breathing glow in whatever colour feels like you. Your name, a word that means something, a place, initials — if it can be spelled, we can make it glow.
          </p>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-10 sm:py-14 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center mb-8 px-4">
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">People love these</h2>
        </div>
        <ReviewCarousel />
        <div className="text-center mt-6">
          <Link href="/reviews" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
            Read all reviews &rarr;
          </Link>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-10 sm:py-14 px-4 bg-gray-950/50">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">See it for yourself</h2>
          <div className="relative aspect-video bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <div className="w-20 h-20 rounded-full border-2 border-gray-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-8 h-8 ml-1">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-lg font-medium">Video coming soon</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Set It and Forget It */}
      <section className="py-10 sm:py-14 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Set it and forget it</h2>
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
            GlowBlocks run on small coin batteries — no charging, no cables, ever. Connected and glowing every evening, your set will last 6 to 7 months before you need to swap a battery. Takes about 30 seconds when you do.
          </p>
        </div>
      </section>

      {/* The Perfect Gift */}
      <section className="py-10 sm:py-14 px-4 bg-gray-950/50">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">The perfect gift</h2>
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
            Genuinely hard to find. Completely personal. Nothing else like it. Whether it&apos;s a name for a nursery, a word for a loved one, or something just for you — GlowBlocks is the kind of gift people keep for years.
          </p>
        </div>
      </section>

      {/* How to Order */}
      <section className="py-10 sm:py-14 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-10">
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Three steps. That&apos;s it.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <StepCard number="1" title="Pick your word" description="A name, a word, initials — whatever means something to you." />
            <StepCard number="2" title="Pick your colours" description="Choose a preset theme or go fully custom with any colour you want." />
            <StepCard number="3" title="We ship it" description="Built, packed, and shipped to your door ready to glow." />
          </div>
          <Link
            href="/customize"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-full transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
          >
            Start Building Yours
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-10 sm:py-14 px-4 bg-gray-950/50">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Simple pricing</h2>
          <p className="text-gray-400">More letters, better price. Custom colours are a one-time $5 fee.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <PricingCard letters="1-3" price="$14.99" />
            <PricingCard letters="4-6" price="$12.99" highlight />
            <PricingCard letters="7-9" price="$10.99" />
            <PricingCard letters="10+" price="$9.50" />
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xl font-bold text-purple-300">
        {number}
      </div>
      <h3 className="text-white font-semibold">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}


function PricingCard({ letters, price, highlight }: { letters: string; price: string; highlight?: boolean }) {
  return (
    <div className={`relative p-5 rounded-2xl border ${highlight ? 'border-purple-500 bg-purple-500/10' : 'border-gray-800 bg-gray-900/50'}`}>
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded-full whitespace-nowrap">
          Most Popular
        </span>
      )}
      <p className="text-gray-400 text-sm mb-1">{letters} letters</p>
      <p className="text-3xl font-bold gradient-text">{price}</p>
      <p className="text-gray-500 text-xs mt-1">per letter</p>
    </div>
  );
}
