// All celestial effects are composited into the hero's own frame canvas.
export function createHeroSky() {
  const stars = document.createElement('canvas');
  const corona = document.createElement('canvas');
  const burst = document.createElement('canvas');
  const sampler = document.createElement('canvas');
  const sampleContext = sampler.getContext('2d', { willReadFrequently: true });
  const horizons = new WeakMap();
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  function prepareBurst() {
    const size = burst.width = burst.height = 512;
    const context = burst.getContext('2d');
    context.translate(size / 2, size / 2);
    context.globalCompositeOperation = 'screen';
    let seed = 19347;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Uneven, tapered diffraction rays rather than a regular graphic star.
    for (let index = 0; index < 44; index++) {
      const angle = index / 44 * Math.PI * 2 + (random() - .5) * .09;
      const length = 55 + random() ** 2 * 190;
      const thickness = .7 + random() * 3;
      context.save();
      context.rotate(angle);
      const ray = context.createLinearGradient(0, 0, length, 0);
      ray.addColorStop(0, '#fff8e0');
      ray.addColorStop(.12, '#ffd28ca0');
      ray.addColorStop(.45, '#f6a35c35');
      ray.addColorStop(1, '#e9883500');
      context.fillStyle = ray;
      context.globalAlpha = .18 + random() * .5;
      context.shadowColor = '#ffa64b';
      context.shadowBlur = 3;
      context.beginPath();
      context.moveTo(0, -thickness);
      context.lineTo(length, 0);
      context.lineTo(0, thickness);
      context.closePath();
      context.fill();
      context.restore();
    }
    const core = context.createRadialGradient(0, 0, 0, 0, 0, 28);
    core.addColorStop(0, '#fffffff5');
    core.addColorStop(.08, '#fffcece8');
    core.addColorStop(.22, '#ffe5a991');
    core.addColorStop(.5, '#ffb96c22');
    core.addColorStop(1, '#ffac5600');
    context.fillStyle = core;
    context.fillRect(-28, -28, 56, 56);
  }

  prepareBurst();

  function streak(context, x, y, length, thickness, angle, opacity, warm) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.scale(1, thickness / length);
    context.globalAlpha *= opacity;
    const light = context.createRadialGradient(0, 0, 0, 0, 0, length);
    light.addColorStop(0, '#fffbeedd');
    light.addColorStop(.06, warm ? '#ffe4b3a8' : '#eaf4ff78');
    light.addColorStop(.28, warm ? '#ffad5c45' : '#b0d6ff25');
    light.addColorStop(.7, warm ? '#e8702912' : '#94c4ff08');
    light.addColorStop(1, '#00000000');
    context.fillStyle = light;
    context.fillRect(-length, -length, length * 2, length * 2);
    context.restore();
  }

  function resize(nextWidth, nextHeight, ratio) {
    width = stars.width = nextWidth;
    height = stars.height = nextHeight;
    pixelRatio = ratio;
    // A continuous light falloff with stable subpixel noise avoids the visible
    // color rings produced by a handful of gradient stops on a dark sky.
    const size = corona.width = corona.height = Math.max(128, Math.round(Math.min(width, height) * .63));
    const coronaContext = corona.getContext('2d');
    const light = coronaContext.createImageData(size, size);
    let noiseSeed = 81473;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const distanceSquared = ((x + .5 - size / 2) ** 2 + (y + .5 - size / 2) ** 2) / (size / 2) ** 2;
        const taper = Math.max(0, 1 - distanceSquared) ** 2;
        const core = Math.exp(-distanceSquared * 70) * .78 * taper;
        const halo = Math.exp(-distanceSquared * 12) * .24 * taper;
        const tail = Math.exp(-distanceSquared * 4) * .035 * taper;
        noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
        const noise = (noiseSeed / 4294967296 - .5) * 1.4 * taper;
        const offset = (y * size + x) * 4;
        light.data[offset] = 255 * core + 255 * halo + 220 * tail + noise;
        light.data[offset + 1] = 248 * core + 194 * halo + 131 * tail + noise;
        light.data[offset + 2] = 230 * core + 122 * halo + 69 * tail + noise;
        light.data[offset + 3] = 255;
      }
    }
    coronaContext.putImageData(light, 0, 0);
    const context = stars.getContext('2d');
    let seed = 69738;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = Math.max(100, Math.min(460, Math.round(width * height / ratio ** 2 / 4300)));
    for (let index = 0; index < count; index++) {
      const x = random() * width;
      const y = random() * height;
      const bright = random() > .96;
      const radius = (bright ? 1.1 : .35 + random() * .5) * ratio;
      const opacity = bright ? .85 : .2 + random() * .48;
      if (bright) {
        const glow = context.createRadialGradient(x, y, 0, x, y, radius * 5);
        glow.addColorStop(0, '#d6e7ff55');
        glow.addColorStop(1, '#d6e7ff00');
        context.fillStyle = glow;
        context.fillRect(x - radius * 5, y - radius * 5, radius * 10, radius * 10);
      }
      context.fillStyle = `rgba(218, 232, 255, ${opacity})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function horizonFor(frame) {
    if (horizons.has(frame)) return horizons.get(frame);
    // Read a small copy once per decoded frame to follow the actual curved limb,
    // including the portrait crop, without painting stars over the planet.
    sampler.width = frame.width < frame.height ? 128 : 256;
    sampler.height = Math.round(sampler.width * frame.height / frame.width);
    sampleContext.drawImage(frame, 0, 0, sampler.width, sampler.height);
    const { data } = sampleContext.getImageData(0, 0, sampler.width, sampler.height);
    const edge = [];
    for (let x = 0; x < sampler.width; x++) {
      let y = 0;
      for (; y < sampler.height; y++) {
        const offset = (y * sampler.width + x) * 4;
        const luminance = data[offset] * .2126 + data[offset + 1] * .7152 + data[offset + 2] * .0722;
        if (luminance > 50 && data[offset + 2] > 56) break;
      }
      edge.push(y * frame.height / sampler.height);
    }
    const smoothingRadius = Math.round(sampler.width / 20);
    const smooth = edge.map((y, x) => {
      let total = 0;
      let weight = 0;
      for (let neighbor = Math.max(0, x - smoothingRadius); neighbor <= Math.min(edge.length - 1, x + smoothingRadius); neighbor++) {
        const strength = smoothingRadius + 1 - Math.abs(neighbor - x);
        total += edge[neighbor] * strength;
        weight += strength;
      }
      return weight ? total / weight : y;
    });
    horizons.set(frame, smooth);
    return smooth;
  }

  function draw(context, frame, offsetX, offsetY, scale, flare = 0) {
    const horizon = horizonFor(frame);
    const pointX = x => offsetX + x * frame.width / (horizon.length - 1) * scale;
    const pointY = x => offsetY + horizon[x] * scale;
    context.save();
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(width, 0);
    for (let x = horizon.length - 1; x >= 0; x--) context.lineTo(pointX(x), pointY(x));
    context.closePath();
    context.clip();
    context.globalCompositeOperation = 'screen';
    context.drawImage(stars, 0, 0);

    const sunX = width * .5;
    const sampleX = Math.max(0, Math.min(horizon.length - 1, (sunX - offsetX) / (frame.width * scale) * (horizon.length - 1)));
    const left = Math.floor(sampleX);
    const right = Math.min(horizon.length - 1, left + 1);
    const limbY = pointY(left) + (pointY(right) - pointY(left)) * (sampleX - left);
    const radius = Math.max(12 * pixelRatio, Math.min(width, height) * .025);
    // The planet occludes almost the entire disk, leaving a narrow solar cap.
    const sunY = limbY + radius * .9;
    const coronaRadius = radius * 9;
    context.globalAlpha = .58 + flare * .12;
    context.drawImage(corona, sunX - coronaRadius, sunY - coronaRadius, coronaRadius * 2, coronaRadius * 2);
    context.globalAlpha = 1;

    const disk = context.createRadialGradient(sunX, sunY, 0, sunX, sunY, radius);
    disk.addColorStop(0, '#ffffff');
    disk.addColorStop(.85, '#fff9e9');
    disk.addColorStop(1, '#ffe1b8');
    context.fillStyle = disk;
    context.beginPath();
    context.arc(sunX, sunY, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // The solar glow and rays stay visible after the brief pulse has ended.
    // Optical artifacts on the lens can cross the planet's silhouette.
    const flareY = limbY - radius * .06;
    const sunlight = .86 + flare * .14;
    context.save();
    context.globalCompositeOperation = 'screen';
    const bloomRadius = coronaRadius * .9;
    context.globalAlpha = sunlight * .85;
    context.drawImage(corona, sunX - bloomRadius, flareY - bloomRadius, bloomRadius * 2, bloomRadius * 2);
    context.globalAlpha = sunlight;
    const burstSize = radius * 34;
    context.drawImage(burst, sunX - burstSize / 2, flareY - burstSize / 2, burstSize, burstSize);
    const length = Math.min(width * .72, radius * 44);
    const diagonal = -.34;
    streak(context, sunX, flareY, length, pixelRatio * 1.4, 0, .75, false);
    streak(context, sunX, flareY, length * .85, radius * 1.8, diagonal, .18, true);
    streak(context, sunX, flareY, length, pixelRatio * 2.2, diagonal, .95, true);
    streak(context, sunX, flareY, radius * 9, pixelRatio * 1.1, -1.18, .65, true);

    if (flare <= 0) {
      context.restore();
      return;
    }

    // Small amber lens ghosts follow the same diagonal as the main light ray.
    const axisLength = Math.min(width * .43, height * .7);
    context.globalAlpha = flare ** 1.4;
    for (const [distance, size, opacity] of [[.25, .18, .13], [.52, .38, .32], [.86, .65, .08], [1.15, 1.05, .035]]) {
      const x = sunX - Math.cos(diagonal) * axisLength * distance;
      const y = flareY - Math.sin(diagonal) * axisLength * distance;
      const ghostRadius = radius * size;
      const ghost = context.createRadialGradient(x, y, 0, x, y, ghostRadius);
      ghost.addColorStop(0, `rgba(255, 244, 189, ${opacity})`);
      ghost.addColorStop(.24, `rgba(255, 205, 92, ${opacity * .85})`);
      ghost.addColorStop(.6, `rgba(235, 116, 47, ${opacity * .45})`);
      ghost.addColorStop(.82, `rgba(207, 81, 95, ${opacity * .2})`);
      ghost.addColorStop(1, 'rgba(207, 81, 95, 0)');
      context.fillStyle = ghost;
      context.fillRect(x - ghostRadius, y - ghostRadius, ghostRadius * 2, ghostRadius * 2);
    }
    context.restore();
  }

  return { resize, draw };
}
