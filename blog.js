import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';
import { setDynamicHints } from './mascot.js';

export async function preloadBlogPosts() {
  try {
    const isGitHubPages = window.location.hostname.endsWith('github.io');
    let dynamicFiles = [];
    if (isGitHubPages) {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const username = window.location.hostname.split('.')[0];
        const repo = pathParts[0];
        try {
          // Recursive fetch helper for GitHub
          async function fetchGithubDir(dirPath) {
            const res = await fetch(`https://api.github.com/repos/${username}/${repo}/contents/${dirPath}`);
            if (!res.ok) return [];
            const items = await res.json();
            let files = [];
            for (const item of items) {
              if (item.type === 'dir') {
                 // Check if it looks like a month folder (YYYY-MM)
                 if (/^\d{4}-\d{2}$/.test(item.name)) {
                   const subFiles = await fetchGithubDir(item.path);
                   files.push(...subFiles);
                 }
              } else if (item.name.endsWith('.md')) {
                files.push(item.path); // Return full path relative to repo root
              }
            }
            return files;
          }
          dynamicFiles = (await fetchGithubDir('blog')).map(p => p.replace('blog/', ''));
        } catch (e) {}
      }
    }
    if (dynamicFiles.length === 0) {
      const fallbackResponse = await fetch('./blog/posts.json');
      if (fallbackResponse.ok) dynamicFiles = await fallbackResponse.json();
    }

    // Sort to get latest first. Dates are derived from path/filename: YYYY-MM/DD-name.md
    function getFileDate(file) {
      const folderMatch = file.match(/^(\d{4}-\d{2})\//);
      const filename = file.split('/').pop();
      const fileMatch = filename.match(/^(\d{2})-/);
      if (folderMatch && fileMatch) return `${folderMatch[1]}-${fileMatch[1]}`;
      // Fallback for flat YYYY-MM-DD-name.md
      const flatMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      return flatMatch ? flatMatch[1] : '1992-01-01';
    }
    
    dynamicFiles.sort((a, b) => getFileDate(b).localeCompare(getFileDate(a)));
    
    // Only process the latest 5 posts for mascot hints
    const filesToProcess = dynamicFiles.slice(0, 5);
    const postsWithDates = [];

    for (const file of filesToProcess) {
      const response = await fetch(`./blog/${file}`);
      if (response.ok) {
        const text = await response.text();
        const date = getFileDate(file);
        
        const italicRegex = /(^|[^*])\*([^*\s](?:[^*\n]*?[^*\s])?)\*(?![*a-zA-Z0-9])|(^|[^a-zA-Z0-9_])_([^_\s](?:[^_\n]*?[^\s_])?)_(?![a-zA-Z0-9_])/g;
        let match;
        const postItalics = [];
        while ((match = italicRegex.exec(text)) !== null) {
          const phrase = match[2] || match[4];
          if (phrase) postItalics.push(phrase.trim());
        }
        postsWithDates.push({ date, italics: postItalics });
      }
    }

    const sorted = postsWithDates.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestItalics = [];
    for (const p of sorted) {
      for (const it of p.italics) {
        if (latestItalics.length < 3) latestItalics.push(it);
        else break;
      }
      if (latestItalics.length >= 3) break;
    }
    if (latestItalics.length > 0) setDynamicHints(latestItalics);
  } catch (e) {
    console.error("Blog preloading failed", e);
  }
}

