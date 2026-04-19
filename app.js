// ---- Quaternion Math ----
function eulerToQuat(rollDeg, pitchDeg, yawDeg) {
  const r = rollDeg * Math.PI / 180;
  const p = pitchDeg * Math.PI / 180;
  const y = yawDeg * Math.PI / 180;
  const cr = Math.cos(r / 2), sr = Math.sin(r / 2);
  const cp = Math.cos(p / 2), sp = Math.sin(p / 2);
  const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy
  };
}

function quatToMatrix(q) {
  const { w, x, y, z } = q;
  return new Float32Array([
    1 - 2*(y*y + z*z), 2*(x*y + w*z),     2*(x*z - w*y),     0,
    2*(x*y - w*z),     1 - 2*(x*x + z*z), 2*(y*z + w*x),     0,
    2*(x*z + w*y),     2*(y*z - w*x),     1 - 2*(x*x + y*y), 0,
    0, 0, 0, 1
  ]);
}

function quatToAxisAngle(q) {
  let angle = 2 * Math.acos(Math.min(1, Math.max(-1, q.w)));
  const s = Math.sqrt(1 - q.w * q.w);
  let ax = 0, ay = 0, az = 1;
  if (s > 0.001) { ax = q.x / s; ay = q.y / s; az = q.z / s; }
  return { ax, ay, az, angle: angle * 180 / Math.PI };
}

// ---- WebGL Setup ----
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl');

const vsrc = `
attribute vec3 aPos;
attribute vec3 aCol;
uniform mat4 uModel;
uniform mat4 uProj;
varying vec3 vCol;
void main() {
  gl_Position = uProj * uModel * vec4(aPos, 1.0);
  vCol = aCol;
}`;

const fsrc = `
precision mediump float;
varying vec3 vCol;
void main() { gl_FragColor = vec4(vCol, 1.0); }`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsrc));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsrc));
gl.linkProgram(prog);
gl.useProgram(prog);

const aPos = gl.getAttribLocation(prog, 'aPos');
const aCol = gl.getAttribLocation(prog, 'aCol');
const uModel = gl.getUniformLocation(prog, 'uModel');
const uProj = gl.getUniformLocation(prog, 'uProj');

// ---- Geometry: colored axes + airplane-like shape ----
function buildGeometry() {
  const v = [];
  const c = [];

  // Axes (thick lines via triangles)
  function addLine(x1,y1,z1, x2,y2,z2, r,g,b) {
    v.push(x1,y1,z1, x2,y2,z2);
    c.push(r,g,b, r,g,b);
  }
  // X axis red, Y green, Z blue
  addLine(0,0,0, 1.5,0,0, 1,0.2,0.2);
  addLine(0,0,0, 0,1.5,0, 0.2,1,0.2);
  addLine(0,0,0, 0,0,1.5, 0.2,0.2,1);

  // Body (fuselage along +X)
  function tri(p1,p2,p3, col) {
    v.push(...p1,...p2,...p3);
    c.push(...col,...col,...col);
  }
  const nose = [1.2, 0, 0];
  const tail = [-0.8, 0, 0];
  const top = [0, 0.15, 0];
  const bot = [0, -0.15, 0];
  const left = [0, 0, 0.15];
  const right = [0, 0, -0.15];

  const cBody = [0.9, 0.3, 0.3];
  const cWing = [0.3, 0.5, 0.9];
  const cTail = [0.3, 0.9, 0.5];

  // Fuselage triangles
  tri(nose, top, left, cBody);
  tri(nose, left, bot, cBody);
  tri(nose, bot, right, cBody);
  tri(nose, right, top, cBody);
  tri(tail, left, top, [0.6,0.2,0.2]);
  tri(tail, bot, left, [0.6,0.2,0.2]);
  tri(tail, right, bot, [0.6,0.2,0.2]);
  tri(tail, top, right, [0.6,0.2,0.2]);

  // Wings (along Z)
  tri([0.2,0,0], [-0.2,0,0], [0,0,0.9], cWing);
  tri([0.2,0,0], [-0.2,0,0], [0,0,-0.9], cWing);

  // Tail fin (vertical)
  tri([-0.6,0,0], [-0.8,0,0], [-0.7,0.5,0], cTail);

  return {
    verts: new Float32Array(v),
    colors: new Float32Array(c),
    lineCount: 3,
    triCount: (v.length / 3 - 6) / 3
  };
}

