// ================================
// SnapMe PH - app.js v1.4
// ================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://umqxidrewrwhypiictrd.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcXhpZHJld3J3aHlwaWljdHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDI1NDksImV4cCI6MjA4ODkxODU0OX0.Ao2EpMSEE6N8VNlueSdDWO0sYcooeFckpfJCw4IZtQk'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let currentUser = null
let currentProfile = null
let allPosts = []
let explorePosts = []
let currentDetailPost = null
let currentCategoryFilter = ''

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
// IMAGE COMPRESSION
// ================================

function compressImage(file, maxWidth = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' })), 'image/jpeg', quality)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// ================================
// DRAWER
// ================================

window.openDrawer = function() {
  document.getElementById('settings-drawer').classList.add('open')
  document.getElementById('drawer-overlay').classList.add('open')
}

window.closeDrawer = function() {
  document.getElementById('settings-drawer').classList.remove('open')
  document.getElementById('drawer-overlay').classList.remove('open')
}

window.showGuidelinesFromDrawer = function() {
  document.getElementById('guidelines-screen').style.display = 'flex'
  document.getElementById('app').style.display = 'none'
}

// ================================
// PHOTO DETAIL
// ================================

window.openPhotoDetail = function(postId) {
  const post = allPosts.find(p => p.id === postId) || explorePosts.find(p => p.id === postId)
  if (!post) return
  currentDetailPost = post

  document.getElementById('detailImg').src = post.image_url
  document.getElementById('detailCategory').textContent = post.category || ''
  document.getElementById('detailCategory').style.display = post.category ? 'block' : 'none'
  document.getElementById('detailExif').textContent = 'Shot on phone'
  document.getElementById('detailUsername').textContent = post.username || 'snapme user'
  document.getElementById('detailCaption').textContent = post.caption || ''
  document.getElementById('detailUserAvatar').textContent = getInitials(post.username)
  document.getElementById('detailLikeCount').textContent = post.likes || 0
  document.getElementById('detailCommentCount').textContent = 0

  const liked = getLiked(post.id)
  const likeBtn = document.getElementById('detailLikeBtn')
  document.getElementById('detailLikeIcon').textContent = liked ? '❤️' : '🤍'
  likeBtn.className = 'detail-action-btn' + (liked ? ' liked' : '')

  // EXIF card — show placeholder for now
  document.getElementById('exifCard').style.display = 'none'

  // Community critique — show if rated
  if (post.vote_count > 0) {
    const avg = (post.total_score / post.vote_count).toFixed(1)
    document.getElementById('critiqueSection').style.display = 'block'
    document.getElementById('critiqueContent').innerHTML = `
      <div class="critique-row">
        <div class="critique-label">Overall</div>
        <div class="critique-bar-wrap"><div class="critique-bar" style="width:${(avg/5)*100}%"></div></div>
        <div class="critique-score">${avg}</div>
      </div>
      <div class="critique-row">
        <div class="critique-label">Composition</div>
        <div class="critique-bar-wrap"><div class="critique-bar" style="width:${Math.min(100,(avg/5)*100 + Math.random()*10 - 5)}%"></div></div>
        <div class="critique-score">${(avg * 1.8 + Math.random()).toFixed(1)}</div>
      </div>
      <div class="critique-row">
        <div class="critique-label">Lighting</div>
        <div class="critique-bar-wrap"><div class="critique-bar" style="width:${Math.min(100,(avg/5)*100 + Math.random()*10 - 5)}%"></div></div>
        <div class="critique-score">${(avg * 1.8 + Math.random()).toFixed(1)}</div>
      </div>`
  } else {
    document.getElementById('critiqueSection').style.display = 'none'
  }

  // Rate section
  const isOwnPost = currentUser && post.user_id === currentUser.id
  const rateSection = document.getElementById('rateSection')
  if (isOwnPost) {
    rateSection.style.display = 'none'
  } else {
    rateSection.style.display = 'block'
    const myRating = getMyRating(post.id)
    document.getElementById('detailStars').innerHTML = [1,2,3,4,5].map(n =>
      `<button class="star-btn ${myRating >= n ? 'filled' : ''}" onclick="ratePost('${post.id}', ${n})" data-post="${post.id}" data-star="${n}">★</button>`
    ).join('')
  }

  const detail = document.getElementById('photo-detail')
  detail.style.display = 'flex'
  detail.scrollTop = 0
  document.body.style.overflow = 'hidden'
}

window.closePhotoDetail = function() {
  document.getElementById('photo-detail').style.display = 'none'
  document.body.style.overflow = ''
}

window.detailLike = async function() {
  if (!currentDetailPost) return
  const post = currentDetailPost
  const isOwnPost = currentUser && post.user_id === currentUser.id
  if (isOwnPost) { showToast("You can't like your own photo", 'error'); return }
  if (!currentUser) { showToast('Sign in to like photos', 'error'); return }

  const liked = getLiked(post.id)
  const newLiked = !liked
  const newCount = (post.likes || 0) + (newLiked ? 1 : -1)

  setLiked(post.id, newLiked)
  post.likes = newCount
  document.getElementById('detailLikeIcon').textContent = newLiked ? '❤️' : '🤍'
  document.getElementById('detailLikeCount').textContent = newCount

  // Update in allPosts
  const idx = allPosts.findIndex(p => p.id === post.id)
  if (idx !== -1) allPosts[idx].likes = newCount

  await supabase.from('posts').update({ likes: newCount }).eq('id', post.id)

  // Update feed card if visible
  const countEl = document.getElementById('like-count-' + post.id)
  if (countEl) countEl.textContent = newCount
}

// ================================
// SLIDES
// ================================

function loadSlides(posts) {
  const row = document.getElementById('slidesRow')
  const userMap = {}
  posts.forEach(post => {
    if (post.user_id && post.username && !userMap[post.user_id]) {
      userMap[post.user_id] = post
    }
  })

  let mySlideHtml = `
    <div class="slide-item" onclick="handleMySlide()">
      <div class="slide-circle slide-add"><div class="slide-add-icon">+</div></div>
      <div class="slide-label">Your Slide</div>
    </div>`

  if (currentUser) {
    const myPost = posts.find(p => p.user_id === currentUser.id)
    if (myPost) {
      mySlideHtml = `
        <div class="slide-item" onclick="openSlideViewer('${currentUser.id}')">
          <div class="slide-circle"><img src="${myPost.image_url}" loading="lazy"></div>
          <div class="slide-label">You</div>
        </div>`
    }
  }

  const othersHtml = Object.values(userMap)
    .filter(u => !currentUser || u.user_id !== currentUser.id)
    .map(post => `
      <div class="slide-item" onclick="openSlideViewer('${post.user_id}')">
        <div class="slide-circle"><img src="${post.image_url}" loading="lazy"></div>
        <div class="slide-label">${post.username}</div>
      </div>`).join('')

  row.innerHTML = mySlideHtml + othersHtml
}

window.handleMySlide = function() {
  const myPost = allPosts.find(p => currentUser && p.user_id === currentUser.id)
  if (myPost) openSlideViewer(currentUser.id)
  else showPage('upload', null)
}

window.openSlideViewer = function(userId) {
  const userPosts = allPosts.filter(p => p.user_id === userId)
  if (!userPosts.length) return

  const username = userPosts[0].username || 'snapme user'
  document.getElementById('slideViewerAvatar').textContent = getInitials(username)
  document.getElementById('slideViewerUsername').textContent = username

  const photosEl = document.getElementById('slideViewerPhotos')
  photosEl.innerHTML = userPosts.map(post =>
    `<img class="slide-viewer-photo" src="${post.image_url}" loading="lazy">`
  ).join('')

  document.getElementById('slideViewerDots').innerHTML = userPosts.map((_, i) =>
    `<div class="slide-dot ${i === 0 ? 'active' : ''}" onclick="scrollToSlide(${i})"></div>`
  ).join('')

  photosEl.onscroll = () => {
    const index = Math.round(photosEl.scrollLeft / photosEl.offsetWidth)
    document.querySelectorAll('.slide-dot').forEach((d, i) => {
      d.className = 'slide-dot' + (i === index ? ' active' : '')
    })
  }

  document.getElementById('slide-viewer').classList.add('open')
  document.body.style.overflow = 'hidden'
}

window.scrollToSlide = function(index) {
  const photosEl = document.getElementById('slideViewerPhotos')
  photosEl.scrollTo({ left: index * photosEl.offsetWidth, behavior: 'smooth' })
}

window.closeSlideViewer = function() {
  document.getElementById('slide-viewer').classList.remove('open')
  document.body.style.overflow = ''
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
      currentUser = null; currentProfile = null
      showAuthScreen()
    }
  })
}

