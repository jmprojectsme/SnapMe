// ================================
// SnapMe PH - app.js
// Philippine Phone Photography
// ================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://umqxidrewrwhypiictrd.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcXhpZHJld3J3aHlwaWljdHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDI1NDksImV4cCI6MjA4ODkxODU0OX0.Ao2EpMSEE6N8VNlueSdDWO0sYcooeFckpfJCw4IZtQk'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let currentUser = null
let currentProfile = null

// ================================
// UTILS
// ================================

function showToast(msg, type = '') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = 'toast show ' + type
  setTimeout(() => t.className = 'toast', 2500)
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}

function getInitials(name) {
  if (!name) return 'SN'
  return name.substring(0, 2).toUpperCase()
}

// ================================
// AUTH STATE
// ================================

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    currentUser = session.user
    await loadCurrentProfile()
    showApp()
  } else {
    showAuthScreen()
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user
      await loadCurrentProfile()
      showApp()
    } else {
      currentUser = null
      currentProfile = null
      showAuthScreen()
    }
  })
}

async function loadCurrentProfile() {
  if (!currentUser) return
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single()
  currentProfile = data
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none'
  document.getElementById('guidelines-screen').style.display = 'none'
  document.getElementById('setup-screen').style.display = 'none'
  document.getElementById('app').style.display = 'flex'

  if (!currentProfile || !currentProfile.username) {
    showSetupScreen()
    return
  }

  if (!localStorage.getItem('guidelines_accepted')) {
    showGuidelinesScreen()
    return
  }

  loadFeed()
  updateNavProfile()
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex'
  document.getElementById('guidelines-screen').style.display = 'none'
  document.getElementById('setup-screen').style.display = 'none'
  document.getElementById('app').style.display = 'none'
}

function showGuidelinesScreen() {
  document.getElementById('app').style.display = 'none'
  document.getElementById('guidelines-screen').style.display = 'flex'
}

function showSetupScreen() {
  document.getElementById('app').style.display = 'none'
  document.getElementById('setup-screen').style.display = 'flex'
}

function updateNavProfile() {
  const avatar = document.getElementById('navAvatar')
  if (avatar && currentProfile) {
    avatar.textContent = getInitials(currentProfile.username)
  }
}

// ================================
// AUTH ACTIONS
// ================================

window.showLogin = function() {
  document.getElementById('login-form').style.display = 'block'
  document.getElementById('signup-form').style.display = 'none'
  document.getElementById('auth-tab-login').classList.add('active')
  document.getElementById('auth-tab-signup').classList.remove('active')
}

window.showSignup = function() {
  document.getElementById('login-form').style.display = 'none'
  document.getElementById('signup-form').style.display = 'block'
  document.getElementById('auth-tab-login').classList.remove('active')
  document.getElementById('auth-tab-signup').classList.add('active')
}

window.doLogin = async function() {
  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  if (!email || !password) { showToast('Please fill in all fields', 'error'); return }

  const btn = document.getElementById('login-btn')
  btn.disabled = true
  btn.textContent = 'Signing in...'

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    showToast(error.message, 'error')
    btn.disabled = false
    btn.textContent = 'Sign In'
  }
}

window.doSignup = async function() {
  const email    = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value
  const confirm  = document.getElementById('signup-confirm').value

  if (!email || !password || !confirm) { showToast('Please fill in all fields', 'error'); return }
  if (password !== confirm) { showToast('Passwords do not match', 'error'); return }
  if (password.length < 6)  { showToast('Password must be at least 6 characters', 'error'); return }

  const btn = document.getElementById('signup-btn')
  btn.disabled = true
  btn.textContent = 'Creating account...'

  const { error } = await supabase.auth.signUp({ email, password })
  if (error) {
    showToast(error.message, 'error')
    btn.disabled = false
    btn.textContent = 'Create Account'
  } else {
    showToast('Account created! Check your email to confirm.', 'success')
    btn.disabled = false
    btn.textContent = 'Create Account'
    showLogin()
  }
}

window.doLogout = async function() {
  await supabase.auth.signOut()
  showToast('Signed out!', 'success')
}

