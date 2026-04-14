export default function FaqPage() {
  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-center gradient-text">Questions</h1>
        <p className="text-center text-gray-400">The stuff people usually ask.</p>

        <div className="space-y-4">
          <FaqItem
            q="What are GlowBlocks?"
            a="Personalised letter tiles that glow when you connect them together. Pick a name, we make the tiles, you connect them and watch them light up."
          />
          <FaqItem
            q="How do they work?"
            a="Place your letters together and they glow. Pull one away and it goes dark. Push them back together and they come right back. No Wi-Fi. No app. No setup."
          />
          <FaqItem
            q="What's the setup like?"
            a="Unbox. Connect. Done. That's the whole setup."
          />
          <FaqItem
            q="How long do the batteries last?"
            a="5-7 months while connected. When tiles aren't touching each other, they enter sleep mode and conserve battery. When it's time for a swap, it takes seconds."
          />
          <FaqItem
            q="How bright are they?"
            a="Not harsh at all. The tiles breathe slowly and softly — more like a candle that doesn't flicker. It's the kind of glow you want on a nightstand, not a spotlight."
          />
          <FaqItem
            q="How big are they?"
            a="Each tile is 2.52 inches wide by 2.5 inches tall. Small enough to fit anywhere, big enough to notice."
          />
          <FaqItem
            q="Can I choose different colours for each letter?"
            a="Yes. You can pick a preset theme that applies colours automatically, or switch to custom mode and choose the exact colour for each individual letter."
          />
          <FaqItem
            q="What are the preset themes?"
            a="Rainbow, American Flag, Party, Tropical, Sunset, and Ocean. Each one applies a curated set of colours across your letters. Or go fully custom with any hex colour you want."
          />
          <FaqItem
            q="How much do they cost?"
            a="$12.00 per letter for 1-3 letters, $11.00 for 4-6, $10.00 for 7-9, and $9.00 for 10+. The longer the word, the better the deal. Custom colours are a one-time $5 fee."
          />
          <FaqItem
            q="How long does shipping take?"
            a="Standard shipping is 5-7 business days ($5.99). Express is 2-3 business days ($12.99). You pick at checkout."
          />
          <FaqItem
            q="Where do you ship?"
            a="US, Canada, UK, and Australia for now."
          />
          <FaqItem
            q="Can I return them?"
            a="Yes — 30-day return policy. If they're unused and undamaged, you get a full refund. Check our return policy page for details."
          />
          <FaqItem
            q="What's GlowBlocks: Words?"
            a="It's coming soon. A spelling game that uses the same tiles. Tap a word card on the reader — it reads the word out loud — then your child finds the right letters and connects them. Get it right and the word lights up. It's a toy and a spelling enrichment tool in one. Stay tuned."
          />
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-gray-900/50 border border-gray-800 rounded-lg">
      <summary className="flex items-center justify-between p-4 cursor-pointer text-white font-medium hover:text-purple-400 transition-colors">
        {q}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0 ml-4 transition-transform group-open:rotate-180">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </summary>
      <p className="px-4 pb-4 text-gray-400 text-sm leading-relaxed">{a}</p>
    </details>
  );
}
