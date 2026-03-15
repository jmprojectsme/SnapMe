import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://umqxidrewrwhypiictrd.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcXhpZHJld3J3aHlwaWljdHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDI1NDksImV4cCI6MjA4ODkxODU0OX0.Ao2EpMSEE6N8VNlueSdDWO0sYcooeFckpfJCw4IZtQk'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let currentUser = null
let currentProfile = null

// UTILS
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 2500);
}

// NAVIGATION
window.showPage = (pageId, el = null) => {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const target = document.getElementById(pageId + 'Page');
  if(target) target.style.display = 'block';
  
  if (el) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  }
  if (pageId === 'home') loadFeed();
  if (pageId === 'profile') loadProfile();
}

// AUTH
window.showLogin = () => {
  document.getElementById('auth-tab-login').classList.add('active');
  document.getElementById('auth-tab-signup').classList.remove('active');
  document.getElementById('auth-btn').textContent = 'Sign In';
}

window.showSignup = () => {
  document.getElementById('auth-tab-signup').classList.add('active');
  document.getElementById('auth-tab-login').classList.remove('active');
  document.getElementById('auth-btn').textContent = 'Create Account';
}

window.handleAuth = async () => {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const isLogin = document.getElementById('auth-tab-login').classList.contains('active');

  if (isLogin) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) showToast(error.message, 'error');
  } else {
    const { error } = await supabase.auth.signUp({ email, password: pass });
    if (error) showToast(error.message, 'error');
    else showToast('Check your email for the link!', 'success');
  }
}

window.handleSignOut = async () => {
  await supabase.auth.signOut();
  location.reload();
}

window.saveProfile = async () => {
  const username = document.getElementById('setup-username').value.trim();
  const bio = document.getElementById('setup-bio').value.trim();
  if (!username) return showToast('Username required', 'error');

  const { error } = await supabase.from('profiles').insert([{ id: currentUser.id, username, bio }]);
  if (error) showToast(error.message, 'error');
  else location.reload();
}

// FEED & POSTS
async function loadFeed() {
  const container = document.getElementById('feedContainer');
  container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-dim);">Gathering frames...</div>';
  
  const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  if (error || !data.length) { container.innerHTML = '<p style="text-align:center; padding:40px;">No photos yet.</p>'; return; }

  container.innerHTML = data.map(post => {
    const isOwner = currentUser && post.user_id === currentUser.id;
    const avg = post.vote_count > 0 ? Math.round(post.total_score / post.vote_count) : 0;
    
    return `
      <div class="post-card">
        <div class="post-header">
          <div class="post-user">
            <div class="post-avatar">${(post.username || 'U')[0].toUpperCase()}</div>
            <span class="post-author">${post.username || 'user'}</span>
          </div>
          ${isOwner ? `<button onclick="deletePost('${post.id}')" style="background:none; border:none; color:var(--red); font-size:0.7rem; cursor:pointer; font-weight:600;">DELETE</button>` : ''}
        </div>
        <img class="post-image" src="${post.image_url}" loading="lazy">
        <div class="post-actions">
           <span style="font-size:0.8rem; color:var(--text-mid);">❤️ ${post.likes || 0}</span>
           <div class="star-rating">
              ${[1,2,3,4,5].map(n => `
                <span class="star ${n <= avg ? 'active' : ''} ${isOwner ? 'disabled' : ''}" 
                      onclick="${isOwner ? "showToast('You cannot rate your own photo', 'error')" : `ratePost('${post.id}', ${n})`}">★</span>
              `).join('')}
           </div>
        </div>
        ${post.caption ? `<div style="padding:0 18px 18px; font-size:0.85rem; color:var(--text-mid);"><strong>${post.username}</strong> ${post.caption}</div>` : ''}
      </div>
    `;
  }).join('');
}

async function loadProfile() {
  if (!currentProfile) return;
  document.getElementById('profile-user').textContent = currentProfile.username;
  document.getElementById('profile-bio-text').textContent = currentProfile.bio || 'Photography enthusiast.';
  document.getElementById('profile-init').textContent = currentProfile.username[0].toUpperCase();

  const { data } = await supabase.from('posts').select('*').eq('user_id', currentUser.id);
  document.getElementById('stat-posts').textContent = data ? data.length : 0;
}

window.deletePost = async (id) => {
  if (!confirm('Delete this photo permanently?')) return;
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) showToast(error.message, 'error');
  else loadFeed();
}

window.ratePost = async (postId, rating) => {
    const { data: post } = await supabase.from('posts').select('total_score, vote_count').eq('id', postId).single();
    await supabase.from('posts').update({ 
      total_score: (post.total_score || 0) + rating, 
      vote_count: (post.vote_count || 0) + 1 
    }).eq('id', postId);
    showToast('Rated ' + rating + ' stars!', 'success');
    loadFeed();
}

// INITIALIZER (REMOVES FLASH)
supabase.auth.onAuthStateChange(async (event, session) => {
  const auth = document.getElementById('auth-screen');
  const app = document.getElementById('app-container');
  const setup = document.getElementById('setup-screen');

  if (session) {
    currentUser = session.user;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    
    if (!profile) {
      auth.style.display = 'none'; app.style.display = 'none'; setup.style.display = 'flex';
    } else {
      currentProfile = profile;
      document.getElementById('nav-avatar-display').textContent = profile.username[0].toUpperCase();
      auth.style.display = 'none'; setup.style.display = 'none'; app.style.display = 'block';
      showPage('home');
    }
  } else {
    currentUser = null;
    app.style.display = 'none'; setup.style.display = 'none'; auth.style.display = 'flex';
  }
});
                                            