// ================================
// PROFILE SETUP
// ================================

window.doSetupProfile = async function() {
  const username = document.getElementById('setup-username').value.trim()
  const bio      = document.getElementById('setup-bio').value.trim()

  if (!username) { showToast('Username is required', 'error'); return }
  if (username.length < 3) { showToast('Username must be at least 3 characters', 'error'); return }
  if (!/^[a-zA-Z0-9_.]+$/.test(username)) { showToast('Username: letters, numbers, _ and . only', 'error'); return }

  const btn = document.getElementById('setup-btn')
  btn.disabled = true
  btn.textContent = 'Saving...'

  const { error } = await supabase.from('profiles').upsert({
    id: currentUser.id,
    username,
    bio: bio || null
  })

  if (error) {
    showToast(error.message.includes('unique') ? 'Username already taken!' : error.message, 'error')
    btn.disabled = false
    btn.textContent = 'Save Profile'
    return
  }

  currentProfile = { id: currentUser.id, username, bio }
  showToast('Profile created! Welcome to SnapMe PH 🎉', 'success')
  setTimeout(() => showGuidelinesScreen(), 1000)

  btn.disabled = false
  btn.textContent = 'Save Profile'
}

// ================================
// GUIDELINES
// ================================

window.acceptGuidelines = function() {
  localStorage.setItem('guidelines_accepted', 'true')
  document.getElementById('guidelines-screen').style.display = 'none'
  document.getElementById('app').style.display = 'flex'
  loadFeed()
  updateNavProfile()
}

// ================================
// PAGE SWITCHING
// ================================

window.showPage = function(name, tabEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.getElementById('page-' + name).classList.add('active')
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'))
  if (tabEl) tabEl.classList.add('active')
  if (name === 'feed')     loadFeed()
  if (name === 'explore')  loadExplore()
  if (name === 'profile')  loadProfile()
  if (name === 'activity') loadActivity()
}

// ================================
// FEED
// ================================

async function loadFeed() {
  const container = document.getElementById('feedContainer')
  container.innerHTML = '<div class="loading"><span class="spinner"></span>Loading photos...</div>'

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>Could not load photos.</p></div>'
    return
  }

  if (!data.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📷</div><p>No photos yet.<br>Be the first to share one!</p></div>'
    return
  }

  container.innerHTML = data.map(post => renderCard(post)).join('')
}

