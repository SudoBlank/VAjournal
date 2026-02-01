import { initCrypto, encryptText, decryptText } from "./crypto.js";

let currentUser;
let mediaRecorder, audioChunks = [];

/* ---------- AUTH ---------- */
window.register = async () => {
  const u = username.value, p = password.value;
  await fetch("/register", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ username:u, password:p }) });
  currentUser = u;
  await initCrypto(p);
  showUI();
};

window.login = async () => {
  const u = username.value, p = password.value;
  const r = await fetch("/login", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ username:u, password:p }) });
  if ((await r.json()).ok) {
    currentUser = u;
    await initCrypto(p);
    showUI();
  }
};

/* ---------- TEXT ---------- */
window.saveEntry = async () => {
  const encrypted = await encryptText(entry.value);
  await fetch("/save", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ username:currentUser, journal:journalSelect.value, encrypted })
  });
};

/* ---------- DRAW ---------- */
const canvas = document.getElementById("draw");
const ctx = canvas.getContext("2d");
let drawing = false;

canvas.onmousedown = () => drawing = true;
canvas.onmouseup = () => drawing = false;
canvas.onmousemove = e => {
  if (!drawing) return;
  ctx.fillRect(e.offsetX, e.offsetY, 4, 4);
};

window.saveDrawing = async () => {
  await fetch("/saveDrawing", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      username: currentUser,
      journal: journalSelect.value,
      image: canvas.toDataURL()
    })
  });
};

/* ---------- AUDIO ---------- */
window.startAudio = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.start();
};

window.stopAudio = async () => {
  mediaRecorder.stop();
  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks);
    const reader = new FileReader();
    reader.onload = async () => {
      await fetch("/saveAudio", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
          username: currentUser,
          journal: journalSelect.value,
          audio: reader.result
        })
      });
    };
    reader.readAsDataURL(blob);
  };
};

function showUI() {
  auth.style.display="none";
  app.style.display="block";
}
