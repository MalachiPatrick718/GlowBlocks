'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Review {
  name: string;
  rating: number;
  text: string;
  date: string;
  order: string;
}

const SEED_REVIEWS: Review[] = [
  { name: 'Sarah M.', rating: 5, text: 'I ordered "EMMA" for my daughter\'s nursery and it looks absolutely stunning! The colors are vibrant and the glow is just perfect. She loves watching the letters light up.', date: 'March 2026', order: 'EMMA - Tropical theme' },
  { name: 'James R.', rating: 5, text: 'Got these for our wedding reception spelling out "LOVE" in custom colors to match our theme. Everyone was asking about them! Great quality and fast shipping.', date: 'February 2026', order: 'LOVE - Custom colors' },
  { name: 'Michelle T.', rating: 5, text: 'The rainbow preset is gorgeous! I ordered my son\'s name "OLIVER" and it\'s the highlight of his room. The way the blocks light up when you connect them is so cool.', date: 'February 2026', order: 'OLIVER - Rainbow theme' },
  { name: 'David K.', rating: 4, text: 'Really fun product. I spelled out "GAME ROOM" for my basement and it sets the perfect vibe. The American flag colors look awesome.', date: 'January 2026', order: 'GAME ROOM - American Flag theme' },
  { name: 'Ashley W.', rating: 5, text: 'I\'ve ordered three sets now — one for each of my kids\' rooms. The custom color picker makes it so easy to match their room decor. Incredible product!', date: 'January 2026', order: 'Multiple orders - Custom colors' },
  { name: 'Carlos P.', rating: 5, text: 'Used these for a surprise birthday party spelling "HAPPY BDAY" in party colors. The look on her face was priceless. Super easy to order and the preview tool is spot on.', date: 'December 2025', order: 'HAPPY BDAY - Party theme' },
  { name: 'Linda H.', rating: 5, text: 'These make the best gifts! I\'ve given them for baby showers, housewarmings, and birthdays. Everyone is always blown away. The sunset theme is my personal favorite.', date: 'December 2025', order: 'Various - Sunset theme' },
  { name: 'Ryan B.', rating: 4, text: 'Quality is top notch and the ocean theme looks incredible on my desk spelling "CREATE". The connecting mechanism is satisfying. Would love even more color presets in the future!', date: 'November 2025', order: 'CREATE - Ocean theme' },
];

function Stars({ count, interactive, onSelect }: { count: number; interactive?: boolean; onSelect?: (n: number) => void }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={i < (hover || count) ? '#FBBF24' : '#374151'}
          className={`w-5 h-5 ${interactive ? 'cursor-pointer transition-colors' : ''}`}
          onClick={() => interactive && onSelect?.(i + 1)}
          onMouseEnter={() => interactive && setHover(i + 1)}
          onMouseLeave={() => interactive && setHover(0)}
        >
          <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [order, setOrder] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    fetch('/api/reviews')
      .then((res) => res.json())
      .then((data) => {
        setReviews(data.length > 0 ? data : SEED_REVIEWS);
        setLoading(false);
      })
      .catch(() => { setReviews(SEED_REVIEWS); setLoading(false); });
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !text.trim() || rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), rating, text: text.trim(), order: order.trim() }),
      });
      if (res.ok) {
        setSuccess(true);
        setName('');
        setRating(0);
        setOrder('');
        setText('');
        const updated = await fetch('/api/reviews').then((r) => r.json());
        setReviews(updated);
        setTimeout(() => { setSuccess(false); setShowForm(false); }, 2000);
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Customer Reviews</h1>
          {reviews.length > 0 && (
            <div className="flex items-center justify-center gap-3">
              <Stars count={Math.round(avgRating)} />
              <span className="text-white font-semibold text-lg">{avgRating.toFixed(1)}</span>
              <span className="text-gray-400">({reviews.length} reviews)</span>
            </div>
          )}
        </div>

        {/* Leave a Review */}
        <div className="text-center">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 border border-purple-500/50 text-purple-400 hover:bg-purple-500/10 rounded-full font-medium transition-colors"
            >
              Leave a Review
            </button>
          ) : (
            <div className="max-w-lg mx-auto bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4 text-left">
              {success ? (
                <div className="text-center py-6">
                  <p className="text-green-400 font-semibold text-lg">Thanks for your review!</p>
                </div>
              ) : (
                <>
                  <h3 className="text-white font-semibold text-lg">Write a review</h3>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Your name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane D."
                      maxLength={50}
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Rating</label>
                    <Stars count={rating} interactive onSelect={setRating} />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">What did you order?</label>
                    <input
                      type="text"
                      value={order}
                      onChange={(e) => setOrder(e.target.value)}
                      placeholder="EMMA - Rainbow theme"
                      maxLength={100}
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Your review</label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Tell us what you think..."
                      maxLength={1000}
                      rows={4}
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !name.trim() || !text.trim() || rating === 0}
                      className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-semibold transition-all"
                    >
                      {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Reviews List */}
        {loading ? (
          <p className="text-center text-gray-500">Loading reviews...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((review, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3 hover:border-purple-500/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{review.name}</p>
                    <p className="text-xs text-gray-500">{review.date}</p>
                  </div>
                  <Stars count={review.rating} />
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{review.text}</p>
                {review.order && <p className="text-xs text-purple-400">{review.order}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="text-center pt-4">
          <Link
            href="/customize"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-full transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
          >
            Create Your Own GlowBlocks
          </Link>
        </div>
      </div>
    </div>
  );
}
