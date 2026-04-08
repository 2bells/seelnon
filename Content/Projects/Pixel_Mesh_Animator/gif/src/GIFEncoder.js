/*
  GIFEncoder.js

  Authors
  Kevin Weiner (original Java version - kweiner@fmsware.com)
  Thibault Imbert (AS3 version - bytearray.org)
  Johan Nordberg (JS version - code@johan-nordberg.com)
*/

var NeuQuant = require('./TypedNeuQuant.js');
var LZWEncoder = require('./LZWEncoder.js');

function ByteArray() {
  this.page = -1;
  this.pages = [];
  this.newPage();
}

ByteArray.pageSize = 4096;
ByteArray.charMap = {};

for (var i = 0; i < 256; i++)
  ByteArray.charMap[i] = String.fromCharCode(i);

ByteArray.prototype.newPage = function() {
  this.pages[++this.page] = new Uint8Array(ByteArray.pageSize);
  this.cursor = 0;
};

ByteArray.prototype.getData = function() {
  var rv = '';
  for (var p = 0; p < this.pages.length; p++) {
    for (var i = 0; i < ByteArray.pageSize; i++) {
      rv += ByteArray.charMap[this.pages[p][i]];
    }
  }
  return rv;
};

ByteArray.prototype.writeByte = function(val) {
  if (this.cursor >= ByteArray.pageSize) this.newPage();
  this.pages[this.page][this.cursor++] = val;
};

ByteArray.prototype.writeUTFBytes = function(string) {
  for (var l = string.length, i = 0; i < l; i++)
    this.writeByte(string.charCodeAt(i));
};

ByteArray.prototype.writeBytes = function(array, offset, length) {
  for (var l = length || array.length, i = offset || 0; i < l; i++)
    this.writeByte(array[i]);
};

function GIFEncoder(width, height) {
  // image size
  this.width = ~~width;
  this.height = ~~height;

  // transparent color if given
  this.transparent = null;

  // transparent index in color table
  this.transIndex = 0;

  // -1 = no repeat, 0 = forever. anything else is repeat count
  this.repeat = -1;

  // frame delay (hundredths)
  this.delay = 0;

  this.image = null; // current frame
  this.pixels = null; // BGR byte array from frame
  this.indexedPixels = null; // converted frame indexed to palette
  this.colorDepth = null; // number of bit planes
  this.colorTab = null; // RGB palette
  this.neuQuant = null; // NeuQuant instance that was used to generate this.colorTab.
  this.usedEntry = new Array(); // active palette entries
  this.palSize = 7; // color table size (bits-1)
  this.dispose = -1; // disposal code (-1 = use default)
  this.firstFrame = true;
  this.sample = 10; // default sample interval for quantizer
  this.dither = false; // default dithering
  this.globalPalette = false;

  this.out = new ByteArray();
}

/*
  Sets the delay time between each frame, or changes it for subsequent frames
  (applies to last frame added)
*/
GIFEncoder.prototype.setDelay = function(milliseconds) {
  this.delay = Math.round(milliseconds / 10);
};

/*
  Sets frame rate in frames per second.
*/
GIFEncoder.prototype.setFrameRate = function(fps) {
  this.delay = Math.round(100 / fps);
};

/*
  Sets the GIF frame disposal code for the last added frame and any
  subsequent frames.

  Default is 0 if no transparent color has been set, otherwise 2.
*/
GIFEncoder.prototype.setDispose = function(disposalCode) {
  if (disposalCode >= 0) this.dispose = disposalCode;
};

/*
  Sets the number of times the set of GIF frames should be played.

  -1 = play once
  0 = repeat indefinitely

  Default is -1

  Must be invoked before the first image is added
*/

GIFEncoder.prototype.setRepeat = function(repeat) {
  this.repeat = repeat;
};

/*
  Sets the transparent color for the last added frame and any subsequent
  frames. Since all colors are subject to modification in the quantization
  process, the color in the final palette for each frame closest to the given
  color becomes the transparent color for that frame. May be set to null to
  indicate no transparent color.
*/
GIFEncoder.prototype.setTransparent = function(color) {
  this.transparent = color;
};

