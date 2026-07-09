import { XAPI } from "xapi-node";

async function run() {
  const x = new XAPI({
      accountId: 'D261411811',
      password: 'Oak5f',
      type: 'demo',
      appName: 'test'
  });
  console.log("Connecting...");
  await x.connect();
  console.log("Connected!");
  
  const trades = await x.Socket.send.getTrades(true);
  console.log("Trades:", trades.data.returnData.length);
  
  await x.disconnect();
}
run().catch(console.error);
