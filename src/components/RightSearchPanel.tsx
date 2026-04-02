import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Course } from "../types";
import { supabase } from "../supabaseClient.ts";

const API = `${import.meta.env.VITE_API_URL}`;

type Props = {
  allCourses: Course[];
  scheduled: Course[];
  favorites: Course[];
  onSelectCourse: (course: Course) => void;
  onToggleSchedule: (course: Course) => void;
  onToggleFavorite: (course: Course) => void;
  onHoverCourse: (course: Course | null) => void;
  averageDifficulty: number | null;
  totalCredits: number;
  activeSlot: number;
  onSlotChange: (slot: number) => void;
};

type ViewModal = { course: Course } | null;
type ModalTab = "reviews" | "syllabus";

interface CourseRating {
  id: string;
  rating: number;
  difficulty: number;
  review: string;
  created_at: string;
}

interface Syllabus {
  id: string;
  course_code: string;
  file_url: string;
  file_name: string;
  uploaded_by: string;
  created_at: string;
}

export function RightSearchPanel({
  allCourses,
  scheduled,
  favorites,
  onSelectCourse,
  onToggleSchedule,
  onToggleFavorite,
  onHoverCourse,
  averageDifficulty,
  totalCredits,
  activeSlot,
  onSlotChange,
}: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [viewModal, setViewModal] = useState<ViewModal>(null);
  const [modalTab, setModalTab] = useState<ModalTab>("reviews");
  const [modalRatings, setModalRatings] = useState<CourseRating[]>([]);
  const [modalAvg, setModalAvg] = useState<{
    rating: string;
    difficulty: string;
    count: number;
  } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Syllabus state
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Load ratings when modal opens
  useEffect(() => {
    if (!viewModal) return;
    setModalLoading(true);
    setModalTab("reviews");
    setSyllabi([]);
    setUploadError(null);
    setUploadSuccess(false);
    const [dept, num] = viewModal.course.code.split(" ");
    fetch(`${API}/api/ratings/course/${dept}/${num}`)
      .then((r) => r.json())
      .then((data) => {
        setModalRatings(data.ratings || []);
        setModalAvg(data.averages || null);
      })
      .finally(() => setModalLoading(false));
  }, [viewModal]);

  // Load syllabi when syllabus tab is opened
  useEffect(() => {
    if (modalTab !== "syllabus" || !viewModal) return;
    setSyllabusLoading(true);
    supabase
      .from("syllabi")
      .select("*")
      .eq("course_code", viewModal.course.code)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSyllabi(data || []);
        setSyllabusLoading(false);
      });
  }, [modalTab, viewModal]);

  const handleSyllabusUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !viewModal) return;

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File must be under 10MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const fileName = `${viewModal.course.code.replace(" ", "_")}_${Date.now()}.pdf`;

    const { error: storageError } = await supabase.storage
      .from("syllabi")
      .upload(fileName, file, { contentType: "application/pdf" });

    if (storageError) {
      setUploadError("Upload failed. Make sure the storage bucket exists.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("syllabi")
      .getPublicUrl(fileName);

    const { error: dbError } = await supabase.from("syllabi").insert({
      course_code: viewModal.course.code,
      file_url: urlData.publicUrl,
      file_name: file.name,
      uploaded_by: user?.email ?? "anonymous",
    });

    if (dbError) {
      setUploadError("Could not save syllabus info.");
    } else {
      setUploadSuccess(true);
      // Refresh list
      const { data } = await supabase
        .from("syllabi")
        .select("*")
        .eq("course_code", viewModal.course.code)
        .order("created_at", { ascending: false });
      setSyllabi(data || []);
    }
    setUploading(false);
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Course[];
    const tokens = q.split(/\s+/);
    return allCourses
      .filter((c) => {
        const hay =
          `${c.code} ${c.title} ${c.instructor} ${c.crn}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .slice(0, 30);
  }, [allCourses, query]);

  const scheduledIds = useMemo(
    () => new Set(scheduled.map((c) => c.id)),
    [scheduled],
  );
  const favoriteIds = useMemo(
    () => new Set(favorites.map((c) => c.id)),
    [favorites],
  );

  const CourseItem = ({ c }: { c: Course }) => {
    const inSchedule = scheduledIds.has(c.id);
    const isFav = favoriteIds.has(c.id);
    return (
      <li
        className="resultItem"
        onMouseEnter={() => onHoverCourse(c)}
        onMouseLeave={() => onHoverCourse(null)}
        style={{ flexDirection: "column", gap: 0, padding: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <button
            className={`resultAction ${inSchedule ? "isOn" : ""}`}
            type="button"
            onClick={() => onToggleSchedule(c)}
            title={inSchedule ? "Remove from schedule" : "Add to schedule"}
          >
            {inSchedule ? "☑" : "☐"}
          </button>
          <button
            className="resultMain"
            type="button"
            onClick={() => onSelectCourse(c)}
            title="Open course details"
            style={{ flex: 1 }}
          >
            <div className="resultMain__line1">
              {c.crn} {c.code} — {c.section}{" "}
              <span className="muted">{c.instructor}</span>
            </div>
            <div className="resultMain__line2 muted">{c.title}</div>
          </button>
          <button
            className={`resultFav ${isFav ? "isOn" : ""}`}
            type="button"
            onClick={() => onToggleFavorite(c)}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            ★
          </button>
        </div>
        <div
          style={{ display: "flex", gap: "4px", padding: "3px 8px 5px 34px" }}
        >
          <button
            type="button"
            onClick={() => setViewModal({ course: c })}
            style={{
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "4px",
              border: "1px solid #555",
              backgroundColor: "transparent",
              color: "#aaa",
              cursor: "pointer",
            }}
          >
            ⭐ View Reviews
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/reviews?course=${encodeURIComponent(c.code)}`)
            }
            style={{
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "4px",
              border: "1px solid #555",
              backgroundColor: "transparent",
              color: "#aaa",
              cursor: "pointer",
            }}
          >
            ✏️ Write Review
          </button>
        </div>
      </li>
    );
  };

  return (
    <aside className="rightPanel">
      <div className="rightPanel__top">
        <div className="schTabs" role="tablist" aria-label="Schedules">
          {[1, 2, 3].map((slot) => (
            <button
              key={slot}
              className={`schTab ${activeSlot === slot ? "isActive" : ""}`}
              type="button"
              onClick={() => onSlotChange(slot)}
            >
              Schedule {slot}
            </button>
          ))}
          <button className="schTab" type="button" title="Settings" disabled>
            ⚙️
          </button>
        </div>
        <input
          className="searchBox"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search… (e.g. CMPS 271, arab 232, 27101)"
        />
        <div className="miniStats">
          <div className="miniStats__item">
            <div className="miniStats__label">Selected</div>
            <div className="miniStats__value">{scheduled.length}</div>
          </div>
          <div className="miniStats__item">
            <div className="miniStats__label">Avg difficulty</div>
            <div className="miniStats__value">
              {averageDifficulty == null ? "—" : averageDifficulty.toFixed(2)}
            </div>
          </div>
          <div className="miniStats__item">
            <div className="miniStats__label">Credits</div>
            <div className="miniStats__value">{totalCredits}</div>
          </div>
        </div>
      </div>

      <div className="rightPanel__scroll">
        <div className="resultsSection">
          <div className="sectionTitle">Results</div>
          {!query.trim() ? (
            <div className="emptyState">Start typing to search.</div>
          ) : results.length === 0 ? (
            <div className="emptyState">No matches.</div>
          ) : (
            <ul className="resultList">
              {results.map((c) => (
                <CourseItem key={c.id} c={c} />
              ))}
            </ul>
          )}
        </div>
        <hr className="divider" />
        <div className="resultsSection">
          <div className="sectionTitle">★ Favorites</div>
          {favorites.length === 0 ? (
            <div className="emptyState">
              No favorites yet. Click ★ on any course.
            </div>
          ) : (
            <ul className="resultList">
              {favorites.map((c) => (
                <CourseItem key={c.id} c={c} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {viewModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
          }}
          onClick={() => setViewModal(null)}
        >
          <div
            style={{
              backgroundColor: "#1e1e2e",
              border: "1px solid #444",
              borderRadius: "12px",
              minWidth: "340px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: "18px 20px 0", flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      color: "#fff",
                    }}
                  >
                    {viewModal.course.code}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#aaa",
                      marginTop: "2px",
                    }}
                  >
                    {viewModal.course.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewModal(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#aaa",
                    fontSize: "18px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  borderBottom: "1px solid #333",
                  marginBottom: "0",
                }}
              >
                {(["reviews", "syllabus"] as ModalTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setModalTab(tab)}
                    style={{
                      padding: "7px 16px",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: modalTab === tab ? "#fff" : "#666",
                      borderBottom:
                        modalTab === tab
                          ? "2px solid #A32638"
                          : "2px solid transparent",
                      marginBottom: "-1px",
                      transition: "all 0.15s",
                      textTransform: "capitalize",
                    }}
                  >
                    {tab === "reviews" ? "⭐ Reviews" : "📄 Syllabus"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
              {/* ── REVIEWS TAB ── */}
              {modalTab === "reviews" && (
                <>
                  {modalAvg && modalAvg.count > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        marginBottom: "16px",
                        padding: "12px",
                        backgroundColor: "#12122a",
                        borderRadius: "8px",
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: "bold",
                            color: "#fff",
                          }}
                        >
                          {modalAvg.rating}
                        </div>
                        <div style={{ fontSize: "11px", color: "#aaa" }}>
                          Rating
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: "bold",
                            color: "#fff",
                          }}
                        >
                          {modalAvg.difficulty}
                        </div>
                        <div style={{ fontSize: "11px", color: "#aaa" }}>
                          Difficulty
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: "bold",
                            color: "#fff",
                          }}
                        >
                          {modalAvg.count}
                        </div>
                        <div style={{ fontSize: "11px", color: "#aaa" }}>
                          Reviews
                        </div>
                      </div>
                    </div>
                  )}
                  {modalLoading ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#aaa",
                        padding: "20px",
                      }}
                    >
                      Loading...
                    </div>
                  ) : modalRatings.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#666",
                        padding: "20px",
                      }}
                    >
                      No reviews yet.
                      <div style={{ marginTop: "8px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setViewModal(null);
                            navigate(
                              `/reviews?course=${encodeURIComponent(viewModal.course.code)}`,
                            );
                          }}
                          style={{
                            fontSize: "12px",
                            color: "#A32638",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Be the first to review!
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {modalRatings.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            backgroundColor: "#12122a",
                            borderRadius: "8px",
                            padding: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              marginBottom: r.review ? "8px" : 0,
                            }}
                          >
                            <span
                              style={{
                                backgroundColor:
                                  r.rating >= 4
                                    ? "#22c55e"
                                    : r.rating >= 3
                                      ? "#f59e0b"
                                      : "#ef4444",
                                color: "#fff",
                                fontWeight: "bold",
                                fontSize: "13px",
                                padding: "2px 8px",
                                borderRadius: "4px",
                              }}
                            >
                              {r.rating}/5
                            </span>
                            {r.difficulty > 0 && (
                              <span
                                style={{ fontSize: "12px", color: "#6b7280" }}
                              >
                                Difficulty: {r.difficulty}/5
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#4b5563",
                                marginLeft: "auto",
                              }}
                            >
                              {new Date(r.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {r.review && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: "13px",
                                color: "#d1d5db",
                                lineHeight: 1.6,
                              }}
                            >
                              {r.review}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setViewModal(null);
                      navigate(
                        `/reviews?course=${encodeURIComponent(viewModal.course.code)}`,
                      );
                    }}
                    style={{
                      marginTop: "16px",
                      width: "100%",
                      padding: "9px",
                      backgroundColor: "#A32638",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "bold",
                    }}
                  >
                    ✏️ Write a Review
                  </button>
                </>
              )}

              {/* ── SYLLABUS TAB ── */}
              {modalTab === "syllabus" && (
                <div>
                  {/* Upload Section */}
                  <div
                    style={{
                      backgroundColor: "#12122a",
                      borderRadius: "10px",
                      padding: "16px",
                      marginBottom: "16px",
                      border: "1px dashed #333",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#e2e8f0",
                        marginBottom: "6px",
                      }}
                    >
                      📤 Upload Syllabus
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        marginBottom: "12px",
                      }}
                    >
                      PDF only, max 10MB. Anyone logged in can upload.
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "10px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor: uploading ? "#1e1e3a" : "#A32638",
                        color: "#fff",
                        fontSize: "13px",
                        fontWeight: 600,
                        opacity: uploading ? 0.7 : 1,
                        transition: "all 0.2s",
                      }}
                    >
                      {uploading ? "Uploading..." : "+ Choose PDF"}
                      <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: "none" }}
                        disabled={uploading}
                        onChange={handleSyllabusUpload}
                      />
                    </label>
                    {uploadError && (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "12px",
                          color: "#ef4444",
                        }}
                      >
                        ⚠ {uploadError}
                      </div>
                    )}
                    {uploadSuccess && (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "12px",
                          color: "#22c55e",
                        }}
                      >
                        ✓ Syllabus uploaded successfully!
                      </div>
                    )}
                  </div>

                  {/* Syllabus List */}
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      marginBottom: "10px",
                    }}
                  >
                    Available Syllabi
                  </div>

                  {syllabusLoading ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#aaa",
                        padding: "20px",
                      }}
                    >
                      Loading...
                    </div>
                  ) : syllabi.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#475569",
                        padding: "24px 0",
                        fontSize: "13px",
                      }}
                    >
                      No syllabus uploaded yet.
                      <br />
                      <span style={{ fontSize: "11px" }}>
                        Be the first to share one!
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {syllabi.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            backgroundColor: "#12122a",
                            borderRadius: "8px",
                            padding: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "13px",
                                color: "#e2e8f0",
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              📄 {s.file_name}
                            </div>
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#475569",
                                marginTop: "3px",
                              }}
                            >
                              By {s.uploaded_by} ·{" "}
                              {new Date(s.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <a
                            href={s.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "5px 12px",
                              backgroundColor: "#1e3a5f",
                              color: "#60a5fa",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            View PDF
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}