async function loadCurrentProfile() {
  if (!currentUser) return
  const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
  currentProfile = data
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none'
  document.getElementById('guidelines-screen').style.display = 'none'
  document.getElementById('setup-screen').style.display = 'none'
  document.getElementById('app').style.display = 'flex'
  if (!currentProfile || !currentProfile.username) { showSetupScreen(); return }
  if (!localStorage.getItem('guidelines_accepted')) { showGuidelinesScreen(); return }
  loadFeed()
  updateNavProfile()
  updateDrawerProfile()
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex'
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
  const el = document.getElementById('navAvatar')
  if (el && currentProfile) el.textContent = getInitials(currentProfile.username)
}

function updateDrawerProfile() {
  if (!currentProfile || !currentUser) return
  const el = document.getElementById('drawerAvatar')
  const un = document.getElementById('drawerUsername')
  const em = document.getElementById('drawerEmail')
  if (el) el.textContent = getInitials(currentProfile.username)
  if (un) un.textContent = '@' + currentProfile.username
  if (em) em.textContent = currentUser.email
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
  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  if (!email || !password) { showToast('Please fill in all fields', 'error'); return }
  const btn = document.getElementById('login-btn')
  btn.disabled = true; btn.textContent = 'Signing in...'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Sign In' }
}

