# THE SCROLL OF HIGHLIGHTING

Testing PrismJS highlighting for different languages.

## JavaScript

```javascript
const agent = "GRIFFIN";
function init() {
    console.log("System Online");
    return true;
}
```

## CSS

```css
.portal {
    background: #000;
    color: #d4af37;
    animation: pulse 2s infinite;
}
```

## Special Tags

[img 2] - This should be highlighted differently if the PrismJS is working with markdown/custom patterns.
Actually, the user said `[img 2]` should be highlighted by PrismJS. This usually means I need to add a custom grammar or ensure the markdown grammar handles it.

[img 1]
[vid 5]

```markdown
This is markdown code block.
[img 2]
```

## Checklists (The Vow)

- [x] Sharp rocks
- [ ] Flint
- [x] Berries

## Tables (The Ledger)

| Resource | Amount | Utility |
| :--- | :--- | :--- |
| Wood | 40 | Fire |
| Stone | 12 | Shelter |
| Gold | 1 | Vanity |

