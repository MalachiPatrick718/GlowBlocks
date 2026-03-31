import Link from 'next/link';

export default function ReturnsPage() {
  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Return Policy</h1>
          <p className="text-gray-400">We want you to love your GlowBlocks. Here&apos;s our return policy.</p>
        </div>

        <div className="space-y-8">
          <PolicySection title="30-Day Return Window">
            <p>
              You have <strong className="text-white">30 days</strong> from the date of delivery to return your
              GlowBlocks for a full refund. If 30 days have passed since delivery, we unfortunately cannot
              offer a refund or exchange.
            </p>
          </PolicySection>

          <PolicySection title="Conditions for Return">
            <ul className="list-disc list-inside space-y-2">
              <li>Items must be <strong className="text-white">unused and undamaged</strong> in their original condition.</li>
              <li>All blocks from the order must be included in the return.</li>
              <li>Items must be in the original packaging, if applicable.</li>
              <li>A proof of purchase (order confirmation email or receipt) is required.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Non-Returnable Items">
            <ul className="list-disc list-inside space-y-2">
              <li>Blocks that have been used, connected, or show signs of wear.</li>
              <li>Items damaged due to misuse, accidents, or unauthorized modifications.</li>
              <li>Gift cards or promotional items.</li>
            </ul>
          </PolicySection>

          <PolicySection title="How to Start a Return">
            <ol className="list-decimal list-inside space-y-2">
              <li>Visit our <Link href="/contact" className="text-purple-400 hover:text-purple-300 underline">Contact Page</Link> and select &quot;Returns&quot; as the subject.</li>
              <li>Include your order number and reason for return in the message.</li>
              <li>Our team will respond within 1-2 business days with return instructions.</li>
              <li>Ship the items back using the provided return label or instructions.</li>
              <li>Once we receive and inspect the return, your refund will be processed within 5-7 business days.</li>
            </ol>
          </PolicySection>

          <PolicySection title="Refunds">
            <p>
              Refunds are issued to the original payment method. Please allow 5-7 business days for the refund
              to appear on your statement after we process the return. Shipping costs are non-refundable unless
              the return is due to a defect or error on our part.
            </p>
          </PolicySection>

          <PolicySection title="Defective or Damaged Items">
            <p>
              If your GlowBlocks arrive damaged or defective, please <Link href="/contact" className="text-purple-400 hover:text-purple-300 underline">contact us</Link> immediately.
              We&apos;ll arrange a replacement or full refund at no extra cost, including return shipping.
            </p>
          </PolicySection>

          <PolicySection title="Exchanges">
            <p>
              We currently do not offer direct exchanges. To get a different set, please return your original
              order for a refund and place a new order through our website.
            </p>
          </PolicySection>
        </div>

        <div className="text-center pt-4 space-y-4">
          <p className="text-gray-400">Have questions about a return?</p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-full transition-all"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="text-gray-400 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
