// api/config/db.js
const mysql = require('mysql2');

// MySQL 연결 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Promise 기반으로 사용
const promisePool = pool.promise();

// 연결 테스트
pool.getConnection((err, connection) => {
  if (err) {
    console.error('MySQL 연결 실패:', err.message);
    return;
  }
  console.log('MySQL 연결 성공');
  connection.release();
});


module.exports = promisePool;