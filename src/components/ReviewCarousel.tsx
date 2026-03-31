'use client';

import { useRef, useEffect, useState } from 'react';

const REVIEWS = [
  { name: 'Sarah M.', text: 'I ordered "EMMA" for my daughter\'s nursery. She watches them glow every night before bed. Perfect nightlight.', rating: 5, order: 'EMMA' },
  { name: 'James R.', text: 'We spelled out "LOVE" for our wedding. Everyone kept playing with them. Most talked-about detail at the reception.', rating: 5, order: 'LOVE' },
  { name: 'Carlos P.', text: 'Got "HAPPY BDAY" for a surprise party. The look on her face when it all lit up was priceless.', rating: 5, order: 'HAPPY BDAY' },
  { name: 'Michelle T.', text: 'The rainbow preset is gorgeous! "OLIVER" is the highlight of his room. So cool watching them light up.', rating: 5, order: 'OLIVER' },
  { name: 'Ashley W.', text: 'I\'ve ordered three sets now — one for each kid\'s room. The custom color picker makes it so easy. Incredible product!', rating: 5, order: 'Multiple' },
  { name: 'David K.', text: '"GAME ROOM" in American flag colours. Sets the perfect vibe in my basement. Really fun product.', rating: 4, order: 'GAME ROOM' },
  { name: 'Linda H.', text: 'Best gift I\'ve ever given. Baby showers, housewarmings, birthdays — everyone is always blown away.', rating: 5, order: 'Various' },
  { name: 'Ryan B.', text: '"CREATE" in ocean theme on my desk. Quality is top notch. The connecting mechanism is genuinely satisfying.', rating: 4, order: 'CREATE' },
  { name: 'Priya N.', text: 'Got "DREAM" for my daughter in sunset colours. She rearranges them every day and giggles when they light up.', rating: 5, order: 'DREAM' },
  { name: 'Tom L.', text: '"HOME" on our mantle. Subtle, warm, and everyone asks about it. Didn\'t expect to love them this much.', rating: 5, order: 'HOME' },
];

export default function ReviewCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animId: number;
    const speed = 0.5;

    const step = () => {
      if (!isPaused && !isDragging && el) {
        el.scrollLeft += speed;
        // Loop: when we've scrolled past the first set, jump back
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft = 0;
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    scrollStartX.current = scrollRef.current?.scrollLeft || 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const diff = e.clientX - dragStartX.current;
    scrollRef.current.scrollLeft = scrollStartX.current - diff;
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    dragStartX.current = e.touches[0].clientX;
    scrollStartX.current = scrollRef.current?.scrollLeft || 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    const diff = e.touches[0].clientX - dragStartX.current;
    scrollRef.current.scrollLeft = scrollStartX.current - diff;
  };

  const handleTouchEnd = () => setIsPaused(false);

  // Duplicate reviews for seamless loop
  const allReviews = [...REVIEWS, ...REVIEWS];

  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-x-hidden cursor-grab active:cursor-grabbing select-none px-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => { setIsPaused(false); setIsDragging(false); }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {allReviews.map((review, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-72 sm:w-80 bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3 hover:border-purple-500/30 transition-colors"
        >
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, j) => (
              <svg key={j} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={j < review.rating ? '#FBBF24' : '#374151'} className="w-4 h-4">
                <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" />
              </svg>
            ))}
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{review.text}</p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium">{review.name}</p>
            <p className="text-xs text-purple-400/70">&quot;{review.order}&quot;</p>
          </div>
        </div>
      ))}
    </div>
  );
}