/*
  Adds next GIF frame. The frame is not written immediately, but is
  actually deferred until the next frame is received so that timing
  data can be inserted.  Invoking finish() flushes all frames.
*/
GIFEncoder.prototype.addFrame = function(imageData) {
  this.image = imageData;

  this.colorTab = this.globalPalette && this.globalPalette.slice ? this.globalPalette : null;

  this.getImagePixels(); // convert to correct format if necessary
  this.analyzePixels(); // build color table & map pixels

  if (this.globalPalette === true) this.globalPalette = this.colorTab;

  if (this.firstFrame) {
    this.writeLSD(); // logical screen descriptior
    this.writePalette(); // global color table
    if (this.repeat >= 0) {
      // use NS app extension to indicate reps
      this.writeNetscapeExt();
    }
  }

  this.writeGraphicCtrlExt(); // write graphic control extension
  this.writeImageDesc(); // image descriptor
  if (!this.firstFrame && !this.globalPalette) this.writePalette(); // local color table
  this.writePixels(); // encode and write pixel data

  this.firstFrame = false;
};

/*
  Adds final trailer to the GIF stream, if you don't call the finish method
  the GIF stream will not be valid.
*/
GIFEncoder.prototype.finish = function() {
  this.out.writeByte(0x3b); // gif trailer
};

/*
  Sets quality of color quantization (conversion of images to the maximum 256
  colors allowed by the GIF specification). Lower values (minimum = 1)
  produce better colors, but slow processing significantly. 10 is the
  default, and produces good color mapping at reasonable speeds. Values
  greater than 20 do not yield significant improvements in speed.
*/
GIFEncoder.prototype.setQuality = function(quality) {
  if (quality < 1) quality = 1;
  this.sample = quality;
};

/*
  Sets dithering method. Available are:
  - FALSE no dithering
  - TRUE or FloydSteinberg
  - FalseFloydSteinberg
  - Stucki
  - Atkinson
  You can add '-serpentine' to use serpentine scanning
*/
GIFEncoder.prototype.setDither = function(dither) {
  if (dither === true) dither = 'FloydSteinberg';
  this.dither = dither;
};

/*
  Sets global palette for all frames.
  You can provide TRUE to create global palette from first picture.
  Or an array of r,g,b,r,g,b,...
*/
GIFEncoder.prototype.setGlobalPalette = function(palette) {
  this.globalPalette = palette;
};

/*
  Returns global palette used for all frames.
  If setGlobalPalette(true) was used, then this function will return
  calculated palette after the first frame is added.
*/
GIFEncoder.prototype.getGlobalPalette = function() {
  return (this.globalPalette && this.globalPalette.slice && this.globalPalette.slice(0)) || this.globalPalette;
};

/*
  Writes GIF file header
*/
GIFEncoder.prototype.writeHeader = function() {
  this.out.writeUTFBytes("GIF89a");
};

