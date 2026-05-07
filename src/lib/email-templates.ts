const BRAND_COLOR = '#7c3aed';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://glowblocks.shop';

function wrap(content: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="${SITE_URL}/images/email-banner.png" alt="GlowBlocks Studio" style="width: 100%; max-width: 520px; border-radius: 12px;" />
      </div>
      ${content}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        Questions? Visit our <a href="${SITE_URL}/contact" style="color: ${BRAND_COLOR};">contact page</a>.
      </p>
    </div>
  `;
}

export function popupOrderConfirmationEmail(
  firstName: string,
  orderNumber: string,
  setsLabel: string,
  deliveryMethod: string,
): string {
  const deliveryNote = deliveryMethod === 'pick-up'
    ? "We'll let you know when your order is ready for pickup!"
    : 'Be on the lookout for your GlowBlocks in 5-7 business days!';

  return wrap(`
    <h2 style="color: ${BRAND_COLOR};">Thanks for your order, ${firstName}!</h2>
    <p>We've received your GlowBlocks order and are getting started on it.</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</p>
      <p style="margin: 0; font-family: monospace; font-size: 24px; color: #1f2937; font-weight: 700;">${orderNumber}</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">${setsLabel}</p>
    </div>
    <p>${deliveryNote}</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${SITE_URL}/order-status" style="display: inline-block; background: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Track Your Order</a>
    </div>
  `);
}

export function onlineOrderConfirmationEmail(
  firstName: string,
  itemListHtml: string,
  totalFormatted: string,
  fullAddress: string,
): string {
  return wrap(`
    <h2 style="color: ${BRAND_COLOR};">Thanks for your order, ${firstName}!</h2>
    <p>We've received your GlowBlocks order and are getting started on it.</p>
    <h3>Order Details</h3>
    <ul>${itemListHtml}</ul>
    <p><strong>Total:</strong> ${totalFormatted}</p>
    <p><strong>Shipping to:</strong> ${fullAddress || 'N/A'}</p>
    <p><strong>Estimated delivery:</strong> 5-7 business days</p>
    <p style="color: #6b7280; font-size: 13px;">We'll send you a tracking number once your order ships.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${SITE_URL}/order-status" style="display: inline-block; background: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Track Your Order</a>
    </div>
  `);
}

export function inProgressEmail(firstName: string): string {
  return wrap(`
    <h2 style="color: ${BRAND_COLOR};">We're working on your order, ${firstName}!</h2>
    <p>Your custom GlowBlocks set is now being built. We'll let you know as soon as it's ready.</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 32px;">🔧</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">Your GlowBlocks are being crafted</p>
    </div>
  `);
}

export function donePickupEmail(firstName: string): string {
  return wrap(`
    <h2 style="color: ${BRAND_COLOR};">Your order is ready, ${firstName}!</h2>
    <p>Your custom GlowBlocks set is complete and ready for pickup. Come grab it!</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 32px;">✅</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">Ready for Pickup</p>
    </div>
  `);
}

export function doneShipEmail(firstName: string): string {
  return wrap(`
    <h2 style="color: ${BRAND_COLOR};">Your order is complete, ${firstName}!</h2>
    <p>Your custom GlowBlocks set is finished and being prepared for shipment. We'll send you tracking info once it ships.</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 32px;">📦</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">Preparing for Shipment</p>
    </div>
  `);
}

export function shippedEmail(
  firstName: string,
  trackingNumber: string,
  trackingUrl: string,
  orderItems?: string,
  orderTotal?: string,
  shippingAddress?: string,
): string {
  const greeting = firstName ? `Hey ${firstName},` : 'Hi,';
  return wrap(`
    <h2 style="color: ${BRAND_COLOR}; margin-bottom: 4px;">${greeting} your GlowBlocks are on the way!</h2>
    <p style="color: #6b7280; margin-top: 0;">Your order has been shipped via USPS and is headed your way.</p>

    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Tracking Number</p>
      <p style="margin: 0 0 12px; font-family: monospace; font-size: 18px; color: #1f2937; word-break: break-all;">${trackingNumber}</p>
      <a href="${trackingUrl}" style="display: inline-block; background: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Track Your Package</a>
    </div>

    <p style="color: #6b7280; font-size: 13px; font-style: italic;">Note: Tracking info may take 1-2 days to update after label creation.</p>

    ${orderItems ? `
    <h3 style="color: #1f2937; font-size: 15px; margin-bottom: 8px;">Order Details</h3>
    <p style="margin: 0 0 4px; color: #374151;">${orderItems}</p>
    ${orderTotal ? `<p style="margin: 0 0 4px; color: #374151;"><strong>Total:</strong> ${orderTotal}</p>` : ''}
    ` : ''}

    ${shippingAddress ? `
    <h3 style="color: #1f2937; font-size: 15px; margin-bottom: 8px;">Shipping To</h3>
    <p style="margin: 0; color: #374151;">${shippingAddress}</p>
    ` : ''}
  `);
}

export function deliveredEmail(firstName: string): string {
  return wrap(`
    <h2 style="color: ${BRAND_COLOR};">Your GlowBlocks have arrived, ${firstName}!</h2>
    <p>Your package has been delivered. We hope you love your custom GlowBlocks!</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 32px;">🎉</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">Package Delivered</p>
    </div>
    <p>Set them up, turn off the lights, and enjoy the glow! If you have any questions about your blocks, don't hesitate to reach out.</p>
  `);
}

export function followUpEmail(firstName: string, reviewUrl: string): string {
  return wrap(`
    <h2 style="color: ${BRAND_COLOR};">How are you loving your GlowBlocks, ${firstName}?</h2>
    <p>We'd love to hear what you think! Share a photo and leave a review — it means the world to us.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${reviewUrl}" style="display: inline-block; background: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Leave a Review</a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">You can also attach a photo of your GlowBlocks in action!</p>
  `);
}
