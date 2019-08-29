
const mysql = require('mysql');

require('dotenv').config();

//console.log(dotenv);

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

db.connect((err, args) => {
    if (!err) {
        console.log('SQL Conectado com sucesso!');
        console.log(args);
    } else {
        console.log('Erro ao conectar SQL: ', JSON.stringify(err));
    }
});

module.exports = db;