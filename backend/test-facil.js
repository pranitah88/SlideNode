const { x402FacilitatorClient } = require('@x402/core/server');
const client = new x402FacilitatorClient({ url: 'https://facilitator.goplausible.xyz' });

async function run() {
  try {
    const config = await client.fetchConfiguration();
    console.log(JSON.stringify(config, null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
