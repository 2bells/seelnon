# Brute Updates

![img](https://i.pinimg.com/736x/7b/a3/a8/7ba3a87a9147d3043d02a44f8d0e17d0.jpg)

Ok, brute was HEAVILY worked on on the background bit by bit.
So:

- Offscreen CPU canvas that runs on 1 FPS and responsible for actual serialization of the canvas into an image, so there are NO SEAMS, because the front end is handled by GPU only! [Seams can appear by GPU being a bit drunk during panning / zooming of the canvas and depending on your browser and hardware acceleration]
- Optimization of images and how they are understood by canvas
- Optimization of chunks and sectors during panning, so it is now a coordinate space, rather than movement of pixels
- Grids now feature more customization and properly expand into the 'forever' of the canvas
- Grids and BG is also exported during the save
- Actual image editing inside of imgHandler, so it is possible to change stuff of the image itself
- Better color extraction: it does 12/12/12 extractions on highlights, midtones and shadows. Then it has an epic tournament arc and trims it down to 4/4/4 for the final 12 colors. And if there is actual 'hue and lightness' diversity in one of those it can go to 1/10/1 or 2/8/2 or 3/6/3 structures, even 2/6/4.
- Extracted colors are NAMED as interactive palettes that is possible to click and pick from them directly, giving you as much color access options as you want.
- Liquify of 3 different options. One is fast, but leaves a bit of pixelation after itself. Resolve has a background worker that watches over and fixes the pixelation problems and Ultra as just does the job, but might be laggy, because a lot of calculations.
- Brush advanced sliders are all separated as their own IDs depending on the brush slot. So it is possible to customize even more our of 1 brush.
- Wireframe now uses its own screen-space, meaning it is not relying on canvas coordinates and can do all cool stuff by itself and only then it is 'imprinted' onto the canvas
- Selection has your traditional 'add' and 'subtract' creating complex selections. (there some work still needed on the way it does destination-out pass for eraser / smudge / liquify)
- Manga style patterns that feature absolute coordinate projection and are operating as a 'mask'. So you can paint in 'manga-screentones' using the brush. And then smudge them all out
- More options for transform selection: non-uniform scaling and options that are accessible for mobile. Previously you had to know hotkeys for transformations.
- More options for Windows Ink sensitivity
- Static canvas with ability to move images onto the 'grey void' and color pick from them
- Images are optimised on upload to max 1200 JPEG (could make colors shift a bit, but it is not that big of a deal, telling you like an artist, unless it is UI design... then use Figma, 4head)
- Impasto and Oiliness rework to give more natural selected color. It still causes shift in value lightness, but not that dramatic and having some diversity could be fun
- Static canvases could be extended with 'artwork preservation' making it easy to say 'I want more details, bring me here' (I'm yet to test very big pixel sizes, but.. if you going too big, just use chunked endless canvas. LLM told me browser is fine with up to 8k)
- Floating panel for mobile, so keyboard shortcuts are available for mobile
- Jitter options for brushes, such as size/angle/scatter
- Flow can make your brush feel like dry media (more flow is like oil, less is dry. Works with smudge as well, so a lot of cool things could be 'discovered' by moving sliders around)
- Layers respect own positions. (earlier if you paint it always on top and only then it pick a layer to sit on)
- Lots of bug fixes and general performance updates

Oh yeah, mascot of the app... A bit different style as I'm testing different stuff.

![img 60% c](https://www.dropbox.com/scl/fi/qxtu53ls8bkv6rr4l6ccq/CONCEPT_BRUTE_17810a33704455.jpg?rlkey=ifqduywwq6noxxhkuhs03tvig&st=pt97rxh9&raw=1)

## Known issues:

- Airbrush is still ass, but there are ways to make it work. Mostly it is bad with pressure sens (it needs proper brush spacing to work well... idk... for some reason one of the most common digital things is hard to make, because I wanted procedural airbrushes based on blur and scale, but then... idk... those are hard and I'm not an airbrush guy)
- Eraser / Smudge / Liquify during active selection leave a mark
- Export and New Canvas do jump when you grab them the first time. They just playing hard to get, all good. They stop on your 2nd try.
- No black and white for images. No way of knife them offscreen in the editor which is a bit annoying
- Hue Jitter kind of tanks performance
- Ctrl+Z on image layer has persistence
- No good Ctrl+Z on selection manipulation
- 'S-' sliders could be a bit annoying as they transpose some of the changes a bit weirdly. So needs some dynamic adjustments

But doing a few paintings using my standard '2400 x 3600 at 300 DPI'... thing is FAST FAST! And I had 0 crashes, no issues at all... I'm not gonna tell how much Rebelle likes to explode on me and how slow it sometimes.

As additional features... hmmm... maybe the whole paper texture thing... I do have an idea of how it could be done by implying masks that have 'grip' strength that tells paint 'how to stay'... But do I really need it? Probably not... it will slow down as + additional calculation. Could be a setting on a brush that 'grips'... nah... the more I start to 'paint in my head' the more I like: yeah it is more annoying, than fun when paint sometimes doesn't do what you want it to do and at that point just use Rebelle.

[Use the app](https://2bells.github.io/seelnon/Content/Projects/Concept_Brute/)

```
thought of a day

a day will be
tommorow
///
this post is actually
a bit ahead
```
