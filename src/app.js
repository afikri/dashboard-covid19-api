const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors"); 
const app = express();
const port = 8000;

// Detik koneksi Database 
const db_config = {
  host: "localhost",
  user: "root",
  password: "",
  database: "js_dashboard_covid_dev",
};

// Fungsi untuk mengenerate integer acak antara min dan max 
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Fungsi untuk mengenerate tanggal acak antara start_date dan end_date 
function randomDate(start_date, end_date) {
  const start_timestamp = start_date.getTime();
  const end_timestamp = end_date.getTime();
  const random_timestamp = getRandomInt(start_timestamp, end_timestamp);
  return new Date(random_timestamp);
}


// Fungsi untuk mengenerate alphanumeric string acak
function generateRandomAlphanumeric(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function calculatePercentage() {
  try {
    const connection = await mysql.createConnection(db_config);

    // Fetch data dari database
    const [rows] = await connection.query(`
      SELECT jenis_vaksin, COUNT(*) AS count
      FROM covid19
      GROUP BY jenis_vaksin;
    `);

    connection.end(); 

    // Cek jika row tidak kosong
    if (rows.length === 0) {
      console.log("Tidak ada data pada tabel covid19.");
      return [];
    }

    // Kalkulasi total count of rows pada tabel covid19 
    const totalCount = rows.reduce((total, row) => total + row.count, 0);

    // Kalkulasi persentasi terhadap tiap jenis_vaksin
    const data = rows.map(row => ({
      jenis_vaksin: row.jenis_vaksin,
      count: row.count,
      percentage: (row.count / totalCount) * 100,
    }));

    // Pembulatan 2 angka desimal
    data.forEach(item => {
      item.percentage = Number(item.percentage.toFixed(2));
    });

    console.log("Percentasi Data:", data);
    return data;
  } catch (error) {
    console.error("Error kalkulasi percentasi:", error);
    return [];
  }
}


async function generateData() {
  try {
    const connection = await mysql.createConnection(db_config);

    const start_date = new Date("2020-01-01");
    const end_date = new Date("2021-12-31");

    // Fetch valid nilai id values dari tabel wilayah 
    const [rows] = await connection.query("SELECT id FROM wilayah");

    // Start recording waktu
    const startTime = process.hrtime();
    const num_rows = 10;
    for (let i = 0; i < num_rows; i++) {
      const id_pasien = generateRandomAlphanumeric(12);
      const jenis_vaksin = ["ASTRAZENECA", "MODERNA", "SINOPHARM", "PFIZER", "ZIFIVAX"][
        getRandomInt(0, 4)
      ];
      const tanggal_vaksin = randomDate(start_date, end_date)
        .toISOString()
        .split("T")[0];
      
      const randomWilayahIndex = getRandomInt(0, rows.length - 1);
      const id_wilayah = rows[randomWilayahIndex].id;

      const sql =
        "INSERT INTO covid19 (id_pasien, jenis_vaksin, tanggal_vaksin, id_wilayah) VALUES (?, ?, ?, ?)";
      const values = [id_pasien, jenis_vaksin, tanggal_vaksin, id_wilayah];

      await connection.query(sql, values);
    }

    const elapsedHrtime = process.hrtime(startTime);
    // Convert to milliseconds
    const elapsedTime = elapsedHrtime[0] * 1000 + elapsedHrtime[1] / 1e6; 

    connection.end(); 

    calculatePercentage();

    console.log(`Data generation completed! Elapsed time: ${elapsedTime.toFixed(2)} milliseconds`);
  } catch (error) {
    console.error("Error generating data:", error);
  }
}


generateData();
app.use(cors()); 

// API endpoint untuk persentasi data
app.get('/api/percentage', async (req, res) => {
  try {
    const percentageData = await calculatePercentage();
    res.json(percentageData);
  } catch (error) {
    console.error("Error fetching percentage data:", error);
    res.status(500).json({ error: "An error occurred while fetching percentage data" });
  }
});


async function fetchDataFromMySQL() {
  const connection = await mysql.createConnection(db_config);
  const [rows] = await connection.query("SELECT id, tingkat FROM wilayah");
  connection.end();
  return rows;
}

function countFourDigitIdWilayah(data) {
  const countById = {};

  data.forEach((item) => {
    const id = item.id.toString();
    const tingkat = item.tingkat;

    if (id.length === 4 && tingkat === 2) {
      const prefix = id.substring(0, 2);
      countById[prefix] = (countById[prefix] || 0) + 1;
    }
  });

  return countById;
}

// API route to fetch data and count the occurrences
app.get("/api/count-id-wilayah", async (req, res) => {
  try {
    // Fetch data from MySQL
    const data = await fetchDataFromMySQL();
    const result = countFourDigitIdWilayah(data);
  
    res.json(result);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Error fetching data" });
  }
});

async function fetchDataFromMySQL() {
  const connection = await mysql.createConnection(db_config);
  const [rows] = await connection.query("SELECT id_wilayah FROM covid19");
  connection.end();
  return rows;
}

function countTingkat2Percentage(data) {
  const tingkat2Data = data.filter((item) => {
    const id_wilayah = item.id_wilayah.toString();
    return id_wilayah.length === 4 && parseInt(id_wilayah.substring(0, 2)) >= 11 && parseInt(id_wilayah.substring(0, 2)) <= 92;
  });

  const totalCountTingkat2 = tingkat2Data.length;

  const countByPrefix = {};
  tingkat2Data.forEach((item) => {
    const prefix = item.id_wilayah.toString().substring(0, 2);
    countByPrefix[prefix] = (countByPrefix[prefix] || 0) + 1;
  });

  const percentages = {};
  Object.entries(countByPrefix).forEach(([prefix, count]) => {
    const percentage = (count / totalCountTingkat2) * 100;
    percentages[prefix] = percentage;
  });

  return percentages;
}


app.get("/api/count-achievement-percentage", async (req, res) => {
  try {
    const data = await fetchDataFromMySQL();

    const result = countTingkat2Percentage(data);
    const roundRes = roundJSONToTwoDecimalPlaces(result);
    res.json(roundRes);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error fetching data" });
  }
});

function roundJSONToTwoDecimalPlaces(obj) {
  const roundedObj = {};
  for (const [key, value] of Object.entries(obj)) {
    roundedObj[key] = parseFloat(value.toFixed(2));
  }
  return roundedObj;
}

app.get("/api/get-province-names", async (req, res) => {
  try {
    const connection = await mysql.createConnection(db_config);

    const query = "SELECT id, nama FROM wilayah WHERE tingkat = 1";
    const [rows] = await connection.query(query);

    connection.end();

    const provinceNames = rows.reduce((acc, row) => {
      acc[row.id] = row.nama;
      return acc;
    }, {});

    res.json(provinceNames);
  } catch (error) {
    console.error("Error fetching province names:", error);
    res.status(500).json({ error: "Error fetching province names" });
  }
});


//Stacked bar
async function fetchMonthlyVaccinationData() {
  try {
    const connection = await mysql.createConnection(db_config);

    const [rows] = await connection.query(`
      SELECT jenis_vaksin, tanggal_vaksin
      FROM covid19
    `);

    connection.end();

    const formattedData = rows.map((row) => ({
      month: new Date(row.tanggal_vaksin).toISOString().slice(0, 7),
      jenis_vaksin: row.jenis_vaksin,
    }));

    return formattedData;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

app.get("/api/monthly-vaccination", async (req, res) => {
  try {
    const data = await fetchMonthlyVaccinationData();
    res.json(data);
  } catch (error) {
    console.error("Error fetching monthly vaccination data:", error);
    res.status(500).json({ error: "Error fetching monthly vaccination data" });
  }
});


app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
