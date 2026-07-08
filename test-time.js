import 'dotenv/config';

async function testConnection() {
  const username = process.env.IG_USERNAME;
  const password = process.env.IG_PASSWORD;
  const apiKey = process.env.IG_DEMO_API_KEY;
  const mode = process.env.IG_MODE || 'demo';

  console.log(`[IG Test] Starting test in mode: ${mode}`);
  console.log(`[IG Test] Username: ${username}`);
  console.log(`[IG Test] API Key: ${apiKey ? apiKey.slice(0, 6) + '...' : 'MISSING'}`);
  console.log(`[IG Test] Password: ${password ? 'PROVIDED' : 'MISSING'}`);

  const baseUrl = mode === 'real' || mode === 'live'
    ? 'https://api.ig.com/gateway/deal'
    : 'https://demo-api.ig.com/gateway/deal';

  try {
    const url = `${baseUrl}/session`;
    console.log(`[IG Test] Connecting to ${url}...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-IG-API-KEY': apiKey || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2'
      },
      body: JSON.stringify({
        identifier: username,
        password: password
      })
    });

    console.log(`[IG Test] Response Status: ${response.status}`);
    
    // In node-fetch or undici, we can inspect headers case-insensitively
    const cst = response.headers.get('cst');
    const securityToken = response.headers.get('x-security-token');
    
    const data: any = await response.json();
    console.log(`[IG Test] Response Body:`, JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log(`[IG Test] Login SUCCESSFUL!`);
      console.log(`[IG Test] CST token: ${cst ? 'FOUND (' + cst.slice(0, 8) + '...)' : 'MISSING'}`);
      console.log(`[IG Test] X-SECURITY-TOKEN: ${securityToken ? 'FOUND (' + securityToken.slice(0, 8) + '...)' : 'MISSING'}`);

      // Now fetch accounts to verify balance
      const accountsUrl = `${baseUrl}/accounts`;
      console.log(`[IG Test] Fetching accounts from ${accountsUrl}...`);
      const acctResponse = await fetch(accountsUrl, {
        method: 'GET',
        headers: {
          'X-IG-API-KEY': apiKey || '',
          'CST': cst || '',
          'X-SECURITY-TOKEN': securityToken || '',
          'Accept': 'application/json',
          'Version': '1'
        }
      });

      console.log(`[IG Test] Accounts Status: ${acctResponse.status}`);
      const acctData = await acctResponse.json();
      console.log(`[IG Test] Accounts Data:`, JSON.stringify(acctData, null, 2));
    } else {
      console.log(`[IG Test] Login FAILED:`, data);
    }
  } catch (error: any) {
    console.error(`[IG Test] Exception occurred:`, error);
  }
}

testConnection();