/*
  Analyzes current frame colors and creates color map.
*/
GIFEncoder.prototype.analyzePixels = function() {
  let paletteIsCustom = false;
  if (this.globalPalette && Array.isArray(this.globalPalette) && this.globalPalette.length > 0) {
    // A custom global palette array was provided by the user/app
    this.colorTab = [...this.globalPalette]; // Use a copy

    const requiredEntries = 256 * 3; // 256 colors * 3 (R,G,B)
    if (this.colorTab.length < requiredEntries) {
      const currentLength = this.colorTab.length;
      // Pad with black if the palette is smaller than 256 colors
      for (let i = 0; i < requiredEntries - currentLength; i += 3) {
        this.colorTab.push(0, 0, 0); 
      }
    } else if (this.colorTab.length > requiredEntries) {
      // Truncate if the palette is larger than 256 colors
      this.colorTab = this.colorTab.slice(0, requiredEntries);
    }
    this.neuQuant = null; // Skip NeuQuant processing
    paletteIsCustom = true;
  } else if (!this.colorTab) { 
    // No custom palette provided AND no colorTab from a previous frame (e.g. globalPalette=true)
    // So, run NeuQuant
    this.neuQuant = new NeuQuant(this.pixels, this.sample);
    this.neuQuant.buildColormap(); 
    this.colorTab = this.neuQuant.getColormap();
  }
  // If this.colorTab was already set (e.g. globalPalette was true and a previous frame processed it), 
  // that existing colorTab is used, and NeuQuant is skipped for subsequent frames.

  // Map image pixels to the new palette
  if (this.dither) {
    this.ditherPixels(this.dither.replace('-serpentine', ''), this.dither.match(/-serpentine/) !== null);
  } else {
    this.indexPixels(); // This will map pixels to this.colorTab
  }

  this.pixels = null; // Free up pixel data
  this.colorDepth = 8;
  this.palSize = 7; // 2^(7+1) = 256 colors

  // Handle transparency
  if (this.transparent !== null) {
    var tr = (this.transparent & 0xFF0000) >> 16; // Target Red for transparency
    var tg = (this.transparent & 0x00FF00) >> 8;  // Target Green
    var tb = (this.transparent & 0x0000FF);       // Target Blue
    var exactMatchIndex = -1;

    // Search for an exact match of the transparent color in the current colorTab
    for (var i = 0; i < this.colorTab.length / 3; i++) {
      if (this.colorTab[i*3] === tr && this.colorTab[i*3+1] === tg && this.colorTab[i*3+2] === tb) {
        exactMatchIndex = i;
        break;
      }
    }

    if (exactMatchIndex !== -1) {
      this.transIndex = exactMatchIndex;
      // Ensure this palette entry is marked as "used" if it's the transparent one.
      // This helps ensure it's considered by some GIF encoders/players.
      // Extend usedEntry array if transIndex is out of bounds.
      if (this.usedEntry.length <= this.transIndex) {
           const oldLen = this.usedEntry.length;
           // Ensure usedEntry is an array that can have its length set.
           if (!Array.isArray(this.usedEntry)) this.usedEntry = Array.from(this.usedEntry || []); 
           this.usedEntry.length = this.transIndex + 1;
           for(let k = oldLen; k < this.transIndex; k++) { if(this.usedEntry[k] === undefined) this.usedEntry[k] = false; } // Initialize new entries
      }
      this.usedEntry[this.transIndex] = true;

    } else {
      // Transparent color was not found in the palette.
      if (paletteIsCustom) {
        // This implies the app.js should have included the transparent color in the custom palette.
        console.warn("GIFEncoder: Transparent color (e.g., magenta) was specified but NOT found in the custom global palette. Keying might not work as expected. Defaulting to index 0 or closest match found by findClosest.");
        // Fallback: find closest or use a default. This may lead to unexpected results.
        this.transIndex = this.findClosest(this.transparent, false); // `false` to search all palette entries
      } else {
        // NeuQuant was used, and it didn't pick up the transparent color.
        // Try to add it or replace an existing color in the NeuQuant-generated palette.
        if (this.colorTab.length / 3 < 256) { 
            // Palette has space (unlikely with NeuQuant's default netsize=256). Add transparent color.
            this.colorTab.push(tr, tg, tb);
            this.transIndex = (this.colorTab.length / 3) - 1;
             // Ensure usedEntry is an array and can be extended.
            if (!Array.isArray(this.usedEntry)) this.usedEntry = Array.from(this.usedEntry || []);
            if(this.usedEntry.length <= this.transIndex) {
               const oldLenUsed = this.usedEntry.length;
               this.usedEntry.length = this.transIndex + 1;
               for(var kUsed=oldLenUsed; kUsed < this.transIndex; kUsed++) { if(this.usedEntry[kUsed] === undefined) this.usedEntry[kUsed] = false; }
            }
            this.usedEntry[this.transIndex] = true;
        } else {
            // Palette is full (256 colors). Find a color to sacrifice and replace it.
            this.transIndex = this.findClosest(this.transparent, true); // `true` to sacrifice a color "used" by the image.
            var palIndexBase = this.transIndex * 3;
            this.colorTab[palIndexBase] = tr;
            this.colorTab[palIndexBase + 1] = tg;
            this.colorTab[palIndexBase + 2] = tb;
             if (!Array.isArray(this.usedEntry)) this.usedEntry = Array.from(this.usedEntry || []); // Ensure array
            if (this.usedEntry.length > this.transIndex) this.usedEntry[this.transIndex] = true; // Mark the (now transparent) color as used.

        }
      }
    }
  } else {
      // No transparency requested
      this.transIndex = 0; // Default to 0, though it won't be used if transp flag is 0.
  }
};

/*
  Index pixels, without dithering
*/
GIFEncoder.prototype.indexPixels = function(imgq) {
  var nPix = this.pixels.length / 3;
  this.indexedPixels = new Uint8Array(nPix);
  var k = 0;
  for (var j = 0; j < nPix; j++) {
    var index = this.findClosestRGB(
      this.pixels[k++] & 0xff,
      this.pixels[k++] & 0xff,
      this.pixels[k++] & 0xff
    );
    this.usedEntry[index] = true;
    this.indexedPixels[j] = index;
  }
};

