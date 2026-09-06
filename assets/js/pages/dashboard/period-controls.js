/**
 * WISE System - Dashboard Period Controls
 * Month/year selection and navigation controls.
 */

const DashboardPeriodControls = {
  /**
   * Render the period label showing current selection
   */
  renderPeriodLabel: function() {
    const label = new Date(DashboardState.year, DashboardState.month - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const monthLabel = $id('db-month-label');
    if (monthLabel) monthLabel.textContent = label;

    const lineSub = $id('db-line-sub');
    if (lineSub) lineSub.textContent = 'Daily classification trends · ' + label;

    const donutSub = $id('db-donut-sub');
    if (donutSub) donutSub.textContent = 'Share of classified records · ' + label;

    const periodHint = $id('db-period-hint');
    if (periodHint) periodHint.textContent = 'Aggregated records for ' + label;

    const now = DashboardDateHelper.phNow();
    const isCurrentMonth = (DashboardState.year === now.getFullYear() && DashboardState.month === (now.getMonth() + 1));
    const jumpBtn = $id('db-jump-current-btn');
    if (jumpBtn) {
      jumpBtn.style.display = isCurrentMonth ? 'none' : 'inline-block';
    }

    const prevBtn = $id('db-month-prev');
    const nextBtn = $id('db-month-next');
    if (prevBtn) prevBtn.disabled = (DashboardState.year <= 2024);
    if (nextBtn) nextBtn.disabled = (DashboardState.year === now.getFullYear() + 1 && DashboardState.month === 12);
  },

  /**
   * Shift month by delta (-1 or +1)
   * @param {number} delta - Month delta
   */
  shiftMonth: function(delta) {
    DashboardState.month += delta;
    if (DashboardState.month < 1) { 
      DashboardState.month = 12; 
      DashboardState.year -= 1; 
    }
    if (DashboardState.month > 12) { 
      DashboardState.month = 1; 
      DashboardState.year += 1; 
    }
    this.renderPeriodLabel();
    DashboardDataLoader.loadMonthly();
  },

  /**
   * Jump to current month
   */
  jumpToCurrentMonth: function() {
    const now = DashboardDateHelper.phNow();
    DashboardState.year = now.getFullYear();
    DashboardState.month = now.getMonth() + 1;
    this.renderPeriodLabel();
    DashboardDataLoader.loadMonthly();
  },

  /**
   * Wire up all period control event listeners
   */
  wireControls: function() {
    const prevBtn = $id('db-month-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this.shiftMonth(-1));

    const nextBtn = $id('db-month-next');
    if (nextBtn) nextBtn.addEventListener('click', () => this.shiftMonth(1));

    const currentBtn = $id('db-month-current');
    if (currentBtn) currentBtn.addEventListener('click', this.openMonthDialog);

    const jumpBtn = $id('db-jump-current-btn');
    if (jumpBtn) jumpBtn.addEventListener('click', this.jumpToCurrentMonth);

    const refreshBtn = $id('db-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.classList.add('is-syncing');
        Promise.all([DashboardDataLoader.loadDashboard(), DashboardDataLoader.loadMonthly()])
          .finally(function () {
            setTimeout(function () { refreshBtn.classList.remove('is-syncing'); }, 600);
          });
      });
    }

    // Line chart view mode switchers
    const viewModeContainer = $id('db-line-view-mode');
    if (viewModeContainer) {
      viewModeContainer.addEventListener('click', function (e) {
        const btn = e.target.closest('.db-view-btn');
        if (!btn) return;
        viewModeContainer.querySelectorAll('.db-view-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        DashboardState.lineChartMode = btn.dataset.mode || 'category';
        if (DashboardState.monthlyData) DashboardCharts.renderLineChart(DashboardState.monthlyData);
      });
    }

    // Activity filter tabs
    const activityFilter = $id('db-activity-filter');
    if (activityFilter) {
      activityFilter.addEventListener('click', function (e) {
        const btn = e.target.closest('.db-filter-pill');
        if (!btn) return;
        activityFilter.querySelectorAll('.db-filter-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        DashboardState.activityFilter = btn.dataset.filter || 'all';
        DashboardActivityFeed.renderFilteredActivities();
      });
    }
  },

  /**
   * Open month picker dialog
   */
  openMonthDialog: function() {
    if (document.getElementById('db-month-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'db-month-dialog';
    overlay.id = 'db-month-overlay';

    const current = DashboardState.year + '-' + (DashboardState.month < 10 ? '0' + DashboardState.month : DashboardState.month);
    const now = DashboardDateHelper.phNow();
    const max = (now.getFullYear() + 1) + '-12';

    overlay.innerHTML =
      '<div class="db-month-dialog-box" role="dialog" aria-modal="true" aria-label="Choose month">' +
        '<h4>Select Analytics Period</h4>' +
        '<p style="font-size:12.5px;color:var(--db-muted);margin:0 0 12px;">Choose any month to load complete classification and collection metrics.</p>' +
        '<input type="month" id="db-month-input" value="' + current + '" min="2024-01" max="' + max + '">' +
        '<div class="db-month-dialog-actions">' +
          '<button type="button" class="db-month-dialog-btn" id="db-month-cancel">Cancel</button>' +
          '<button type="button" class="db-month-dialog-btn primary" id="db-month-apply">Apply Period</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    DashboardState.monthInput = $id('db-month-input');

    const close = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      DashboardState.monthInput = null;
    };

    $id('db-month-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
    $id('db-month-apply').addEventListener('click', () => {
      const val = DashboardState.monthInput.value;
      if (val && val.length === 7) {
        const parts = val.split('-');
        DashboardState.year = parseInt(parts[0], 10);
        DashboardState.month = parseInt(parts[1], 10);
        this.renderPeriodLabel();
        DashboardDataLoader.loadMonthly();
      }
      close();
    });
  }
};
