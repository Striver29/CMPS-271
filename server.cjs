console.log("File started");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors({
  origin: "http://localhost:5173"
}));

app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.get("/api/terms", async (req, res) => {
  const { data, error } = await supabase
    .from("terms")
    .select("*")
    .order("code", { ascending: false });

  if (error) return res.status(500).json(error);

  const cleaned = data.map(t => ({
    ...t,
    description: t.description.replace(" (View Only)", "").trim()
  }));

  res.json(cleaned);
});

app.get("/api/courses", async (req, res) => {
  const { term, search } = req.query;

  let query = supabase
    .from("courses")
    .select("*, professors(full_name)")
    .eq("semester", term);

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,department.ilike.%${search}%,crn.eq.${search},course_number.ilike.%${search}%`
    );
  }

  const { data, error } = await query.range(0, 5000);;
  if (error) return res.status(500).json(error);
  res.json(data);
});

console.log("About to listen...");
app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});

process.stdin.resume();