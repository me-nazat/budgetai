const http = require('http');

const data = JSON.stringify({
  email: 'test4@example.com',
  password: 'Password123!'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('Login Status:', res.statusCode);
    
    if (res.headers['set-cookie']) {
      const cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      
      const meReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/me',
        method: 'GET',
        headers: { 'Cookie': cookies }
      }, meRes => {
        console.log('\nMe Status:', meRes.statusCode);
        
        const dashReq = http.request({
          hostname: 'localhost',
          port: 3000,
          path: '/api/dashboard?month=2024-05&week=all',
          method: 'GET',
          headers: { 'Cookie': cookies }
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
      meReq.end();
    }
  });
});
req.on('error', e => console.error(e));
req.write(data);
req.end();
