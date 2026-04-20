const express = require("express");
const app = express();
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const mysql = require("mysql2");

// ================= DATABASE =================
const db_conn = mysql.createConnection({
  host: process.env.DB_HOST || "shinkansen.proxy.rlwy.net",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "hHvPJGKhyLeznWAFqcXdaejclEnsWptH",
  database: process.env.DB_NAME || "railway",
  port: process.env.DB_PORT || 13830,
});

db_conn.connect((err) => {
  if (err) {
    console.log("❌ DB Error:", err);
  } else {
    console.log("✅ Database Connected");
  }
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static("uploads"));

// ================= MULTER =================
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "image/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const imageUpload = multer({ storage: imageStorage });

// ================= ROUTES =================

// CATEGORY LIST
app.get("/list_dr_category", (req, res) => {
  db_conn.query(
    "SELECT id, cat_name, catimage FROM dr_category",
    (err, result) => {
      if (err) return res.status(500).send({ msg: "error" });

      const data = result.map((item) => ({
        id: item.id,
        catname: item.cat_name,
        catimage: item.catimage
          ? item.catimage.toString("base64")
          : null,
      }));

      res.send({ msg: "ok", result: data });
    }
  );
});

// DELETE CATEGORY
app.delete("/deleteCategory/:id", (req, res) => {
  const id = req.params.id;

  db_conn.query(
    "DELETE FROM dr_details WHERE dr_catid = ?",
    [id],
    (err) => {
      if (err) return res.send({ error: err.sqlMessage });

      db_conn.query(
        "DELETE FROM dr_category WHERE id = ?",
        [id],
        (err) => {
          if (err) return res.send({ error: err.sqlMessage });

          res.send({ msg: "Category deleted" });
        }
      );
    }
  );
});

// DELETE DOCTOR
app.delete("/deleteDoctor/:id", (req, res) => {
  db_conn.query(
    "DELETE FROM dr_details WHERE id = ?",
    [req.params.id],
    (err, result) => {
      if (err) return res.send({ error: err.sqlMessage });

      res.send({ msg: "Doctor deleted", result });
    }
  );
});

// ADD CATEGORY
app.post("/addCategorySubmit", imageUpload.single("image"), (req, res) => {
  if (!req.file) return res.send({ error: "Image required" });

  const img = fs.readFileSync(
    path.join(__dirname, "image", req.file.filename)
  );

  db_conn.query(
    "INSERT INTO dr_category (cat_name, catimage) VALUES (?, ?)",
    [req.body.catname, img],
    (err, result) => {
      if (err) return res.send({ error: err.sqlMessage });

      res.send({ msg: "ok", id: result.insertId });
    }
  );
});

// DOCTOR LIST
app.get("/alldoctorslist", (req, res) => {
  db_conn.query(
    `SELECT d.*, c.cat_name AS catname
     FROM dr_details d
     LEFT JOIN dr_category c ON c.id = d.dr_catid`,
    (err, result) => {
      if (err) return res.send({ msg: "error" });

      const data = result.map((item) => ({
        ...item,
        dr_image: item.dr_image
          ? item.dr_image.toString("base64")
          : null,
      }));

      res.send({ msg: "ok", result: data });
    }
  );
});

// REGISTER
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.send({ error: "All fields required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db_conn.query(
    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
    [name, email, hashedPassword],
    (err) => {
      if (err) return res.send({ error: "User exists" });

      res.send({ msg: "Registered" });
    }
  );
});

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db_conn.query(
    "SELECT * FROM users WHERE email=?",
    [email],
    async (err, result) => {
      if (result.length === 0)
        return res.send({ error: "User not found" });

      const user = result[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch)
        return res.send({ error: "Invalid password" });

      const token = jwt.sign({ id: user.id }, "secretkey");

      res.send({
        msg: "Login success",
        token,
        user,
      });
    }
  );
});

// ================= SERVER =================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});