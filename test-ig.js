const { IgMarketsAPI } = require('./dist/backend/services/IgMarketsAPI.js');

async function run() {
  const api = IgMarketsAPI.getInstance();
  api.setCredentials({
    identifier: process.env.IG_DEMO_USERNAME,
    password: process.env.IG_DEMO_PASSWORD,
    apiKey: process.env.IG_DEMO_API_KEY
  }, 'demo');

  await api.login();
  const accounts = await api.getAccounts();
  console.log('Accounts:', accounts);

  const markets = await api.searchMarket('EURUSD');
  console.log('Markets:', markets);
}
run();
