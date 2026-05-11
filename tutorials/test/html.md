# HTML in Markdown Test

This is a test of using raw HTML and CSS within a Markdown file.

<div style="background: #3d342b; border: 2px dashed #d4af37; padding: 20px; color: #fff; text-align: center; margin: 20px 0;">
  <h2 style="color: #ffca28; border: none; margin: 0;">BRUTALIST HTML BOX</h2>
  <p style="margin: 10px 0; font-family: monospace;">This box is rendered using inline HTML styles.</p>
  <button style="background: #d4af37; border: none; padding: 10px 20px; font-weight: bold; cursor: pointer; color: #1c1814;">
    CLICKING DOES NOTHING
  </button>
</div>

### CSS Injection Test
<style>
  .custom-highlight {
    background: #5c4d3c;
    color: #ffca28;
    padding: 2px 5px;
    border: 1px solid #d4af37;
  }
</style>

If the styling above works, <span class="custom-highlight">this text should be highlighted</span> via a style tag.

### Image with Inline Style
<img src="../../icons/talent_icon_pixel.png" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid white; filter: invert(1);" />


<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>My Stylish Blog</title>

<style>
    body {
        background: linear-gradient(to right, #667eea, #764ba2);
    }

    header {
        animation: fadeIn 2s ease-in-out;
    }


    footer {
        text-align: center;
        padding: 15px;
        background: rgba(0,0,0,0.5);
    }

    /* Animations */
    @keyframes fadeIn {
        from {opacity: 0;}
        to {opacity: 1;}
    }

    @keyframes slideUp {
        from {
            transform: translateY(50px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
</style>
</head>

<body>

<header>
</header>
<footer>
❤️
</footer>

</body>
</html>
