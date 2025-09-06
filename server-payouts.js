const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database
const db = new sqlite3.Database("./database.sqlite");
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, country TEXT, identity_number TEXT, selfie TEXT, account_number TEXT)"
  );
});

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 10 * 365 * 24 * 60 * 60 * 1000 } // 10 years
  })
);
app.use(express.static("public"));

// File upload for selfies
const upload = multer({ dest: "uploads/" });

// Transporter (Email setup)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Routes
app.get("/", (req, res) => res.sendFile(__dirname + "/login.html"));
app.get("/signup", (req, res) => res.sendFile(__dirname + "/signup.html"));
app.get("/dashboard", (req, res) => res.sendFile(__dirname + "/dashboard.html"));
app.get("/va_request", (req, res) => res.sendFile(__dirname + "/va_request.html"));

// Signup
app.post("/signup", (req, res) => {
  const { name, email, password, country } = req.body;
  db.run(
    "INSERT INTO users (name, email, password, country) VALUES (?, ?, ?, ?)",
    [name, email, password, country],
    (err) => {
      if (err) {
        return res.send("Error: " + err.message);
      }
      res.redirect("/");
    }
  );
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, row) => {
      if (row) {
        req.session.user = row;
        res.redirect("/dashboard");
      } else {
        res.send("Invalid credentials!");
      }
    }
  );
});

// Request account number (BVN + Selfie + Identity)
app.post("/va_request", upload.single("selfie"), (req, res) => {
  if (!req.session.user) return res.redirect("/");
  const user = req.session.user;
  const { identity_number } = req.body;
  const account_number = "SD" + Math.floor(100000000 + Math.random() * 900000000);

  db.run(
    "UPDATE users SET identity_number=?, selfie=?, account_number=? WHERE id=?",
    [identity_number, req.file.filename, account_number, user.id],
    (err) => {
      if (err) return res.send("Error saving details.");
      res.send(`Account created: ${account_number}`);
    }
  );
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
