import express from "express";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static("public"));

const db = new sqlite3.Database('./db.sqlite');

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    passwordHash TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, name)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_id INTEGER,
    date INTEGER,
    encrypted TEXT,
    FOREIGN KEY (journal_id) REFERENCES journals (id)
  )`);
});

const PORT = process.env.PORT || 3000;

function debug(msg) {
  console.log("[SERVER]", msg);
}

app.post("/register", (req, res) => {
  debug("Register request");

  const { username, password } = req.body;
  const hash = crypto.createHash("sha256").update(password).digest("hex");

  db.run("INSERT INTO users (username, passwordHash) VALUES (?, ?)", [username, hash], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.json({ ok: false, error: "User exists" });
      }
      debug("Register error: " + err);
      return res.json({ ok: false, error: "Database error" });
    }

    const userId = this.lastID;
    // Create default journal
    db.run("INSERT INTO journals (user_id, name) VALUES (?, ?)", [userId, "default"], (err2) => {
      if (err2) {
        debug("Create default journal error: " + err2);
      }
      res.json({ ok: true });
    });
  });
});

app.post("/login", (req, res) => {
  debug("Login request");

  const { username, password } = req.body;
  const hash = crypto.createHash("sha256").update(password).digest("hex");

  db.get("SELECT id, passwordHash FROM users WHERE username = ?", [username], (err, row) => {
    if (err) {
      debug("Login error: " + err);
      return res.json({ ok: false });
    }

    if (!row || row.passwordHash !== hash) {
      return res.json({ ok: false });
    }

    // Ensure default journal exists
    db.get("SELECT id FROM journals WHERE user_id = ? AND name = ?", [row.id, "default"], (err2, journalRow) => {
      if (err2) {
        debug("Check default journal error: " + err2);
        return res.json({ ok: true });
      }

      if (!journalRow) {
        db.run("INSERT INTO journals (user_id, name) VALUES (?, ?)", [row.id, "default"], (err3) => {
          if (err3) {
            debug("Create default journal error: " + err3);
          }
        });
      }

      res.json({ ok: true });
    });
  });
});

app.post("/save", (req, res) => {
  debug("Save entry request");

  const { encrypted, journal = "default", username } = req.body;
  if (!encrypted || !username) {
    debug("No encrypted data or username received");
    return res.json({ ok: false });
  }

  // Get journal_id
  db.get("SELECT j.id FROM journals j JOIN users u ON j.user_id = u.id WHERE u.username = ? AND j.name = ?", [username, journal], (err, row) => {
    if (err) {
      debug("Save error: " + err);
      return res.json({ ok: false });
    }

    if (!row) {
      return res.json({ ok: false, error: "Journal not found" });
    }

    db.run("INSERT INTO entries (journal_id, date, encrypted) VALUES (?, ?, ?)", [row.id, Date.now(), JSON.stringify(encrypted)], (err2) => {
      if (err2) {
        debug("Insert entry error: " + err2);
        return res.json({ ok: false });
      }

      res.json({ ok: true });
    });
  });
});

app.post("/createJournal", (req, res) => {
  debug("Create journal request");

  const { journalName, username } = req.body;
  if (!username) {
    return res.json({ ok: false, error: "No username" });
  }

  db.get("SELECT id FROM users WHERE username = ?", [username], (err, userRow) => {
    if (err || !userRow) {
      debug("Create journal error: user not found");
      return res.json({ ok: false, error: "User not found" });
    }

    db.run("INSERT INTO journals (user_id, name) VALUES (?, ?)", [userRow.id, journalName], function(err2) {
      if (err2) {
        if (err2.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.json({ ok: false, error: "Journal exists" });
        }
        debug("Create journal error: " + err2);
        return res.json({ ok: false });
      }

      res.json({ ok: true });
    });
  });
});

app.post("/journals", (req, res) => {
  debug("Get journals request");

  const { username } = req.body;
  if (!username) {
    return res.json({ ok: false, error: "No username" });
  }

  db.all("SELECT j.name FROM journals j JOIN users u ON j.user_id = u.id WHERE u.username = ?", [username], (err, rows) => {
    if (err) {
      debug("Get journals error: " + err);
      return res.json({ journals: [] });
    }

    const journals = rows.map(row => row.name);
    res.json({ journals });
  });
});

app.post("/loadEntries", (req, res) => {
  debug("Load entries request");

  const { username, journal } = req.body;
  if (!username || !journal) {
    return res.json({ ok: false, error: "Missing username or journal" });
  }

  db.all("SELECT date, encrypted FROM entries WHERE journal_id = (SELECT j.id FROM journals j JOIN users u ON j.user_id = u.id WHERE u.username = ? AND j.name = ?) ORDER BY date DESC", [username, journal], (err, rows) => {
    if (err) {
      debug("Load entries error: " + err);
      return res.json({ entries: [] });
    }

    const entries = rows.map(row => ({
      date: row.date,
      encrypted: JSON.parse(row.encrypted)
    }));
    res.json({ entries });
  });
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Running on port ${PORT}`);
});

