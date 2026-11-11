/**
 * DOHA FAM CHRISTMAS PARTY 2026 — VAULT APP
 * Mobile-First, Smooth Scroll Navigation, 14 Members
 */

// State
let vaultData = { party: {}, members: [] };
let currentFilter = 'all';
let searchQuery = '';
let isSnowing = true;
let activeMember = null;

// DOM Elements
const membersGrid = document.getElementById('members-grid');
const quickNavBar = document.getElementById('quick-nav-bar');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const filterPills = document.querySelectorAll('.filter-pill');
const countAll = document.getElementById('count-all');

// Modals
const wishModal = document.getElementById('wish-modal');
const wishesForm = document.getElementById('wishes-form');
const btnToggleSnow = document.getElementById('btn-toggle-snow');

// -------------------------------------------------------------
// 1. Initial Load & Fetch
// -------------------------------------------------------------

async function fetchVault() {
  try {
    const res = await fetch('/api/vault');
    const data = await res.json();
    vaultData = data;
    renderAll();
  } catch (err) {
    console.error('Failed to load vault data:', err);
    showToast('⚠️ Could not connect to vault server', 'error');
  }
}

// -------------------------------------------------------------
// 2. Render Functions
// -------------------------------------------------------------

function renderAll() {
  renderQuickNav();
  renderMembers();
}

function renderQuickNav() {
  const members = vaultData.members || [];
  if (countAll) countAll.textContent = members.length;

  quickNavBar.innerHTML = members.map(m => {
    const wishes = m.wishes || [];
    const filledCount = wishes.filter(w => w.title && w.title.trim()).length;
    const isFull = filledCount === 3;

    return `
      <button class="nav-member-chip ${isFull ? 'full' : ''}" onclick="scrollToMember('${m.id}')">
        <span>${m.avatar || '🎅'}</span>
        <span>${escapeHtml(m.name)}</span>
      </button>
    `;
  }).join('');
}

