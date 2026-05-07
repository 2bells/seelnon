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
      return `<div style="opacity: 0.5; font-style: italic; padding: 20px; text-align: center; line-height: 1.6;">
        press 'editor mode' to start editing your markdown file<br>
        <small style="display: block; margin-top: 10px; opacity: 0.7;">
          tip: typing a path like 'adventures/forest/logs' in the folder field<br>
          will create those folders automatically!
        </small>
      </div>`;
    }
    let md = content;
    
    // Caveman normalization: convert common bullet points (•) to markdown asterisks (*)
    // so marked can parse them as proper list items for the task list logic.
    md = md.replace(/^[ \t]*•/gm, (match) => match.replace('•', '*'));

    // Replace Obsidian-style [[img-id]] with placeholders for lazy loading
    md = md.replace(/!\[\[(.*?)\]\]/g, (match, id) => {
      return `<img data-img-id="${id.trim()}" class="lazy-vault-img" loading="lazy" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E">`;
    });

    // Video support: ![video](link)
    md = md.replace(/!\[video\]\((.*?)\)/g, (match, url) => {
      const type = url.trim().endsWith('.webm') ? 'video/webm' : 'video/mp4';
      return `<video controls loop muted style="max-width:100%; margin: 10px 0; border: 1px solid var(--text-primary);">
  <source src="${url.trim()}" type="${type}">
  Your browser does not support the video tag.
</video>`;
    });
    
    // Ensure marked is configured for GFM
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: true
      });
      let html = marked.parse(md);
      
      // Brutalist Hack: marked makes checkboxes 'disabled' by default. 
      // We strip that so they are interactive and we can catch the click.
      html = html.replace(/<input disabled="" type="checkbox">/g, '<input type="checkbox">');
      html = html.replace(/<input checked="" disabled="" type="checkbox">/g, '<input checked="" type="checkbox">');
      
      // Image stability hack: force eager loading and sync decoding to minimize flicker during re-renders
      html = html.replace(/<img /g, '<img loading="eager" decoding="sync" referrerpolicy="no-referrer" ');

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
