const http = require('http');

const regData = JSON.stringify({
  name: 'Test User',
  email: 'test4@example.com',
  password: 'Password123!'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': regData.length
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('Reg Status:', res.statusCode);
    console.log('Reg Body:', body);
    
    const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : null;
    if (cookie) {
      const meReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/me',
        method: 'GET',
        headers: { 'Cookie': cookie }
      }, meRes => {
        let meBody = '';
        meRes.on('data', d => meBody += d);
        meRes.on('end', () => {
          console.log('\nMe Status:', meRes.statusCode);
          console.log('Me Body:', meBody);
          
          const dashReq = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/dashboard?month=2024-05&week=all',
            method: 'GET',
            headers: { 'Cookie': cookie }
          }, dashRes => {
             let dashBody = '';
             dashRes.on('data', d => dashBody += d);
             dashRes.on('end', () => {
               console.log('\nDashboard Status:', dashRes.statusCode);
               console.log('Dashboard Body:', dashBody);
             });
          });
          dashReq.end();
        });
      });
      meReq.end();
    }
  });
});
req.on('error', e => console.error(e));
req.write(regData);
req.end();
