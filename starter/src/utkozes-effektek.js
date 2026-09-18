// Kizárólag visszajelzés: az ütközések fizikáját és a kör óráját nem módosítja.
export function utkozesEffektek() {
  let szikrak = [], hullamok = [], razas = 0, ido = 0, utolso = -1;
  let hang = null, nemitva = false;
  const kevesMozgas = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gomb = document.createElement('button');
  gomb.type = 'button';
  gomb.textContent = '🔊 Hang bekapcsolása';
  gomb.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:10;padding:8px 12px;background:#202633;color:#fff;border:1px solid #657089;border-radius:8px;cursor:pointer';
  document.body.append(gomb);

  async function hangIndit() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { gomb.textContent = 'Hang nem elérhető'; return; }
      hang ??= new Audio();
      if (hang.state === 'suspended') await hang.resume();
      gomb.textContent = hang.state === 'running'
        ? (nemitva ? '🔇 Hang bekapcsolása' : '🔊 Némítás') : '🔊 Hang bekapcsolása';
    } catch { gomb.textContent = '🔊 Hang újrapróbálása'; }
  }
  // Az emulált gamepad-billentyű nem oldja fel a böngésző hangtiltását.
  document.addEventListener('keydown', (e) => { if (e.isTrusted && !e.repeat) void hangIndit(); });
  gomb.addEventListener('click', () => {
    if (hang?.state === 'running') nemitva = !nemitva;
    else nemitva = false;
    void hangIndit();
  });

  function puff(ero) {
    if (!hang || hang.state !== 'running' || nemitva || document.hidden) return;
    const t = hang.currentTime;
    const oszc = hang.createOscillator(), gain = hang.createGain();
    oszc.type = 'triangle';
    oszc.frequency.setValueAtTime(150 - ero * 45, t);
    oszc.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12 + ero * 0.16, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    oszc.connect(gain); gain.connect(hang.destination);
    oszc.onended = () => { oszc.disconnect(); gain.disconnect(); };
    oszc.start(t); oszc.stop(t + 0.21);
  }

  return {
    talalat(x, y, impulzus) {
      // Folyamatos összetolásnál se induljon minden képkockán új effekt.
      if (ido - utolso < 0.1) return;
      utolso = ido;
      const ero = Math.min(1, Math.max(0, (impulzus / 460 - 1) / 3.5));
      razas = Math.max(razas, 3 + ero * 7);
      const darab = Math.round(10 + ero * 22);
      for (let i = 0; i < darab; i++) {
        const szog = Math.random() * Math.PI * 2;
        const seb = (90 + Math.random() * 170) * (1 + ero);
        const elet = 0.2 + Math.random() * 0.25;
        szikrak.push({ x, y, vx: Math.cos(szog) * seb, vy: Math.sin(szog) * seb,
          elet, max: elet, szin: ['#fff4cf', '#ffc65c', '#ff874b'][i % 3] });
      }
      szikrak = szikrak.slice(-160);
      hullamok.push({ x, y, elet: 0.22, ero });
      hullamok = hullamok.slice(-4);
      puff(ero);
    },
    lepes(dt) {
      ido += dt;
      razas = Math.max(0, razas - 45 * dt);
      for (const p of szikrak) {
        p.elet -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.exp(-5 * dt); p.vy *= Math.exp(-5 * dt);
      }
      for (const h of hullamok) h.elet -= dt;
      szikrak = szikrak.filter(p => p.elet > 0);
      hullamok = hullamok.filter(h => h.elet > 0);
    },
    kamera(c) {
      if (!kevesMozgas.matches && razas > 0) {
        c.translate(Math.sin(ido * 153) * razas, Math.cos(ido * 187) * razas * 0.7);
      }
    },
    rajzol(c) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const h of hullamok) {
        const t = 1 - h.elet / 0.22;
        c.globalAlpha = (1 - t) * 0.7;
        c.strokeStyle = '#ffe3a3'; c.lineWidth = 3 * (1 - t) + 1;
        c.beginPath(); c.arc(h.x, h.y, 8 + t * (25 + h.ero * 35), 0, Math.PI * 2); c.stroke();
      }
      c.lineCap = 'round';
      for (const p of szikrak) {
        c.globalAlpha = p.elet / p.max;
        c.strokeStyle = p.szin; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); c.stroke();
      }
      c.restore();
    },
    torol() { szikrak = []; hullamok = []; razas = 0; utolso = -1; },
  };
}
