const mysql = require('mysql2');

const db_conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "dr_prj"
});

db_conn.connect((err) => {
    if (err) {
        console.log("DB ERROR:", err);
    } else {
        console.log("Database Connected");
    }
});

module.exports = db_conn;