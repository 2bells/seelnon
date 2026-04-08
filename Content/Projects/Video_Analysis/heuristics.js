export function scoreEditingLikelihood(analysis) {
  const evidence = [];
  let score = 0;

  const add = (weight, reason) => {
    evidence.push({ weight, reason });
    score += weight;
  };

  const tags = analysis.tags || {};
  const brands = analysis.brands || [];
  const codecs = analysis.codecs || [];
  const tool = analysis.softwareTool || analysis.encoder || "";

  // High signals of editing/re-encoding
  if (/ffmpeg|lavf|libx264|libx265|handbrake|premiere|after effects|resolve|avid|imovie|kdenlive|shotcut/i.test(tool)) {
    add(0.35, `Software/tool suggests re-encoding: "${tool}"`);
  }
  // XMP Adobe evidence
  if (/adobe|after effects|premiere|photoshop|media encoder|audition/i.test(String(tags["xmp:CreatorTool"]||"")) ||
      Array.isArray(tags["xmpMM:History.softwareAgents"]) && tags["xmpMM:History.softwareAgents"].some(a=>/adobe|after effects|premiere|photoshop|media encoder|audition/i.test(a))) {
    add(0.3, `Adobe XMP metadata indicates editing (${tags["xmp:CreatorTool"] || "history"})`);
  }
  // Encoder tag
  if (tags.encoder && /x264|x265|ffmpeg|HandBrake/i.test(String(tags.encoder))) {
    add(0.25, `Encoder tag indicates re-encoded: "${tags.encoder}"`);
  }
  // Mismatch between device and brand
  if (brands.some(b=>/isom|iso6|mp42/i.test(b)) && /QuickTime/i.test(tool)) {
    add(0.1, `Generic MP4 brand but QuickTime tool present`);
  }
  // Presence of rich QuickTime metadata but generic brands
  if (Object.keys(tags).some(k=>/^com\.apple\.quicktime/i.test(k)) && brands.every(b=>!/^qt\s?/.test(b))) {
    add(0.1, `QuickTime metadata present without QuickTime brand`);
  }
  // Multiple passes hints
  if (tags["com.apple.quicktime.software"] && tags["©too"] && tags["©too"] !== tags["com.apple.quicktime.software"]) {
    add(0.1, `Multiple software tags suggest processing chain`);
  }
  // Track codecs that imply transcode
  if (codecs.some(c=>/avc1|hvc1|hev1|mp4a/.test(c)) && tool) {
    add(0.05, `Common delivery codecs with explicit tool tag`);
  }

  // Signals of original capture
  if (/apple|iphone|ipad/i.test(String(tags["com.apple.quicktime.model"]||"")) ||
      /iphone|ipad/i.test(String(analysis.device||""))) {
    add(-0.15, `Apple device model present (often original capture)`);
  }
  if (/samsung|pixel|xiaomi|oneplus|huawei/i.test(String(analysis.device||""))) {
    add(-0.1, `Android device model present (often original capture)`);
  }
  // GoPro / DJI original streams often include maker notes
  if (Object.keys(tags).some(k=>/GoPro|GPMF|DJI|Ambarella/i.test(k)) ||
      Object.values(tags).some(v=>/GoPro|GPMF|DJI|Ambarella/i.test(String(v)))) {
    add(-0.1, `Action camera maker metadata present`);
  }

  // Clamp score 0..1
  score = Math.max(0, Math.min(1, score));
  return { score, evidence };
}