function renderCard(post) {
  const avg      = post.vote_count > 0 ? (post.total_score / post.vote_count).toFixed(1) : null
  const liked    = getLiked(post.id)
  const myRating = getMyRating(post.id)
  const username = post.username || 'snapme user'
  const isOwner  = currentUser && post.user_id === currentUser.id

  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="star-btn ${myRating >= n ? 'filled' : ''}" onclick="ratePost('${post.id}', ${n})" data-post="${post.id}" data-star="${n}">★</button>`
  ).join('')

  return `
  <div class="card" id="card-${post.id}">
    <div class="card-header">
      <div class="card-user">
        <div class="avatar">${getInitials(username)}</div>
        <div>
          <div class="user-name">${username}</div>
          <div class="user-time">${timeAgo(post.created_at)}</div>
        </div>
      </div>
      ${isOwner ? `<button class="delete-btn" onclick="deletePost('${post.id}')">🗑️</button>` : ''}
    </div>
    <div class="card-photo">
      <img src="${post.image_url}" alt="photo" loading="lazy">
      ${avg ? `<div class="score-badge">★ ${avg} <span style="color:var(--text-dim);font-size:0.7rem">(${post.vote_count})</span></div>` : ''}
    </div>
    <div class="card-actions">
      <button class="action-btn ${liked ? 'liked' : ''}" onclick="likePost('${post.id}')" id="like-btn-${post.id}">
        <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span id="like-count-${post.id}">${post.likes}</span>
      </button>
      <div class="action-spacer"></div>
    </div>
    <div class="rate-row">
      <span class="rate-label">Rate:</span>
      <div class="stars">${stars}</div>
    </div>
    ${post.caption ? `<div class="card-caption"><strong>${username}</strong> ${post.caption}</div>` : ''}
  </div>`
}

// ================================
// DELETE POST
// ================================

window.deletePost = async function(id) {
  if (!confirm('Delete this photo?')) return
  await supabase.from('posts').delete().eq('id', id)
  document.getElementById('card-' + id)?.remove()
  showToast('Photo deleted', 'success')
}

// ================================
// LIKES
// ================================

function getLiked(id) {
  return JSON.parse(localStorage.getItem('liked') || '{}')[id] || false
}

function setLiked(id, val) {
  const l = JSON.parse(localStorage.getItem('liked') || '{}')
  l[id] = val
  localStorage.setItem('liked', JSON.stringify(l))
}

window.likePost = async function(id) {
  if (!currentUser) { showToast('Sign in to like photos', 'error'); return }
  const liked    = getLiked(id)
  const btn      = document.getElementById('like-btn-' + id)
  const countEl  = document.getElementById('like-count-' + id)
  const newLiked = !liked
  const delta    = newLiked ? 1 : -1
  const newCount = parseInt(countEl.textContent) + delta

  setLiked(id, newLiked)
  countEl.textContent = newCount
  btn.className = 'action-btn ' + (newLiked ? 'liked' : '')
  btn.querySelector('svg').setAttribute('fill', newLiked ? 'currentColor' : 'none')
  await supabase.from('posts').update({ likes: newCount }).eq('id', id)
}

// ================================
// RATINGS
// ================================

function getMyRating(id) {
  return JSON.parse(localStorage.getItem('ratings') || '{}')[id] || 0
}

function setMyRating(id, val) {
  const r = JSON.parse(localStorage.getItem('ratings') || '{}')
  r[id] = val
  localStorage.setItem('ratings', JSON.stringify(r))
}

window.ratePost = async function(id, score) {
  if (!currentUser) { showToast('Sign in to rate photos', 'error'); return }
  const prev = getMyRating(id)
  if (prev === score) return

  setMyRating(id, score)
  document.querySelectorAll(`[data-post="${id}"]`).forEach(btn => {
    btn.className = 'star-btn ' + (parseInt(btn.dataset.star) <= score ? 'filled' : '')
  })

  const { data } = await supabase.from('posts').select('total_score, vote_count').eq('id', id).single()
  let newTotal = (data.total_score || 0) + score
  let newCount = (data.vote_count || 0) + 1
  if (prev > 0) { newTotal -= prev; newCount -= 1 }

  await supabase.from('posts').update({ total_score: newTotal, vote_count: newCount }).eq('id', id)
  showToast('Rated ' + score + ' ★', 'success')

  const avg  = (newTotal / newCount).toFixed(1)
  const card = document.getElementById('card-' + id)
  if (card) {
    let badge = card.querySelector('.score-badge')
    if (!badge) {
      badge = document.createElement('div')
      badge.className = 'score-badge'
      card.querySelector('.card-photo').appendChild(badge)
    }
    badge.innerHTML = `★ ${avg} <span style="color:var(--text-dim);font-size:0.7rem">(${newCount})</span>`
  }
}

// ================================
// UPLOAD
// ================================

let selectedFile = null

document.getElementById('fileInput').addEventListener('change', (e) => {
  selectedFile = e.target.files[0]
  if (!selectedFile) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const zone = document.getElementById('uploadZone')
    zone.innerHTML = `
      <img src="${ev.target.result}">
      <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);border-radius:20px;padding:6px 14px;font-size:0.75rem;color:var(--gold)">Tap to change</div>`
    zone.onclick = () => document.getElementById('fileInput').click()
  }
  reader.readAsDataURL(selectedFile)
})

