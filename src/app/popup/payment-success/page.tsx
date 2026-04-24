export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-600 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-green-300">Payment Complete!</h1>
        <p className="text-gray-300 text-lg">
          Your GlowBlocks order has been paid. You can close this page.
        </p>
        <p className="text-gray-500 text-sm">
          Thank you for your purchase!
        </p>
      </div>
    </div>
  );
}
