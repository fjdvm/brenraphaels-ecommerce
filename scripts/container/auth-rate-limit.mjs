import assert from 'node:assert/strict';

const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const actions = JSON.parse(process.env.SMOKE_AUTH_ACTIONS ?? '{}');
const refusal = 'Too many attempts. Please try again in 10 minutes.';
for (const [name, path] of [
  ['submitSignUp', '/signup'],
  ['submitForgotPassword', '/forgot-password'],
  ['resendVerificationEmail', '/verify-email'],
]) {
  assert.ok(actions[name], `Missing built action: ${name}`);
  for (let attempt = 0; attempt < 6; attempt++) {
    // React's multipart action encoding: an empty FormData as the form argument.
    // Invalid input must exercise validation without sending email or creating a login.
    const body = new FormData();
    body.set('0', JSON.stringify(name === 'submitSignUp' ? ['$K1'] : [{}, '$K1']));
    const result = await fetch(new URL(path, base), {
      method: 'POST', body,
      headers: {
        'next-action': actions[name],
        'x-forwarded-for': `198.51.100.${attempt}, 203.0.113.190`,
      },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(result.status, 200, `${name} attempt ${attempt + 1}`);
    const response = await result.text();
    if (attempt < 5) {
      assert.ok(!response.includes(refusal), `${name} must permit first five attempts`);
      assert.ok(response.includes(name === 'submitSignUp' ? 'fieldErrors' : 'Enter a valid email address'));
    } else {
      assert.ok(response.includes(refusal), `${name} must refuse sixth attempt despite spoofed prefixes`);
      assert.ok(response.includes(name === 'submitSignUp' ? 'formError' : 'message'));
    }
  }
}
console.log('All three auth actions refuse the sixth attempt over container HTTP.');
