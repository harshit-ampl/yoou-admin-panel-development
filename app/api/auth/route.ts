export const dynamic = 'force-dynamic'; // Forces dynamic behavior

import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES!;
const SHOPIFY_AUTH_CALLBACK_URL = process.env.SHOPIFY_AUTH_CALLBACK_URL!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

function validateHmac(query: URLSearchParams): boolean {
  const hmac = query.get('hmac');
  if (!hmac) return false;

  // Remove hmac from the parameters
  query.delete('hmac');

  // Create the message from the remaining parameters
  const message = Array.from(query.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  // Calculate the HMAC
  const calculatedHmac = crypto
    .createHmac('sha256', SHOPIFY_CLIENT_SECRET)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(
    new Uint8Array(Buffer.from(hmac)),
    new Uint8Array(Buffer.from(calculatedHmac))
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  const hmac = searchParams.get('hmac');
  const host = searchParams.get('host');

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 });
  }

  // Validate HMAC if present (coming from Shopify)
  if (hmac && !validateHmac(searchParams)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 400 });
  }

  // Validate the shop domain
  if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  // Construct the authorization URL
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', SHOPIFY_CLIENT_ID);
  authUrl.searchParams.set('scope', SHOPIFY_SCOPES);
  authUrl.searchParams.set('redirect_uri', SHOPIFY_AUTH_CALLBACK_URL);

  // Pass host parameter if present
  if (host)
    authUrl.searchParams.set('host', host);
  
  // Generate and store a nonce for security
  const nonce = Math.random().toString(36).substring(2);
  authUrl.searchParams.set('state', nonce);

  return NextResponse.redirect(authUrl.toString());
}
