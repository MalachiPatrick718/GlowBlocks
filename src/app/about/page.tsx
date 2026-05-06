import Image from 'next/image';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-16">

        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">About GlowBlocks</h1>
          <p className="text-gray-300 text-lg leading-relaxed max-w-2xl mx-auto">
            Personalised letter tiles that light up when they&apos;re together — and go dark the moment they&apos;re apart. Your name, your word, your glow.
          </p>
        </div>

        {/* Meet the Creator */}
        <section className="flex flex-col sm:flex-row items-start gap-8">
          <div className="shrink-0">
            <Image
              src="/images/founder.jpg"
              alt="Malachi Patrick — Founder of GlowBlocks"
              width={200}
              height={200}
              className="rounded-2xl object-cover border-2 border-purple-500/40 shadow-lg shadow-purple-500/10"
            />
          </div>
          <div className="space-y-4 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-white">Meet the Creator</h2>
            <p className="text-gray-300 leading-relaxed">
              Hey, I&apos;m Malachi — the founder, designer, and builder behind GlowBlocks Studio.
            </p>
            <p className="text-gray-300 leading-relaxed">
              GlowBlocks started with a simple question I could not get out of my head: What is something unique, fun and interesting that I can create that different groups and individuals would enjoy! I spent two years prototyping, redesigning, failing, and rebuilding until that question became a real product — one that I am genuinely proud of. Not another LED sign, not another custom name plaque — something that actually does something. Something that feels alive. Place two tiles together and they glow. Pull them apart and they go dark. No app, no WiFi, no setup. Just magic you can hold in your hands.
            </p>
            <p className="text-gray-300 leading-relaxed">
              I design every circuit board, write every line of firmware, model every enclosure, and hand-assemble every single Glowblock right here in Englewood, New Jersey. When you order from GlowBlocks Studio you are not buying something off a shelf. You are getting something a real person built specifically for you.
            </p>
            <p className="text-gray-300 leading-relaxed">
              What started as one idea typed out in Notion has turned into a full product line in the making. GlowBlocks are just the beginning. Glowblocks: Words are coming — an interactive learning toy designed to help toddlers and young children spell and read through play. Glowblocks: Numbers will bring the same magic to math, bringing fun around simple arithmetic.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Every version of GlowBlocks shares the same DNA — Connected we Glow! My goal goes beyond retail. I want to prove that an independent studio can build something genuinely magical — something that belongs on a nightstand next to the things that matter most to you, in classrooms where kids are learning to read, and in the hands of anyone who deserves to feel that moment when their Glowblocks come alive.
            </p>
            <p className="text-gray-300 leading-relaxed">
              That idea is bigger than a product. It is a platform. And we are just getting started.
            </p>
            <p className="text-gray-300 leading-relaxed italic">
              Built by hand. Designed to feel like magic.
              <br />
              — Malachi, GlowBlocks Studio
            </p>
          </div>
        </section>

        {/* What Makes Them Special */}
        <section className="space-y-6 text-center">
          <h2 className="text-2xl font-bold text-white">What makes them different</h2>
          <p className="text-gray-300 leading-relaxed max-w-2xl mx-auto">
            GlowBlocks aren&apos;t a sign. They&apos;re not a lamp. They&apos;re individual letter tiles that respond to each other. Place them together and they glow. Pull one away and it goes dark. No plugs, no app, no setup — just something that feels a little bit magic.
          </p>
        </section>

        {/* The Tiles */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-white text-center">The tiles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-2">
              <h3 className="text-purple-400 font-semibold">Size</h3>
              <p className="text-3xl font-bold text-white">2.52&quot; x 2.5&quot;</p>
              <p className="text-gray-400 text-sm">
                Small enough to fit on any shelf. Big enough that you notice them.
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-2">
              <h3 className="text-purple-400 font-semibold">Battery life</h3>
              <p className="text-3xl font-bold text-white">6-7 months</p>
              <p className="text-gray-400 text-sm">
                Coin batteries. No charging, no cables, ever. Swap takes 30 seconds.
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-2">
              <h3 className="text-purple-400 font-semibold">The glow</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                A soft, breathing light — not harsh, not flashy. More like a candle that doesn&apos;t flicker. The kind of glow you want in a room at night.
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-2">
              <h3 className="text-purple-400 font-semibold">Colours</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Pick a preset theme or choose the exact colour for each individual letter. Rainbow, sunset, ocean — or fully custom with any hex colour you want.
              </p>
            </div>
          </div>
        </section>

        {/* Set It and Forget It */}
        <section className="text-center space-y-6">
          <h2 className="text-2xl font-bold text-white">Set it and forget it</h2>
          <p className="text-gray-300 leading-relaxed max-w-2xl mx-auto">
            GlowBlocks run on small coin batteries — no charging, no cables, ever. Connected and glowing every evening, your set will last 6 to 7 months before you need to swap a battery. Takes about 30 seconds when you do.
          </p>
        </section>

        {/* Made for Real Life */}
        <section className="text-center space-y-6">
          <h2 className="text-2xl font-bold text-white">Made for real life</h2>
          <p className="text-gray-300 leading-relaxed max-w-2xl mx-auto">
            GlowBlocks look incredible on a nightstand, a bookshelf, a desk, or a kid&apos;s bedroom wall. A soft glow in whatever colour feels like you. Your name, a word that means something, a place, initials — if it can be spelled, we can make it glow.
          </p>
        </section>

        {/* The Perfect Gift */}
        <section className="text-center space-y-6">
          <h2 className="text-2xl font-bold text-white">The perfect gift</h2>
          <p className="text-gray-300 leading-relaxed max-w-2xl mx-auto">
            Genuinely hard to find. Completely personal. Nothing else like it. Whether it&apos;s a name for a nursery, a word for a loved one, or something just for you — GlowBlocks is the kind of gift people keep for years.
          </p>
        </section>

        {/* Coming Soon — GlowBlocks Words */}
        <section>
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-xs font-semibold text-purple-300 uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">GlowBlocks: Words</h2>
            <p className="text-gray-300 leading-relaxed">
              A spelling game built on the same tiles you already love. Tap a word card on the reader — it reads the word out loud. Then your child finds the right letter tiles and connects them in order. Get it right and the whole word lights up. A toy and a spelling enrichment tool in one. Perfect for kids, classrooms, and family game nights.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold text-cyan-400 tracking-widest">BUILD. CONNECT. GLOW.</p>
          <Link
            href="/customize"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-full transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
          >
            Build Yours
          </Link>
        </div>
      </div>
    </div>
  );
}
