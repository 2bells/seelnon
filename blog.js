import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';
import { 
  db, 
  auth, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  signInWithPopup, 
  googleProvider,
  handleFirestoreError,
  OperationType
} from './firebase/firebase.js';

export async function openBlogWindow(title, openWindowFn) {
  // Static posts (hardcoded as fallback or legacy)
  const staticPosts = [
    {
      id: 1,
      title: "Welcome to my Blog!",
      date: "2026-04-01",
      content: `
        <p>Welcome to the first entry of my Windows 95 themed blog! I've always been fascinated by the aesthetic of early computing, and I wanted to create a space that reflects that nostalgia while showcasing my modern projects.</p>
        <p>This blog is built with vanilla JavaScript, HTML, and CSS, just like the rest of this site. No heavy frameworks, just pure 90s vibes.</p>
        <img src="https://picsum.photos/seed/win95/600/400" alt="Win95 Aesthetic" referrerPolicy="no-referrer" style="width:100%; border:1px solid #000; margin: 20px 0;">
        <p>Stay tuned for more updates on my creative journey, technical deep dives, and maybe some random thoughts along the way.</p>
      `,
      type: "text",
      thumbnail: "icons/projects_icon.png"
    },
    {
      id: 2,
      title: "Deep Dive into AI Research",
      date: "2026-04-05",
      content: `
        <p>I've been spending a lot of time lately exploring node-based visualizations for AI research. The goal is to make complex neural network architectures more intuitive to understand and manipulate.</p>
        <p>Here's a sneak peek at the interface I've been developing:</p>
        <img src="https://picsum.photos/seed/ai-research/600/400" alt="AI Research Interface" referrerPolicy="no-referrer" style="width:100%; border:1px solid #000; margin: 20px 0;">
        <p>The interface uses a custom ASCII water simulation background to give it that "hacker terminal" feel. It's been a fun challenge to balance performance with visual flair.</p>
        <div style="background: #000; color: #0f0; padding: 10px; font-family: monospace; border: 1px solid #0f0; margin: 10px 0;">
          > Initializing neural nodes...<br>
          > Mapping synaptic connections...<br>
          > Visualization stable.
        </div>
      `,
      type: "image",
      thumbnail: "icons/ai_research_icon.png"
    },
    {
      id: 3,
      title: "Video Production Workflow",
      date: "2026-04-08",
      content: `
        <p>Video editing is a huge part of my creative process. I primarily use After Effects for my VFX work, but I'm always looking for ways to optimize my workflow.</p>
        <p>One technique I've been perfecting is "logic-based editing," where I use scripts to automate repetitive tasks and allow for more abstract creative decisions.</p>
        <p>This short clip shows a package turnaround animation I created using these techniques. It's all about finding that perfect balance between technical precision and artistic expression.</p>
      `,
      type: "video",
      youtubeId: "dQw4w9WgXcQ", // Example YouTube ID
      thumbnail: "icons/videos_icon.png"
    },
    {
      id: 4,
      title: "Exploring the Retro Aesthetic",
      date: "2026-03-20",
      content: `
        <p>Why Windows 95? There's something about the simplicity and the "clunky" charm of that era that I find incredibly inspiring. It was a time when the digital world felt like a new frontier, full of possibilities.</p>
        <p>Recreating this aesthetic in modern web technologies is a fun exercise in constraints. It forces you to think about how to convey information clearly without the bells and whistles of modern UI design.</p>
        <img src="https://picsum.photos/seed/retro/600/400" alt="Retro Computing" referrerPolicy="no-referrer" style="width:100%; border:1px solid #000; margin: 20px 0;">
      `,
      type: "text",
      thumbnail: "icons/projects_icon.png"
    },
    {
      id: 5,
      title: "The Future of My Portfolio",
      date: "2026-02-15",
      content: `
        <p>This portfolio is an ever-evolving project. I'm constantly adding new features, projects, and experiments. My goal is to create a space that is not just a showcase of my work, but an experience in itself.</p>
        <p>Thanks for stopping by and exploring my digital world!</p>
      `,
      type: "text",
      thumbnail: "icons/about_me_icon.png"
    }
  ];

  // Function to load dynamic posts from the blog/ folder
  async function fetchDynamicPosts() {
    try {
      // In a real production environment on GitHub Pages, we can't "list" a directory via JS.
      // We usually use a manifest.json or a naming convention.
      // For now, let's look for a specific post we just created.
      const dynamicFiles = [
        '2026-04-10_new_horizons.md'
      ];
      
      const posts = [];
      for (const file of dynamicFiles) {
        const response = await fetch(`./blog/${file}`);
        if (response.ok) {
          const text = await response.text();
          // Extract title from first H1 if possible
          const titleMatch = text.match(/^# (.*)/m);
          const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
          
          // Strip the first H1 from the content to avoid duplication
          let cleanText = text;
          if (titleMatch) {
            cleanText = text.replace(/^# .*/m, '').trim();
          }
          
          const html = marked.parse(cleanText);
          
          // Extract date from filename (YYYY-MM-DD)
          const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

          // Extract youtubeId if present in a comment or specific line like [video: ID]
          const videoMatch = text.match(/\[video: (.*)\]/);
          const youtubeId = videoMatch ? videoMatch[1] : null;

          posts.push({
            id: file,
            title: title,
            date: date,
            content: html,
            youtubeId: youtubeId,
            type: youtubeId ? 'video' : 'text',
            thumbnail: youtubeId ? 'icons/videos_icon.png' : 'icons/projects_icon.png'
          });
        }
      }
      return posts;
    } catch (e) {
      console.error("Failed to fetch dynamic posts", e);
      return [];
    }
  }

  const dynamicPosts = await fetchDynamicPosts();
  const blogPosts = [...staticPosts, ...dynamicPosts].sort((a, b) => new Date(b.date) - new Date(a.date));

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
          <div class="comments-section">
            <h2 class="comments-header">Comments</h2>
            <div id="comment-form-container"></div>
            <div id="comments-list-container" class="comments-list">
              <div class="no-comments">Select a post to view comments.</div>
            </div>
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

  function loadPost(postId) {
    const post = blogPosts.find(p => p.id === postId);
    if (!post) return;

    postTitleEl.textContent = post.title;
    postDateEl.textContent = post.date;
    
    let contentHtml = post.content;
    if (post.youtubeId) {
      contentHtml += `
        <div class="video-container" style="margin: 20px 0; border: 2px solid var(--win95-dark);">
          <iframe 
            width="100%" 
            height="450" 
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

    // Update active state in list
    blogContainer.querySelectorAll('.post-list-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === postId.toString());
    });

    // Cusdis Integration - Fix for flashing/disappearing
    const cusdisEl = blogContainer.querySelector('#cusdis_thread');
    if (cusdisEl) {
      // Clear previous content to avoid flashing old comments
      cusdisEl.innerHTML = ''; 
      
      cusdisEl.dataset.pageId = post.id.toString();
      cusdisEl.dataset.pageTitle = post.title;
      cusdisEl.dataset.pageUrl = window.location.origin + window.location.pathname + '#blog-' + post.id;
      
      // Re-render Cusdis
      if (window.CUSDIS) {
        window.CUSDIS.renderTo(cusdisEl);
      }
    }

    // Scroll to top of content
    postContentEl.scrollTop = 0;

    // Load Firebase Comments
    initComments(post.id);
  }

  let unsubscribeComments = null;

  function initComments(postId) {
    const formContainer = blogContainer.querySelector('#comment-form-container');
    const listContainer = blogContainer.querySelector('#comments-list-container');

    // Unsubscribe from previous post's comments
    if (unsubscribeComments) unsubscribeComments();

    // Render Form
    renderCommentForm(postId, formContainer);

    // Listen for comments
    const q = query(
      collection(db, 'comments'),
      where('postId', '==', postId.toString()),
      orderBy('createdAt', 'desc')
    );

    unsubscribeComments = onSnapshot(q, (snapshot) => {
      listContainer.innerHTML = '';
      if (snapshot.empty) {
        listContainer.innerHTML = '<div class="no-comments">No comments yet. Be the first to speak!</div>';
        return;
      }

      snapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.createdAt?.toDate() ? data.createdAt.toDate().toLocaleString() : 'Just now';
        
        const commentItem = document.createElement('div');
        commentItem.className = 'comment-item';
        commentItem.innerHTML = `
          <div class="comment-meta">
            <span class="comment-author">${data.authorName}</span>
            <span class="comment-date">${date}</span>
          </div>
          <div class="comment-body">${data.content}</div>
        `;
        listContainer.appendChild(commentItem);
      });
    }, (error) => {
      // If we get a permission error, it might be because the collection doesn't exist yet or rules
      // handleFirestoreError(error, OperationType.LIST, 'comments');
      console.warn("Comment loading error:", error);
      listContainer.innerHTML = '<div class="no-comments">Comments currently unavailable.</div>';
    });
  }

  function renderCommentForm(postId, container) {
    const user = auth.currentUser;

    if (!user) {
      container.innerHTML = `
        <div class="comment-form">
          <div class="comment-form-title">Post a Comment</div>
          <div class="comment-form-actions">
            <span class="comment-auth-notice">You must be logged in to comment.</span>
            <button class="comment-btn" id="login-btn">Login with Google</button>
          </div>
        </div>
      `;
      container.querySelector('#login-btn').addEventListener('click', async () => {
        try {
          await signInWithPopup(auth, googleProvider);
          renderCommentForm(postId, container);
        } catch (error) {
          console.error("Login failed", error);
        }
      });
      return;
    }

    container.innerHTML = `
      <div class="comment-form">
        <div class="comment-form-title">Post a Comment as ${user.displayName}</div>
        <textarea class="comment-input" placeholder="Write your thoughts..."></textarea>
        <div class="comment-form-actions">
          <button class="comment-btn" id="logout-btn">Logout</button>
          <button class="comment-btn" id="submit-comment">Submit</button>
        </div>
      </div>
    `;

    container.querySelector('#logout-btn').addEventListener('click', async () => {
      await auth.signOut();
      renderCommentForm(postId, container);
    });

    container.querySelector('#submit-comment').addEventListener('click', async () => {
      const input = container.querySelector('.comment-input');
      const content = input.value.trim();
      if (!content) return;

      const submitBtn = container.querySelector('#submit-comment');
      submitBtn.disabled = true;

      try {
        await addDoc(collection(db, 'comments'), {
          postId: postId.toString(),
          authorName: user.displayName || 'Anonymous',
          content: content,
          createdAt: serverTimestamp(),
          uid: user.uid
        });
        input.value = '';
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'comments');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  renderPostList();
  renderTimelineGrid();

  // Load latest post by default
  if (blogPosts.length > 0) {
    loadPost(blogPosts[0].id);
  }

  openWindowFn({
    title: title,
    content: blogContainer,
    width: 900,
    height: 600,
    x: 100,
    y: 50
  });
}
