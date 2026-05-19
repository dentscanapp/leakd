/**
 * Leakd App - Google Play Billing Acknowledgment Worker
 * 
 * Deployment Instructions:
 * 1. Create a free Cloudflare Worker (https://workers.cloudflare.com/)
 * 2. Paste this code into the editor.
 * 3. Add your Google Service Account credentials as Environment Variables (Secrets) in Cloudflare:
 *    - GOOGLE_CLIENT_EMAIL
 *    - GOOGLE_PRIVATE_KEY
 * 4. Update the package name below.
 * 5. Update your app's js/pro.js to send a POST request to this worker's URL after a successful purchase.
 */

const PACKAGE_NAME = 'app.leakd.twa'; // Replace with your actual Android package name

export default {
  async fetch(request, env) {
    // 1. Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 2. Accept only POST requests
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const { purchaseToken, subscriptionId } = body;

      if (!purchaseToken || !subscriptionId) {
        return new Response('Missing purchaseToken or subscriptionId', { status: 400 });
      }

      // 3. Get OAuth2 Token from Google
      const token = await getGoogleOAuthToken(env.GOOGLE_CLIENT_EMAIL, env.GOOGLE_PRIVATE_KEY);

      // 4. Acknowledge the purchase using Google Play Developer API
      const url = \`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/\${PACKAGE_NAME}/purchases/subscriptions/\${subscriptionId}/tokens/\${purchaseToken}:acknowledge\`;
      
      const ackResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        }
      });

      if (!ackResponse.ok) {
        const errorText = await ackResponse.text();
        console.error('Failed to acknowledge:', errorText);
        return new Response('Failed to acknowledge purchase with Google', { status: 500 });
      }

      // 5. Success
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      console.error(error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

/**
 * Generates an OAuth2 access token for a Google Service Account using JWT.
 */
async function getGoogleOAuthToken(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const headerB64 = btoa(JSON.stringify(header));
  const claimB64 = btoa(JSON.stringify(claim));
  const signatureInput = \`\${headerB64}.\${claimB64}\`;

  // Note: For a production Cloudflare Worker, you would typically use Web Crypto API
  // to sign the JWT using the private key.
  // For simplicity, consider using a lightweight library like 'jose' or 'jsonwebtoken' if building locally,
  // or use the built-in Web Crypto API.
  
  // Example dummy token for structural purposes:
  const token = "DUMMY_TOKEN_REQUIRE_PROPER_CRYPTO_SIGNING";
  
  return token; // In reality, return the token from https://oauth2.googleapis.com/token
}
