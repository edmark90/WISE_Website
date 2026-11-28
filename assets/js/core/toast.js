/**
 * WISE System - Toast Notifications
 * Safe, dismissible, hover-pausable toast used across all pages.
 */
function showToast(msg, type) {
  type = type || 'info';
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  container.setAttribute('aria-live', 'polite');

  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = icons[type] || icons.info;

  const textSpan = document.createElement('span');
  textSpan.className = 'toast-msg';
  textSpan.textContent = msg != null ? String(msg) : '';
  el.appendChild(textSpan);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  el.appendChild(closeBtn);

  container.appendChild(el);

  let removed = false;
  let timerId = null;

  function dismiss() {
    if (removed) return;
    removed = true;
    clearTimeout(timerId);
    el.classList.add('removing');
    setTimeout(function () { el.remove(); }, 250);
  }

  function startTimer(ms) {
    clearTimeout(timerId);
    timerId = setTimeout(dismiss, ms);
  }

  closeBtn.addEventListener('click', dismiss);
  el.addEventListener('mouseenter', function () { clearTimeout(timerId); });
  el.addEventListener('mouseleave', function () { startTimer(1800); });
  el.addEventListener('focusin', function () { clearTimeout(timerId); });
  el.addEventListener('focusout', function () { startTimer(1800); });

  startTimer(type === 'error' ? 4800 : 3500);
}
