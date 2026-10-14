/**
 * BRUTALIST CANVAS AUDIO VISUALIZER
 * Styled in warm Fri-Ren / Altus Gold / Ancient Terminal aesthetic.
 * Renders real-time FFT Spectrum Bars, Raw Oscilloscope Beam, and Calibrated VU Meters.
 */

export class AudioVisualizer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = audioEngine;
    this.mode = 'SPECTRUM'; // 'SPECTRUM' | 'OSCILLOSCOPE' | 'VU_METER'
    this.animationId = null;
    this.peakValues = new Float32Array(64);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 600;
    this.height = rect.height || 140;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  setMode(newMode) {
    this.mode = newMode;
  }

  start() {
    if (this.animationId) return;
    const render = () => {
      this.draw();
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear with warm dark charcoal background (#151310)
    ctx.fillStyle = '#151310';
    ctx.fillRect(0, 0, w, h);

    // Background fine golden coordinate grid lines
    ctx.strokeStyle = '#262017';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 28) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += 18) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    const freqData = this.engine.getFrequencyData();
    const timeData = this.engine.getTimeDomainData();

    if (!freqData || !timeData || this.engine.audio.paused) {
      // Idle standby oscilloscope line
      this._drawIdle(ctx, w, h);
      return;
    }

    if (this.mode === 'SPECTRUM') {
      this._drawSpectrum(ctx, w, h, freqData);
    } else if (this.mode === 'OSCILLOSCOPE') {
      this._drawOscilloscope(ctx, w, h, timeData);
    } else if (this.mode === 'VU_METER') {
      this._drawVuMeter(ctx, w, h, freqData, timeData);
    }
  }

  _drawIdle(ctx, w, h) {
    ctx.strokeStyle = '#4a3d2e';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#837562';
    ctx.font = '10px monospace';
    ctx.fillText('AUDIO VISUALIZER // STANDBY', 10, h - 10);
  }

  _drawSpectrum(ctx, w, h, freqData) {
    const barCount = 36;
    const barWidth = Math.floor(w / barCount) - 3;
    const step = Math.floor(freqData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += freqData[i * step + j] || 0;
      }
      const avg = sum / step;
      const normalized = avg / 255;
      const barHeight = Math.max(3, normalized * (h - 22));

      const x = i * (barWidth + 3) + 2;
      const y = h - barHeight - 4;

      // Peak hold calculation
      if (normalized > (this.peakValues[i] || 0)) {
        this.peakValues[i] = normalized;
      } else {
        this.peakValues[i] = Math.max(0, (this.peakValues[i] || 0) - 0.015);
      }

      // Warm retro palette: Altus Gold, Parchment, Crimson Fire
      if (normalized > 0.85) {
        ctx.fillStyle = '#c85252'; // Crimson Fire peak
      } else if (normalized > 0.5) {
        ctx.fillStyle = '#edd6a4'; // Warm Parchment
      } else {
        ctx.fillStyle = '#c8a96e'; // Altus Gold
      }

      // Solid block
      ctx.fillRect(x, y, barWidth, barHeight);

      // Peak cap line
      const peakY = h - (this.peakValues[i] * (h - 22)) - 6;
      ctx.fillStyle = '#dfcfaf';
      ctx.fillRect(x, Math.max(4, peakY), barWidth, 2);
    }

    ctx.fillStyle = '#837562';
    ctx.font = '9px monospace';
    ctx.fillText('FFT SPECTRUM ANALYZER [20Hz - 20kHz]', 8, 14);
  }

  _drawOscilloscope(ctx, w, h, timeData) {
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#c8a96e'; // Altus Gold beam
    ctx.beginPath();

    const sliceWidth = w / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * h) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();

    ctx.fillStyle = '#c8a96e';
    ctx.font = '9px monospace';
    ctx.fillText('RAW TIME-DOMAIN OSCILLOSCOPE [CH1]', 8, 14);
  }

  _drawVuMeter(ctx, w, h, freqData, timeData) {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const amp = (timeData[i] - 128) / 128;
      sum += amp * amp;
    }
    const rms = Math.sqrt(sum / timeData.length);
    const db = 20 * Math.log10(Math.max(0.0001, rms));

    const bassSum = (freqData[0] + freqData[1] + freqData[2] + freqData[3]) / (4 * 255);
    const leftVal = Math.min(1, rms * 2.2 + bassSum * 0.2);
    const rightVal = Math.min(1, rms * 2.0 + bassSum * 0.25);

    const meterHeight = 18;
    const meterY1 = h / 2 - 24;
    const meterY2 = h / 2 + 6;
    const meterWidth = w - 60;

    this._renderVuChannel(ctx, 'L-CH', 40, meterY1, meterWidth, meterHeight, leftVal);
    this._renderVuChannel(ctx, 'R-CH', 40, meterY2, meterWidth, meterHeight, rightVal);

    ctx.fillStyle = '#837562';
    ctx.font = '9px monospace';
    ctx.fillText(`MASTER VU METER // PEAK: ${db.toFixed(1)} dB`, 8, 14);
  }

  _renderVuChannel(ctx, label, x, y, width, height, val) {
    ctx.fillStyle = '#dfcfaf';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(label, 6, y + height - 4);

    // Frame
    ctx.strokeStyle = '#3f362a';
    ctx.strokeRect(x, y, width, height);

    // Discrete LED blocks
    const segments = 24;
    const segWidth = Math.floor(width / segments) - 2;
    const filledSegments = Math.round(val * segments);

    for (let s = 0; s < segments; s++) {
      const sx = x + s * (segWidth + 2) + 2;
      const isFilled = s < filledSegments;

      if (isFilled) {
        if (s >= 21) {
          ctx.fillStyle = '#c85252'; // Crimson Fire peak
        } else if (s >= 16) {
          ctx.fillStyle = '#edd6a4'; // Parchment high
        } else {
          ctx.fillStyle = '#c8a96e'; // Altus Gold
        }
      } else {
        ctx.fillStyle = '#221d17';
      }
      ctx.fillRect(sx, y + 2, segWidth, height - 4);
    }
  }
}
