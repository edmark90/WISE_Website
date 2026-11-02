/**
 * WISE System - Login Page
 * Entry point for index.html. Uses shared helpers from core/.
 */

(function initRememberedEmail() {
  const emailInput = $id('admin-id');
  const rememberCheckbox = $id('remember-me');
  if (!emailInput || !rememberCheckbox) return;

  const savedEmail = localStorage.getItem('wise_remembered_email');
  if (savedEmail) {
    emailInput.value = savedEmail;
    rememberCheckbox.checked = true;
  }
})();

async function postLoginRequest(email, password) {
  const fetchOpts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
      password: password
    })
  };

  try {
    return await fetch(CONFIG.API_BASE_URL + '/api/auth/login', fetchOpts);
  } catch (primaryErr) {
    // Automatically try the alternate local loopback address (127.0.0.1 <-> localhost)
    const altBase = CONFIG.API_BASE_URL === CONFIG.LOCAL_IPV4_API_BASE_URL
      ? CONFIG.LOCAL_API_BASE_URL
      : (CONFIG.API_BASE_URL === CONFIG.LOCAL_API_BASE_URL ? CONFIG.LOCAL_IPV4_API_BASE_URL : null);
    if (altBase) {
      const response = await fetch(altBase + '/api/auth/login', fetchOpts);
      CONFIG.API_BASE_URL = altBase;
      return response;
    }
    throw primaryErr;
  }
}

// Login handler for WISE System Admin
$id('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  const email = $id('admin-id').value.trim();
  const password = $id('password').value;
  const rememberCheckbox = $id('remember-me');
  const submitBtn = document.querySelector('.login-btn') || document.querySelector('.submit');

  // Disable button during request
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Signing in...</span>';

  try {
    const response = await postLoginRequest(email, password);
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      // Save JWT token to localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('token_type', data.token_type);
      localStorage.setItem('user_role', data.user.role);
      if (data.user && data.user.fullname) {
        localStorage.setItem('user_name', data.user.fullname);
      }

      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('wise_remembered_email', email);
      } else {
        localStorage.removeItem('wise_remembered_email');
      }

      // Check if user is admin
      if (data.user.role === 'admin') {
        window.location.href = 'dashboard.html';
      } else {
        showError('Admin account only.');
      }
    } else {
      showError(data.detail || 'Invalid email or password.');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Cannot reach backend at ' + CONFIG.API_BASE_URL + '. Check that port 8000 is running and CORS allows ' + window.location.origin + '.');
  } finally {
    // Re-enable button
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="btn-signin-icon">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
        <polyline points="10 17 15 12 10 7"></polyline>
        <line x1="15" y1="12" x2="3" y2="12"></line>
      </svg>
      <span>Sign In</span>
    `;
  }
});

function showError(message) {
  // Remove existing error message if any
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }

  // Create and show error message styled via login.css (.error-message)
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;

  document.querySelector('.form-wrapper').appendChild(errorDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
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