/*
  Taken from http://jsbin.com/iXofIji/2/edit by PAEz
*/
GIFEncoder.prototype.ditherPixels = function(kernel, serpentine) {
  var kernels = {
    FalseFloydSteinberg: [
      [3 / 8, 1, 0],
      [3 / 8, 0, 1],
      [2 / 8, 1, 1]
    ],
    FloydSteinberg: [
      [7 / 16, 1, 0],
      [3 / 16, -1, 1],
      [5 / 16, 0, 1],
      [1 / 16, 1, 1]
    ],
    Stucki: [
      [8 / 42, 1, 0],
      [4 / 42, 2, 0],
      [2 / 42, -2, 1],
      [4 / 42, -1, 1],
      [8 / 42, 0, 1],
      [4 / 42, 1, 1],
      [2 / 42, 2, 1],
      [1 / 42, -2, 2],
      [2 / 42, -1, 2],
      [4 / 42, 0, 2],
      [2 / 42, 1, 2],
      [1 / 42, 2, 2]
    ],
    Atkinson: [
      [1 / 8, 1, 0],
      [1 / 8, 2, 0],
      [1 / 8, -1, 1],
      [1 / 8, 0, 1],
      [1 / 8, 1, 1],
      [1 / 8, 0, 2]
    ]
  };

  if (!kernel || !kernels[kernel]) {
    throw 'Unknown dithering kernel: ' + kernel;
  }

  var ds = kernels[kernel];
  var index = 0,
    height = this.height,
    width = this.width,
    data = this.pixels;
  var direction = serpentine ? -1 : 1;

  this.indexedPixels = new Uint8Array(this.pixels.length / 3);

  for (var y = 0; y < height; y++) {

    if (serpentine) direction = direction * -1;

    for (var x = (direction == 1 ? 0 : width - 1), xend = (direction == 1 ? width : 0); x !== xend; x += direction) {

      index = (y * width) + x;
      // Get original colour
      var idx = index * 3;
      var r1 = data[idx];
      var g1 = data[idx + 1];
      var b1 = data[idx + 2];

      // Get converted colour
      idx = this.findClosestRGB(r1, g1, b1);
      this.usedEntry[idx] = true;
      this.indexedPixels[index] = idx;
      idx *= 3;
      var r2 = this.colorTab[idx];
      var g2 = this.colorTab[idx + 1];
      var b2 = this.colorTab[idx + 2];

      var er = r1 - r2;
      var eg = g1 - g2;
      var eb = b1 - b2;

      for (var i = (direction == 1 ? 0: ds.length - 1), end = (direction == 1 ? ds.length : 0); i !== end; i += direction) {
        var x1 = ds[i][1]; // *direction;  //  Should this by timesd by direction?..to make the kernel go in the opposite direction....got no idea....
        var y1 = ds[i][2];
        if (x1 + x >= 0 && x1 + x < width && y1 + y >= 0 && y1 + y < height) {
          var d = ds[i][0];
          idx = index + x1 + (y1 * width);
          idx *= 3;

          data[idx] = Math.max(0, Math.min(255, data[idx] + er * d));
          data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + eg * d));
          data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + eb * d));
        }
      }
    }
  }
};

/*
  Returns index of palette color closest to c
*/
GIFEncoder.prototype.findClosest = function(c, used) {
  return this.findClosestRGB((c & 0xFF0000) >> 16, (c & 0x00FF00) >> 8, (c & 0x0000FF), used);
};

GIFEncoder.prototype.findClosestRGB = function(r, g, b, used) {
  if (this.colorTab === null) return -1;

  if (this.neuQuant && !used) {
    return this.neuQuant.lookupRGB(r, g, b);
  }

  var c = b | (g << 8) | (r << 16);

  var minpos = 0;
  var dmin = 256 * 256 * 256;
  var len = this.colorTab.length;

  for (var i = 0, index = 0; i < len; index++) {
    var dr = r - (this.colorTab[i++] & 0xff);
    var dg = g - (this.colorTab[i++] & 0xff);
    var db = b - (this.colorTab[i++] & 0xff);
    var d = dr * dr + dg * dg + db * db;
    if ((!used || this.usedEntry[index]) && (d < dmin)) {
      dmin = d;
      minpos = index;
    }
  }

  return minpos;
};

