export const FS = (() => {
  const makePath = (parent, name) => (parent === '/' ? `/${name}` : `${parent}/${name}`);

  const root = {
    type: 'folder',
    name: 'Desktop',
    path: '/',
    children: []
  };

  function folder(name, parent='/', opts={}) {
    const f = { type: 'folder', name, path: makePath(parent, name), children: [], desktopShortcut: !!opts.desktopShortcut, ...opts };
    addChild(parent, f);
    return f;
  }
  function image(name, url, parent, opts={}) {
    const e = { type: 'image', name, url, path: makePath(parent, name), icon: null, ...opts };
    addChild(parent, e); return e;
  }
  function video(name, url, parent, opts={}) {
    const e = { type: 'video', name, url, path: makePath(parent, name), icon: null, ...opts };
    addChild(parent, e); return e;
  }
  function html(name, url, parent, opts={}) {
    const e = { type: 'html', name, url, path: makePath(parent, name), icon: null, ...opts };
    addChild(parent, e); return e;
  }
  function wonderland(name, url, parent, opts={}) {
    const e = { type: 'wonderland', name, url, path: makePath(parent, name), icon: null, ...opts };
    addChild(parent, e); return e;
  }

  function addChild(parentPath, node) {
    const p = get(parentPath);
    if (!p || p.type !== 'folder') throw new Error('Invalid parent ' + parentPath);
    node.icon ||= null;
    p.children.push(node);
    // Sort children for consistent order, especially for image navigation
    p.children.sort((a, b) => a.name.localeCompare(b.name));
  }

  function get(path) {
    if (path === '/' || path === '') return root;
    const parts = path.split('/').filter(Boolean);
    let cur = root;
    for (const part of parts) {
      if (!cur || cur.type !== 'folder' || !cur.children) return null; // Check if cur is a valid folder
      cur = cur.children.find(ch => ch.name === part);
      if (!cur) return null;
    }
    return cur;
  }

  function findByName(name, node=root) {
    if (node.name === name) return node;
    if (!node.children) return null;
    for (const ch of node.children) {
      const found = findByName(name, ch);
      if (found) return found;
    }
    return null;
  }

  // Build demo structure
  const pics = folder('Pictures', '/', { desktopShortcut: true });
  const vids = folder('Videos', '/', { desktopShortcut: true });
  const projs = folder('Projects', '/', { desktopShortcut: true });
  const wonderlands = folder('Wonderlands', '/', { desktopShortcut: true });
  const blog = folder('Blog', '/', { desktopShortcut: true, type: 'blog' }); // New 'Blog' entry
  const aboutMe = folder('About Me', '/', { desktopShortcut: true, type: 'about' }); // New 'About Me' entry
  // Path for aiResearchApp is already relative, but can be simplified for consistency if in root
  const aiResearchApp = html('AI_research', 'ai_research/new_index.html', '/', { desktopShortcut: true, icon: 'icons/ai_research_icon.png' });

  // Pictures
  // Corrected paths to be relative to the root index.html file
  image('Concept Art Collage', 'Content/Images/image-board-export-1756292941378.png', '/Pictures', { description: 'A collection of diverse concept art pieces.' });
  image('Red Eyes Solo Game Dreams', 'Content/Images/Red_Eyes_SoloGame_Dreams.png', '/Pictures', { description: 'Scenes from a dark, atmospheric Dreams game.' });

  // Videos
  video('GBR Elements', 'Content/Videos/GBR_Elements_trailer.mp4', '/Videos', { icon: 'Content/Videos/GBR_Cover.jpg', description: 'A game made inside of Miliastra Wonderland.' });
  video('GBR Release', 'Content/Videos/GBR_trailer.mp4', '/Videos', { icon: 'Content/Videos/GBR_1_cover.png', description: 'A game made inside of Miliastra Wonderland.' });
  video('Package turn', 'Content/Videos/Package_turn_1.mp4', '/Videos', { description: 'A short animation showcasing a package turnaround.' });
  video('Unsubscribed Trailer', 'Content/Videos/Unsubscribed Trailer.mp4', '/Videos', { icon: 'Content/Videos/Unsubscribe_Trailer_thumbnail.jpg', description: 'Trailer for a sci-fi game project.' }); // Added thumbnail

  // Projects
  html('Image Board', 'Content/Projects/Image_Board/index.html', '/Projects', { icon: 'Content/Projects/Image_Board/Image_Board_thumbnail.jpg', description: 'An interactive image organization and editing tool.' });
  html('Endless Canvas', 'Content/Projects/Endless_canvas/index.html', '/Projects', { icon: 'Content/Projects/Endless_canvas/Endless_canvas_thumbnail.jpg', description: 'A versatile digital drawing application with infinite canvas.' });
  html('RTS Game', 'Content/Projects/RTS_Game/index.html', '/Projects', { icon: 'Content/Projects/RTS_Game/RTS_thumbnail.jpg', description: 'A real-time strategy game with AI opponents.' });
  html('Atelier', 'Content/Projects/Atelier/index.html', '/Projects', { icon: 'Content/Projects/Atelier/Atelier_thumbnail.jpg', description: 'A digital art studio with custom brushes and image management.' });
  html('Game Assets Creator', 'Content/Projects/Game_Assets_Creator/index.html', '/Projects', { icon: 'Content/Projects/Atelier/Atelier_thumbnail.jpg', description: 'A way to quickly create game assets.' });  
  html('Pixel Mesh Animator', 'Content/Projects/Pixel_Mesh_Animator/index.html', '/Projects', { icon: 'Content/Projects/Atelier/Atelier_thumbnail.jpg', description: 'A way to animate pixel art, works great with GAC.' });  
  html('Rubber Animation', 'Content/Projects/Rubber_Animation/index.html', '/Projects', { icon: 'Content/Projects/Atelier/Atelier_thumbnail.jpg', description: 'A way to animate fluid pictures.' });  
  html('Video Analysis', 'Content/Projects/Video_Analysis/index.html', '/Projects', { icon: 'Content/Projects/Atelier/Atelier_thumbnail.jpg', description: 'A way to analyze a video.' });  
  html('Fireplace', 'Content/Projects/Fireplace/index.html', '/Projects', { icon: 'Content/Projects/Fireplace/Fireplace_Thumbnail.jpg', description: 'A way to remember an hour.' });  

  // Wonderlands
  wonderland('Guns Brooms Rockets', 'wonderlands/miliastra_prime/index.html', '/Wonderlands', { 
    description: 'The core of the Miliastra project.',
    updatesUrl: 'wonderlands/miliastra_prime/updates.md',
    icon: 'wonderlands/miliastra_prime/GBR_Cover.jpg'
  });


  // Assign custom icons - corrected paths to be relative to the root index.html
  pics.icon = 'icons/pictures_icon.png';
  vids.icon = 'icons/videos_icon.png';
  projs.icon = 'icons/projects_icon.png';
  wonderlands.icon = 'icons/chest_icon.png';
  blog.icon = 'icons/projects_icon.png';
  aboutMe.icon = 'icons/about_me_icon.png';
  aiResearchApp.icon = 'icons/ai_research_icon.png'; // Kept as png as it's a specific app icon

  return { root, get, findByName };
})();
