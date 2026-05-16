(function () {
  const data = window.ETUBIG;
  if (!data) return;

  if (data.currentUser) {
    document.querySelectorAll('[data-etubig-user-name]').forEach((el) => {
      el.textContent = data.currentUser.fullName;
    });
    document.querySelectorAll('[data-etubig-user-email]').forEach((el) => {
      el.textContent = data.currentUser.email;
    });
    const chip = document.querySelector('[data-etubig-user-chip]');
    if (chip && data.currentUser.fullName) {
      chip.textContent = data.currentUser.fullName.charAt(0).toUpperCase();
    }
  }

  const badge = document.querySelector('[data-etubig-alert-badge]');
  if (badge && typeof data.activeAlertCount === 'number') {
    badge.textContent = String(data.activeAlertCount);
    badge.style.display = data.activeAlertCount > 0 ? '' : 'none';
  }

  document.querySelectorAll('[data-etubig-notifications]').forEach((list) => {
    const items = data.notifications || [];
    if (!items.length) {
      list.innerHTML = '<li class="popover-item"><span>No notifications yet.</span></li>';
      return;
    }
    list.innerHTML = items
      .map(
        (n) => `
        <li class="popover-item">
          <strong>${escapeHtml(n.title)}</strong>
          <span>${escapeHtml(n.message)}</span>
        </li>`
      )
      .join('');
  });

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
