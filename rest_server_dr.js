require("dotenv").config();

const express = require("express");
const app = express();

const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { Pool } = require("pg");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ================= DATABASE =================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err) => {
  if (err) {
    console.log("❌ Database connection failed:", err);
  } else {
    console.log("✅ PostgreSQL Connected");
  }
});

// ================= MIDDLEWARE =================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// ================= IMAGE FOLDER =================

if (!fs.existsSync("image")) {
  fs.mkdirSync("image");
}

app.use("/uploads", express.static("image"));

// ================= MULTER =================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "image/");
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ================= TEST ROUTE =================

app.get("/", (req, res) => {
  res.send("Backend running with PostgreSQL ✅");
});

// ================= INIT DATABASE =================

app.get("/init-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dr_category (
        id SERIAL PRIMARY KEY,
        cat_name TEXT,
        catimage TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dr_details (
        id SERIAL PRIMARY KEY,
        dr_name TEXT,
        dr_catid INTEGER,
        dr_image TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT
      )
    `);

    res.send("✅ Tables created successfully");
  } catch (err) {
    console.log(err);
    res.send(err.message);
  }
});

// ================= CATEGORY LIST =================

app.get("/list_dr_category", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, cat_name, catimage FROM dr_category"
    );

    const data = result.rows.map((item) => ({
      id: item.id,
      catname: item.cat_name,
      catimage: item.catimage,
    }));

    res.send({
      msg: "ok",
      result: data,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ msg: "error" });
  }
});

// ================= ADD CATEGORY =================

app.post("/addCategorySubmit", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.send({ error: "Image required" });
    }

    const imagePath = "/uploads/" + req.file.filename;

    const result = await pool.query(
      "INSERT INTO dr_category (cat_name, catimage) VALUES ($1, $2) RETURNING id",
      [req.body.catname, imagePath]
    );

    res.send({
      msg: "ok",
      id: result.rows[0].id,
    });
  } catch (err) {
    res.send({ error: err.message });
  }
});

// ================= DELETE CATEGORY =================

app.delete("/deleteCategory/:id", async (req, res) => {
  try {
    const id = req.params.id;

    await pool.query(
      "DELETE FROM dr_details WHERE dr_catid=$1",
      [id]
    );

    await pool.query(
      "DELETE FROM dr_category WHERE id=$1",
      [id]
    );

    res.send({
      msg: "Category deleted",
    });
  } catch (err) {
    res.send({ error: err.message });
  }
});

// ================= ALL DOCTORS LIST =================

app.get("/alldoctorslist", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, c.cat_name AS catname
      FROM dr_details d
      LEFT JOIN dr_category c ON c.id = d.dr_catid
    `);

    res.send({
      msg: "ok",
      result: result.rows,
    });
  } catch (err) {
    console.log(err);
    res.send({ msg: "error" });
  }
});

// ================= ADD DOCTOR =================

app.post("/addDoctor", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.send({ error: "Image required" });
    }

    const imagePath = "/uploads/" + req.file.filename;

    const { dr_name, dr_catid } = req.body;

    const result = await pool.query(
      "INSERT INTO dr_details (dr_name, dr_catid, dr_image) VALUES ($1, $2, $3) RETURNING id",
      [dr_name, dr_catid, imagePath]
    );

    res.send({
      msg: "Doctor added",
      id: result.rows[0].id,
    });
  } catch (err) {
    res.send({ error: err.message });
  }
});

// ================= DELETE DOCTOR =================

app.delete("/deleteDoctor/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM dr_details WHERE id=$1 RETURNING *",
      [req.params.id]
    );

    res.send({
      msg: "Doctor deleted",
      result: result.rows,
    });
  } catch (err) {
    res.send({ error: err.message });
  }
});

// ================= REGISTER =================

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.send({
        error: "All fields required",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashedPassword]
    );

    res.send({
      msg: "Registered successfully",
    });
  } catch (err) {
    res.send({
      error: err.message,
    });
  }
});

// ================= LOGIN =================

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.send({
        error: "User not found",
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.send({
        error: "Invalid password",
      });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || "secretkey"
    );

    res.send({
      msg: "Login success",
      token,
      user,
    });
  } catch (err) {
    res.send({
      error: "Server error",
    });
  }
});

// ================= SERVER =================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});