const geo = buildGeometry();

const vBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
gl.bufferData(gl.ARRAY_BUFFER, geo.verts, gl.STATIC_DRAW);
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

const cBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
gl.bufferData(gl.ARRAY_BUFFER, geo.colors, gl.STATIC_DRAW);
gl.enableVertexAttribArray(aCol);
gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);

gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.06, 0.06, 0.12, 1);

// Simple perspective
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  return new Float32Array([
    f/aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far+near)/(near-far), -1,
    0, 0, 2*far*near/(near-far), 0
  ]);
}

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// ---- UI ----
const rollEl = document.getElementById('roll');
const pitchEl = document.getElementById('pitch');
const yawEl = document.getElementById('yaw');

// ---- 2D Quaternion Circle (w-z plane) ----
const circleCanvas = document.getElementById('circle-canvas');
const ctx = circleCanvas.getContext('2d');
let demoTrail = []; // [{w, z, deg}]

function resizeCircle() {
  circleCanvas.width = circleCanvas.clientWidth * devicePixelRatio;
  circleCanvas.height = circleCanvas.clientHeight * devicePixelRatio;
}
window.addEventListener('resize', resizeCircle);
resizeCircle();

function drawCircle(q, currentDeg) {
  const W = circleCanvas.width, H = circleCanvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.38;
  const dpr = devicePixelRatio;

  ctx.clearRect(0, 0, W, H);

  // Unit circle
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();

  // Axis labels
  ctx.font = `${11 * dpr}px monospace`;
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText('w=1', cx + R + 20 * dpr, cy + 4 * dpr);
  ctx.fillText('w=-1', cx - R - 22 * dpr, cy + 4 * dpr);
  ctx.fillText('z=1', cx, cy - R - 8 * dpr);
  ctx.fillText('z=-1', cx, cy + R + 14 * dpr);

  // Cross-hair
  ctx.beginPath();
  ctx.moveTo(cx - R - 5*dpr, cy); ctx.lineTo(cx + R + 5*dpr, cy);
  ctx.moveTo(cx, cy - R - 5*dpr); ctx.lineTo(cx, cy + R + 5*dpr);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();

  // Milestone markers on circle: 0°, 360°, 720°
  const milestones = [
    { deg: 0, label: '0°', col: '#4ecca3' },
    { deg: 360, label: '360°', col: '#e94560' },
  ];
  for (const m of milestones) {
    const a = (m.deg / 2) * Math.PI / 180;
    const mx = cx + R * Math.cos(a);
    const my = cy - R * Math.sin(a);
    ctx.beginPath();
    ctx.arc(mx, my, 5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = m.col;
    ctx.fill();
    ctx.fillStyle = m.col;
    ctx.font = `bold ${10 * dpr}px monospace`;
    ctx.fillText(m.label, mx + 10 * dpr, my - 8 * dpr);
  }

  // Draw trail
  if (demoTrail.length > 1) {
    for (let i = 1; i < demoTrail.length; i++) {
      const p0 = demoTrail[i - 1], p1 = demoTrail[i];
      const x0 = cx + p0.w * R, y0 = cy - p0.z * R;
      const x1 = cx + p1.w * R, y1 = cy - p1.z * R;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      // First 360° = cyan, second 360° = magenta
      if (p1.deg <= 360) {
        ctx.strokeStyle = '#4ecca3';
      } else {
        ctx.strokeStyle = '#e94560';
      }
      ctx.lineWidth = 2.5 * dpr;
      ctx.stroke();
    }
  }

  // Current point
  const px = cx + q.w * R;
  const py = cy - q.z * R;
  ctx.beginPath();
  ctx.arc(px, py, 7 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py, 4 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = (currentDeg !== undefined && currentDeg > 360) ? '#e94560' : '#4ecca3';
  ctx.fill();

  // Label current
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${10 * dpr}px monospace`;
  ctx.fillText(`(w=${q.w.toFixed(2)}, z=${q.z.toFixed(2)})`, px + 10*dpr, py + 14*dpr);
}

// ---- 720° Demo Animation ----
let demoRunning = false;
let demoAngle = 0;
const demoBtn = document.getElementById('demo-btn');
const demoInfo = document.getElementById('demo-info');

demoBtn.addEventListener('click', () => {
  if (demoRunning) return;
  demoRunning = true;
  demoAngle = 0;
  demoTrail = [];
  demoBtn.disabled = true;
  demoBtn.textContent = '⟳ Animating...';
  rollEl.value = 0;
  pitchEl.value = 0;
  animateDemo();
});

function animateDemo() {
  if (demoAngle > 720) {
    demoRunning = false;
    demoBtn.disabled = false;
    demoBtn.textContent = '▶ Restart 720° Rotation';
    demoInfo.innerHTML = `<span class="green">720° ပြည့်ပြီ!</span> Quaternion ပြန်ရောက် → q=(1,0,0,0)<br>
      <span class="highlight">360° မှာ q=(-1,0,0,0) — identity မဟုတ်သေးဘူး!</span>`;
    return;
  }

  // Update yaw slider (wrap to -180..180 display only)
  const displayYaw = ((demoAngle % 360) > 180) ? (demoAngle % 360) - 360 : (demoAngle % 360);
  yawEl.value = displayYaw;

  // Compute quaternion directly for demo (yaw only around Z)
  const halfRad = (demoAngle / 2) * Math.PI / 180;
  const q = { w: Math.cos(halfRad), x: 0, y: 0, z: Math.sin(halfRad) };

  // Trail
  demoTrail.push({ w: q.w, z: q.z, deg: demoAngle });

  // Status messages
  if (demoAngle < 360) {
    const pct = (demoAngle / 360 * 100).toFixed(0);
    demoInfo.innerHTML = `<span class="green">First 360°</span>: ${demoAngle.toFixed(0)}° (${pct}%)<br>q = (${q.w.toFixed(3)}, 0, 0, ${q.z.toFixed(3)})`;
  } else if (Math.abs(demoAngle - 360) < 3) {
    demoInfo.innerHTML = `<span class="highlight">360° ရောက်ပြီ!</span> q = (-1, 0, 0, 0)<br>Identity (1,0,0,0) မဟုတ်သေးဘူး! → ဆက်လည်ရမယ်`;
  } else {
    const pct = ((demoAngle - 360) / 360 * 100).toFixed(0);
    demoInfo.innerHTML = `<span class="highlight">Second 360°</span>: ${demoAngle.toFixed(0)}° (${pct}%)<br>q = (${q.w.toFixed(3)}, 0, 0, ${q.z.toFixed(3)})`;
  }

  updateDisplay(q, demoAngle);
  drawCircle(q, demoAngle);

  demoAngle += 2;
  requestAnimationFrame(animateDemo);
}

function updateDisplay(q, currentDeg) {
  document.getElementById('qw').textContent = q.w.toFixed(4);
  document.getElementById('qx').textContent = q.x.toFixed(4);
  document.getElementById('qy').textContent = q.y.toFixed(4);
  document.getElementById('qz').textContent = q.z.toFixed(4);

  const aa = quatToAxisAngle(q);
  document.getElementById('axis').textContent = `(${aa.ax.toFixed(3)}, ${aa.ay.toFixed(3)}, ${aa.az.toFixed(3)})`;
  document.getElementById('angle').textContent = aa.angle.toFixed(1) + '°';

  const roll = +rollEl.value, pitch = +pitchEl.value, yaw = +yawEl.value;
  document.getElementById('roll-val').textContent = roll + '°';
  document.getElementById('pitch-val').textContent = pitch + '°';
  document.getElementById('yaw-val').textContent = (currentDeg !== undefined ? currentDeg.toFixed(0) : yaw) + '°';

  const rot = quatToMatrix(q);
  rot[14] = -4;
  const proj = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(uModel, false, rot);
  gl.uniformMatrix4fv(uProj, false, proj);
  gl.drawArrays(gl.LINES, 0, 6);
  gl.drawArrays(gl.TRIANGLES, 6, geo.triCount * 3);
}

function update() {
  const roll = +rollEl.value, pitch = +pitchEl.value, yaw = +yawEl.value;
  const q = eulerToQuat(roll, pitch, yaw);
  updateDisplay(q);
  if (!demoRunning) {
    drawCircle(q);
    demoTrail = [];
  }
  requestAnimationFrame(update);
}

rollEl.addEventListener('input', () => {});
pitchEl.addEventListener('input', () => {});
yawEl.addEventListener('input', () => {});

update();