function scrollToMember(memberId) {
  const el = document.getElementById(`card-${memberId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('highlight-pulse');
    void el.offsetWidth; // trigger reflow
    el.classList.add('highlight-pulse');
  }
}

function renderMembers() {
  const members = vaultData.members || [];
  const query = searchQuery.trim().toLowerCase();

  const filtered = members.filter(m => {
    const nameMatch = m.name.toLowerCase().includes(query);
    if (!nameMatch) return false;

    const filledCount = (m.wishes || []).filter(w => w.title && w.title.trim()).length;
    if (currentFilter === 'complete') return filledCount === 3;
    if (currentFilter === 'incomplete') return filledCount < 3;
    return true;
  });

  if (filtered.length === 0) {
    membersGrid.innerHTML = `
      <div class="loading-state">
        <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
        <p>No member found matching "${escapeHtml(searchQuery)}"</p>
      </div>
    `;
    return;
  }

  membersGrid.innerHTML = filtered.map(member => {
    const wishes = member.wishes || [];
    const filledCount = wishes.filter(w => w.title && w.title.trim()).length;
    const isFull = filledCount === 3;
    const progressPercent = Math.round((filledCount / 3) * 100);

    return `
      <div class="member-card" id="card-${member.id}" data-member-id="${member.id}">
        <div class="card-ribbon"></div>
        
        <div class="card-header">
          <div class="member-avatar-wrap">
            <div class="avatar-bubble">${member.avatar || '🎅'}</div>
            <div class="member-meta">
              <h3>${escapeHtml(member.name)}</h3>
            </div>
          </div>
          <div class="wish-counter-badge ${isFull ? 'full' : ''}">
            ${filledCount} / 3 Wishes ${isFull ? '⭐' : ''}
          </div>
        </div>

        <div class="progress-bar-wrap">
          <div class="progress-fill ${isFull ? 'full' : ''}" style="width: ${progressPercent}%"></div>
        </div>

        <div class="wishes-list">
          ${[0, 1, 2].map(idx => {
            const wish = wishes[idx] || { id: idx + 1, title: '', claimed: false };
            const isFilled = Boolean(wish.title && wish.title.trim());
            const slotEmoji = idx === 0 ? '🎁' : idx === 1 ? '⭐' : '🎄';
            const slotName = `Wish #${idx + 1} ${slotEmoji}`;

            if (!isFilled) {
              return `
                <div class="wish-item empty" onclick="openEditModal('${member.id}')">
                  <div class="wish-header-line">
                    <span class="wish-slot-label">${slotName}</span>
                  </div>
                  <div class="wish-empty">+ Tap to add wish</div>
                </div>
              `;
            }

            return `
              <div class="wish-item filled ${wish.claimed ? 'claimed' : ''}" onclick="openEditModal('${member.id}')">
                <div class="wish-header-line">
                  <span class="wish-slot-label">${slotName}</span>
                  ${wish.claimed ? `<span class="claim-tag">Claimed 🤫</span>` : ''}
                </div>
                <div class="wish-title">${escapeHtml(wish.title)}</div>
                
                ${wish.note ? `<div class="wish-details">${escapeHtml(wish.note)}</div>` : ''}

                <div class="wish-meta-footer">
                  <div>
                    ${wish.link ? `<a href="${escapeHtml(wish.link)}" target="_blank" rel="noopener" class="wish-link" onclick="event.stopPropagation()">Link ↗</a>` : ''}
                  </div>
                  <button class="btn-claim-toggle ${wish.claimed ? 'is-claimed' : ''}" 
                          onclick="event.stopPropagation(); toggleClaim('${member.id}', ${wish.id})">
                    ${wish.claimed ? 'Claimed ✓' : 'Claim as Santa 🤫'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="card-actions">
          <button class="btn-edit-card" onclick="openEditModal('${member.id}')">
            <span>✏️</span> Edit Wishes
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// 3. Edit Wishes Modal
// -------------------------------------------------------------

function openEditModal(memberId) {
  const member = vaultData.members.find(m => m.id === memberId);
  if (!member) return;

  activeMember = member;
  document.getElementById('edit-member-id').value = member.id;
  document.getElementById('modal-avatar').textContent = member.avatar || '🎅';
  document.getElementById('modal-title').textContent = `${member.name}'s Wishlist`;

  const wishes = member.wishes || [];

  // Slot 1
  const w1 = wishes[0] || {};
  document.getElementById('w1-title').value = w1.title || '';
  document.getElementById('w1-note').value = w1.note || '';
  document.getElementById('w1-link').value = w1.link || '';

  // Slot 2
  const w2 = wishes[1] || {};
  document.getElementById('w2-title').value = w2.title || '';
  document.getElementById('w2-note').value = w2.note || '';
  document.getElementById('w2-link').value = w2.link || '';

  // Slot 3
  const w3 = wishes[2] || {};
  document.getElementById('w3-title').value = w3.title || '';
  document.getElementById('w3-note').value = w3.note || '';
  document.getElementById('w3-link').value = w3.link || '';

  wishModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  wishModal.classList.remove('open');
  document.body.style.overflow = '';
  activeMember = null;
}

wishesForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeMember) return;

  const btnSave = document.getElementById('btn-save-wishes');
  btnSave.disabled = true;
  btnSave.innerHTML = `<span>⏳</span> Saving...`;

  const updatedWishes = [
    {
      id: 1,
      title: document.getElementById('w1-title').value,
      note: document.getElementById('w1-note').value,
      link: document.getElementById('w1-link').value,
      claimed: (activeMember.wishes[0] && activeMember.wishes[0].claimed) || false
    },
    {
      id: 2,
      title: document.getElementById('w2-title').value,
      note: document.getElementById('w2-note').value,
      link: document.getElementById('w2-link').value,
      claimed: (activeMember.wishes[1] && activeMember.wishes[1].claimed) || false
    },
    {
      id: 3,
      title: document.getElementById('w3-title').value,
      note: document.getElementById('w3-note').value,
      link: document.getElementById('w3-link').value,
      claimed: (activeMember.wishes[2] && activeMember.wishes[2].claimed) || false
    }
  ];

  try {
    const res = await fetch(`/api/members/${activeMember.id}/wishes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wishes: updatedWishes })
    });

    const result = await res.json();
    if (result.success) {
      const idx = vaultData.members.findIndex(m => m.id === activeMember.id);
      if (idx !== -1) vaultData.members[idx] = result.member;

      closeEditModal();
      renderAll();
      showToast(`🎁 ${activeMember.name}'s wishes saved!`);
      triggerConfetti();
    } else {
      showToast(`⚠️ Error: ${result.error || 'Failed to save'}`, 'error');
    }
  } catch (err) {
    console.error('Save failed:', err);
    showToast('⚠️ Error saving wishes', 'error');
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = `<span>🎁</span> Save Wishes`;
  }
});

// Idea chip insertion
document.querySelectorAll('.idea-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const idea = tag.dataset.idea;
    const inputs = [
      document.getElementById('w1-title'),
      document.getElementById('w2-title'),
      document.getElementById('w3-title')
    ];
    const target = inputs.find(inp => !inp.value.trim()) || inputs[0];
    target.value = idea;
    target.focus();
  });
});

