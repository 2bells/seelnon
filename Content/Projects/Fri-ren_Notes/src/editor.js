/**
 * Caveman Notes - Editor Module
 * Handles Markdown rendering and Image injection
 */
export class Editor {
  constructor(vault) {
    this.vault = vault;
  }

  async processMarkdown(content) {
    if (!content || content.trim() === '') {
      return `<div style="opacity: 0.5; font-style: italic; padding: 20px; text-align: center; line-height: 1.8;">
        press 'edit' to start editing your markdown file<br>
        <div style="margin-top: 20px; font-size: 0.9em; opacity: 0.7; max-width: 400px; margin-left: auto; margin-right: auto; text-align: left; border-top: 1px dashed var(--text-primary); padding-top: 15px;">
           • folder field is a <b>path</b> (e.g. <i>work/notes/2026</i>)<br>
           • connect notes with <b>[[note title]]</b><br>
           • use <b>![video]</b> for mp4/webm/YouTube<br>
           • resize: <b>![image 500 300](link)</b> or <b>![[img 300 300]]</b><br>
           • check <b>canvas</b> mode for visual thinking
        </div>
      </div>`;
    }
    let md = content;
    
    // Caveman normalization: convert common bullet points (•) to markdown asterisks (*)
    // so marked can parse them as proper list items for the task list logic.
    md = md.replace(/^[ \t]*•/gm, (match) => match.replace('•', '*'));

    // Replace Obsidian-style [[img-id]] with placeholders for lazy loading, adding support for sizing: ![[id width height]]
    md = md.replace(/!\[\[(.*?)(?:\s+(\d+))?(?:\s+(\d+))?\]\]/g, (match, rawId, w, h) => {
      const id = rawId.trim();
      const width = w ? `${w}px` : 'auto';
      const height = h ? `${h}px` : 'auto';
      const style = `style="max-width:100%; width: ${width}; height: ${height}; margin: 10px 5px; vertical-align: top;"`;
      return `<span><img data-img-id="${id}" class="lazy-vault-img" loading="lazy" ${style} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"></span>`;
    });

    // Video & YouTube support: ![video](link) or ![video 500 300](link)
    md = md.replace(/!\[video(?:\s+(\d+))?(?:\s+(\d+))?\]\((.*?)\)/g, (match, w, h, url) => {
      const u = url.trim();
      const width = w ? `${w}px` : 'auto';
      const height = h ? `${h}px` : 'auto';
      const style = `max-width:100%; width: ${width}; height: ${height}; margin: 10px 5px; border: 1px solid var(--text-primary); vertical-align: top;`;
      
      // YouTube Detector
      const ytMatch = u.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        return `<span><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" 
          style="${style} aspect-ratio: 16/9;" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen></iframe></span>`;
      }

      const type = u.endsWith('.webm') ? 'video/webm' : 'video/mp4';
      return `<span><video controls loop muted playsinline crossorigin="anonymous" referrerpolicy="no-referrer" style="${style}">
  <source src="${u}" type="${type}">
  Your browser does not support the video tag.
</video></span>`;
    });

    // Image resizing support: ![alt width height](url)
    md = md.replace(/!\[(.*?)(?:\s+(\d+))?(?:\s+(\d+))?\]\((.*?)\)/g, (match, alt, w, h, url) => {
      // Skip if it was already processed as video placeholder or something else
      if (alt.startsWith('video')) return match; 
      
      const width = w ? `${w}px` : 'auto';
      const height = h ? `${h}px` : 'auto';
      const u = url.trim();
      const a = alt ? alt.trim() : '';

      return `<span><img src="${u}" alt="${a}" style="max-width:100%; width: ${width}; height: ${height}; margin: 10px 5px; vertical-align: top;" loading="eager" decoding="sync" referrerpolicy="no-referrer"></span>`;
    });
    
    // Ensure marked is configured for GFM
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: true
      });
      
      const renderer = new marked.Renderer();
      
      renderer.code = (arg1, arg2) => {
        let code = arg1;
        let language = arg2;
        
        // Handle new Marked API where first arg is an object { text, lang, escaped }
        if (typeof arg1 === 'object' && arg1 !== null) {
          code = arg1.text;
          language = arg1.lang;
        }
        
        const lang = language || 'text';
        if (typeof Prism !== 'undefined') {
          try {
            const prismLang = Prism.languages[lang];
            let highlighted;
            
            if (prismLang) {
              highlighted = Prism.highlight(code, prismLang, lang);
            } else {
              // Fallback to plain text with basic escaping
              highlighted = code
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            }
            
            // Manual Diff Highlighting Logic for leading + and -
            const lines = highlighted.split('\n');
            const processedLines = lines.map(line => {
              const plainLine = line.replace(/<[^>]+>/g, '').trim();
              if (plainLine.startsWith('+')) {
                return `<span class="line-diff-added">${line}</span>`;
              } else if (plainLine.startsWith('-')) {
                return `<span class="line-diff-removed">${line}</span>`;
              }
              return line;
            });
            
            highlighted = processedLines.join('\n');
            return `<pre class="language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>`;
          } catch (e) {
            console.warn("Prism highlight error:", e);
          }
        }
        return `<pre class="language-text"><code>${code}</code></pre>`;
      };

      marked.setOptions({ renderer });

      let html = marked.parse(md);
      
      // Brutalist Hack: marked makes checkboxes 'disabled' by default. 
      // We strip that so they are interactive and we can catch the click.
      html = html.replace(/<input disabled="" type="checkbox">/g, '<input type="checkbox">');
      html = html.replace(/<input checked="" disabled="" type="checkbox">/g, '<input checked="" type="checkbox">');
      
      // Image stability hack: force eager loading and sync decoding to minimize flicker during re-renders
      html = html.replace(/<img /g, '<img loading="eager" decoding="sync" referrerpolicy="no-referrer" ');
      
      // Video stability hack: also add no-referrer to videos
      html = html.replace(/<video /g, '<video referrerpolicy="no-referrer" ');

      // Wikilink Detection [[Note Title]]
      html = html.replace(/\[\[(.*?)\]\]/g, (match, target) => {
        return `<a class="wikilink" data-target="${target.trim()}">${target.trim()}</a>`;
      });

      return html;
    }
    
    return md;
  }

  generateImageId() {
    return `img-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}
