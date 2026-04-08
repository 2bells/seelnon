
export function initBlogAscii(container) {
  if (!container) return;

  const canvas = document.createElement('pre');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.margin = '0';
  canvas.style.padding = '0';
  canvas.style.overflow = 'hidden';
  canvas.style.pointerEvents = 'none';
  canvas.style.color = 'rgba(0, 255, 0, 0.15)'; // Faint green
  canvas.style.fontSize = '10px';
  canvas.style.lineHeight = '10px';
  canvas.style.zIndex = '0';
  canvas.style.opacity = '0.4';
  container.appendChild(canvas);

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
  let width, height, columns;
  let drops = [];

  function resize() {
    const rect = container.getBoundingClientRect();
    width = Math.floor(rect.width / 8);
    height = Math.floor(rect.height / 10);
    columns = width;
    
    // Initialize drops if not already or if width changed
    if (drops.length !== columns) {
      drops = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100; // Start off-screen
      }
    }
  }

  function draw() {
    let output = "";
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < columns; x++) {
        // If drop is at this Y position, show a char
        if (Math.floor(drops[x]) === y) {
          output += chars[Math.floor(Math.random() * chars.length)];
        } else if (Math.floor(drops[x]) > y && Math.floor(drops[x]) - 10 < y) {
          // Trail
          if (Math.random() > 0.3) {
             output += chars[Math.floor(Math.random() * chars.length)];
          } else {
             output += " ";
          }
        } else {
          output += " ";
        }
      }
      output += "\n";
    }
    canvas.textContent = output;

    for (let i = 0; i < drops.length; i++) {
      drops[i] += 0.5; // Speed
      if (drops[i] > height && Math.random() > 0.975) {
        drops[i] = 0;
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);

  let animationId;
  function animate() {
    draw();
    animationId = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 50); // Limit FPS for performance
  }

  animate();

  return () => {
    window.removeEventListener('resize', resize);
    clearTimeout(animationId);
  };
}
