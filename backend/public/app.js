import { initCrypto, encryptText, decryptText } from "./crypto.js";

let currentUser = null;

function debug(msg) {
  console.log("[APP]", msg);
}

window.register = async () => {
  debug("Register clicked");

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  debug("Register response: " + JSON.stringify(data));

  if (data.ok) {
    currentUser = username;
    await initCrypto(password);
    alert("Registered!");
    showLoggedInUI();
  }
};

window.login = async () => {
  debug("Login clicked");

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  debug("Login response: " + JSON.stringify(data));

  if (data.ok) {
    currentUser = username;
    await initCrypto(password);
    alert("Logged in!");
    showLoggedInUI();
  }
};

window.saveEntry = async () => {
  debug("Save journal clicked");

  if (!currentUser) {
    alert("Not logged in");
    return;
  }

  const text = document.getElementById("entry").value;
  const journal = document.getElementById("journalSelect").value || "default";

  debug("Encrypting journal text");
  const encrypted = await encryptText(text);

  debug("Sending to backend");
  const res = await fetch("/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted, journal, username: currentUser }),
  });

  const data = await res.json();
  debug("Save response: " + JSON.stringify(data));

  alert("Journal saved!");
};

window.createJournal = async () => {
  debug("Create journal clicked");

  const journalName = document.getElementById("newJournal").value;
  if (!journalName) {
    alert("Enter journal name");
    return;
  }

  const res = await fetch("/createJournal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ journalName, username: currentUser }),
  });

  const data = await res.json();
  debug("Create journal response: " + JSON.stringify(data));

  if (data.ok) {
    alert("Journal created!");
    await loadJournals();
  } else {
    alert(data.error || "Failed to create journal");
  }
};

window.analyze = async () => {
  debug("Analyze clicked");

  const text = document.getElementById("entry").value;
  if (!text) {
    alert("Write something first");
    return;
  }

  const res = await fetch("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const data = await res.json();
  debug("Analyze response: " + JSON.stringify(data));

  if (data.feedback) {
    document.getElementById("output").innerText = data.feedback;
  }
};

window.loadEntries = async () => {
  debug("Load entries clicked");

  const journal = document.getElementById("journalSelect").value;
  if (!journal) {
    alert("Select a journal first");
    return;
  }

  const res = await fetch("/loadEntries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser, journal }),
  });

  const data = await res.json();
  debug("Load entries response: " + JSON.stringify(data));

  const list = document.getElementById("entries-list");
  list.innerHTML = "";

  if (data.entries && data.entries.length > 0) {
    for (const entry of data.entries) {
      try {
        const decrypted = await decryptText(entry.encrypted);
        const div = document.createElement("div");
        div.className = "entry";
        div.innerHTML = `<strong>${new Date(entry.date).toLocaleString()}</strong><br>${decrypted}`;
        list.appendChild(div);
      } catch (e) {
        debug("Failed to decrypt entry: " + e);
      }
    }
  } else {
    list.innerHTML = "<p>No entries found.</p>";
  }
};

async function loadJournals() {
  const res = await fetch("/journals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser }),
  });
  const data = await res.json();

  const select = document.getElementById("journalSelect");
  select.innerHTML = "";
  data.journals.forEach(j => {
    const option = document.createElement("option");
    option.value = j;
    option.text = j;
    select.appendChild(option);
  });
}

function showLoggedInUI() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("journal-section").style.display = "block";
  document.getElementById("entry-section").style.display = "block";
  document.getElementById("user-info").style.display = "block";
  document.getElementById("current-user").innerText = currentUser;
  loadJournals();
}

window.logout = () => {
  currentUser = null;
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("journal-section").style.display = "none";
  document.getElementById("entry-section").style.display = "none";
  document.getElementById("user-info").style.display = "none";
  document.getElementById("output").innerText = "";
  document.getElementById("entry").value = "";
  document.getElementById("newJournal").value = "";
  document.getElementById("entries-list").innerHTML = "";
};
