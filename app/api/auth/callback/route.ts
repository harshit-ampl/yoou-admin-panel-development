import { NextResponse } from 'next/server';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!shop || !code) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to obtain access token');
    }

    const { access_token } = await tokenResponse.json();

    // Here you would typically store the access token securely
    // For example, in a database associated with the shop

    // Log the successful installation
    console.log(`App installed successfully for shop: ${shop}`);

    // Redirect back to Shopify admin if host is present
    if (host) {
      const decodedHost = Buffer.from(host, 'base64').toString();
      return NextResponse.redirect(`https://${decodedHost}/apps/${SHOPIFY_CLIENT_ID}`);
    } else {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}