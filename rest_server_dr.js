require("dotenv").config();

const express = require("express");
const app = express();

const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const mysql = require("mysql2");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ================= DATABASE =================

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

db.connect((err) => {
  if (err) {
    console.log("❌ Database connection failed:", err);
  } else {
    console.log("✅ MySQL Connected");
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
  res.send("Backend running with MySQL2 ✅");
});

// ================= INIT DATABASE =================

app.get("/init-db", (req, res) => {
  const categoryTable = `
    CREATE TABLE IF NOT EXISTS dr_category (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cat_name VARCHAR(255),
      catimage LONGTEXT
    )
  `;

  const doctorTable = `
    CREATE TABLE IF NOT EXISTS dr_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dr_name VARCHAR(255),
      dr_catid INT,
      dr_image LONGTEXT
    )
  `;

  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255)
    )
  `;

  db.query(categoryTable, (err) => {
    if (err) return res.send(err);

    db.query(doctorTable, (err) => {
      if (err) return res.send(err);

      db.query(usersTable, (err) => {
        if (err) return res.send(err);

        res.send("✅ Tables created successfully");
      });
    });
  });
});

// ================= CATEGORY LIST =================

app.get("/list_dr_category", (req, res) => {
  db.query(
    "SELECT id, cat_name, catimage FROM dr_category",
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send({ msg: "error" });
      }

      const data = result.map((item) => ({
        id: item.id,
        catname: item.cat_name,
        catimage: item.catimage,
      }));

      res.send({
        msg: "ok",
        result: data,
      });
    }
  );
});

// ================= ADD CATEGORY =================

app.post("/addCategorySubmit", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.send({ error: "Image required" });
    }

    const imagePath = "/uploads/" + req.file.filename;

    db.query(
      "INSERT INTO dr_category (cat_name, catimage) VALUES (?, ?)",
      [req.body.catname, imagePath],
      (err, result) => {
        if (err) {
          return res.send({ error: err.message });
        }

        res.send({
          msg: "ok",
          id: result.insertId,
        });
      }
    );
  } catch (err) {
    res.send({ error: err.message });
  }
});

// ================= DELETE CATEGORY =================

app.delete("/deleteCategory/:id", (req, res) => {
  const id = req.params.id;

  db.query(
    "DELETE FROM dr_details WHERE dr_catid=?",
    [id],
    (err) => {
      if (err) {
        return res.send({ error: err.message });
      }

      db.query(
        "DELETE FROM dr_category WHERE id=?",
        [id],
        (err2) => {
          if (err2) {
            return res.send({ error: err2.message });
          }

          res.send({
            msg: "Category deleted",
          });
        }
      );
    }
  );
});

// ================= ALL DOCTORS LIST =================

app.get("/alldoctorslist", (req, res) => {
  db.query(
    `SELECT d.*, c.cat_name AS catname
     FROM dr_details d
     LEFT JOIN dr_category c ON c.id = d.dr_catid`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res.send({ msg: "error" });
      }

      res.send({
        msg: "ok",
        result,
      });
    }
  );
});

// ================= ADD DOCTOR =================

app.post("/addDoctor", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.send({ error: "Image required" });
    }

    const imagePath = "/uploads/" + req.file.filename;

    const { dr_name, dr_catid } = req.body;

    db.query(
      "INSERT INTO dr_details (dr_name, dr_catid, dr_image) VALUES (?, ?, ?)",
      [dr_name, dr_catid, imagePath],
      (err, result) => {
        if (err) {
          return res.send({ error: err.message });
        }

        res.send({
          msg: "Doctor added",
          id: result.insertId,
        });
      }
    );
  } catch (err) {
    res.send({ error: err.message });
  }
});

// ================= DELETE DOCTOR =================

app.delete("/deleteDoctor/:id", (req, res) => {
  db.query(
    "DELETE FROM dr_details WHERE id=?",
    [req.params.id],
    (err, result) => {
      if (err) {
        return res.send({ error: err.message });
      }

      res.send({
        msg: "Doctor deleted",
        result,
      });
    }
  );
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

    db.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword],
      (err, result) => {
        if (err) {
          return res.send({
            error: err.message,
          });
        }

        res.send({
          msg: "Registered successfully",
        });
      }
    );
  } catch (err) {
    res.send({
      error: "Server error",
    });
  }
});

// ================= LOGIN =================

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    db.query(
      "SELECT * FROM users WHERE email=?",
      [email],
      async (err, result) => {
        if (err) {
          return res.send({
            error: err.message,
          });
        }

        if (result.length === 0) {
          return res.send({
            error: "User not found",
          });
        }

        const user = result[0];

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
      }
    );
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