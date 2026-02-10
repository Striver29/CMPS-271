// server.cjs

const express = require("express");
const cors = require("cors");
const { professors, ratings } = require("./database.cjs");

console.log("PROFESSORS AT START:", professors);
console.log("RATINGS AT START:", ratings);


const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// RATINGS ROUTE
app.get("/ratings", (req, res) => {
  const result = ratings.map(r => {
    const prof = professors.find(p => p.id === r.professorId);
    return {
      ...r,
      professorName: prof ? prof.name : "Unknown"
    };
  });

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