window.uploadPost = async function() {
  if (!currentUser) { showToast('Please sign in first', 'error'); return }
  if (!selectedFile) { showToast('Please select a photo first', 'error'); return }

  const btn = document.getElementById('submitBtn')
  btn.disabled = true
  btn.textContent = 'Uploading...'

  try {
    const ext      = selectedFile.name.split('.').pop()
    const filename = `photo_${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('photos').upload(filename, selectedFile)
    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filename)
    const caption = document.getElementById('captionInput').value.trim()

    const { error: insertError } = await supabase.from('posts').insert({
      image_url: urlData.publicUrl,
      caption,
      user_id: currentUser.id,
      username: currentProfile?.username || 'snapme user'
    })
    if (insertError) throw insertError

    showToast('Photo shared! 🎉', 'success')
    selectedFile = null
    document.getElementById('fileInput').value    = ''
    document.getElementById('captionInput').value = ''
    document.getElementById('uploadZone').innerHTML = `
      <div class="upload-zone-text">
        <div class="upload-icon">📷</div>
        <div class="upload-hint">Tap to choose a photo</div>
      </div>`
    document.getElementById('uploadZone').onclick = () => document.getElementById('fileInput').click()
    showPage('feed', document.querySelector('.nav-tab'))

  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error')
  }

  btn.disabled = false
  btn.textContent = 'Share Photo'
}

// ================================
// EXPLORE
// ================================

async function loadExplore() {
  const grid = document.getElementById('exploreGrid')
  grid.innerHTML = '<div class="loading"><span class="spinner"></span></div>'

  const { data } = await supabase.from('posts').select('*').order('likes', { ascending: false })

  if (!data || !data.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:span 3"><p>No photos yet</p></div>'
    return
  }

  grid.innerHTML = data.map(post => {
    const avg = post.vote_count > 0 ? (post.total_score / post.vote_count).toFixed(1) : ''
    return `
    <div class="grid-item" onclick="showPage('feed', document.querySelector('.nav-tab'))">
      <img src="${post.image_url}" loading="lazy">
      ${avg ? `<div class="grid-score">★ ${avg}</div>` : ''}
    </div>`
  }).join('')
}

// ================================
// PROFILE PAGE
// ================================

async function loadProfile() {
  if (!currentUser || !currentProfile) return

  document.getElementById('profileName').textContent     = currentProfile.username
  document.getElementById('profileBio').textContent      = currentProfile.bio || 'No bio yet'
  document.getElementById('profileInitials').textContent = getInitials(currentProfile.username)
  document.getElementById('profileEmail').textContent    = currentUser.email

  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })

  if (!data) return

  document.getElementById('profilePostCount').textContent = data.length
  const totalLikes = data.reduce((s, p) => s + (p.likes || 0), 0)
  document.getElementById('profileLikeCount').textContent = totalLikes

  const rated = data.filter(p => p.vote_count > 0)
  if (rated.length) {
    const avg = rated.reduce((s, p) => s + p.total_score / p.vote_count, 0) / rated.length
    document.getElementById('profileAvgScore').textContent = avg.toFixed(1)
  }

  document.getElementById('profileGrid').innerHTML = data.length
    ? data.map(post => `<div class="grid-item"><img src="${post.image_url}" loading="lazy"></div>`).join('')
    : '<div style="grid-column:span 3;text-align:center;padding:20px;color:var(--text-dim);font-size:0.82rem">No photos yet</div>'
}

// ================================
// ACTIVITY
// ================================

async function loadActivity() {
  const list = document.getElementById('activityList')

  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!data || !data.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">🔔</div><p>No activity yet.<br>Start uploading photos!</p></div>'
    return
  }

  list.innerHTML = data.map(post => `
    <div class="activity-item">
      <img class="activity-thumb" src="${post.image_url}" loading="lazy">
      <div class="activity-info">
        <p><strong>${post.username || 'snapme user'}</strong> shared a photo</p>
        ${post.likes > 0 ? `<p>❤️ ${post.likes} like${post.likes !== 1 ? 's' : ''}</p>` : ''}
        ${post.vote_count > 0 ? `<p>★ Rated ${(post.total_score / post.vote_count).toFixed(1)} by ${post.vote_count} user${post.vote_count !== 1 ? 's' : ''}</p>` : ''}
        <div class="activity-time">${timeAgo(post.created_at)}</div>
      </div>
    </div>`).join('')
}

// ================================
// SERVICE WORKER
// ================================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('SnapMe SW registered ✅'))
    .catch(err => console.log('SW error:', err))
}

// ================================
// INIT
// ================================

initAuth()