// -------------------------------------------------------------
// 4. Claim Toggle
// -------------------------------------------------------------

async function toggleClaim(memberId, wishId) {
  try {
    const res = await fetch(`/api/members/${memberId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wishId })
    });
    const result = await res.json();
    if (result.success) {
      const member = vaultData.members.find(m => m.id === memberId);
      if (member) {
        const wish = member.wishes.find(w => w.id === wishId);
        if (wish) {
          wish.claimed = result.wish.claimed;
        }
      }
      renderAll();
      if (result.wish.claimed) {
        showToast('🤫 Wish claimed! Marked for Santa!');
        triggerConfetti({ particleCount: 25, spread: 45 });
      } else {
        showToast('Claim removed.');
      }
    }
  } catch (err) {
    console.error('Claim toggle failed:', err);
    showToast('⚠️ Could not update claim', 'error');
  }
}

// -------------------------------------------------------------
// 5. Modal Close Handlers
// -------------------------------------------------------------

document.getElementById('btn-close-modal').addEventListener('click', closeEditModal);
document.getElementById('btn-cancel-modal').addEventListener('click', closeEditModal);

wishModal.addEventListener('click', (e) => {
  if (e.target === wishModal) closeEditModal();
});

// -------------------------------------------------------------
// 6. Search & Filter
// -------------------------------------------------------------

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  searchClear.style.display = searchQuery ? 'block' : 'none';
  renderMembers();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchClear.style.display = 'none';
  renderMembers();
});

filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    filterPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilter = pill.dataset.filter;
    renderMembers();
  });
});

// -------------------------------------------------------------
// 7. Toast & Confetti
// -------------------------------------------------------------

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');

  toastMsg.textContent = msg;
  toastIcon.textContent = type === 'error' ? '⚠️' : '✨';
  toast.style.borderColor = type === 'error' ? '#ff4d6d' : '#00f7a5';

  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function triggerConfetti(opts = {}) {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: opts.particleCount || 50,
      spread: opts.spread || 60,
      origin: { y: 0.75 },
      colors: ['#ffd700', '#ff2a4b', '#00f7a5', '#ffffff'],
      ...opts
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------
// 8. Snow Canvas
// -------------------------------------------------------------

const canvas = document.getElementById('snow-canvas');
const ctx = canvas.getContext('2d');
let snowflakes = [];

function resizeSnowCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function initSnow() {
  resizeSnowCanvas();
  window.addEventListener('resize', resizeSnowCanvas);

  const count = window.innerWidth < 600 ? 35 : 75;
  snowflakes = [];
  for (let i = 0; i < count; i++) {
    snowflakes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2.2 + 1.0,
      density: Math.random() * 1.4 + 0.5,
      wind: Math.random() * 0.4 - 0.2,
      alpha: Math.random() * 0.7 + 0.3
    });
  }
  requestAnimationFrame(renderSnow);
}

function renderSnow() {
  if (!isSnowing) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < snowflakes.length; i++) {
    const f = snowflakes[i];
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
    ctx.fill();

    f.y += f.density * 1.1;
    f.x += f.wind + Math.sin(f.y * 0.01) * 0.3;

    if (f.y > canvas.height) {
      f.y = -5;
      f.x = Math.random() * canvas.width;
    }
  }

  requestAnimationFrame(renderSnow);
}

btnToggleSnow.addEventListener('click', () => {
  isSnowing = !isSnowing;
  document.getElementById('snow-icon').textContent = isSnowing ? '❄️' : '☀️';
  if (isSnowing) requestAnimationFrame(renderSnow);
  showToast(isSnowing ? '❄️ Snowfall on' : '☀️ Snowfall paused');
});

// -------------------------------------------------------------
// Bootstrapping
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initSnow();
  fetchVault();
});
