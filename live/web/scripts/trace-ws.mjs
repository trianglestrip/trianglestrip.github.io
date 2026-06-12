import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  
  page.on('websocket', ws => {
    console.log(`WebSocket opened: ${ws.url()}`);
    ws.on('framesent', payload => console.log('WS Sent length:', payload.payload ? payload.payload.length : 'unknown'));
    ws.on('framereceived', payload => console.log('WS Received length:', payload.payload ? payload.payload.length : 'unknown'));
  });
  
  page.on('request', request => {
    if(request.url().includes('api') || request.url().includes('muxia') || request.url().includes('wss')) {
      console.log('Request: ' + request.url());
    }
  });

  try {
    await page.goto('https://lemonlive.deno.dev/douyu/play/252140', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(10000);
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
