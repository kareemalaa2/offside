// Presentation: DOM primitives (modal sheet, toast, sound, share/download).
import { ui } from './context.js';
import { applyReadOnly } from './permissions.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const val = (id) => ($('#' + id)?.value ?? '');

let toastTimer;
export function toast(text) {
  const e = $('#toast');
  e.textContent = text;
  e.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove('on'), 3500);
}

export function openModal(html, { focus } = {}) {
  const m = $('#m');
  m.innerHTML = `<div class="mb" role="dialog" aria-modal="true">${html}</div>`;
  applyReadOnly(m);
  m.classList.add('on');
  document.body.classList.add('locked');
  ui.modalOpen = true;
  if (focus) setTimeout(() => $('#' + focus)?.focus(), 60);
}

export function setModalBody(html) {
  const mb = $('#m .mb');
  if (mb) {
    mb.innerHTML = html;
    applyReadOnly(mb);
  }
}

export function hideModal() {
  const m = $('#m');
  m.classList.remove('on');
  m.innerHTML = '';
  document.body.classList.remove('locked');
  ui.modalOpen = false;
  ui.liveInvoiceId = null;
}

/* ---- sound: one shared AudioContext, unlocked on first touch (required on iOS) ---- */
let audio;
export function unlockAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    /* no audio */
  }
}
export function beep() {
  try {
    unlockAudio();
    const o = audio.createOscillator();
    o.connect(audio.destination);
    o.frequency.value = 880;
    o.start();
    o.stop(audio.currentTime + 0.5);
  } catch {
    /* ignore */
  }
  navigator.vibrate?.([200, 100, 200]);
}

/* ---- share / save helpers (native share sheet on phones, download on desktop) ---- */
export async function shareText(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  await copyText(text);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('تم النسخ');
  } catch {
    toast('تعذر النسخ');
  }
}

export async function saveFile(name, text, mime = 'application/json') {
  const file = new File([text], name, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
