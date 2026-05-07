'use client';

import { useState } from 'react';
import Link from 'next/link';

const SERVICE_TYPES = [
  { value: 'Battery Replacement', label: 'Battery Replacement', description: 'Replace the CR2450 coin-cell battery in your Glowblock' },
  { value: 'Enclosure Repair', label: 'Glowblocks Enclosure', description: 'Repair or replace a damaged enclosure' },
  { value: 'LED Repair', label: 'LED Repair', description: 'Fix or replace malfunctioning LEDs' },
  { value: 'Color Reprogramming', label: 'Color Reprogramming', description: 'Change the color programmed on your Glowblock' },
  { value: 'General Servicing', label: 'General Servicing', description: 'Cleaning, inspection, or general maintenance' },
  { value: 'Other', label: 'Other', description: 'Something else not listed above' },
];

export default function ServicePage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    orderNumber: '',
    serviceType: '',
    details: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serviceType) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('success');
        setForm({ name: '', email: '', orderNumber: '', serviceType: '', details: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Glowblocks Service Request</h1>
          <p className="text-gray-400">
            Need a battery replacement, repair, or other servicing? Submit a request below and we&apos;ll send you a return label and box.
          </p>
          <p className="text-sm text-gray-500">
            You can also email us directly at{' '}
            <a href="mailto:orders@glowblocks.shop" className="text-purple-400 hover:text-purple-300">
              orders@glowblocks.shop
            </a>
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-green-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Service Request Submitted!</h2>
            <p className="text-gray-400">We&apos;ll review your request and get back to you with return instructions and next steps.</p>
            <button
              onClick={() => setStatus('idle')}
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              Submit another request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Order Number <span className="text-gray-500">(optional)</span></label>
              <input
                type="text"
                value={form.orderNumber}
                onChange={(e) => setForm(f => ({ ...f, orderNumber: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="If you have your order number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Service Type</label>
              <div className="space-y-2">
                {SERVICE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.serviceType === type.value
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="serviceType"
                      value={type.value}
                      checked={form.serviceType === type.value}
                      onChange={(e) => setForm(f => ({ ...f, serviceType: e.target.value }))}
                      className="mt-1 text-purple-500 focus:ring-purple-500 bg-gray-800 border-gray-600"
                    />
                    <div>
                      <p className="text-white font-medium text-sm">{type.label}</p>
                      <p className="text-gray-500 text-xs">{type.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Additional Details <span className="text-gray-500">(optional)</span></label>
              <textarea
                rows={4}
                value={form.details}
                onChange={(e) => setForm(f => ({ ...f, details: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                placeholder="Describe the issue or what you need help with..."
              />
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-sm">Something went wrong. Please try again or email orders@glowblocks.shop.</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending' || !form.serviceType}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'sending' ? 'Submitting...' : 'Submit Service Request'}
            </button>

            <p className="text-center text-xs text-gray-500">
              Have a general question instead?{' '}
              <Link href="/contact" className="text-purple-400 hover:text-purple-300">Contact us</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