window.doSignup = async function() {
  const email = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value
  const confirm = document.getElementById('signup-confirm').value
  if (!email || !password || !confirm) { showToast('Please fill in all fields', 'error'); return }
  if (password !== confirm) { showToast('Passwords do not match', 'error'); return }
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }
  const btn = document.getElementById('signup-btn')
  btn.disabled = true; btn.textContent = 'Creating account...'
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) {
    showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Create Account'
  } else {
    showToast('Account created! Check your email to confirm.', 'success')
    btn.disabled = false; btn.textContent = 'Create Account'
    showLogin()
  }
}

window.doLogout = async function() {
  closeDrawer()
  await supabase.auth.signOut()
  showToast('Signed out!', 'success')
}

// ================================
// PROFILE SETUP
// ================================

window.doSetupProfile = async function() {
  const username = document.getElementById('setup-username').value.trim()
  const bio = document.getElementById('setup-bio').value.trim()
  if (!username) { showToast('Username is required', 'error'); return }
  if (username.length < 3) { showToast('Username must be at least 3 characters', 'error'); return }
  if (!/^[a-zA-Z0-9_.]+$/.test(username)) { showToast('Username: letters, numbers, _ and . only', 'error'); return }
  const btn = document.getElementById('setup-btn')
  btn.disabled = true; btn.textContent = 'Saving...'
  const { error } = await supabase.from('profiles').upsert({ id: currentUser.id, username, bio: bio || null })
  if (error) {
    showToast(error.message.includes('unique') ? 'Username already taken!' : error.message, 'error')
    btn.disabled = false; btn.textContent = 'Save Profile'; return
  }
  currentProfile = { id: currentUser.id, username, bio }
  showToast('Profile created! Welcome to SnapMe PH 🎉', 'success')
  setTimeout(() => showGuidelinesScreen(), 1000)
  btn.disabled = false; btn.textContent = 'Save Profile'
}

// ================================
// GUIDELINES
// ================================

window.acceptGuidelines = function() {
  localStorage.setItem('guidelines_accepted', 'true')
  document.getElementById('guidelines-screen').style.display = 'none'
  document.getElementById('app').style.display = 'flex'
  loadFeed(); updateNavProfile(); updateDrawerProfile()
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

  const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false })

  if (error) { container.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>Could not load photos.</p></div>'; return }
  if (!data.length) { container.innerHTML = '<div class="empty"><div class="empty-icon">📷</div><p>No photos yet.<br>Be the first to share one!</p></div>'; return }

  allPosts = data
  loadSlides(data)
  container.innerHTML = data.map(post => renderCard(post)).join('')
}

function renderCard(post) {
  const username = post.username || 'snapme user'
  const isOwnPost = currentUser && post.user_id === currentUser.id
  const liked = getLiked(post.id)

  return `
  <div class="card" onclick="openPhotoDetail('${post.id}')">
    <div class="card-photo">
      <img src="${post.image_url}" alt="photo" loading="lazy">
      ${post.category ? `<div class="card-overlay-left">${post.category}</div>` : ''}
      <div class="card-overlay-right">📱 Phone</div>
    </div>
    <div class="card-footer">
      <div class="card-footer-user">
        <div class="card-footer-avatar">${getInitials(username)}</div>
        <div class="card-footer-username">${username}</div>
      </div>
      <div class="card-footer-actions" onclick="event.stopPropagation()">
        ${!isOwnPost ? `
        <button class="card-action ${liked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="likePost('${post.id}')">
          <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span id="like-count-${post.id}">${post.likes || 0}</span>
        </button>` : `
        <div class="card-action" style="opacity:0.3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>${post.likes || 0}</span>
        </div>`}
        <button class="card-action">💬 0</button>
        ${isOwnPost ? `<button class="card-action" onclick="deletePost('${post.id}')">🗑️</button>` : ''}
      </div>
    </div>
  </div>`
}

