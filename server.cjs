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

  const { data, error } = await query.range(0, 5000);
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Get course ratings
app.get("/api/ratings/course/:department/:courseNumber", async (req, res) => {
  const { department, courseNumber } = req.params;

  const { data, error } = await supabase
    .from("course_ratings")
    .select("*")
    .eq("department", department)
    .eq("course_number", courseNumber)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json(error);

  const avg = data.length ? {
    rating: (data.reduce((a, r) => a + r.rating, 0) / data.length).toFixed(1),
    difficulty: (data.reduce((a, r) => a + r.difficulty, 0) / data.length).toFixed(1),
    count: data.length
  } : { rating: 0, difficulty: 0, count: 0 };

  res.json({ ratings: data, averages: avg });
});

// Submit course rating
app.post("/api/ratings/course", async (req, res) => {
  const { user_id, department, course_number, rating, difficulty, review } = req.body;

  const { data, error } = await supabase
    .from("course_ratings")
    .upsert({ user_id, department, course_number, rating, difficulty, review },
      { onConflict: 'user_id,department,course_number' });

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

// Get professor ratings
app.get("/api/ratings/professor/:professorId", async (req, res) => {
  const { professorId } = req.params;

  const { data, error } = await supabase
    .from("professor_ratings")
    .select("*")
    .eq("professor_id", professorId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json(error);

  const avg = data.length ? {
    rating: (data.reduce((a, r) => a + r.rating, 0) / data.length).toFixed(1),
    count: data.length
  } : { rating: 0, count: 0 };

  res.json({ ratings: data, averages: avg });
});

// Submit professor rating
app.post("/api/ratings/professor", async (req, res) => {
  const { user_id, professor_id, department, course_number, rating, review } = req.body;

  const { data, error } = await supabase
    .from("professor_ratings")
    .upsert({ user_id, professor_id, department, course_number, rating, review },
      { onConflict: 'user_id,professor_id,department,course_number' });

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

app.get("/api/professors", async (req, res) => {
  const { search } = req.query;

  let query = supabase
    .from("professors")
    .select("id, full_name");

  if (search) {
    query = query.ilike("full_name", `%${search}%`);
  }

  const { data, error } = await query.limit(20);
  if (error) return res.status(500).json(error);
  res.json(data);
});

app.get("/api/courses/search", async (req, res) => {
  const { search } = req.query;

  let query = supabase
    .from("courses")
    .select("department, course_number, title")
    .ilike("department", `${search}%`);

  const { data, error } = await query.range(0, 200);
  if (error) return res.status(500).json(error);

  // Deduplicate
  const seen = new Set();
  const unique = data.filter(c => {
    const key = `${c.department}-${c.course_number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.json(unique);
});

console.log("About to listen...");
app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});

process.stdin.resume();
