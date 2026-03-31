import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-yellow-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold text-white">Checkout Cancelled</h1>
      <p className="text-gray-400 max-w-md">
        Your order was not completed. Don&apos;t worry — your cart items are still saved.
      </p>
      <div className="flex gap-4 mt-4">
        <Link
          href="/cart"
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all"
        >
          Back to Cart
        </Link>
        <Link
          href="/"
          className="px-6 py-3 border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
