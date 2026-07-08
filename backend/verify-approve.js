const { signToken } = require('./utils/auth');

(async () => {
  const token = signToken({ id: 'hospital-admin', email: 'admin@hrmcs.org', role: 'Admin' });
  const base = 'http://127.0.0.1:4000';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const getRequests = async () => {
    const res = await fetch(`${base}/api/requests`, { headers });
    return res.json();
  };

  const before = await getRequests();
  const target = before.find((item) => item.id === 'req-1');
  console.log('BEFORE', JSON.stringify(target));

  const res = await fetch(`${base}/api/requests/req-1/approve`, { method: 'POST', headers });
  console.log('STATUS', res.status);
  console.log('BODY', await res.text());

  const after = await getRequests();
  const updated = after.find((item) => item.id === 'req-1');
  console.log('AFTER', JSON.stringify(updated));
})();