// ================================
// DELETE
// ================================

window.deletePost = async function(id) {
  const post = allPosts.find(p => p.id === id)
  if (!post || !currentUser || post.user_id !== currentUser.id) { showToast('You can only delete your own photos', 'error'); return }
  if (!confirm('Delete this photo?')) return
  await supabase.from('posts').delete().eq('id', id)
  document.getElementById('card-' + id)?.remove()
  allPosts = allPosts.filter(p => p.id !== id)
  if (document.getElementById('photo-detail').style.display !== 'none') closePhotoDetail()
  showToast('Photo deleted', 'success')
  loadFeed()
}

// ================================
// LIKES
// ================================

function getLiked(id) { return JSON.parse(localStorage.getItem('liked') || '{}')[id] || false }
function setLiked(id, val) { const l = JSON.parse(localStorage.getItem('liked') || '{}'); l[id] = val; localStorage.setItem('liked', JSON.stringify(l)) }

window.likePost = async function(id) {
  if (!currentUser) { showToast('Sign in to like photos', 'error'); return }
  const post = allPosts.find(p => p.id === id)
  if (post && post.user_id === currentUser.id) { showToast("You can't like your own photo", 'error'); return }

  const liked = getLiked(id)
  const btn = document.getElementById('like-btn-' + id)
  const countEl = document.getElementById('like-count-' + id)
  const newLiked = !liked
  const newCount = parseInt(countEl?.textContent || 0) + (newLiked ? 1 : -1)

  setLiked(id, newLiked)
  if (countEl) countEl.textContent = newCount
  if (btn) {
    btn.className = 'card-action' + (newLiked ? ' liked' : '')
    btn.querySelector('svg')?.setAttribute('fill', newLiked ? 'currentColor' : 'none')
  }
  if (post) post.likes = newCount
  await supabase.from('posts').update({ likes: newCount }).eq('id', id)
}

// ================================
// RATINGS
// ================================

function getMyRating(id) { return JSON.parse(localStorage.getItem('ratings') || '{}')[id] || 0 }
function setMyRating(id, val) { const r = JSON.parse(localStorage.getItem('ratings') || '{}'); r[id] = val; localStorage.setItem('ratings', JSON.stringify(r)) }

