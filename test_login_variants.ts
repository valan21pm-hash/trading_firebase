import 'dotenv/config';

async function testVariant(username: string, mode: 'demo' | 'real', apiKey: string) {
  const password = process.env.IG_PASSWORD;
  const baseUrl = mode === 'real'
    ? 'https://api.ig.com/gateway/deal'
    : 'https://demo-api.ig.com/gateway/deal';

  console.log(`\n--- Testing Variant ---`);
  console.log(`Mode: ${mode}`);
  console.log(`Username: ${username}`);
  console.log(`API Key: ${apiKey.slice(0, 6)}...`);

  try {
    const url = `${baseUrl}/session`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-IG-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2'
      },
      body: JSON.stringify({
        identifier: username,
        password: password
      })
    });

    console.log(`Status: ${response.status}`);
    const data: any = await response.json();
    console.log(`Body:`, JSON.stringify(data));
    
    if (response.ok) {
      console.log(`SUCCESS with username "${username}" in mode "${mode}"!`);
      const cst = response.headers.get('cst');
      const securityToken = response.headers.get('x-security-token');
      console.log(`CST: ${cst ? 'Present' : 'Missing'}, SecurityToken: ${securityToken ? 'Present' : 'Missing'}`);
      
      // Let's try fetching accounts
      const acctResponse = await fetch(`${baseUrl}/accounts`, {
        method: 'GET',
        headers: {
          'X-IG-API-KEY': apiKey,
          'CST': cst || '',
          'X-SECURITY-TOKEN': securityToken || '',
          'Accept': 'application/json',
          'Version': '1'
        }
      });
      console.log(`Accounts Status: ${acctResponse.status}`);
      const acctData = await acctResponse.json();
      console.log(`Accounts:`, JSON.stringify(acctData));
      return true;
    }
  } catch (err: any) {
    console.log(`Exception: ${err.message}`);
  }
  return false;
}

async function run() {
  const apiKey = process.env.IG_DEMO_API_KEY || '';
  
  // Try variant 1: username = valan21pm, mode = demo
  await testVariant('valan21pm', 'demo', apiKey);
  
  // Try variant 2: username = valan21pm, mode = real
  await testVariant('valan21pm', 'real', apiKey);

  // Try variant 3: username = valan21pm@gmail.com, mode = demo
  await testVariant('valan21pm@gmail.com', 'demo', apiKey);

  // Try variant 4: username = valan21pm@gmail.com, mode = real
  await testVariant('valan21pm@gmail.com', 'real', apiKey);

  // Try variant 5: username = Z6CKEN, mode = demo
  await testVariant('Z6CKEN', 'demo', apiKey);

  // Try variant 6: username = Z6CKEN, mode = real
  await testVariant('Z6CKEN', 'real', apiKey);
}

run();
