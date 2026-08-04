document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("mobile-update-btn");
  const closeBtn = document.getElementById("mobile-update-close-btn");
  const cancelBtn = document.getElementById("mu-cancel-btn");
  const overlay = document.getElementById("mobile-update-overlay");

  const sendBtn = document.getElementById("mu-send-btn");
  const saveVerBtn = document.getElementById("nuv-save-btn");
  const clearVerBtn = document.getElementById("nuv-clear-btn");

  const versionSelect = document.getElementById("mu-version");
  const versionHistoryList = document.getElementById("version-history-list");
  let loadedVersions = [];
  let loadedAnnouncements = [];

  if (!openBtn || !overlay) return;

  function openModal() {
    overlay.classList.add("show");
    fetchVersions();
  }

  function closeModal() {
    overlay.classList.remove("show");
  }

  openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  async function fetchVersions() {
    try {
      versionSelect.innerHTML = '<option value="">Loading versions...</option>';
      const res = await apiRequest("/api/mobile-updates/versions", "GET");
      if (!res || !res.ok) throw new Error("Failed to load versions");
      loadedVersions = await res.json();

      // Fetch all announcements
      const annRes = await apiRequest("/api/mobile-updates/announcements", "GET");
      if (annRes && annRes.ok) {
        loadedAnnouncements = await annRes.json();
      } else {
        loadedAnnouncements = [];
      }

      renderVersionDropdown();
      renderVersionHistory();
    } catch (err) {
      showToast(err.message || "Failed to load versions", "error");
      versionSelect.innerHTML = '<option value="">Error loading versions</option>';
    }
  }

  function renderVersionDropdown() {
    if (loadedVersions.length === 0) {
      versionSelect.innerHTML = '<option value="">No versions available — Add one below</option>';
      return;
    }
    versionSelect.innerHTML = '<option value="">Select Version</option>' +
      loadedVersions.map(v =>
        `<option value="${v.id}">${escapeHtml(v.version)} — ${escapeHtml(v.title)} ${!v.apk_url ? '(No APK)' : ''}</option>`
      ).join('');
  }

  function renderVersionHistory() {
    if (loadedVersions.length === 0) {
      versionHistoryList.innerHTML = '<p style="color:var(--nt-text-muted); font-size:13px;">No versions created yet.</p>';
      return;
    }
    versionHistoryList.innerHTML = loadedVersions.map(v => {
      const date = v.created_at ? new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const apkBadge = v.apk_url
        ? '<span style="color:#16a34a;font-size:11px;font-weight:600;">✓ APK Linked</span>'
        : '<span style="color:#dc2626;font-size:11px;font-weight:600;">✗ No APK</span>';
      const forceBadge = v.is_force
        ? '<span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;">FORCE</span>'
        : '';

      // Get announcements for this version
      const versionAnnouncements = loadedAnnouncements.filter(a => a.app_version_id === v.id);
      const annCount = versionAnnouncements.length;
      const annBadge = annCount > 0
        ? `<span style="background:#eff6ff;color:#2563eb;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">${annCount} announcement${annCount > 1 ? 's' : ''}</span>`
        : '';

      const announcementsHtml = versionAnnouncements.length > 0
        ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Announcements</div>
            ${versionAnnouncements.map(a => {
              const aDate = a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              const forceTag = a.force ? '<span style="color:#dc2626;font-size:10px;font-weight:600;">FORCE</span>' : '';
              const reminderTag = a.reminder && a.reminder !== 'None' ? `<span style="color:#8b5cf6;font-size:10px;">⏰ ${escapeHtml(a.reminder)}</span>` : '';
              return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:#f0f9ff;border:1px solid #bfdbfe;border-radius:6px;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                  <div style="font-size:12px;color:#1e40af;font-weight:600;white-space:nowrap;">${escapeHtml(a.title)}</div>
                  ${forceTag}
                  ${reminderTag}
                  <div style="font-size:10px;color:#9ca3af;">${aDate}</div>
                </div>
                <button class="nt-delete-btn nt-delete-ann-btn" data-delete-ann-id="${a.id}" data-delete-ann-title="${escapeHtml(a.title)}" title="Delete announcement" style="padding:3px 6px;font-size:10px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>`;
            }).join('')}
          </div>`
        : `<div style="margin-top:6px;font-size:11px;color:#9ca3af;font-style:italic;">No announcements — version can be deleted</div>`;

      return `<div style="padding:12px;background:#f9fafb;border:1px solid var(--nt-border);border-radius:8px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <div style="font-weight:700;font-size:13px;color:var(--nt-text);white-space:nowrap;">${escapeHtml(v.version)}</div>
            ${forceBadge}
            ${annBadge}
            <div style="font-size:12px;color:var(--nt-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.title)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
            ${apkBadge}
            <span style="font-size:11px;color:var(--nt-text-muted);">${date}</span>
            <button class="nt-delete-btn nt-delete-version-btn" data-delete-version-id="${v.id}" data-delete-version-name="${escapeHtml(v.version)}" title="Delete version">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Delete
            </button>
          </div>
        </div>
        ${announcementsHtml}
      </div>`;
    }).join('');

    // Wire version delete buttons
    versionHistoryList.querySelectorAll('.nt-delete-version-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteVersionId;
        const name = btn.dataset.deleteVersionName;
        const annCount = loadedAnnouncements.filter(a => String(a.app_version_id) === String(id)).length;
        if (annCount > 0) {
          showToast(`Cannot delete version "${name}" — it has ${annCount} announcement(s). Delete all announcements first.`, 'error');
          return;
        }
        if (!confirm(`Delete version "${name}"? This cannot be undone.`)) return;
        try {
          btn.disabled = true;
          btn.textContent = 'Deleting...';
          const res = await apiRequest(`/api/mobile-updates/versions/${id}`, { method: 'DELETE' });
          if (!res || !res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Failed to delete' }));
            showToast(err.detail || 'Failed to delete version.', 'error');
            return;
          }
          showToast(`Version "${name}" deleted.`, 'success');
          fetchVersions();
        } catch (err) {
          showToast(err.message || 'Failed to delete version.', 'error');
        }
      });
    });

    // Wire announcement delete buttons
    versionHistoryList.querySelectorAll('.nt-delete-ann-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteAnnId;
        const title = btn.dataset.deleteAnnTitle;
        if (!confirm(`Delete announcement "${title}"? This cannot be undone.`)) return;
        try {
          btn.disabled = true;
          const res = await apiRequest(`/api/mobile-updates/announcements/${id}`, { method: 'DELETE' });
          if (!res || !res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Failed to delete' }));
            showToast(err.detail || 'Failed to delete announcement.', 'error');
            return;
          }
          showToast(`Announcement "${title}" deleted.`, 'success');
          fetchVersions();
        } catch (err) {
          showToast(err.message || 'Failed to delete announcement.', 'error');
        }
      });
    });
  }

  // SECTION 1 — Send Mobile Update
  sendBtn.addEventListener("click", async () => {
    const title = document.getElementById("mu-title").value.trim();
    const message = document.getElementById("mu-message").value.trim();
    const versionId = versionSelect.value;
    const force = document.getElementById("mu-force").checked;
    const reminder = document.getElementById("mu-reminder").value;

    if (!title || !message || !versionId) {
      showToast("Please complete Title, Message, and select a Version.", "warning");
      return;
    }

    const selectedVersion = loadedVersions.find(v => String(v.id) === String(versionId));
    if (!selectedVersion || !selectedVersion.apk_url || !selectedVersion.apk_url.trim()) {
      showToast("Blocked: Selected Version has no APK Download Link. Please add an APK link first.", "error");
      return;
    }

    try {
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending...";

      const payload = { title, message, app_version_id: parseInt(versionId), force, reminder };
      const res = await apiRequest("/api/mobile-updates/send", { method: 'POST', body: JSON.stringify(payload) });
      if (!res || !res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to send update" }));
        throw new Error(err.detail);
      }
      const data = await res.json();
      showToast(`Mobile Update sent! (${data.devices_pushed} devices notified)`, "success");

      document.getElementById("mu-title").value = "";
      document.getElementById("mu-message").value = "";
      document.getElementById("mu-force").checked = false;
      document.getElementById("mu-reminder").value = "None";

      closeModal();
    } catch (err) {
      showToast(err.message || "Failed to send update.", "error");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send Update";
    }
  });

  // SECTION 2 — Add New Version
  saveVerBtn.addEventListener("click", async () => {
    const version = document.getElementById("nuv-version").value.trim();
    const version_code = parseInt(document.getElementById("nuv-code").value);
    const title = document.getElementById("nuv-title").value.trim();
    const release_notes = document.getElementById("nuv-notes").value.trim();
    const apk_url = document.getElementById("nuv-apk").value.trim();

    if (!version || isNaN(version_code) || !title || !apk_url) {
      showToast("Please fill in Version, Version Code, Release Title, and APK Download Link.", "warning");
      return;
    }
    if (!apk_url.startsWith("http://") && !apk_url.startsWith("https://")) {
      showToast("APK Download Link must start with http:// or https://", "warning");
      return;
    }

    try {
      saveVerBtn.disabled = true;
      saveVerBtn.textContent = "Saving...";
      const payload = { version, version_code, title, release_notes, apk_url, is_force: false };
      const res = await apiRequest("/api/mobile-updates/versions", { method: 'POST', body: JSON.stringify(payload) });
      if (!res || !res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to save version" }));
        throw new Error(err.detail);
      }
      showToast("New Version saved!", "success");
      clearVersionForm();
      fetchVersions();
    } catch (err) {
      showToast(err.message || "Failed to save version.", "error");
    } finally {
      saveVerBtn.disabled = false;
      saveVerBtn.textContent = "Save Version";
    }
  });

  function clearVersionForm() {
    document.getElementById("nuv-version").value = "";
    document.getElementById("nuv-code").value = "";
    document.getElementById("nuv-title").value = "";
    document.getElementById("nuv-notes").value = "";
    document.getElementById("nuv-apk").value = "";
  }

  if (clearVerBtn) clearVerBtn.addEventListener("click", clearVersionForm);
});
