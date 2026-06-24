export const actionRadicals = [
  // CATEGORY 4: POSITIONAL ALIGNMENTS, RATIOS & SCALE ANCHORS
  {
    no: 561,
    char: "顶",
    pinyin: "dǐng",
    strokes: 8,
    meaning: "top",
    category: "UI_POSITION",
    etymology: "Depicts a person with an emphasized head looking upward, meaning the top, summit, ceiling, or vertical minimum alignment.",
    funFact: "Alignment values mapping to the Y-axis minimum (top-0, items-start). Found in 'Header/Top' (页顶/顶部).",
    philosophy: "The ceiling bounds vertical rise. Aligning elements to the top anchors them at the origin of standard block reading paths.",
    strokePaths: [
      [[15, 20], [45, 20]],
      [[30, 20], [30, 80]],
      [[15, 50], [45, 50]],
      [[50, 20], [80, 20]],
      [[65, 20], [65, 50]],
      [[50, 50], [80, 50], [80, 80]],
      [[55, 65], [75, 65]],
      [[40, 80], [25, 95]]
    ]
  },
  {
    no: 562,
    char: "底",
    pinyin: "dǐ",
    strokes: 8,
    meaning: "bottom",
    category: "UI_POSITION",
    etymology: "A shelter built down over a flat base, representing the floor, base, foundation, or vertical maximum alignment.",
    funFact: "Alignment values mapping to the Y-axis maximum (bottom-0, items-end). Found in 'Footer' (页底/底部).",
    philosophy: "The base supports the weight of the document flow. Bottom alignments anchor stable visual footers or permanent status rails.",
    strokePaths: [
      [[50, 10], [50, 20]],
      [[25, 25], [75, 25]],
      [[30, 25], [30, 85]],
      [[45, 38], [70, 38]],
      [[40, 55], [75, 55]],
      [[58, 38], [58, 85], [45, 75]],
      [[42, 68], [30, 85]],
      [[65, 68], [80, 85]]
    ]
  },
  {
    no: 563,
    char: "中",
    pinyin: "zhōng",
    strokes: 4,
    meaning: "center",
    category: "UI_POSITION",
    etymology: "A flagpole with streaming streamers placed perfectly in the center of an assembly field, meaning center or middle alignment.",
    funFact: "Absolute geometric midpoint on any layout axis (justify-center, items-center). Found in 'Center/Middle' (中心/居中).",
    philosophy: "The center represents perfect balance. Placing elements at the geometric midpoint distributes negative space equally in all directions.",
    strokePaths: [
      [[25, 30], [25, 65]],
      [[25, 30], [75, 30], [75, 65]],
      [[25, 65], [75, 65]],
      [[50, 10], [50, 90]]
    ]
  },
  {
    no: 564,
    char: "左",
    pinyin: "zuǒ",
    strokes: 5,
    meaning: "left",
    category: "UI_POSITION",
    etymology: "A left hand holding a measuring ruler to build works, meaning left direction or horizontal start coordinates.",
    funFact: "Horizontal tracking mapped to X-axis minimum (left-0, text-left). Found in 'Left align' (左对齐/左边).",
    philosophy: "Left is the origin of western text. Placing assets at the horizontal start establishes a reliable left boundary for readers.",
    strokePaths: [
      [[15, 25], [85, 25]],
      [[55, 10], [25, 85]],
      [[35, 45], [75, 45]],
      [[55, 45], [55, 75]],
      [[25, 75], [85, 75]]
    ]
  },
  {
    no: 565,
    char: "右",
    pinyin: "yòu",
    strokes: 5,
    meaning: "right",
    category: "UI_POSITION",
    etymology: "A right hand coming down to feed the mouth, meaning the right side, horizontal end coordinates, or secondary status panels.",
    funFact: "Horizontal tracking mapped to X-axis maximum (right-0, text-right). Found in 'Right align' (右对齐/右边).",
    philosophy: "The right margin is the destination. Secondary details or metadata float along the right sidebar, keeping the main reading flow uncluttered.",
    strokePaths: [
      [[15, 25], [85, 25]],
      [[55, 10], [25, 85]],
      [[40, 45], [40, 80]],
      [[40, 45], [75, 45], [75, 80]],
      [[40, 80], [75, 80]]
    ]
  },
  {
    no: 566,
    char: "前",
    pinyin: "qián",
    strokes: 9,
    meaning: "front",
    category: "UI_POSITION",
    etymology: "A foot moving forward over a boat, meaning in front of, forward direction, foreground, or higher z-index stacks.",
    funFact: "Foreground assets or higher stack weights (z-index). Found in 'Foreground/Front' (前景/前进).",
    philosophy: "The foreground advances. Higher z-index stack weights project elements forward, casting a shadow over lower background tiers.",
    strokePaths: [
      [[35, 15], [30, 25]],
      [[65, 15], [70, 25]],
      [[15, 35], [85, 35]],
      [[25, 48], [45, 48]],
      [[25, 48], [25, 85]],
      [[25, 85], [45, 85]],
      [[55, 48], [80, 48]],
      [[60, 48], [60, 85]],
      [[75, 48], [75, 85], [65, 75]]
    ]
  },
  {
    no: 567,
    char: "后",
    pinyin: "hòu",
    strokes: 6,
    meaning: "back",
    category: "UI_POSITION",
    etymology: "A ruler standing behind a screening shield, denoting behind, back direction, background, or lower z-index layers.",
    funFact: "Background graphics or baseline layout layers. Found in 'Background/Go Back' (背景/后退).",
    philosophy: "The background recedes. Behind active focus dialogs, the baseline layer sits dark and muted, providing quiet supporting contrast.",
    strokePaths: [
      [[55, 15], [25, 35]],
      [[25, 35], [80, 35]],
      [[30, 35], [30, 85]],
      [[40, 52], [40, 82]],
      [[40, 52], [75, 52], [75, 82]],
      [[40, 82], [75, 82]]
    ]
  },
  {
    no: 568,
    char: "内",
    pinyin: "nèi",
    strokes: 4,
    meaning: "inside / internal",
    category: "UI_POSITION",
    etymology: "A person entering through a doorway frame, representing internal areas, interior margins, or element padding.",
    funFact: "Element padding dimensions or interior layouts (padding, p-4). Found in 'Internal/Inside' (内边距/内部).",
    philosophy: "Padding lives inside the border. It protects the content, establishing a cushion of negative space that prevents text from colliding with borders.",
    strokePaths: [
      [[25, 15], [25, 85]],
      [[25, 15], [75, 15], [75, 85], [65, 75]],
      [[50, 25], [35, 50]],
      [[50, 25], [65, 50]]
    ]
  },
  {
    no: 569,
    char: "外",
    pinyin: "wài",
    strokes: 5,
    meaning: "outside / external",
    category: "UI_POSITION",
    etymology: "An evening fortune-telling custom performed outside the home walls, signifying external margins, gaps, or layouts.",
    funFact: "Element margin metrics or external layouts (margin, m-4). Found in 'External/Outside' (外边距/外部).",
    philosophy: "Margins push other boxes away. External margin space prevents bounding box collisions, keeping distinct nodes neatly separated.",
    strokePaths: [
      [[15, 45], [45, 15]],
      [[20, 45], [45, 45], [30, 75]],
      [[15, 70], [35, 60]],
      [[60, 20], [60, 80]],
      [[60, 45], [85, 40]]
    ]
  },
  {
    no: 570,
    char: "距",
    pinyin: "jù",
    strokes: 12,
    meaning: "distance / space",
    category: "UI_POSITION",
    etymology: "A foot measuring strides against a carpenter's square ruler, meaning distance, gaps, margins, or padding measurements.",
    funFact: "Spacing arrays (Explicit padding/margin definitions). Found in 'Distance/Gap' (间距/距离).",
    philosophy: "Proximity governs meaning. Things closer together are perceived as related, while wide gaps signal a change of semantic category.",
    strokePaths: [
      [[20, 20], [45, 20]],
      [[30, 20], [30, 45]],
      [[20, 45], [45, 45]],
      [[20, 45], [20, 65]],
      [[20, 65], [45, 55]],
      [[55, 30], [85, 30]],
      [[70, 30], [70, 85]],
      [[50, 85], [90, 85]]
    ]
  },
  {
    no: 571,
    char: "比",
    pinyin: "bǐ",
    strokes: 4,
    meaning: "ratio / compare",
    category: "UI_POSITION",
    etymology: "Two people standing side-by-side to compare heights, meaning layout proportions, aspect ratios, or scale benchmarks.",
    funFact: "Layout aspect ratios or proportional scaling (aspect-square, ratio-16-9). Found in 'Proportion/Ratio' (比例).",
    philosophy: "Everything is relational. Scaling is not absolute; we define standard multipliers (rem, em) to keep typography relative and fluid.",
    strokePaths: [
      [[40, 25], [20, 50]],
      [[20, 50], [45, 50], [35, 75]],
      [[75, 20], [75, 45]],
      [[55, 45], [90, 45], [85, 75]]
    ]
  },
  {
    no: 572,
    char: "缩",
    pinyin: "suō",
    strokes: 14,
    meaning: "shrink / scale down",
    category: "UI_POSITION",
    etymology: "Winding loose silk threads together tightly to pack them, denoting constricting, shrinking, zooming out, or scaling down.",
    funFact: "Matrix downsizing parameters or asset zoom-out states. Found in 'Shrink/Zoom out' (缩小/缩放).",
    philosophy: "Shrinking yields screen territory. Zooming out compacts the rendering field, letting the eye absorb dense global macro layouts.",
    strokePaths: [
      [[25, 20], [15, 40]],
      [[15, 40], [30, 40], [20, 65]],
      [[20, 65], [30, 75]],
      [[45, 25], [75, 25]],
      [[45, 42], [75, 42], [70, 60]],
      [[45, 60], [75, 60]],
      [[50, 75], [50, 95]],
      [[70, 75], [70, 95]]
    ]
  },
  {
    no: 573,
    char: "扩",
    pinyin: "kuò",
    strokes: 5,
    meaning: "expand / scale up",
    category: "UI_POSITION",
    etymology: "A hand throwing broad lines wide, meaning to broaden, expand, maximize, or launch fullscreen modes.",
    funFact: "Container text expansions or fullscreen toggles. Found in 'Expand/Zoom in' (扩大/放大/扩充).",
    philosophy: "Expansion reveals hidden detail. Zooming in lets users scrutinize micro layouts, enlarging tiny interactive assets.",
    strokePaths: [
      [[10, 45], [35, 45]],
      [[22, 20], [22, 80], [12, 70]],
      [[10, 75], [30, 60]],
      [[45, 30], [80, 30]],
      [[65, 30], [50, 85]]
    ]
  },
  // [574 was removed - duplicates Kangxi #574]
  {
    no: 575,
    char: "齐",
    pinyin: "qí",
    strokes: 6,
    meaning: "align / level",
    category: "UI_POSITION",
    etymology: "Three ears of wheat growing perfectly level and uniform at the same height, denoting alignments, uniform limits, or arrays.",
    funFact: "Flexbox/Grid alignment styles (align-items-center). Found in 'Align/Uniform' (对齐/整齐).",
    philosophy: "Alignment is the visual glue of composition. When margins line up perfectly, the layout feels structured, unified, and quiet.",
    strokePaths: [
      [[50, 10], [50, 20]],
      [[15, 35], [85, 35]],
      [[30, 35], [15, 85]],
      [[50, 35], [35, 85]],
      [[60, 35], [75, 85]],
      [[50, 55], [85, 80]]
    ]
  },
  {
    no: 576,
    char: "隙",
    pinyin: "xì",
    strokes: 12,
    meaning: "gap / space",
    category: "UI_POSITION",
    etymology: "An earthen wall with small cracks that let light slip through, signifying layout grid gaps, spacers, or margins.",
    funFact: "Exact pixel layout definitions between items (gap-4). Found in 'Gap/Space' (缝隙/间隙).",
    philosophy: "Gaps shape relation. Uniform gaps let grids breathe, establishing mathematical consistency across dynamic screen sizes.",
    strokePaths: [
      [[25, 15], [25, 85], [15, 75]],
      [[25, 15], [45, 25], [25, 45]],
      [[50, 20], [70, 20]],
      [[50, 35], [50, 55]],
      [[50, 35], [80, 35], [80, 55]],
      [[50, 55], [80, 55]],
      [[65, 55], [65, 85]],
      [[45, 85], [85, 85]]
    ]
  },
  {
    no: 577,
    char: "高",
    pinyin: "gāo",
    strokes: 10,
    meaning: "height",
    category: "UI_POSITION",
    etymology: "A tall architectural watchtower with an upper deck and wide supporting gates, denoting vertical height values.",
    funFact: "Vertical height values (h-screen, max-h-96). Found in 'Height' (高度/高大).",
    philosophy: "Height maps depth of scroll. Fixed heights contain content, forcing layout scrolls when inner markup overflows bounds.",
    strokePaths: [
      [[50, 10], [50, 20]],
      [[25, 25], [75, 25]],
      [[35, 38], [65, 38]],
      [[35, 38], [35, 52], [65, 52]],
      [[35, 52], [65, 52]],
      [[20, 65], [20, 90]],
      [[20, 65], [80, 65], [80, 90]],
      [[35, 75], [35, 85]],
      [[35, 75], [65, 75], [65, 85]],
      [[20, 90], [80, 90]]
    ]
  },
  {
    no: 578,
    char: "宽",
    pinyin: "kuān",
    strokes: 10,
    meaning: "width",
    category: "UI_POSITION",
    etymology: "A spacious house container with broad grass flooring underneath, signifying horizontal width values or viewport spans.",
    funFact: "Horizontal width values (w-full, max-w-7xl). Found in 'Width' (宽度/宽大).",
    philosophy: "Width dictates visual presence. Capping container widths keeps text lines readable, preventing them from extending too long.",
    strokePaths: [
      [[50, 10], [50, 20]],
      [[25, 25], [25, 35]],
      [[25, 25], [75, 25], [75, 35]],
      [[35, 42], [65, 42]],
      [[45, 38], [45, 52]],
      [[55, 38], [55, 52]],
      [[30, 60], [30, 75]],
      [[30, 60], [70, 60], [70, 75]],
      [[30, 75], [70, 75]],
      [[45, 75], [85, 95], [80, 85]]
    ]
  },
  {
    no: 579,
    char: "深",
    pinyin: "shēn",
    strokes: 11,
    meaning: "depth",
    category: "UI_POSITION",
    etymology: "Water flowing through a deep underground cavern shelter, representing Z-axis coordinates or perspective weight layers.",
    funFact: "Z-axis coordinate depth or perspective weights (perspective-1000). Found in 'Depth/Deep' (深度/深色).",
    philosophy: "Depth is an illusion on flat glass. By configuring perspective weights and shadow filters, we evoke the feeling of realistic depth layers.",
    strokePaths: [
      [[20, 20], [25, 25]],
      [[15, 45], [20, 50]],
      [[15, 80], [30, 70]],
      [[45, 25], [75, 25]],
      [[45, 42], [75, 42], [70, 60]],
      [[45, 60], [75, 60]],
      [[50, 75], [50, 95]],
      [[70, 75], [70, 95]]
    ]
  },
// CATEGORY 5: TYPOGRAPHY, CANVAS MARKS & VISUAL INDICATORS
  {
    no: 581,
    char: "字",
    pinyin: "zì",
    strokes: 6,
    meaning: "character",
    category: "UI_VISUAL",
    etymology: "A child born inside a peaceful household container, denoting characters, letters, text nodes, or font engines.",
    funFact: "Text blocks requiring font family engine rendering. Found in 'Character/Font' (文字/字体).",
    philosophy: "A character represents codified thought. Words are the ultimate layer of visual meaning on the interface, rendered through custom font engines.",
    strokePaths: [
      [[50, 10], [50, 20]],
      [[25, 25], [25, 35]],
      [[25, 25], [75, 25], [75, 35]],
      [[35, 50], [65, 50], [55, 60]],
      [[50, 38], [50, 85], [40, 75]],
      [[15, 68], [85, 68]]
    ]
  },
  {
    no: 582,
    char: "图",
    pinyin: "tú",
    strokes: 8,
    meaning: "graph / vector",
    category: "UI_VISUAL",
    etymology: "A designated territory enclosing structured drawings, meaning diagrams, graphics, canvas layers, or vector icons.",
    funFact: "Graphical layout assets, shapes, or canvas prints. Found in 'Image/Icon' (图片/图标).",
    philosophy: "Images translate concepts into raw shapes. A vector path scale-stretches infinitely, preserved by math coordinates without quality loss.",
    strokePaths: [
      [[20, 15], [20, 85]],
      [[20, 15], [80, 15], [80, 85], [72, 78]],
      [[40, 35], [60, 35]],
      [[50, 35], [50, 65]],
      [[40, 50], [60, 50]],
      [[35, 70], [45, 60]],
      [[55, 60], [65, 70]],
      [[20, 85], [80, 85]]
    ]
  },
  {
    no: 583,
    char: "号",
    pinyin: "hào",
    strokes: 5,
    meaning: "mark / number",
    category: "UI_VISUAL",
    etymology: "A mouth chanting or blowing a horn to mark a command, meaning identifiers, tokens, sizes, or index marks.",
    funFact: "Index identifiers, size tokens, or glyph markers. Found in 'Symbol/Mark/Number' (符号/账号/号码).",
    philosophy: "Numbers organize data. Index tokens map lists to sequential items, making datasets easily queryable for lookup loops.",
    strokePaths: [
      [[35, 15], [35, 35]],
      [[35, 15], [65, 15], [65, 35]],
      [[35, 35], [65, 35]],
      [[20, 55], [80, 55]],
      [[50, 55], [50, 85], [35, 75]]
    ]
  },
  {
    no: 584,
    char: "体",
    pinyin: "tǐ",
    strokes: 7,
    meaning: "font style / body",
    category: "UI_VISUAL",
    etymology: "Combines 'person' and 'book root', meaning the visual style of written letters, weights, or rendering font files.",
    funFact: "Font weight variants or rendering font files. Found in 'Font Family/Style' (字体/繁体/简体).",
    philosophy: "Style dresses structural text. Changing the font weight or spacing adjusts the visual tone of the page, making it elegant or technical.",
    strokePaths: [
      [[30, 15], [15, 85]],
      [[22, 40], [22, 85]],
      [[45, 45], [85, 45]],
      [[65, 20], [65, 80]],
      [[65, 45], [45, 75]],
      [[65, 45], [85, 75]],
      [[52, 65], [78, 65]]
    ]
  },
  {
    no: 585,
    char: "符",
    pinyin: "fú",
    strokes: 11,
    meaning: "token / code",
    category: "UI_VISUAL",
    etymology: "A matching bamboo tally slip marked with credentials, meaning symbols, credentials, key-tokens, or code files.",
    funFact: "Structural string text symbols or icon fonts. Found in 'Symbol/Token' (符号/令牌).",
    philosophy: "Tokens validate state. A secure string token identifies permissions, granting local users access to private data streams.",
    strokePaths: [
      [[20, 15], [35, 25]],
      [[15, 25], [40, 25]],
      [[60, 15], [75, 25]],
      [[55, 25], [80, 25]],
      [[45, 45], [80, 45]],
      [[40, 65], [85, 65]],
      [[60, 38], [60, 85], [50, 75]],
      [[35, 50], [35, 85]]
    ]
  },
  {
    no: 586,
    char: "印",
    pinyin: "yìn",
    strokes: 5,
    meaning: "stamp / print",
    category: "UI_VISUAL",
    etymology: "A hand pressing a master seal or stamp down onto wax, meaning visual marks, watermarks, stamps, or render buffers.",
    funFact: "Active watermarks or rendering state burns. Found in 'Print/Stamp' (打印/印象/水印).",
    philosophy: "Printing burns state onto canvases. It leaves an permanent visual record, transforming abstract buffer arrays into static pixels.",
    strokePaths: [
      [[20, 25], [45, 25]],
      [[32, 10], [32, 60]],
      [[20, 55], [50, 55]],
      [[55, 20], [80, 20], [75, 45]],
      [[75, 45], [75, 90], [65, 80]]
    ]
  },
  {
    no: 587,
    char: "墨",
    pinyin: "mò",
    strokes: 15,
    meaning: "ink / dark",
    category: "UI_VISUAL",
    etymology: "Soot black carbon placed over an earth base, denoting solid colors, rich dark inks, fill codes, or shadow mappings.",
    funFact: "Solid color filling codes or shadow maps. Found in 'Ink/Dark' (墨水/黑煞).",
    philosophy: "Ink saturates empty space. It is the core material of typography, giving heavy, high-contrast presence to text nodes against blank canvases.",
    strokePaths: [
      [[30, 15], [30, 45]],
      [[30, 15], [70, 15], [70, 45]],
      [[30, 30], [70, 30]],
      [[30, 45], [70, 45]],
      [[15, 60], [85, 60]],
      [[45, 75], [70, 75]],
      [[58, 60], [58, 90]],
      [[30, 90], [85, 90]]
    ]
  },
  {
    no: 588,
    char: "彩",
    pinyin: "cǎi",
    strokes: 11,
    meaning: "color / hue",
    category: "UI_VISUAL",
    etymology: "A claw plucking bright, multi-colored hairs or feathers from a bird, representing palettes, color states, or visual hues.",
    funFact: "Hue tracking arrays, palette systems, or styling loops. Found in 'Color' (彩色/色彩/彩虹).",
    philosophy: "Color changes layout mood. Color variables map raw numbers to rich hue channels, establishing semantic accents like success green.",
    strokePaths: [
      [[50, 15], [30, 30]],
      [[30, 30], [70, 30]],
      [[45, 42], [75, 42]],
      [[60, 32], [60, 75]],
      [[60, 42], [45, 65]],
      [[35, 85], [45, 75]],
      [[50, 85], [60, 75]],
      [[75, 85], [85, 75]]
    ]
  },
  {
    no: 589,
    char: "度",
    pinyin: "dù",
    strokes: 9,
    meaning: "degree / opacity",
    category: "UI_VISUAL",
    etymology: "A hand measuring spans under a shelter, signifying opacity deltas, degree angles, scale multipliers, or rates.",
    funFact: "Alpha channel variations or linear rotation values (opacity-80, rotate-45). Found in 'Degree/Opacity' (透明度/角度/速度).",
    philosophy: "Measurements make layout systematic. Tuning alpha values fades elements smoothly, whispering depth without hiding underlying assets.",
    strokePaths: [
      [[50, 10], [50, 20]],
      [[25, 25], [75, 25]],
      [[30, 25], [30, 85]],
      [[45, 40], [70, 40]],
      [[58, 30], [58, 65]],
      [[40, 58], [75, 58]],
      [[40, 58], [30, 85]],
      [[55, 68], [80, 85]],
      [[55, 58], [55, 85]]
    ]
  },
  {
    no: 590,
    char: "影",
    pinyin: "yǐng",
    strokes: 15,
    meaning: "shadow",
    category: "UI_VISUAL",
    etymology: "The sun shining over a capital tower, casting long shadows behind it, meaning visual shadows, glows, or depth styling.",
    funFact: "CSS drop shadows or layout box glow parameters (shadow-lg). Found in 'Shadow/Image' (阴影/影响/电影).",
    philosophy: "A shadow frames depth. By casting soft dark gradients underneath floating cards, we elevate active states above static baselines.",
    strokePaths: [
      [[30, 15], [30, 35]],
      [[30, 15], [60, 15], [60, 35]],
      [[30, 35], [60, 35]],
      [[25, 50], [75, 50]],
      [[50, 38], [50, 75]],
      [[35, 85], [45, 75]],
      [[50, 85], [60, 75]],
      [[75, 85], [85, 75]]
    ]
  },
  {
    no: 591,
    char: "亮",
    pinyin: "liàng",
    strokes: 9,
    meaning: "bright / light",
    category: "UI_VISUAL",
    etymology: "A master looking upward from a high tower window, signifying screen brightness, active accents, or light color states.",
    funFact: "Screen brightness parameters or highlight accents. Found in 'Bright/Light' (亮度/高亮).",
    philosophy: "Light drives attention. Accent highlights capture cursor hover events, glowing up to signal that an element is ready for clicks.",
    strokePaths: [
      [[50, 10], [50, 20]],
      [[25, 25], [75, 25]],
      [[35, 38], [35, 52]],
      [[35, 38], [65, 38], [65, 52]],
      [[35, 52], [65, 52]],
      [[25, 65], [75, 65], [70, 75]],
      [[30, 65], [30, 90]],
      [[45, 75], [30, 90]],
      [[55, 75], [75, 90]]
    ]
  },
  {
    no: 592,
    char: "暗",
    pinyin: "àn",
    strokes: 13,
    meaning: "dark / dim",
    category: "UI_VISUAL",
    etymology: "The sun covered by thick, chanting sounds, meaning darkness, dim states, black-themed viewports, or low active flags.",
    funFact: "Dark-mode interface themes or shadow states. Found in 'Dark-mode/Dim' (暗色/暗黑模式).",
    philosophy: "Darkness is restful to the eye. Dimming inactive zones reduces visual competition, elevating active alerts to sharp visibility.",
    strokePaths: [
      [[15, 25], [15, 65]],
      [[15, 25], [45, 25], [45, 65]],
      [[15, 45], [45, 45]],
      [[15, 65], [45, 65]],
      [[55, 15], [85, 15]],
      [[55, 30], [55, 55]],
      [[55, 30], [85, 30], [85, 55]],
      [[55, 55], [85, 55]]
    ]
  },
  {
    no: 593,
    char: "纹",
    pinyin: "wén",
    strokes: 7,
    meaning: "texture / grain",
    category: "UI_VISUAL",
    etymology: "Silk thread patterns woven into garments, signifying vectors, textures, pattern tiles, or border patterns.",
    funFact: "Pattern arrays or vector background tiles. Found in 'Texture/Pattern' (纹理/条纹).",
    philosophy: "A subtle background texture breaks the cold sterility of pure solid colors. Subtle noise grains give tactile comfort to digital screens.",
    strokePaths: [
      [[25, 20], [15, 40]],
      [[15, 40], [30, 40], [20, 65]],
      [[20, 65], [30, 75]],
      [[55, 25], [55, 35]],
      [[40, 45], [85, 45]],
      [[65, 45], [40, 85]],
      [[45, 55], [80, 85]]
    ]
  },
  {
    no: 594,
    char: "留",
    pinyin: "liú",
    strokes: 10,
    meaning: "leave / keep",
    category: "UI_VISUAL",
    etymology: "Tilling soil and keeping boundary fields intact, denoting white-spacing, negative space, offsets, or preserved storage states.",
    funFact: "White space definitions (Negative layout areas). Found in 'White-space' (留白/保留).",
    philosophy: "Design is built of what we leave blank. Giving generous negative space lets assets breathe, directing attention effortlessly.",
    strokePaths: [
      [[35, 15], [25, 30]],
      [[55, 15], [70, 30]],
      [[25, 35], [75, 35]],
      [[25, 50], [75, 50]],
      [[35, 50], [35, 80]],
      [[35, 50], [65, 50], [65, 80]],
      [[50, 50], [50, 80]],
      [[35, 65], [65, 65]],
      [[35, 80], [65, 80]],
      [[20, 85], [85, 85]]
    ]
  },
  {
    no: 595,
    char: "显",
    pinyin: "xiǎn",
    strokes: 9,
    meaning: "show / display",
    category: "UI_VISUAL",
    etymology: "The sun illuminating silk thread filaments, making them starkly visible; denotes showing, displaying, or rendering assets.",
    funFact: "Active visibility properties (display: block / visible). Found in 'Display/Show' (显示/显然).",
    philosophy: "To display is to materialize state. If a condition matches true, the lister parses the node, bringing it into visible layout geometry.",
    strokePaths: [
      [[30, 15], [30, 45]],
      [[30, 15], [70, 15], [70, 45]],
      [[30, 30], [70, 30]],
      [[30, 45], [70, 45]],
      [[15, 60], [85, 60]],
      [[35, 60], [20, 85]],
      [[65, 60], [80, 85]],
      [[40, 75], [60, 75]],
      [[50, 60], [50, 90]]
    ]
  },
  {
    no: 596,
    char: "隐",
    pinyin: "yǐn",
    strokes: 11,
    meaning: "hide / mask",
    category: "UI_VISUAL",
    etymology: "A high earthen hill screening or hiding small, nesting hands below, meaning hidden status, opacity zeros, or display none properties.",
    funFact: "Inactive visibility properties (display: none / hidden). Found in 'Hidden' (隐藏/隐私).",
    philosophy: "Hiding keeps the layout clean. By wrapping details in hidden drawers, we prevent info overload, revealing options only on request.",
    strokePaths: [
      [[25, 15], [25, 85], [15, 75]],
      [[25, 15], [45, 25], [25, 45]],
      [[55, 25], [85, 25]],
      [[55, 45], [85, 45]],
      [[50, 65], [90, 65]],
      [[70, 25], [70, 65]],
      [[45, 85], [60, 75]],
      [[75, 75], [90, 85]]
    ]
  },
  {
    no: 597,
    char: "焦",
    pinyin: "jiāo",
    strokes: 12,
    meaning: "focus",
    category: "UI_VISUAL",
    etymology: "A bird roasted over a high fire, meaning intense focal heat, focal points, or element focus selectors.",
    funFact: "Element active focus states (:focus pseudo-classes). Found in 'Focus' (聚焦/焦距/焦点).",
    philosophy: "Focus gives exclusive priority. The keyboard targets the focused element, piping key triggers directly into its active handlers.",
    strokePaths: [
      [[35, 15], [20, 35]],
      [[20, 35], [45, 35], [35, 55]],
      [[20, 55], [45, 55]],
      [[50, 15], [80, 15]],
      [[65, 15], [65, 55]],
      [[20, 75], [15, 85]],
      [[40, 75], [45, 85]],
      [[80, 75], [85, 85]]
    ]
  },
  {
    no: 598,
    char: "态",
    pinyin: "tài",
    strokes: 8,
    meaning: "state / status",
    category: "UI_VISUAL",
    etymology: "A bear's internal heart defining its posture, attitude, or mode, signifying system states, status indicators, or loaded flags.",
    funFact: "Layout state variations (Hover, active, loaded states). Found in 'State' (状态/生态).",
    philosophy: "State is the source of truth. UI is simply a pure visual projection of underlying state values at any given point in time.",
    strokePaths: [
      [[45, 15], [20, 45]],
      [[20, 45], [80, 45], [70, 60]],
      [[45, 45], [45, 65]],
      [[30, 60], [20, 75]],
      [[20, 75], [50, 85], [80, 80], [85, 60]],
      [[48, 60], [52, 70]],
      [[80, 60], [85, 70]],
      [[40, 30], [65, 30]]
    ]
  },
  {
    no: 599,
    char: "源",
    pinyin: "yuán",
    strokes: 13,
    meaning: "asset source",
    category: "UI_VISUAL",
    etymology: "Water flowing from a high cavern spring, meaning master origins, resource paths, source codes, or src attributes.",
    funFact: "Media file location paths (src attributes). Found in 'Source/Origin' (来源/源码/电源).",
    philosophy: "All paths flow from a source. A source code contains the architectural instructions that outline the complete lifecycle of a software.",
    strokePaths: [
      [[20, 20], [25, 25]],
      [[15, 45], [20, 50]],
      [[15, 80], [30, 70]],
      [[45, 25], [80, 25]],
      [[40, 45], [40, 70]],
      [[40, 45], [85, 45], [85, 70]],
      [[40, 70], [85, 70]],
      [[62, 10], [62, 95]]
    ]
  },
  {
    no: 600,
    char: "配",
    pinyin: "pèi",
    strokes: 10,
    meaning: "match / fit",
    category: "UI_VISUAL",
    etymology: "Mixing wine inside a secure earthen jar to match proportions, meaning configurations, matches, fits, or styling alignments.",
    funFact: "Configuration layouts or parent sizing adjustments (object-fit, match-parent). Found in 'Configuration/Match' (配置/配合).",
    philosophy: "A complete system is a perfect mix of layout and logic. Config fields align distinct values to establish a stable workspace.",
    strokePaths: [
      [[35, 15], [65, 15]],
      [[25, 30], [25, 80]],
      [[25, 30], [75, 30], [75, 80]],
      [[25, 50], [75, 50]],
      [[25, 80], [75, 80]],
      [[55, 35], [55, 65]],
      [[55, 35], [85, 35], [85, 65], [75, 55]],
      [[55, 65], [85, 65]],
      [[55, 10], [55, 30]],
      [[15, 90], [90, 90]]
    ]
  }
];
