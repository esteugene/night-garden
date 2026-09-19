// Adapted from Desktop Habitats, Copyright 2026 Chase Lean, MIT.
import * as THREE from "three";
import {noise,randomGenerator,vec} from "./math.js";
export function rockGeometry(seed, detail = 112) {
  const geometry = new THREE.SphereGeometry(
    1,
    detail,
    Math.floor(detail * 0.7),
  );
  const positions = geometry.attributes.position;
  const color = new THREE.Color();
  const colors = [];
  const planes = [];
  const sample = randomGenerator(Math.round(seed * 1000) + 27461);
  const pits = [];
  if (detail > 20)
    for (let i = 0; i < 115; i++) {
      const y = sample() * 2 - 1,
        a = sample() * Math.PI * 2,
        r = Math.sqrt(1 - y * y);
      const radius = 0.022 + sample() ** 2 * 0.18;
      pits.push({
        x: Math.cos(a) * r,
        y,
        z: Math.sin(a) * r,
        radius,
        depth: radius * (0.3 + sample() * 0.8),
      });
    }
  for (let i = 0; i < 15; i++) {
    const a = i * 2.399963 + seed,
      y = 1 - (2 * (i + 0.5)) / 15,
      r = Math.sqrt(1 - y * y);
    planes.push({
      normal: vec(Math.cos(a) * r, y, Math.sin(a) * r),
      distance: 0.76 + noise(i, seed, 4) * 0.35,
    });
  }
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const a = noise(x * 2.5 + seed, y * 2.5, z * 2.5);
    const b = noise(x * 7 + seed, y * 7, z * 7);
    const c = noise(x * 22 + seed, y * 22, z * 22);
    const strata = Math.pow(
      Math.abs(Math.sin(x * 3.2 + y * 9 + z * 2.7 + a * 6)),
      18,
    );
    let radius = 1.28;
    for (const plane of planes) {
      const dot = x * plane.normal.x + y * plane.normal.y + z * plane.normal.z;
      if (dot > 0) radius = Math.min(radius, plane.distance / dot);
    }
    radius +=
      (a - 0.5) * 0.1 + (b - 0.5) * 0.055 + (c - 0.5) * 0.023 - strata * 0.017;
    let depression = 0;
    let rim = 0;
    for (const pit of pits) {
      const d =
        Math.sqrt(
          (x - pit.x) ** 2 + ((y - pit.y) * 1.17) ** 2 + (z - pit.z) ** 2,
        ) / pit.radius;
      if (d < 1) depression += pit.depth * (1 - d * d) ** 0.65;
      else if (d < 1.2) rim += (1.2 - d) * 0.1;
    }
    radius -= Math.min(0.25, depression);
    positions.setXYZ(i, x * radius, y * radius, z * radius);
    color
      .setRGB(1, 0.985, 0.945)
      .multiplyScalar(
        (0.8 + 0.2 * a + rim) * (1 - Math.min(0.52, depression * 2.1)),
      );
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function branchGeometry(points, baseRadius, tipRadius, seed) {
  const curve = new THREE.CatmullRomCurve3(points);
  const length = curve.getLength();
  const rows = Math.ceil(length * 16),
    cols = 32;
  const positions = [],
    uv = [],
    indices = [],
    colors = [];
  const frames = curve.computeFrenetFrames(rows, false);
  const splitRandom = randomGenerator(Math.round(seed * 1000) + 51781);
  const splits = Array.from({ length: 14 }, () => ({
    a: splitRandom() * Math.PI * 2,
    t: splitRandom(),
    width: 0.025 + splitRandom() * 0.09,
    length: 0.025 + splitRandom() * 0.15,
    depth: 0.08 + splitRandom() * 0.32,
  }));
  for (let i = 0; i <= rows; i++) {
    const t = i / rows,
      p = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(
      baseRadius,
      tipRadius,
      Math.pow(t, 0.8),
    );
    for (let j = 0; j <= cols; j++) {
      const a = (j / cols) * Math.PI * 2;
      const ridges =
        0.077 * Math.sin(a * 9 + t * 12 + seed) +
        0.042 * Math.sin(a * 17 - t * 7) +
        0.022 * Math.sin(a * 31 + t * 33);
      const weather = noise(Math.cos(a) * 5 + seed, t * 30, Math.sin(a) * 5);
      const channel =
        Math.pow(0.5 + 0.5 * Math.sin(a * 13 + Math.sin(t * 15) * 0.25), 10) *
        0.07;
      const knot = 1 + 0.15 * Math.exp(-(((t - 0.47) / 0.08) ** 2));
      let splitDepth = 0;
      for (const split of splits) {
        const angle = a - split.a - 0.07 * Math.sin(t * 37 + seed);
        const around =
          Math.atan2(Math.sin(angle), Math.cos(angle)) / split.width;
        const along = (t - split.t) / split.length;
        const distance = around * around + along * along;
        if (distance < 1)
          splitDepth += split.depth * Math.pow(1 - distance, 0.6);
      }
      const r =
        radius *
        knot *
        (1 +
          ridges +
          (weather - 0.5) * 0.3 -
          channel -
          Math.min(0.65, splitDepth));
      const radial = frames.normals[i]
        .clone()
        .multiplyScalar(Math.cos(a))
        .addScaledVector(frames.binormals[i], Math.sin(a));
      const v = p.clone().addScaledVector(radial, r);
      positions.push(v.x, v.y, v.z);
      uv.push(j / cols, length * t * 0.32);
      const tint =
        (0.7 + weather * 0.27 + ridges * 0.7 - channel) *
        (1 - Math.min(0.6, splitDepth * 1.5));
      colors.push(tint, tint * 0.97, tint * 0.92);
      if (i < rows && j < cols) {
        const k = i * (cols + 1) + j;
        indices.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1);
      }
    }
  }
  // Close the weathered tips; the narrower branches intersect inside their parent.
  for (const i of [0, rows]) {
    const p = curve.getPointAt(i / rows),
      k = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    uv.push(0.5, 0.5);
    colors.push(0.38, 0.32, 0.23);
    for (let j = 0; j < cols; j++) {
      if (i === 0) indices.push(k, j + 1, j);
      else indices.push(k, i * (cols + 1) + j, i * (cols + 1) + j + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

