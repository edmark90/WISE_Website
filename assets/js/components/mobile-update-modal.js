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

  function switchTab(tabName) {
    overlay.querySelectorAll(".mu-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    overlay.querySelectorAll(".mu-tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane.dataset.pane === tabName);
    });
  }

  overlay.querySelectorAll(".mu-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  function openModal() {
    switchTab("send");
    overlay.classList.add("show");
    fetchVersions();
  }

  function closeModal() {
    overlay.classList.remove("show");
  }

  openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) {
      closeModal();
    }
  });

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
      versionSelect.innerHTML = '<option value="">No versions available — Add one in Add Version tab</option>';
      return;
    }
    versionSelect.innerHTML = '<option value="">Select Version</option>' +
      loadedVersions.map(v =>
        `<option value="${v.id}">${escapeHtml(v.version)} — ${escapeHtml(v.title)} ${!v.apk_url ? '(No APK)' : ''}</option>`
      ).join('');
  }

  function renderVersionHistory() {
    if (loadedVersions.length === 0) {
      versionHistoryList.innerHTML = '<p class="mu-history-empty">No versions created yet.</p>';
      return;
    }
    versionHistoryList.innerHTML = loadedVersions.map(v => {
      const date = v.created_at ? new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const apkBadge = v.apk_url
        ? '<span class="mu-badge-apk-ok">✓ APK Linked</span>'
        : '<span class="mu-badge-apk-no">✗ No APK</span>';
      const forceBadge = v.is_force
        ? '<span class="mu-badge-force">FORCE</span>'
        : '';

      // Get announcements for this version
      const versionAnnouncements = loadedAnnouncements.filter(a => a.app_version_id === v.id);
      const annCount = versionAnnouncements.length;
      const annBadge = annCount > 0
        ? `<span class="mu-badge-ann">${annCount} announcement${annCount > 1 ? 's' : ''}</span>`
        : '';

      const announcementsHtml = versionAnnouncements.length > 0
        ? `<div class="mu-ann-section">
            <div class="mu-ann-heading">Announcements</div>
            ${versionAnnouncements.map(a => {
              const aDate = a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              const forceTag = a.force ? '<span class="mu-badge-force">FORCE</span>' : '';
              const reminderTag = a.reminder && a.reminder !== 'None' ? `<span class="mu-ann-reminder">⏰ ${escapeHtml(a.reminder)}</span>` : '';
              return `<div class="mu-ann-item">
                <div class="mu-ann-meta">
                  <div class="mu-ann-title">${escapeHtml(a.title)}</div>
                  ${forceTag}
                  ${reminderTag}
                  <div class="mu-ann-date">${aDate}</div>
                </div>
                <button class="nt-delete-btn nt-delete-ann-btn" data-delete-ann-id="${a.id}" data-delete-ann-title="${escapeHtml(a.title)}" title="Delete announcement">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>`;
            }).join('')}
          </div>`
        : `<div class="mu-ann-empty">No announcements — version can be deleted</div>`;

      return `<div class="mu-version-card">
        <div class="mu-version-header">
          <div class="mu-version-left">
            <div class="mu-version-tag">${escapeHtml(v.version)}</div>
            ${forceBadge}
            ${annBadge}
            <div class="mu-version-title">${escapeHtml(v.title)}</div>
          </div>
          <div class="mu-version-right">
            ${apkBadge}
            <span class="mu-version-date">${date}</span>
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

  // TAB 1 — Send Mobile Update
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

  // TAB 2 — Add New Version
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
      await fetchVersions();
      switchTab("send");
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
