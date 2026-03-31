'use client';

import { useState } from 'react';
import Image from 'next/image';

const PHOTOS = [
  { src: '/images/gallery/1.jpg', alt: 'GlowBlocks on a nightstand' },
  { src: '/images/gallery/2.jpg', alt: 'GlowBlocks on a bookshelf' },
  { src: '/images/gallery/3.jpg', alt: 'GlowBlocks in a nursery' },
  { src: '/images/gallery/4.jpg', alt: 'GlowBlocks on a desk' },
  { src: '/images/gallery/5.jpg', alt: 'GlowBlocks as a gift' },
  { src: '/images/gallery/6.jpg', alt: 'GlowBlocks close-up' },
];

export default function GalleryCarousel() {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? PHOTOS.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === PHOTOS.length - 1 ? 0 : c + 1));

  return (
    <div className="relative max-w-4xl mx-auto">
      {/* Main image */}
      <div className="relative aspect-[16/10] bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <Image
          src={PHOTOS[current].src}
          alt={PHOTOS[current].alt}
          fill
          className="object-cover transition-opacity duration-500"
          sizes="(max-width: 768px) 100vw, 896px"
          priority={current === 0}
        />

        {/* Arrows */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Counter */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
          {current + 1} / {PHOTOS.length}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 mt-3 justify-center">
        {PHOTOS.map((photo, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all ${
              i === current ? 'border-purple-500 scale-105' : 'border-transparent opacity-50 hover:opacity-80'
            }`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              className="object-cover"
              sizes="64px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
