interface AstroAppAuth {
  token: string;
  expiresAt: number;
  usesLeft: number;
  cookies: string;
}

// In-memory token storage
let currentAuth: AstroAppAuth | null = null;

// Lightweight billable-call accounting. AstroApp meters every request to
// astroapp.com, and token generation is itself a billable chart request. These
// markers let usage be reconciled against AstroApp's invoice from the logs.
let billableCallsToday = 0;
let billableCountDate = '';

function recordBillableCall(kind: string): void {
  const today = new Date().toISOString().split('T')[0];
  if (today !== billableCountDate) {
    billableCountDate = today;
    billableCallsToday = 0;
  }
  billableCallsToday++;
  console.log(`[ASTROAPP BILLABLE] ${kind} — call #${billableCallsToday} on ${today}`);
}

// Returns the sticky-session cookies captured at the last successful login, or ''.
export function getAstroAppCookies(): string {
  return currentAuth?.cookies ?? '';
}

export async function getAstroAppToken(): Promise<string> {
  // Check if we have a valid token
  if (currentAuth && currentAuth.expiresAt > Date.now() && currentAuth.usesLeft > 0) {
    console.log('TOKEN REUSE - Uses left before:', currentAuth.usesLeft);
    currentAuth.usesLeft--;
    console.log('TOKEN REUSE - Uses left after:', currentAuth.usesLeft);
    console.log('TOKEN REUSE - Token age (minutes):', (Date.now() - (currentAuth.expiresAt - 60*60*1000)) / (1000*60));
    return currentAuth.token;
  }

  console.log('TOKEN GENERATION - Need new token. Current auth state:', {
    exists: !!currentAuth,
    expired: currentAuth ? currentAuth.expiresAt <= Date.now() : 'N/A',
    usesLeft: currentAuth?.usesLeft || 'N/A'
  });

  // Get credentials
  const email = process.env.ASTROAPP_USERNAME;
  const password = process.env.ASTROAPP_PASSWORD;
  const apiKey = process.env.ASTROAPP_API_KEY;

  if (!email || !password || !apiKey) {
    throw new Error('AstroApp credentials not configured');
  }

  // Create Basic Auth header using email:password
  const basicAuth = Buffer.from(`${email}:${password}`).toString('base64');

  try {
    
    // Step 1: Use Basic Auth to get JWT token from working chart endpoint
    recordBillableCall('token-auth (chart POST)');
    const response = await fetch('https://astroapp.com/astro/apis/chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
        'Key': apiKey
      },
      body: JSON.stringify({
        chart: {
          chartData: {
            chartName: "JWT Auth Request",
            chartDate: "2000-01-01T12:00:00",
            lat: 0,
            lng: 0,
            tz: "UTC",
            zodiacID: 100,
            houseSystemID: 1,
            coordSys: "G",
            version: 1
          }
        },
        calcRequestProps: {
          needImage: "N",
          needAspects: "N"
        },
        params: {
          objects: [0]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get JWT token: ${response.status}`);
    }

    // Extract JWT from response headers
    const jwtToken = response.headers.get('jwt');

    // Capture AstroApp's sticky-session cookies (route / SRVGROUP). AstroApp's load
    // balancer pins the JWT to the server group that issued it; data requests MUST
    // carry these cookies or they hit a different server and get 401 "Restricted to
    // valid users". This is the fix for the mini's transits/sky 401 (2026-08-23).
    const setCookies = (response.headers as any).getSetCookie
      ? (response.headers as any).getSetCookie()
      : [response.headers.get('set-cookie')];
    const cookieHeader = (setCookies as (string | null)[])
      .filter(Boolean)
      .map((c) => (c as string).split(';')[0])
      .join('; ');

    console.log('JWT AUTH SUCCESS - Response status:', response.status);
    console.log('JWT AUTH SUCCESS - JWT token received:', !!jwtToken);
    console.log('JWT AUTH SUCCESS - JWT token length:', jwtToken?.length || 0);
    
    if (!jwtToken) {
      throw new Error('No JWT token found in response headers');
    }

    // Store the token + the sticky-session cookies that must accompany it
    currentAuth = {
      token: jwtToken,
      expiresAt: Date.now() + (60 * 60 * 1000), // 60 minutes
      usesLeft: 99, // We just used 1 to get the token
      cookies: cookieHeader
    };

    console.log('JWT AUTH SUCCESS - Token stored, uses left:', currentAuth.usesLeft);
    return jwtToken;
  } catch (error) {
    console.error('Error getting JWT token:', error);
    throw error;
  }
}

export async function makeAstroAppRequest(url: string, options: RequestInit = {}): Promise<any> {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] STARTING ASTROAPP API REQUEST`);
  
  const token = await getAstroAppToken();
  const apiKey = process.env.ASTROAPP_API_KEY;

  if (!apiKey) {
    throw new Error('ASTROAPP_API_KEY not configured');
  }

  console.log(`[${requestId}] MAKING ASTROAPP API REQUEST`);
  console.log(`[${requestId}] USING JWT TOKEN length:`, token?.length || 0);
  // Build headers and prevent Authorization/Key overrides for security
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Force correct authentication headers (prevent override)
  headers.Authorization = `Bearer ${token}`;
  headers.Key = apiKey;
  // Carry AstroApp's sticky-session cookies so the data request lands on the same
  // server group that issued the JWT (else 401 "Restricted to valid users").
  if (currentAuth?.cookies) headers.Cookie = currentAuth.cookies;
  
  // Headers configured; credentials are never logged.

  recordBillableCall('data-request');
  // AstroApp's transits endpoint signals success with a 302. Node fetch auto-follows
  // redirects by DEFAULT and drops the Authorization/Key headers on the followed hop,
  // so the redirected request lands unauthenticated -> 401 "Restricted to valid users".
  // redirect:'manual' stops the follow so the 302 returns as-is and is treated as success.
  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual'
  });

  // AstroApp transits endpoint returns 302 as success - handle this explicitly
  if (!response.ok && response.status !== 302) {
    const responseText = await response.text();
    
    console.log(`[${requestId}] API Error:`, response.status);
    
    // Handle token expiration
    if (response.status === 401 || responseText === 'EXPIRED' || responseText.includes('EXPIRED') || responseText.includes('Restricted to valid users')) {
      currentAuth = null;
      const newToken = await getAstroAppToken();
      
      const retryHeaders: any = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      retryHeaders.Authorization = `Bearer ${newToken}`;
      retryHeaders.Key = apiKey;
      const retryCookies = getAstroAppCookies();
      if (retryCookies) retryHeaders.Cookie = retryCookies;
      
      recordBillableCall('data-request-retry');
      const retryResponse = await fetch(url, {
        ...options,
        headers: retryHeaders,
        redirect: 'manual'
      });

      if (!retryResponse.ok && retryResponse.status !== 302) {
        throw new Error(`AstroApp API error: ${retryResponse.status}`);
      }

      console.log(`[${requestId}] RETRY SUCCESS:`, retryResponse.status);
      return retryResponse.json();
    }
    
    // Don't throw error for 302 responses - AstroApp treats these as success
    if (response.status !== 302) {
      throw new Error(`AstroApp API error: ${response.status}`);
    }
  }

  console.log(`[${requestId}] API SUCCESS:`, response.status);
  return response.json();
}