export async function openBlogWindow(title, openWindowFn) {
  let blogPosts = [];

  function getPostIdFromHref(href) {
    let decoded = decodeURIComponent(href);
    decoded = decoded.split('?')[0].split('#')[0].trim();
    
    // Try to find "blog/" and take everything after it
    const blogIndex = decoded.indexOf('blog/');
    if (blogIndex !== -1) {
      return decoded.substring(blogIndex + 5).replace(/^\/+/, ''); 
    }
    
    // If "blog/" is not found, let's clean up leading ./ or /
    return decoded.replace(/^\.?\/+/, '');
  }

  // Function to load dynamic posts from the blog/ folder
  async function fetchDynamicPostsList() {
    try {
      let dynamicFiles = [];
      const isGitHubPages = window.location.hostname.endsWith('github.io');
      if (isGitHubPages) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const username = window.location.hostname.split('.')[0];
          const repo = pathParts[0];
          try {
            async function fetchGithubDir(dirPath) {
              const res = await fetch(`https://api.github.com/repos/${username}/${repo}/contents/${dirPath}`);
              if (!res.ok) return [];
              const items = await res.json();
              let files = [];
              for (const item of items) {
                if (item.type === 'dir') {
                   if (/^\d{4}-\d{2}$/.test(item.name)) {
                     const subFiles = await fetchGithubDir(item.path);
                     files.push(...subFiles);
                   }
                } else if (item.name.endsWith('.md')) {
                  files.push(item.path);
                }
              }
              return files;
            }
            dynamicFiles = (await fetchGithubDir('blog')).map(p => p.replace('blog/', ''));
          } catch (ghErr) {}
        }
      }

      if (dynamicFiles.length === 0) {
        const fallbackResponse = await fetch('./blog/posts.json');
        if (fallbackResponse.ok) dynamicFiles = await fallbackResponse.json();
      }

      function getFileDate(file) {
        const folderMatch = file.match(/^(\d{4}-\d{2})\//);
        const filename = file.split('/').pop();
        const fileMatch = filename.match(/^(\d{2})-/);
        if (folderMatch && fileMatch) return `${folderMatch[1]}-${fileMatch[1]}`;
        const flatMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
        return flatMatch ? flatMatch[1] : '1992-01-01';
      }

      // Sort files by date descending
      dynamicFiles.sort((a, b) => getFileDate(b).localeCompare(getFileDate(a)));

      // Convert filenames to initial post metadata objects
      return dynamicFiles.map(file => {
        const date = getFileDate(file);
        // Clean title from filename if possible
        const titleFromFilename = file.split('/').pop().replace(/^\d{2}-/, '').replace('.md', '').replace(/-/g, ' ');
        
        return {
          id: file,
          title: titleFromFilename.charAt(0).toUpperCase() + titleFromFilename.slice(1),
          date: date,
          content: null, 
          thumbnail: 'icons/projects_icon.png', 
          isLoaded: false
        };
      });
    } catch (e) {
      console.error("Failed to fetch dynamic posts list", e);
      return [];
    }
  }

  // Helper to parse post content and metadata
  function processPostText(file, text) {
    const titleMatch = text.match(/^# (.*)/m);
    const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
    
    let cleanText = text;
    if (titleMatch) {
      cleanText = text.replace(/^# .*/m, '').trim();
    }

    const italicRegex = /(^|[^*])\*([^*\s](?:[^*\n]*?[^*\s])?)\*(?![*a-zA-Z0-9])|(^|[^a-zA-Z0-9_])_([^_\s](?:[^_\n]*?[^\s_])?)_(?![a-zA-Z0-9_])/g;
    let match;
    const postItalics = [];
    while ((match = italicRegex.exec(cleanText)) !== null) {
      const phrase = match[2] || match[4];
      if (phrase) postItalics.push(phrase.trim());
    }
    
    cleanText = cleanText.replace(italicRegex, (match, p1, p2, p3, p4) => p1 || p3 || '');
    const videoMatch = cleanText.match(/\[video: (.*)\]/);
    let youtubeId = null;
    let isShort = false;
    
    if (videoMatch) {
      const videoInput = videoMatch[1].trim();
      const shortsMatch = videoInput.match(/youtube\.com\/shorts\/([^/?#&]+)/);
      const watchMatch = videoInput.match(/[?&]v=([^/?#&]+)/);
      const embedMatch = videoInput.match(/youtube\.com\/embed\/([^/?#&]+)/);
      const shortUrlMatch = videoInput.match(/youtu\.be\/([^/?#&]+)/);

      if (shortsMatch) { youtubeId = shortsMatch[1]; isShort = true; }
      else if (watchMatch) youtubeId = watchMatch[1];
      else if (embedMatch) youtubeId = embedMatch[1];
      else if (shortUrlMatch) youtubeId = shortUrlMatch[1];
      else youtubeId = videoInput;
    }

    const iconMatch = cleanText.match(/\[icon: (.*)\]/);
    if (videoMatch) cleanText = cleanText.replace(/\[video: .*\]/g, '').trim();
    if (iconMatch) cleanText = cleanText.replace(/\[icon: .*\]/g, '').trim();

    let html = marked.parse(cleanText);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.querySelectorAll('p').forEach(p => {
      if (p.textContent.trim().startsWith('//')) p.classList.add('blog-comment-line');
    });

    const firstP = Array.from(tempDiv.querySelectorAll('p')).find(p => !p.classList.contains('blog-comment-line'));
    if (firstP) {
      const text = firstP.innerHTML.trim();
      if (text && !text.startsWith('<')) {
        const firstChar = text.charAt(0);
        if (/[A-Z0-9a-z]/i.test(firstChar)) {
          const isW = firstChar.toUpperCase() === 'W';
          const className = isW ? 'blog-drop-cap blog-drop-cap-w' : 'blog-drop-cap';
          firstP.innerHTML = `<span class="${className}">${firstChar}</span>` + text.substring(1);
        }
      }
    }
    tempDiv.querySelectorAll('a').forEach(a => {
      a.classList.add('blog-link-btn');
      
      const href = a.getAttribute('href') || '';
      const normalizedPath = getPostIdFromHref(href);
      const isInternal = blogPosts && blogPosts.some(p => p.id === normalizedPath);
      
      if (isInternal) {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      } else {
        if (!a.target) a.target = "_blank";
        if (!a.rel) a.rel = "noopener noreferrer";
      }
      
      const cursor = document.createElement('span');
      cursor.className = 'blinking-cursor';
      cursor.textContent = ' _';
      a.appendChild(cursor);
    });

    tempDiv.querySelectorAll('img').forEach(img => {
      const alt = (img.getAttribute('alt') || '').trim();
      const match = alt.match(/^img\s+(.+)$/i);
      if (match) {
        const params = match[1].trim();
        const tokens = params.split(/\s+/);
        if (tokens.length > 0) {
          let align = null;
          const lastToken = tokens[tokens.length - 1].toLowerCase();
          if (lastToken === 'r' || lastToken === 'right') {
            align = 'right';
            tokens.pop();
          } else if (lastToken === 'c' || lastToken === 'center') {
            align = 'center';
            tokens.pop();
          } else if (lastToken === 'l' || lastToken === 'left') {
            align = 'left';
            tokens.pop();
          }

          if (tokens.length === 1) {
            const sizeToken = tokens[0];
            if (sizeToken.endsWith('%')) {
              img.style.setProperty('width', sizeToken, 'important');
              img.style.setProperty('height', 'auto', 'important');
            } else {
              const pxVal = parseInt(sizeToken, 10);
              if (!isNaN(pxVal)) {
                img.style.setProperty('width', `${pxVal}px`, 'important');
                img.style.setProperty('height', 'auto', 'important');
              }
            }
          } else if (tokens.length >= 2) {
            const widthToken = tokens[0];
            const heightToken = tokens[1];
            
            let wVal = widthToken;
            if (/^\d+$/.test(widthToken)) {
              wVal = `${widthToken}px`;
            }
            let hVal = heightToken;
            if (/^\d+$/.test(heightToken)) {
              hVal = `${heightToken}px`;
            }

            img.style.setProperty('width', wVal, 'important');
            img.style.setProperty('height', hVal, 'important');
            img.style.setProperty('object-fit', 'contain', 'important');
          }

          if (align === 'center') {
            img.style.setProperty('margin-left', 'auto', 'important');
            img.style.setProperty('margin-right', 'auto', 'important');
            img.style.setProperty('display', 'block', 'important');
          } else if (align === 'left') {
            img.style.setProperty('margin-left', '0', 'important');
            img.style.setProperty('margin-right', 'auto', 'important');
            img.style.setProperty('display', 'block', 'important');
          } else if (align === 'right') {
            img.style.setProperty('margin-left', 'auto', 'important');
            img.style.setProperty('margin-right', '0', 'important');
            img.style.setProperty('display', 'block', 'important');
          }
        }
      }
    });
    
    const firstImgMatch = text.match(/!\[.*\]\((.*)\)/);
    const customIcon = iconMatch ? iconMatch[1] : (firstImgMatch ? firstImgMatch[1] : null);

    return {
      title,
      content: tempDiv.innerHTML,
      youtubeId,
      isShort,
      thumbnail: customIcon || (youtubeId ? 'icons/videos_icon.png' : 'icons/projects_icon.png'),
      italics: postItalics,
      isLoaded: true
    };
  }

  blogPosts = (await fetchDynamicPostsList()).sort((a, b) => new Date(b.date) - new Date(a.date));

  const blogContainer = document.createElement('div');
  blogContainer.className = 'blog-container';

  blogContainer.innerHTML = `
    <div class="blog-layout">
      <div class="blog-main">
        <div class="blog-masthead">
          <h1 class="blog-masthead-title">The Fri-ren News</h1>
          <div class="blog-masthead-meta">
            <span>ESTABLISHED 1992</span>
            <span>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>LATEST EDITION</span>
          </div>
        </div>
        <div class="blog-post-view">
          <header class="blog-post-header">
            <h1 class="blog-post-title">Select a post</h1>
            <div class="blog-post-date"></div>
          </header>
          <div class="blog-post-content">
            <p>Click on a post from the timeline to read more.</p>
          </div>
        </div>
      </div>
      <aside class="blog-sidebar">
        <div class="timeline-header">
          <span>TIMELINE</span>
          <div class="timeline-controls">
            <button id="zoom-out" title="Zoom Out">-</button>
            <button id="zoom-in" title="Zoom In">+</button>
          </div>
        </div>
        <div class="timeline-grid-container">
          <div id="timeline-label" class="timeline-label">Overall</div>
          <div class="timeline-grid" id="timeline-grid"></div>
        </div>
        <div class="post-list" id="post-list"></div>
      </aside>
    </div>
  `;

  const postTitleEl = blogContainer.querySelector('.blog-post-title');
  const postDateEl = blogContainer.querySelector('.blog-post-date');
  const postContentEl = blogContainer.querySelector('.blog-post-content');
  const postListEl = blogContainer.querySelector('#post-list');
  const timelineGridEl = blogContainer.querySelector('#timeline-grid');
  const timelineLabelEl = blogContainer.querySelector('#timeline-label');
  const zoomInBtn = blogContainer.querySelector('#zoom-in');
  const zoomOutBtn = blogContainer.querySelector('#zoom-out');

  let currentZoom = 'month'; // 'overall', 'year', 'month'
  let viewDate = new Date(); // The date we are currently looking at in the timeline

  // Render Post List
  function renderPostList() {
    postListEl.innerHTML = '';
    blogPosts.forEach(post => {
      const item = document.createElement('div');
      item.className = 'post-list-item';
      item.dataset.id = post.id;
      item.innerHTML = `
        <img src="${post.thumbnail}" class="post-thumb" alt="">
        <div class="post-info">
          <div class="post-item-title">${post.title}</div>
          <div class="post-item-date">${post.date}</div>
        </div>
      `;
      item.addEventListener('click', () => loadPost(post.id));
      postListEl.appendChild(item);
    });
  }

  // Render Timeline Grid (GitHub style with zoom levels)
  function renderTimelineGrid() {
    timelineGridEl.innerHTML = '';
    timelineGridEl.className = `timeline-grid zoom-${currentZoom}`;

    if (currentZoom === 'overall') {
      timelineLabelEl.textContent = 'Years';
      const startYear = 2024;
      const endYear = new Date().getFullYear();
      for (let y = startYear; y <= endYear; y++) {
        const square = document.createElement('div');
        square.className = 'timeline-square';
        const hasPosts = blogPosts.some(p => new Date(p.date).getFullYear() === y);
        if (hasPosts) square.classList.add('has-post');
        square.title = y;
        square.addEventListener('click', () => {
          viewDate.setFullYear(y);
          currentZoom = 'year';
          renderTimelineGrid();
        });
        timelineGridEl.appendChild(square);
      }
    } else if (currentZoom === 'year') {
      const year = viewDate.getFullYear();
      timelineLabelEl.textContent = year;
      for (let m = 0; m < 12; m++) {
        const square = document.createElement('div');
        square.className = 'timeline-square';
        const hasPosts = blogPosts.some(p => {
          const d = new Date(p.date);
          return d.getFullYear() === year && d.getMonth() === m;
        });
        if (hasPosts) square.classList.add('has-post');
        square.title = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(year, m));
        square.addEventListener('click', () => {
          viewDate.setMonth(m);
          currentZoom = 'month';
          renderTimelineGrid();
        });
        timelineGridEl.appendChild(square);
      }
    } else {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      timelineLabelEl.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate);
      
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const square = document.createElement('div');
        square.className = 'timeline-square';
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const post = blogPosts.find(p => p.date === dateStr);
        if (post) {
          square.classList.add('has-post');
          square.title = `${post.title} (${dateStr})`;
          square.addEventListener('click', () => loadPost(post.id));
        } else {
          square.title = dateStr;
        }
        timelineGridEl.appendChild(square);
      }
    }
  }

  zoomInBtn.addEventListener('click', () => {
    if (currentZoom === 'overall') currentZoom = 'year';
    else if (currentZoom === 'year') currentZoom = 'month';
    renderTimelineGrid();
  });

  zoomOutBtn.addEventListener('click', () => {
    if (currentZoom === 'month') currentZoom = 'year';
    else if (currentZoom === 'year') currentZoom = 'overall';
    renderTimelineGrid();
  });

  async function loadPost(postId) {
    const post = blogPosts.find(p => p.id === postId);
    if (!post) return;

    // Show loading state if post content isn't available yet
    if (!post.isLoaded) {
      postTitleEl.textContent = "Loading...";
      postDateEl.textContent = post.date;
      postContentEl.innerHTML = '<div class="blog-loading-spinner">Decrypting data...</div>';
      
      try {
        const response = await fetch(`./blog/${postId}`);
        if (response.ok) {
          const text = await response.text();
          const processed = processPostText(postId, text);
          Object.assign(post, processed);
          
          // Update the list and timeline metadata
          const listItem = postListEl.querySelector(`.post-list-item[data-id="${postId}"]`);
          if (listItem) {
            listItem.querySelector('.post-thumb').src = post.thumbnail;
            listItem.querySelector('.post-item-title').textContent = post.title;
          }
          // Update hint if it's one of the latest posts
          if (blogPosts.indexOf(post) < 5 && post.italics.length > 0) {
             // Gather all italics from first 5
             const hints = [];
             blogPosts.slice(0, 5).forEach(p => {
               if(p.italics) hints.push(...p.italics);
             });
             if(hints.length > 0) setDynamicHints(hints.slice(0, 3));
          }
        }
      } catch (e) {
        console.error("Failed to lazy load post", e);
        postContentEl.innerHTML = '<p>Error loading post content.</p>';
        return;
      }
    }

    postTitleEl.textContent = post.title;
    postDateEl.textContent = post.date;
    
    let contentHtml = post.content || "";
    if (post.youtubeId) {
      const isShort = post.isShort;
      const containerStyle = isShort 
        ? "margin: 20px auto; border: 2px solid var(--win95-dark); max-width: 315px; aspect-ratio: 9/16;"
        : "margin: 20px 0; border: 2px solid var(--win95-dark); aspect-ratio: 16/9;";
      
      contentHtml += `
        <div class="video-container" style="${containerStyle}">
          <iframe 
            width="100%" 
            height="100%" 
            src="https://www.youtube.com/embed/${post.youtubeId}" 
            title="YouTube video player" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerpolicy="strict-origin-when-cross-origin" 
            allowfullscreen>
          </iframe>
        </div>
      `;
    }
    postContentEl.innerHTML = contentHtml;

    // Attach click handlers for internal blog links
    postContentEl.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const normalizedPath = getPostIdFromHref(href);
      const matchedPost = blogPosts && blogPosts.find(p => p.id === normalizedPath);
      if (matchedPost) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          loadPost(matchedPost.id);
        });
      }
    });

    // Update active state in list
    blogContainer.querySelectorAll('.post-list-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === postId.toString());
    });

    // Scroll to top of content
    const blogMain = blogContainer.querySelector('.blog-main');
    if (blogMain) blogMain.scrollTop = 0;
  }

  // Load metadata for items in list sequentially to not block
  async function loadMetadata() {
    // Process top 10 first for immediate results, then the rest
    const queue = [...blogPosts];
    for (const post of queue) {
      if (!post.isLoaded) {
        // Fetch only enough to get title and icon - for simplicity we fetch the whole small .md
        // but we don't block the window opening
        try {
          const response = await fetch(`./blog/${post.id}`);
          if (response.ok) {
            const text = await response.text();
            const processed = processPostText(post.id, text);
            Object.assign(post, processed);
            
            // Update UI if user is still in the list
            const listItem = postListEl.querySelector(`.post-list-item[data-id="${post.id}"]`);
            if (listItem) {
              listItem.querySelector('.post-thumb').src = post.thumbnail;
              listItem.querySelector('.post-item-title').textContent = post.title;
            }
          }
        } catch (e) {}
        // Small delay to keep UI responsive
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }

  renderPostList();
  renderTimelineGrid();

  // Load latest post immediately
  if (blogPosts.length > 0) {
    loadPost(blogPosts[0].id);
  }

  // Start background metadata loading
  loadMetadata();

  return openWindowFn({
    title: title,
    content: blogContainer,
    width: 900,
    height: 600,
    x: 100,
    y: 50
  });
}