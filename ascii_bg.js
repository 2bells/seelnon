
export function initAsciiBg(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'ascii-bg-canvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let width, height, columns;
  const fontSize = 14;
  const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$+-*/=%\"\'#&_(),.;:?!\\|{}<>[]^~';
  let drops = [];

  function resize() {
    width = container.offsetWidth;
    height = container.offsetHeight;
    canvas.width = width;
    canvas.height = height;
    columns = Math.floor(width / fontSize);
    drops = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }
  }

  window.addEventListener('resize', resize);
  resize();

  function draw() {
    // Semi-transparent black to create trail effect
    // In dark mode we want it darker, in light mode maybe lighter?
    // Let's stick to a subtle dark effect that works in both but is more prominent in dark mode
    const isDarkMode = document.body.classList.contains('dark-mode');
    ctx.fillStyle = isDarkMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = isDarkMode ? '#0f0' : '#888'; // Matrix green in dark mode, grey in light
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < drops.length; i++) {
      const text = characters.charAt(Math.floor(Math.random() * characters.length));
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);

      if (drops[i] * fontSize > height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  let animationId;
  function animate() {
    draw();
    animationId = requestAnimationFrame(animate);
  }
  animate();

  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resize);
    canvas.remove();
  };
}
