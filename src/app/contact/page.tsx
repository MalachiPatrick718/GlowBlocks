'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('success');
        setForm({ name: '', email: '', subject: 'General', message: '' });
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
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Contact Us</h1>
          <p className="text-gray-400">
            Have a question, feedback, or need help with an order? We&apos;d love to hear from you.
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-green-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Message Sent!</h2>
            <p className="text-gray-400">Thank you for reaching out. We&apos;ll get back to you as soon as possible.</p>
            <button
              onClick={() => setStatus('idle')}
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              Send another message
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Subject</label>
              <select
                value={form.subject}
                onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                <option value="General">General Inquiry</option>
                <option value="Order Issue">Order Issue</option>
                <option value="Feedback">Feedback</option>
                <option value="Returns">Returns</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                placeholder="How can we help?"
              />
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-sm">Something went wrong. Please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
