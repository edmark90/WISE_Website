/**
 * WISE System - Delete Confirmation Modal Component
 */

// ---------- Delete Modal ----------
function openDeleteModal(id, name) {
  state.deletingId = id;
  deleteText.innerHTML = 'Delete schedule for <strong>' + escapeHtml(name) + '</strong>?';
  deleteOverlay.classList.add('active');
}
function closeDeleteModal() { deleteOverlay.classList.remove('active'); state.deletingId = null; }
