/**
 * WISE System - Login Page
 * Entry point for index.html. Uses shared helpers from core/.
 */

// Login handler for WISE System Admin
$id('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  const email = $id('admin-id').value;
  const password = $id('password').value;
  const submitBtn = document.querySelector('.submit');

  // Disable button during request
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Logging in...';

  try {
    const response = await fetch(CONFIG.API_BASE_URL + '/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Save JWT token to localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('token_type', data.token_type);
      localStorage.setItem('user_role', data.user.role);

      // Check if user is admin
      if (data.user.role === 'admin') {
        window.location.href = 'dashboard.html';
      } else {
        showError('Admin account only.');
      }
    } else {
      showError('Invalid email or password.');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Connection error. Please try again.');
  } finally {
    // Re-enable button
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      Login to System
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    `;
  }
});

function showError(message) {
  // Remove existing error message if any
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }

  // Create and show error message
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    background-color: #fee2e2;
    color: #991b1b;
    padding: 12px 16px;
    border-radius: 8px;
    margin-top: 16px;
    font-size: 14px;
    border: 1px solid #fecaca;
  `;

  document.querySelector('.card').appendChild(errorDiv);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}

// Password toggle function
function togglePassword() {
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eye-icon');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } else {
    passwordInput.type = 'password';
    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
}
