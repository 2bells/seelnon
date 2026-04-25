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
  const gilArchive = html('GIL Archive', 'archive.html', '/', { desktopShortcut: true, icon: 'icons/talent_icon_pixel.png' }); // Pointer to archive.html
  const aboutMe = folder('About Me', '/', { desktopShortcut: true, type: 'about' }); // New 'About Me' entry
  // Path for aiResearchApp is already relative, but can be simplified for consistency if in root
  const aiResearchApp = html('AI_research', 'ai_research/new_index.html', '/', { desktopShortcut: true, icon: 'icons/ai_research_icon.png' });

  // Pictures
  // Corrected paths to be relative to the root index.html file
  image('Concept Art Collage 2016-2020', 'Content/Images/image-board-export-1756292941378.png', '/Pictures', { description: 'A collection of diverse concept art pieces.' });
  image('Red Eyes Solo Game Dreams - 2020', 'Content/Images/Red_Eyes_SoloGame_Dreams.png', '/Pictures', { description: 'Scenes from a dark, atmospheric Dreams game.' });
  image('Deathless Traveler - 2020', 'Content/Images/deathless_traveler.jpg', '/Pictures', { description: 'If Frieren was depressing. Something I was concepting in 2020 with MSFS' });
  image('Character Designs - 2016', 'Content/Images/2016_december.jpg', '/Pictures', { description: 'Had a 14 day grind, designing different characters. December 2016' });
  image('Ex-Mansion Designs - 2024', 'Content/Images/2024-april-ex-mansion.jpg', '/Pictures', { description: 'Godot game dev, did some designs for myself. April 2024' });
  image('Ex-Mansion Sketches - 2024', 'Content/Images/2024_sketches.jpg', '/Pictures', { description: 'Ex-Mansion. Lore, redesigns, exploration' });



  // Videos
  video('GBR Elements', 'Content/Videos/GBR_Elements_trailer.mp4', '/Videos', { icon: 'Content/Videos/GBR_Cover.jpg', description: 'A game made inside of Miliastra Wonderland.' });
  video('GBR Release', 'Content/Videos/GBR_trailer.mp4', '/Videos', { icon: 'Content/Videos/GBR_1_cover.png', description: 'A game made inside of Miliastra Wonderland.' });
  video('HR Deep Learning 2017', 'Content/Videos/shapes_cycle.mp4', '/Videos', { icon: 'Content/Videos/HR_yandex.jpg', description: 'Some of the stuff from back in the day, looked clean.' });
  video('Unsubscribed Trailer', 'Content/Videos/Unsubscribed Trailer.mp4', '/Videos', { icon: 'Content/Videos/Unsubscribe_Trailer_thumbnail.jpg', description: 'Trailer for a sci-fi game project.' }); // Added thumbnail

  // Projects
  html('Image Board', 'Content/Projects/Image_Board/index.html', '/Projects', { icon: 'Content/Projects/Image_Board/Image_Board_thumbnail.jpg', description: 'An interactive image organization and editing tool.' });
  html('Endless Canvas', 'Content/Projects/Endless_canvas/index.html', '/Projects', { icon: 'Content/Projects/Endless_canvas/Endless_canvas_thumbnail.jpg', description: 'A versatile digital drawing application with infinite canvas.' });
  html('RTS Game', 'Content/Projects/RTS_Game/index.html', '/Projects', { icon: 'Content/Projects/RTS_Game/RTS_thumbnail.jpg', description: 'A real-time strategy game with AI opponents.' });
  html('Atelier', 'Content/Projects/Atelier/index.html', '/Projects', { icon: 'Content/Projects/Atelier/Atelier_thumbnail.jpg', description: 'A digital art studio with custom brushes and image management.' });
  html('Game Assets Creator', 'Content/Projects/Game_Assets_Creator/index.html', '/Projects', { icon: 'Content/Projects/Game_Assets_Creator/gac_thumbnail.jpg', description: 'A way to quickly create game assets.' });  
  html('Pixel Mesh Animator', 'Content/Projects/Pixel_Mesh_Animator/index.html', '/Projects', { icon: 'Content/Projects/Pixel_Mesh_Animator/pixel_mesh_thumbnail.jpg', description: 'A way to animate pixel art, works great with GAC.' });  
  html('Rubber Animation', 'Content/Projects/Rubber_Animation/index.html', '/Projects', { icon: 'Content/Projects/Rubber_Animation/soft_puppet_thumbnail.jpg', description: 'A way to animate fluid pictures.' });  
  html('Video Analysis', 'Content/Projects/Video_Analysis/index.html', '/Projects', { icon: 'Content/Projects/Video_Analysis/video_analysis_thumbnail.jpg', description: 'A way to analyze a video.' });    
  html('Fireplace', 'Content/Projects/Fireplace/index.html', '/Projects', { icon: 'Content/Projects/Fireplace/Fireplace_Thumbnail.jpg', description: 'A way to remember an hour.' });  
  html('ASCII animations', 'Content/Projects/ASCII/index.html', '/Projects', { icon: 'Content/Projects/ASCII/ASCII_Thumbnail.jpg', description: 'A way to vibe out an hour.' });  
  html('Panellum Viewer', 'Content/Projects/Panellum/index.html', '/Projects', { icon: 'Content/Projects/Panellum/panellum_thumbnail.jpg', description: 'A way to view images.' });  
  html('CONCEPT_BRUTE', 'Content/Projects/Concept_Brute/index.html', '/Projects', { icon: 'Content/Projects/Concept_Brute/img/concept_brute_thmb.jpg', description: 'A way to paint images.' });  
  


  // Wonderlands
  wonderland('Guns Brooms Rockets', 'wonderlands/gbr/TAG.txt', '/Wonderlands', { 
    description: 'shoot + broom + explode = fun.',
    updatesUrl: 'wonderlands/gbr/updates.md',
    icon: 'wonderlands/gbr/GBR_Cover.jpg'
  });
  wonderland('Országház', 'wonderlands/orszaghaz/TAG.txt', '/Wonderlands', { 
    description: 'Building.',
    updatesUrl: 'wonderlands/orszaghaz/updates.md',
    icon: "https://avatars.mds.yandex.net/i?id=0b2cf640211c6f941219cafacc01dd41_sr-5147303-images-thumbs&n=13"
  });  
    wonderland('League of GUN', 'wonderlands/league_of_gun/TAG.txt', '/Wonderlands', { 
    description: 'League, but FPS.',
    updatesUrl: 'wonderlands/league_of_gun/updates.md',
    icon: "wonderlands/league_of_gun/cover.jpg"
  });  


  // Assign custom icons - corrected paths to be relative to the root index.html
  pics.icon = 'icons/pictures_icon.png';
  vids.icon = 'icons/videos_icon.png';
  projs.icon = 'icons/projects_icon.png';
  wonderlands.icon = 'icons/chest_icon.png';
  blog.icon = 'icons/projects_icon.png';
  gilArchive.icon = 'icons/talent_icon_pixel.png';
  aboutMe.icon = 'icons/about_me_icon.png';
  aiResearchApp.icon = 'icons/ai_research_icon.png'; // Kept as png as it's a specific app icon

  return { root, get, findByName };
})();