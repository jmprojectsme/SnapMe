// ================================
// SnapMe PH - app.js v1.5
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
let critiqueRatings = { composition: 0, lighting: 0, editing: 0 }

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

function avatarHtml(avatarUrl, name, size = 30) {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`
  }
  return getInitials(name)
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
// EXIF READING
// ================================

function readExif(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target.result)
        if (view.getUint16(0, false) !== 0xFFD8) { resolve(null); return }
        let offset = 2
        while (offset < view.byteLength) {
          if (view.getUint16(offset, false) === 0xFFE1) {
            const exifData = {}
            // Basic EXIF parsing — get what we can
            resolve(exifData)
            return
          }
          offset += 2 + view.getUint16(offset + 2, false)
        }
        resolve(null)
      } catch (e) { resolve(null) }
    }
    reader.readAsArrayBuffer(file.slice(0, 64000))
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

window.openPhotoDetail = async function(postId) {
  const post = allPosts.find(p => p.id === postId) || explorePosts.find(p => p.id === postId)
  if (!post) return
  currentDetailPost = post

  const isOwnPost = currentUser && post.user_id === currentUser.id

  document.getElementById('detailImg').src = post.image_url
  document.getElementById('detailCategory').textContent = post.category || ''
  document.getElementById('detailCategory').style.display = post.category ? 'block' : 'none'
  document.getElementById('detailExifOverlay').textContent = post.exif_data?.model || '📱 Phone'
  document.getElementById('detailUsername').textContent = post.username || 'snapme user'
  document.getElementById('detailCaption').textContent = post.caption || ''
  document.getElementById('detailLikeCount').textContent = post.likes || 0
  document.getElementById('detailCommentCount').textContent = 0

  // User avatar
  const avatarEl = document.getElementById('detailUserAvatar')
  if (post.avatar_url) {
    avatarEl.innerHTML = `<img src="${post.avatar_url}">`
  } else {
    avatarEl.textContent = getInitials(post.username)
  }

  // Comment avatar
  const commentAvatarEl = document.getElementById('commentAvatar')
  if (currentProfile?.avatar_url) {
    commentAvatarEl.innerHTML = `<img src="${currentProfile.avatar_url}">`
  } else {
    commentAvatarEl.textContent = getInitials(currentProfile?.username)
  }

  // Like state
  const liked = await checkLiked(post.id)
  document.getElementById('detailLikeIcon').textContent = liked ? '❤️' : '🤍'
  document.getElementById('detailLikeBtn').className = 'detail-action-btn' + (liked ? ' liked' : '')

  // Delete button
  document.getElementById('detailDeleteBtn').style.display = isOwnPost ? 'flex' : 'none'

  // EXIF data
  if (post.exif_data && Object.keys(post.exif_data).length > 0) {
    document.getElementById('exifCard').style.display = 'block'
    document.getElementById('exifGrid').innerHTML = Object.entries(post.exif_data).map(([key, val]) => `
      <div class="exif-item">
        <div class="exif-value">${val}</div>
        <div class="exif-label">${key}</div>
      </div>`).join('')
  } else {
    document.getElementById('exifCard').style.display = 'none'
  }

  // Load critiques
  await loadCritiques(post.id)

  // Rate section — only for others' posts
  const rateSection = document.getElementById('rateSection')
  if (!isOwnPost && currentUser) {
    rateSection.style.display = 'block'
    // Check if already critiqued
    const { data: existing } = await supabase
      .from('critiques')
      .select('*')
      .eq('post_id', post.id)
      .eq('user_id', currentUser.id)
      .single()

    if (existing) {
      critiqueRatings = { composition: existing.composition, lighting: existing.lighting, editing: existing.editing }
    } else {
      critiqueRatings = { composition: 0, lighting: 0, editing: 0 }
    }
    renderCritiqueInputs()
  } else {
    rateSection.style.display = 'none'
  }

  // Load comments
  await loadComments(post.id)

  const detail = document.getElementById('photo-detail')
  detail.style.display = 'flex'
  detail.scrollTop = 0
  document.body.style.overflow = 'hidden'
}

window.closePhotoDetail = function() {
  document.getElementById('photo-detail').style.display = 'none'
  document.body.style.overflow = ''
  currentDetailPost = null
}

// ================================
// CRITIQUES
// ================================

function renderCritiqueInputs() {
  ['composition', 'lighting', 'editing'].forEach(cat => {
    const container = document.getElementById(`stars-${cat}`)
    container.innerHTML = [1,2,3,4,5,6,7,8,9,10].map(n =>
      `<button class="star-btn ${critiqueRatings[cat] >= n ? 'filled' : ''}"
        onclick="setCritiqueRating('${cat}', ${n})">★</button>`
    ).join('')
  })
}

window.setCritiqueRating = function(category, score) {
  critiqueRatings[category] = score
  renderCritiqueInputs()
}

window.submitCritique = async function() {
  if (!currentUser) { showToast('Sign in to critique photos', 'error'); return }
  if (!currentDetailPost) return
  if (critiqueRatings.composition === 0 || critiqueRatings.lighting === 0 || critiqueRatings.editing === 0) {
    showToast('Please rate all 3 categories', 'error'); return
  }

  const { error } = await supabase.from('critiques').upsert({
    post_id: currentDetailPost.id,
    user_id: currentUser.id,
    composition: critiqueRatings.composition,
    lighting: critiqueRatings.lighting,
    editing: critiqueRatings.editing
  }, { onConflict: 'post_id,user_id' })

  if (error) { showToast('Error submitting critique', 'error'); return }

  showToast('Critique submitted! 🎉', 'success')
  await loadCritiques(currentDetailPost.id)
}

async function loadCritiques(postId) {
  const { data } = await supabase.from('critiques').select('*').eq('post_id', postId)

  if (!data || !data.length) {
    document.getElementById('critiqueSection').style.display = 'none'
    return
  }

  const avg = (arr) => (arr.reduce((s, v) => s + v, 0) / arr.length)
  const compAvg = avg(data.map(d => d.composition))
  const lightAvg = avg(data.map(d => d.lighting))
  const editAvg  = avg(data.map(d => d.editing))

  document.getElementById('critiqueSection').style.display = 'block'
  document.getElementById('critiqueContent').innerHTML = [
    { label: 'Composition', avg: compAvg },
    { label: 'Lighting',    avg: lightAvg },
    { label: 'Editing',     avg: editAvg },
  ].map(({ label, avg }) => `
    <div class="critique-row">
      <div class="critique-label">${label}</div>
      <div class="critique-bar-wrap">
        <div class="critique-bar" style="width:${(avg / 10) * 100}%"></div>
      </div>
      <div class="critique-score">${avg.toFixed(1)}</div>
    </div>`).join('')
}

// ================================
// COMMENTS
// ================================

async function loadComments(postId) {
  const list = document.getElementById('commentsList')
  list.innerHTML = '<div class="loading"><span class="spinner"></span></div>'

  const { data } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  document.getElementById('detailCommentCount').textContent = data?.length || 0

  if (!data || !data.length) {
    list.innerHTML = '<div style="padding:16px 0;color:var(--text-dim);font-size:0.8rem">No comments yet. Be the first!</div>'
    return
  }

  list.innerHTML = data.map(comment => `
    <div class="comment-item">
      <div class="comment-item-avatar">${getInitials(comment.username)}</div>
      <div class="comment-item-body">
        <div class="comment-item-username">${comment.username || 'snapme user'}</div>
        <div class="comment-item-text">${comment.content}</div>
        <div class="comment-item-time">${timeAgo(comment.created_at)}</div>
      </div>
    </div>`).join('')
}

window.submitComment = async function() {
  if (!currentUser) { showToast('Sign in to comment', 'error'); return }
  if (!currentDetailPost) return

  const input = document.getElementById('commentInput')
  const content = input.value.trim()
  if (!content) return

  const { error } = await supabase.from('comments').insert({
    post_id: currentDetailPost.id,
    user_id: currentUser.id,
    username: currentProfile?.username || 'snapme user',
    content
  })

  if (error) { showToast('Error posting comment', 'error'); return }

  input.value = ''
  await loadComments(currentDetailPost.id)
  showToast('Comment posted!', 'success')
}

window.focusComment = function() {
  document.getElementById('commentInput').focus()
}

// ================================
// LIKES — database verified
// ================================

async function checkLiked(postId) {
  if (!currentUser) return false
  const { data } = await supabase
    .from('ratings')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', currentUser.id)
    .single()
  return !!data
}

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

window.detailLike = async function() {
  if (!currentDetailPost) return
  const post = currentDetailPost
  if (currentUser && post.user_id === currentUser.id) { showToast("You can't like your own photo", 'error'); return }
  if (!currentUser) { showToast('Sign in to like photos', 'error'); return }

  const liked = getLiked(post.id)
  const newLiked = !liked
  const newCount = (post.likes || 0) + (newLiked ? 1 : -1)

  setLiked(post.id, newLiked)
  post.likes = newCount
  document.getElementById('detailLikeIcon').textContent = newLiked ? '❤️' : '🤍'
  document.getElementById('detailLikeCount').textContent = newCount
  document.getElementById('detailLikeBtn').className = 'detail-action-btn' + (newLiked ? ' liked' : '')

  const idx = allPosts.findIndex(p => p.id === post.id)
  if (idx !== -1) allPosts[idx].likes = newCount

  await supabase.from('posts').update({ likes: newCount }).eq('id', post.id)
  const countEl = document.getElementById('like-count-' + post.id)
  if (countEl) countEl.textContent = newCount
}

// ================================
// DELETE
// ================================

window.deleteCurrentPost = async function() {
  if (!currentDetailPost || !currentUser) return
  if (currentDetailPost.user_id !== currentUser.id) { showToast('You can only delete your own photos', 'error'); return }
  if (!confirm('Delete this photo?')) return
  await supabase.from('posts').delete().eq('id', currentDetailPost.id)
  allPosts = allPosts.filter(p => p.id !== currentDetailPost.id)
  closePhotoDetail()
  showToast('Photo deleted', 'success')
  loadFeed()
}

// ================================
// PROFILE PHOTO UPLOAD
// ================================

window.uploadAvatarPhoto = function() {
  document.getElementById('avatarInput').click()
}

window.uploadCoverPhoto = function() {
  document.getElementById('coverInput').click()
}

document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file || !currentUser) return
  showToast('Uploading avatar...', '')
  try {
    const compressed = await compressImage(file, 400, 0.85)
    const filename = `avatar_${currentUser.id}.jpg`
    const { error } = await supabase.storage.from('photos').upload(filename, compressed, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filename)
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUser.id)
    currentProfile.avatar_url = avatarUrl
    updateNavProfile()
    updateDrawerProfile()
    loadProfile()
    showToast('Avatar updated! 🎉', 'success')
  } catch (err) { showToast('Upload failed: ' + err.message, 'error') }
})

document.getElementById('coverInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file || !currentUser) return
  showToast('Uploading cover...', '')
  try {
    const compressed = await compressImage(file, 1200, 0.85)
    const filename = `cover_${currentUser.id}.jpg`
    const { error } = await supabase.storage.from('photos').upload(filename, compressed, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filename)
    const coverUrl = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('profiles').update({ cover_url: coverUrl }).eq('id', currentUser.id)
    currentProfile.cover_url = coverUrl
    loadProfile()
    showToast('Cover photo updated! 🎉', 'success')
  } catch (err) { showToast('Upload failed: ' + err.message, 'error') }
})

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
      const imgContent = currentProfile?.avatar_url
        ? `<img src="${currentProfile.avatar_url}">`
        : `<img src="${myPost.image_url}">`
      mySlideHtml = `
        <div class="slide-item" onclick="openSlideViewer('${currentUser.id}')">
          <div class="slide-circle">${imgContent}</div>
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
  loadFeed(); updateNavProfile(); updateDrawerProfile()
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
  if (!el || !currentProfile) return
  if (currentProfile.avatar_url) {
    el.innerHTML = `<img src="${currentProfile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
  } else {
    el.textContent = getInitials(currentProfile.username)
  }
}

function updateDrawerProfile() {
  if (!currentProfile || !currentUser) return
  const el = document.getElementById('drawerAvatar')
  const un = document.getElementById('drawerUsername')
  const em = document.getElementById('drawerEmail')
  if (el) {
    if (currentProfile.avatar_url) {
      el.innerHTML = `<img src="${currentProfile.avatar_url}">`
    } else {
      el.textContent = getInitials(currentProfile.username)
    }
  }
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
  const avatarContent = post.avatar_url
    ? `<img src="${post.avatar_url}">`
    : getInitials(username)

  return `
  <div class="card" onclick="openPhotoDetail('${post.id}')">
    <div class="card-photo">
      <img src="${post.image_url}" alt="photo" loading="lazy">
      ${post.category ? `<div class="card-overlay-left">${post.category}</div>` : ''}
      <div class="card-overlay-right">📱 Phone</div>
    </div>
    <div class="card-footer">
      <div class="card-footer-user">
        <div class="card-footer-avatar">${avatarContent}</div>
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
        <div class="card-action" style="opacity:0.3;cursor:default">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>${post.likes || 0}</span>
        </div>`}
        <button class="card-action" onclick="openPhotoDetail('${post.id}')">💬</button>
      </div>
    </div>
  </div>`
}

// ================================
// UPLOAD WITH EXIF
// ================================

let selectedFile = null
let selectedExif = null

document.getElementById('fileInput').addEventListener('change', async (e) => {
  selectedFile = e.target.files[0]
  if (!selectedFile) return

  // Try to read EXIF
  selectedExif = await readExif(selectedFile)

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
    const caption  = document.getElementById('captionInput').value.trim()
    const category = document.getElementById('categorySelect').value
    const { error: insertError } = await supabase.from('posts').insert({
      image_url: urlData.publicUrl,
      caption,
      category: category || null,
      user_id: currentUser.id,
      username: currentProfile?.username || 'snapme user',
      avatar_url: currentProfile?.avatar_url || null,
      exif_data: selectedExif || null
    })
    if (insertError) throw insertError
    showToast('Photo shared! 🎉', 'success')
    selectedFile = null; selectedExif = null
    document.getElementById('fileInput').value = ''
    document.getElementById('captionInput').value = ''
    document.getElementById('categorySelect').value = ''
    document.getElementById('uploadZone').innerHTML = `<div class="upload-zone-text"><div class="upload-icon">📷</div><div class="upload-hint">Tap to choose a photo</div></div>`
    document.getElementById('uploadZone').onclick = () => document.getElementById('fileInput').click()
    showPage('feed', document.querySelector('.nav-tab'))
  } catch (err) { showToast('Upload failed: ' + err.message, 'error') }
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
  const filtered = currentCategoryFilter ? posts.filter(p => p.category === currentCategoryFilter) : posts
  if (!filtered.length) { grid.innerHTML = '<div class="empty"><p>No photos yet</p></div>'; return }
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

  // Avatar
  const avatarEl = document.getElementById('profileAvatarEl')
  if (currentProfile.avatar_url) {
    avatarEl.innerHTML = `<img src="${currentProfile.avatar_url}">`
  } else {
    avatarEl.innerHTML = `<span>${getInitials(currentProfile.username)}</span>`
  }

  // Cover
  const cover = document.getElementById('profileCover')
  if (currentProfile.cover_url) {
    cover.style.backgroundImage = `url(${currentProfile.cover_url})`
    cover.style.backgroundSize = 'cover'
    cover.style.backgroundPosition = 'center'
  }

  const { data } = await supabase.from('posts').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false })
  if (!data) return

  document.getElementById('profilePostCount').textContent = data.length
  document.getElementById('profileLikeCount').textContent = data.reduce((s, p) => s + (p.likes || 0), 0)

  // Get average critique score
  const { data: critiques } = await supabase
    .from('critiques')
    .select('composition, lighting, editing')
    .in('post_id', data.map(p => p.id))

  if (critiques && critiques.length) {
    const allScores = critiques.map(c => (c.composition + c.lighting + c.editing) / 3)
    const avg = allScores.reduce((s, v) => s + v, 0) / allScores.length
    document.getElementById('profileAvgScore').textContent = avg.toFixed(1)
  }

  // Set cover from latest photo if no cover set
  if (!currentProfile.cover_url && data.length > 0) {
    cover.style.backgroundImage = `url(${data[0].image_url})`
    cover.style.backgroundSize = 'cover'
    cover.style.backgroundPosition = 'center'
  }

  document.getElementById('profilePortfolio').innerHTML = data.length
    ? data.map(post => `<div class="profile-masonry-item" onclick="openPhotoDetail('${post.id}')"><img src="${post.image_url}" loading="lazy"></div>`).join('')
    : '<div style="text-align:center;padding:40px;color:var(--text-dim);font-size:0.82rem">No photos yet</div>'
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