/*
  Extracts image pixels into byte array pixels
  (removes alphachannel from canvas imagedata)
*/
GIFEncoder.prototype.getImagePixels = function() {
  var w = this.width;
  var h = this.height;
  this.pixels = new Uint8Array(w * h * 3);

  var data = this.image;
  var srcPos = 0;
  var count = 0;

  for (var i = 0; i < h; i++) {
    for (var j = 0; j < w; j++) {
      this.pixels[count++] = data[srcPos++];
      this.pixels[count++] = data[srcPos++];
      this.pixels[count++] = data[srcPos++];
      srcPos++;
    }
  }
};

/*
  Writes Graphic Control Extension
*/
GIFEncoder.prototype.writeGraphicCtrlExt = function() {
  this.out.writeByte(0x21); // extension introducer
  this.out.writeByte(0xf9); // GCE label
  this.out.writeByte(4); // data block size

  var transp, disp;
  if (this.transparent === null) {
    transp = 0;
    disp = 0; // dispose = no action
  } else {
    transp = 1;
    disp = 2; // force clear if using transparent color
  }

  if (this.dispose >= 0) {
    disp = this.dispose & 7; // user override
  }
  disp <<= 2;

  // packed fields
  this.out.writeByte(
    0 | // 1:3 reserved
    disp | // 4:6 disposal
    0 | // 7 user input - 0 = none
    transp // 8 transparency flag
  );

  this.writeShort(this.delay); // delay x 1/100 sec
  this.out.writeByte(this.transIndex); // transparent color index
  this.out.writeByte(0); // block terminator
};

/*
  Writes Image Descriptor
*/
GIFEncoder.prototype.writeImageDesc = function() {
  this.out.writeByte(0x2c); // image separator
  this.writeShort(0); // image position x,y = 0,0
  this.writeShort(0);
  this.writeShort(this.width); // image size
  this.writeShort(this.height);

  // packed fields
  if (this.firstFrame || this.globalPalette) {
    // no LCT - GCT is used for first (or only) frame
    this.out.writeByte(0);
  } else {
    // specify normal LCT
    this.out.writeByte(
      0x80 | // 1 local color table 1=yes
      0 | // 2 interlace - 0=no
      0 | // 3 sorted - 0=no
      0 | // 4-5 reserved
      this.palSize // 6-8 size of color table
    );
  }
};

/*
  Writes Logical Screen Descriptor
*/
GIFEncoder.prototype.writeLSD = function() {
  // logical screen size
  this.writeShort(this.width);
  this.writeShort(this.height);

  // packed fields
  this.out.writeByte(
    0x80 | // 1 : global color table flag = 1 (gct used)
    0x70 | // 2-4 : color resolution = 7
    0x00 | // 5 : gct sort flag = 0
    this.palSize // 6-8 : gct size
  );

  this.out.writeByte(0); // background color index
  this.out.writeByte(0); // pixel aspect ratio - assume 1:1
};

/*
  Writes Netscape application extension to define repeat count.
*/
GIFEncoder.prototype.writeNetscapeExt = function() {
  this.out.writeByte(0x21); // extension introducer
  this.out.writeByte(0xff); // app extension label
  this.out.writeByte(11); // block size
  this.out.writeUTFBytes('NETSCAPE2.0'); // app id + auth code
  this.out.writeByte(3); // sub-block size
  this.out.writeByte(1); // loop sub-block id
  this.writeShort(this.repeat); // loop count (extra iterations, 0=repeat forever)
  this.out.writeByte(0); // block terminator
};

/*
  Writes color table
*/
GIFEncoder.prototype.writePalette = function() {
  this.out.writeBytes(this.colorTab);
  var n = (3 * 256) - this.colorTab.length;
  for (var i = 0; i < n; i++)
    this.out.writeByte(0);
};

GIFEncoder.prototype.writeShort = function(pValue) {
  this.out.writeByte(pValue & 0xFF);
  this.out.writeByte((pValue >> 8) & 0xFF);
};

/*
  Encodes and writes pixel data
*/
GIFEncoder.prototype.writePixels = function() {
  var enc = new LZWEncoder(this.width, this.height, this.indexedPixels, this.colorDepth);
  enc.encode(this.out);
};

/*
  Retrieves the GIF stream
*/
GIFEncoder.prototype.stream = function() {
  return this.out;
};

module.exports = GIFEncoder;