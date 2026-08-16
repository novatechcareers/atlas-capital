import test from 'node:test';
import assert from 'node:assert/strict';

const originalEnv = { ...process.env };

test('Supabase login config is accepted even without the service role key for registration', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { GET } = await import('../app/api/supabase-config/route.ts');
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.loginReady, true);
  assert.equal(payload.registrationReady, false);
  assert.equal(payload.missingServiceRoleKey, true);
});

test('Supabase full config is marked as ready for registration when the service role key is present', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

  const { GET } = await import('../app/api/supabase-config/route.ts');
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.loginReady, true);
  assert.equal(payload.registrationReady, true);
  assert.equal(payload.missingServiceRoleKey, false);
});

process.on('exit', () => {
  process.env = originalEnv;
});
