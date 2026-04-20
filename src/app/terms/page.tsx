export default function TermsPage() {
  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Terms of Service</h1>
          <p className="text-gray-500 text-sm">Last updated: March 2026</p>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed text-sm">
          <Section title="Agreement">
            <p>
              By using the GlowBlocks Studio website and placing an order, you agree to these terms. If you don&apos;t agree, please don&apos;t use the site.
            </p>
          </Section>

          <Section title="Products">
            <p>
              GlowBlocks are personalised illuminating letter tiles. Each tile is approximately 2.52&quot; wide x 2.5&quot; tall. Colours may vary slightly from what you see on screen due to differences in displays. We do our best to match your selections as closely as possible.
            </p>
          </Section>

          <Section title="Orders and pricing">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Prices are listed in USD</li>
              <li>1-3 letters: $12.00 per letter</li>
              <li>4-6 letters: $11.00 per letter</li>
              <li>7-9 letters: $10.00 per letter</li>
              <li>10+ letters: $9.00 per letter</li>
              <li>Custom colours: one-time $2.00 fee</li>
              <li>Shipping costs are calculated at checkout</li>
            </ul>
            <p className="mt-2">
              We reserve the right to update pricing at any time. The price at the time of your order is the price you pay.
            </p>
          </Section>

          <Section title="Payment">
            <p>
              All payments are processed securely through Stripe. By placing an order, you confirm that you are authorised to use the payment method provided. Orders are not processed until payment is confirmed.
            </p>
          </Section>

          <Section title="Shipping">
            <p>
              We offer Standard (5–7 business days, $5.99) and Express (2–3 business days, $12.99) shipping. Delivery times are estimates and not guaranteed. We are not responsible for delays caused by shipping carriers.
            </p>
          </Section>

          <Section title="SMS notifications">
            <p>
              By placing a pop-up pickup order and providing your phone number, you consent to receive transactional SMS messages related to your order. These include an order confirmation and a pickup-ready notification. We do not send marketing messages. Message and data rates may apply. You may opt out of SMS notifications by contacting us through our{' '}
              <a href="/contact" className="text-purple-400 hover:text-purple-300 underline">contact page</a>.
            </p>
          </Section>

          <Section title="Returns and refunds">
            <p>
              We offer a 30-day return policy for unused and undamaged items. GlowBlocks are custom-made products — please double-check your order before submitting. See our{' '}
              <a href="/returns" className="text-purple-400 hover:text-purple-300 underline">return policy</a> for full details.
            </p>
          </Section>

          <Section title="Custom products">
            <p>
              Because GlowBlocks are made to order with your chosen letters and colours, we cannot accept returns on items that were made correctly to your specifications unless they are defective.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              All content on this website — including text, images, logos, and design — is the property of GlowBlocks Studio. You may not copy, reproduce, or distribute any content without our permission.
            </p>
          </Section>

          <Section title="User reviews">
            <p>
              By submitting a review, you grant us permission to display it on our website. We reserve the right to remove reviews that are abusive, spam, or otherwise inappropriate.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              GlowBlocks Studio is not liable for any indirect, incidental, or consequential damages arising from the use of our products or website. Our total liability is limited to the amount you paid for your order.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. Continued use of the website after changes are posted constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Reach out through our{' '}
              <a href="/contact" className="text-purple-400 hover:text-purple-300 underline">contact page</a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
