'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

type MediaItem =
  | { type: 'image'; src: string; alt: string }
  | { type: 'video'; src: string; alt: string; portrait?: boolean };

const MEDIA: MediaItem[] = [
  { type: 'video', src: '/videos/gallery-1.mp4', alt: 'Glowblocks in action', portrait: true },
  { type: 'image', src: '/images/gallery/9.jpeg', alt: 'GlowBlocks photo 8' },
  { type: 'image', src: '/images/gallery/10.jpeg', alt: 'GlowBlocks photo 9' },
  { type: 'image', src: '/images/gallery/11.jpeg', alt: 'GlowBlocks photo 10' },
  { type: 'image', src: '/images/gallery/12.jpg', alt: 'GlowBlocks photo 11' },
];

export default function GalleryCarousel() {
  const [current, setCurrent] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const prev = () => setCurrent((c) => (c === 0 ? MEDIA.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === MEDIA.length - 1 ? 0 : c + 1));

  const item = MEDIA[current];
  const isPortraitVideo = item.type === 'video' && 'portrait' in item && item.portrait;

  // Pause video when navigating away, play when navigating to a video
  useEffect(() => {
    if (item.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [current, item.type]);

  return (
    <div className="relative max-w-4xl mx-auto">
      {/* Main display */}
      <div className={`relative bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden ${isPortraitVideo ? 'aspect-[9/16] max-w-sm mx-auto' : 'aspect-[16/10]'}`}>
        {item.type === 'video' ? (
          <video
            ref={videoRef}
            src={item.src}
            className="absolute inset-0 w-full h-full object-cover"
            controls
            muted
            autoPlay
            loop
            playsInline
          />
        ) : (
          <Image
            src={item.src}
            alt={item.alt}
            fill
            className="object-cover transition-opacity duration-500"
            sizes="(max-width: 768px) 100vw, 896px"
            priority={current === 0}
          />
        )}

        {/* Arrows */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Counter */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium z-10">
          {current + 1} / {MEDIA.length}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 mt-3 justify-center">
        {MEDIA.map((m, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all ${
              i === current ? 'border-purple-500 scale-105' : 'border-transparent opacity-50 hover:opacity-80'
            }`}
          >
            {m.type === 'video' ? (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                </svg>
              </div>
            ) : (
              <Image
                src={m.src}
                alt={m.alt}
                fill
                className="object-cover"
                sizes="64px"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
