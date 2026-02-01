import { initCrypto, encryptText, decryptText } from "./crypto.js";

let currentUser;
let mediaRecorder, audioChunks = [];

/* ---------- AUTH ---------- */
window.register = async () => {
  const u = document.getElementById("username").value, p = document.getElementById("password").value;
  const r = await fetch("/register", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ username:u, password:p }) });
  const data = await r.json();
  if (data.ok) {
    currentUser = u;
    await initCrypto(p);
    showUI();
  } else {
    alert(data.error || "Registration failed");
  }
};

window.login = async () => {
  const u = document.getElementById("username").value, p = document.getElementById("password").value;
  const r = await fetch("/login", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ username:u, password:p }) });
  const data = await r.json();
  if (data.ok) {
    currentUser = u;
    await initCrypto(p);
    showUI();
  } else {
    alert("Login failed");
  }
};

/* ---------- TEXT ---------- */
window.saveEntry = async () => {
  const encrypted = await encryptText(document.getElementById("entry").value);
  await fetch("/save", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ username:currentUser, journal:document.getElementById("journalSelect").value, encrypted })
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
      journal: document.getElementById("journalSelect").value,
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
          journal: document.getElementById("journalSelect").value,
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
