const API_BASE_URL = '/api/auth';

export const registerForEmailVerification = (registration) => fetch(`${API_BASE_URL}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(registration),
});