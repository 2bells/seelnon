/**
 * Caveman Notes - Editor Module
 * Handles Markdown rendering and Image injection
 */
export class Editor {
  constructor(vault) {
    this.vault = vault;
  }

  async processMarkdown(content) {
    let md = content;
    
    // Caveman normalization: convert common bullet points (•) to markdown asterisks (*)
    // so marked can parse them as proper list items for the task list logic.
    md = md.replace(/^[ \t]*•/gm, (match) => match.replace('•', '*'));

    // Replace Obsidian-style [[img-id]] with absolute data URLs from IndexedDB
    const imgMatches = md.match(/!\[\[(.*?)\]\]/g);
    if (imgMatches) {
      for (const match of imgMatches) {
        const id = match.replace('![[', '').replace(']]', '');
        const dataUrl = await this.vault.getImage(id);
        if (dataUrl) {
          md = md.replace(match, `![image](${dataUrl})`);
        }
      }
    }
    
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
      html = html.replace(/<img /g, '<img loading="eager" decoding="sync" ');

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
