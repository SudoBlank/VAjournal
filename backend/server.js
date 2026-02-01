import express from "express";
import crypto from "crypto";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const DB_PATH = process.env.RENDER
  ? "/var/data/db.sqlite"
  : "./db.sqlite";

function debug(step, msg = "") {
  console.log(`[SERVER][${step}]`, msg);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error(err);
  else debug("DB", "Opened at " + DB_PATH);
});

/* ---------- DB ---------- */
db.serialize(() => {
  debug("DB", "Ensuring tables");

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    passwordHash TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS journals (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    name TEXT,
    UNIQUE(user_id, name)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    journal_id INTEGER,
    date INTEGER,
    encrypted TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS drawings (
    id INTEGER PRIMARY KEY,
    journal_id INTEGER,
    date INTEGER,
    image TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audio_entries (
    id INTEGER PRIMARY KEY,
    journal_id INTEGER,
    date INTEGER,
    audio TEXT
  )`);
});

/* ---------- AUTH ---------- */
app.post("/register", (req, res) => {
  debug("REGISTER", "Request");

  const { username, password } = req.body;
  const hash = crypto.createHash("sha256").update(password).digest("hex");

  db.run(
    "INSERT INTO users (username, passwordHash) VALUES (?, ?)",
    [username, hash],
    function (err) {
      if (err) {
        debug("REGISTER", err.message);
        return res.json({ ok: false });
      }

      db.run(
        "INSERT INTO journals (user_id, name) VALUES (?, ?)",
        [this.lastID, "default"]
      );

      res.json({ ok: true });
    }
  );
});

app.post("/login", (req, res) => {
  debug("LOGIN", "Request");

  const { username, password } = req.body;
  const hash = crypto.createHash("sha256").update(password).digest("hex");

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, row) => {
      if (!row || row.passwordHash !== hash)
        return res.json({ ok: false });

      res.json({ ok: true });
    }
  );
});

/* ---------- JOURNALS ---------- */
app.post("/journals", (req, res) => {
  const { username } = req.body;

  db.all(
    `SELECT j.name FROM journals j
     JOIN users u ON j.user_id = u.id
     WHERE u.username = ?`,
    [username],
    (_, rows) => res.json({ journals: rows.map(r => r.name) })
  );
});

app.post("/createJournal", (req, res) => {
  const { username, journalName } = req.body;

  db.get(
    "SELECT id FROM users WHERE username = ?",
    [username],
    (_, user) => {
      db.run(
        "INSERT INTO journals (user_id, name) VALUES (?, ?)",
        [user.id, journalName],
        (err) => {
          if (err) return res.json({ ok: false });
          res.json({ ok: true });
        }
      );
    }
  );
});

/* ---------- TEXT ---------- */
app.post("/save", (req, res) => {
  debug("SAVE_TEXT", "Request");

  const { username, journal, encrypted } = req.body;

  db.get(
    `SELECT j.id FROM journals j
     JOIN users u ON j.user_id = u.id
     WHERE u.username = ? AND j.name = ?`,
    [username, journal],
    (_, row) => {
      db.run(
        "INSERT INTO entries VALUES (NULL, ?, ?, ?)",
        [row.id, Date.now(), JSON.stringify(encrypted)],
        () => res.json({ ok: true })
      );
    }
  );
});

app.post("/loadEntries", (req, res) => {
  const { username, journal } = req.body;

  db.all(
    `SELECT date, encrypted FROM entries
     WHERE journal_id = (
       SELECT j.id FROM journals j
       JOIN users u ON j.user_id = u.id
       WHERE u.username = ? AND j.name = ?
     ) ORDER BY date DESC`,
    [username, journal],
    (_, rows) => res.json({ entries: rows.map(r => ({
      date: r.date,
      encrypted: JSON.parse(r.encrypted)
    })) })
  );
});

/* ---------- DRAWING ---------- */
app.post("/saveDrawing", (req, res) => {
  const { username, journal, image } = req.body;

  db.get(
    `SELECT j.id FROM journals j JOIN users u ON j.user_id=u.id
     WHERE u.username=? AND j.name=?`,
    [username, journal],
    (_, row) => {
      db.run(
        "INSERT INTO drawings VALUES (NULL, ?, ?, ?)",
        [row.id, Date.now(), image],
        () => res.json({ ok: true })
      );
    }
  );
});

/* ---------- AUDIO ---------- */
app.post("/saveAudio", (req, res) => {
  const { username, journal, audio } = req.body;
  db.get(
    `SELECT j.id FROM journals j JOIN users u ON j.user_id=u.id
     WHERE u.username=? AND j.name=?`,
    [username, journal],
    (_, row) => {
      db.run(
        "INSERT INTO audio_entries VALUES (NULL, ?, ?, ?)",
        [row.id, Date.now(), audio],
        () => res.json({ ok: true })
      );
    }
  );
});
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Running on port ${PORT}`);
});

/* ---------- ANALYZE ---------- */
app.post("/analyze", (_, res) => {
  res.json({ feedback: "Analysis coming soon 👀" });
});

app.listen(process.env.PORT || 3000, () =>
  debug("BOOT", "Server running")
);
