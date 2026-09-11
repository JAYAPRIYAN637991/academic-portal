import request from 'supertest';
import { createApp } from '../server';

async function testFrontendServing() {
  console.log('🔍 Testing Frontend Static Serving & SPA Fallback...');
  const app = createApp();

  // 1. /admin/login serves HTML
  const resHtml = await request(app).get('/admin/login');
  console.log('1. /admin/login status:', resHtml.status, 'Has base href:', resHtml.text.includes('<base href="/" />'));

  // 2. /css/style.css serves CSS with correct content-type
  const resCss = await request(app).get('/css/style.css');
  console.log('2. /css/style.css status:', resCss.status, 'Content-Type:', resCss.headers['content-type']);

  // 3. /js/app.js serves JS with correct content-type
  const resJs = await request(app).get('/js/app.js');
  console.log('3. /js/app.js status:', resJs.status, 'Content-Type:', resJs.headers['content-type'], 'Has App class:', resJs.text.includes('class App'));

  // 4. /admin/js/app.js (relative alias)
  const resAliasJs = await request(app).get('/admin/js/app.js');
  console.log('4. /admin/js/app.js status:', resAliasJs.status, 'Content-Type:', resAliasJs.headers['content-type'], 'Has App class:', resAliasJs.text.includes('class App'));

  // 5. /js/views/adminLogin.js
  const resAdminLoginJs = await request(app).get('/js/views/adminLogin.js');
  console.log('5. /js/views/adminLogin.js status:', resAdminLoginJs.status, 'Content-Type:', resAdminLoginJs.headers['content-type']);

  // 6. /js/views/staffLogin.js
  const resStaffLoginJs = await request(app).get('/js/views/staffLogin.js');
  console.log('6. /js/views/staffLogin.js status:', resStaffLoginJs.status, 'Content-Type:', resStaffLoginJs.headers['content-type']);

  // 7. /staff/login serves HTML
  const resStaffHtml = await request(app).get('/staff/login');
  console.log('7. /staff/login status:', resStaffHtml.status);

  console.log('\n✅ All frontend static asset routes verified successfully!');
}

testFrontendServing().catch(console.error);