window.ratePost = async function(id, score) {
  if (!currentUser) { showToast('Sign in to rate photos', 'error'); return }
  const post = allPosts.find(p => p.id === id) || currentDetailPost
  if (post && post.user_id === currentUser.id) { showToast("You can't rate your own photo", 'error'); return }

  const prev = getMyRating(id)
  if (prev === score) return

  setMyRating(id, score)
  document.querySelectorAll(`[data-post="${id}"]`).forEach(btn => {
    btn.className = 'star-btn' + (parseInt(btn.dataset.star) <= score ? ' filled' : '')
  })

  const { data } = await supabase.from('posts').select('total_score, vote_count').eq('id', id).single()
  let newTotal = (data.total_score || 0) + score
  let newCount = (data.vote_count || 0) + 1
  if (prev > 0) { newTotal -= prev; newCount -= 1 }

  await supabase.from('posts').update({ total_score: newTotal, vote_count: newCount }).eq('id', id)
  showToast('Rated ' + score + ' ★', 'success')
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
  btn.disabled = true; btn.textContent = 'Compressing...'
  try {
    const compressed = await compressImage(selectedFile)
    btn.textContent = 'Uploading...'
    const filename = `photo_${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage.from('photos').upload(filename, compressed)
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filename)
    const caption = document.getElementById('captionInput').value.trim()
    const category = document.getElementById('categorySelect').value
    const { error: insertError } = await supabase.from('posts').insert({
      image_url: urlData.publicUrl, caption,
      category: category || null,
      user_id: currentUser.id,
      username: currentProfile?.username || 'snapme user'
    })
    if (insertError) throw insertError
    showToast('Photo shared! 🎉', 'success')
    selectedFile = null
    document.getElementById('fileInput').value = ''
    document.getElementById('captionInput').value = ''
    document.getElementById('categorySelect').value = ''
    document.getElementById('uploadZone').innerHTML = `<div class="upload-zone-text"><div class="upload-icon">📷</div><div class="upload-hint">Tap to choose a photo</div></div>`
    document.getElementById('uploadZone').onclick = () => document.getElementById('fileInput').click()
    showPage('feed', document.querySelector('.nav-tab'))
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error')
  }
  btn.disabled = false; btn.textContent = 'Share Photo'
}

// ================================
// EXPLORE
// ================================

async function loadExplore() {
  const grid = document.getElementById('exploreGrid')
  grid.innerHTML = '<div class="loading" style="text-align:center;padding:40px"><span class="spinner"></span></div>'
  const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
  explorePosts = data || []
  renderExploreGrid(explorePosts)
}

function renderExploreGrid(posts) {
  const grid = document.getElementById('exploreGrid')
  if (!posts.length) { grid.innerHTML = '<div class="empty"><p>No photos yet</p></div>'; return }

  const filtered = currentCategoryFilter
    ? posts.filter(p => p.category === currentCategoryFilter)
    : posts

  if (!filtered.length) { grid.innerHTML = '<div class="empty"><p>No photos in this category yet</p></div>'; return }

  grid.innerHTML = filtered.map(post => {
    const avg = post.vote_count > 0 ? (post.total_score / post.vote_count).toFixed(1) : ''
    return `
    <div class="masonry-item" onclick="openPhotoDetail('${post.id}')">
      <img src="${post.image_url}" loading="lazy">
      ${avg ? `<div class="masonry-score">★ ${avg}</div>` : ''}
    </div>`
  }).join('')
}

window.filterByCategory = function(category, btn) {
  currentCategoryFilter = category
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'))
  btn.classList.add('active')
  renderExploreGrid(explorePosts)
}

window.filterExplore = function() {
  const query = document.getElementById('searchInput').value.toLowerCase()
  const filtered = explorePosts.filter(p =>
    (p.username || '').toLowerCase().includes(query) ||
    (p.caption || '').toLowerCase().includes(query) ||
    (p.category || '').toLowerCase().includes(query)
  )
  renderExploreGrid(filtered)
}

// ================================
// PROFILE
// ================================

async function loadProfile() {
  if (!currentUser || !currentProfile) return
  document.getElementById('profileName').textContent = currentProfile.username
  document.getElementById('profileUsername').textContent = '@' + currentProfile.username
  document.getElementById('profileBio').textContent = currentProfile.bio || ''
  document.getElementById('profileInitials').textContent = getInitials(currentProfile.username)

  const { data } = await supabase.from('posts').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false })
  if (!data) return

  document.getElementById('profilePostCount').textContent = data.length
  document.getElementById('profileLikeCount').textContent = data.reduce((s, p) => s + (p.likes || 0), 0)
  const rated = data.filter(p => p.vote_count > 0)
  if (rated.length) {
    const avg = rated.reduce((s, p) => s + p.total_score / p.vote_count, 0) / rated.length
    document.getElementById('profileAvgScore').textContent = avg.toFixed(1)
  }

  document.getElementById('profilePortfolio').innerHTML = data.length
    ? data.map(post => `<div class="profile-masonry-item" onclick="openPhotoDetail('${post.id}')"><img src="${post.image_url}" loading="lazy"></div>`).join('')
    : '<div style="text-align:center;padding:40px;color:var(--text-dim);font-size:0.82rem">No photos yet</div>'

  // Set profile cover from latest photo
  if (data.length > 0) {
    const cover = document.getElementById('profileCover')
    cover.style.backgroundImage = `url(${data[0].image_url})`
    cover.style.backgroundSize = 'cover'
    cover.style.backgroundPosition = 'center'
  }
}

window.switchProfileTab = function(tab, btn) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById('profilePortfolio').style.display = tab === 'portfolio' ? 'block' : 'none'
  document.getElementById('profileCritiques').style.display = tab === 'critiques' ? 'block' : 'none'
}

// ================================
// ACTIVITY
// ================================

async function loadActivity() {
  const list = document.getElementById('activityList')
  const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(20)
  if (!data || !data.length) { list.innerHTML = '<div class="empty"><div class="empty-icon">🔔</div><p>No activity yet.</p></div>'; return }
  list.innerHTML = data.map(post => `
    <div class="activity-item" onclick="openPhotoDetail('${post.id}')">
      <img class="activity-thumb" src="${post.image_url}" loading="lazy">
      <div class="activity-info">
        <p><strong>${post.username || 'snapme user'}</strong> shared a photo${post.category ? ` · ${post.category}` : ''}</p>
        ${post.likes > 0 ? `<p>❤️ ${post.likes} like${post.likes !== 1 ? 's' : ''}</p>` : ''}
        ${post.vote_count > 0 ? `<p>★ Rated ${(post.total_score/post.vote_count).toFixed(1)} by ${post.vote_count} user${post.vote_count !== 1 ? 's' : ''}</p>` : ''}
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
