// src/components/AIScheduler.tsx
import { useState, useRef, useEffect } from "react";
import type { Course } from "../types";

const API = `${import.meta.env.VITE_API_URL}`;

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  allCourses: Course[];
  onApplySchedule: (courses: Course[]) => void;
  activeSlot: number;
};

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function dayLabel(d: string) {
  return (
    ({ M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri", S: "Sat" } as any)[
      d
    ] ?? d
  );
}

function extractCourseCodes(text: string): string[] {
  const matches = text.toUpperCase().match(/[A-Z]{2,4}\s*\d{3}/g) ?? [];
  return [...new Set(matches.map((c) => c.replace(/\s+/, " ").trim()))];
}

async function fetchDifficulty(code: string): Promise<number | null> {
  try {
    const [dept, num] = code.split(" ");
    const res = await fetch(`${API}/api/ratings/course/${dept}/${num}`);
    const data = await res.json();
    if (data.averages?.difficulty > 0)
      return parseFloat(data.averages.difficulty);
  } catch {}
  return null;
}

export function AIScheduler({
  allCourses,
  onApplySchedule,
  activeSlot,
}: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI course assistant.\n\nI can do two things:\n1. Build a schedule from the course codes you want.\n2. Summarize what students wrote about a professor.\n\nTry:\n\"I want CMPS 271, MATH 201, ARAB 201. No Fridays, prefer mornings.\"\n\nOr:\n\"Summarize the reviews for Professor Jane Doe.\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposedSchedule, setProposedSchedule] = useState<Course[] | null>(
    null,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const courseCodes = extractCourseCodes(text);
      const sections =
        courseCodes.length > 0
          ? allCourses.filter((c) =>
              courseCodes.some((code) => c.code.toUpperCase() === code),
            )
          : [];

      const difficulties: Record<string, number> = {};
      if (sections.length > 0) {
        const uniqueCodes = [...new Set(sections.map((c) => c.code))];
        await Promise.all(
          uniqueCodes.map(async (code) => {
            const d = await fetchDifficulty(code);
            if (d !== null) difficulties[code] = d;
          }),
        );
      }

      const res = await fetch(`${API}/api/ai-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sections,
          difficulties,
          history: messages,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
        setLoading(false);
        return;
      }

      if (data.schedule && data.schedule.length > 0) {
        const picked = data.schedule
          .map((id: string) => allCourses.find((c) => c.id === id))
          .filter(Boolean) as Course[];
        setProposedSchedule(picked);
      } else {
        setProposedSchedule(null);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.summary },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Make sure your server is running.",
        },
      ]);
    }

    setLoading(false);
  };

  const handleApply = () => {
    if (!proposedSchedule) return;
    onApplySchedule(proposedSchedule);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Done! Applied ${proposedSchedule.length} courses to Schedule ${activeSlot}. You can see them on the grid now.`,
      },
    ]);
    setProposedSchedule(null);
  };

  return (
    <>
      <style>{css}</style>

      <button className="ai-fab" onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 12h8M12 8v8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        AI Assistant
      </button>

      {open && (
        <div className="ai-panel">
          <div className="ai-panel__header">
            <div className="ai-panel__title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              AI Course Assistant
            </div>
            <button className="ai-panel__close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="ai-panel__messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg--${m.role}`}>
                <div className="ai-msg__bubble">{m.content}</div>
              </div>
            ))}

            {proposedSchedule && proposedSchedule.length > 0 && (
              <div className="ai-proposal">
                <div className="ai-proposal__title">Proposed Schedule</div>
                {proposedSchedule.map((c) => (
                  <div key={c.id} className="ai-proposal__course">
                    <div className="ai-proposal__code">
                      {c.code} — {c.section}
                    </div>
                    <div className="ai-proposal__meta">{c.title}</div>
                    <div className="ai-proposal__meta">
                      {c.instructor} ·{" "}
                      {c.meetings
                        .map(
                          (m) =>
                            `${m.days.map(dayLabel).join("/")} ${formatTime(m.start)}–${formatTime(m.end)}`,
                        )
                        .join(" · ")}
                    </div>
                  </div>
                ))}
                <button className="ai-proposal__apply" onClick={handleApply}>
                  Apply to Schedule {activeSlot}
                </button>
              </div>
            )}

            {loading && (
              <div className="ai-msg ai-msg--assistant">
                <div className="ai-msg__bubble ai-msg__bubble--loading">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="ai-panel__input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask for a schedule or professor review summary"
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── All colors now use CSS variables so they respect light/dark mode ──
const css = `
  .ai-fab {
    position: fixed;
    bottom: 28px;
    right: 28px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: #A32638;
    color: #fff;
    border: none;
    border-radius: 100px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(163,38,56,0.4);
    transition: transform .2s, box-shadow .2s;
    z-index: 1000;
  }
  .ai-fab:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(163,38,56,0.5); }

  .ai-panel {
    position: fixed;
    bottom: 90px;
    right: 28px;
    width: 390px;
    height: 580px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 60px rgba(0,0,0,0.3);
    z-index: 1000;
    overflow: hidden;
  }

  .ai-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--panel2);
    flex-shrink: 0;
  }
  .ai-panel__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }
  .ai-panel__close {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 16px;
    cursor: pointer;
    transition: color .15s;
  }
  .ai-panel__close:hover { color: var(--text); }

  .ai-panel__messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .ai-msg { display: flex; }
  .ai-msg--user { justify-content: flex-end; }
  .ai-msg--assistant { justify-content: flex-start; }

  .ai-msg__bubble {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .ai-msg--user .ai-msg__bubble {
    background: #A32638;
    color: #fff;
    border-bottom-right-radius: 4px;
  }
  .ai-msg--assistant .ai-msg__bubble {
    background: var(--panel2);
    color: var(--text);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
  }

  .ai-msg__bubble--loading {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 14px 18px;
  }
  .ai-msg__bubble--loading span {
    width: 6px;
    height: 6px;
    background: var(--muted);
    border-radius: 50%;
    animation: aiDot 1.2s ease-in-out infinite;
  }
  .ai-msg__bubble--loading span:nth-child(2) { animation-delay: 0.2s; }
  .ai-msg__bubble--loading span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes aiDot {
    0%,80%,100% { transform: scale(1); opacity: .4; }
    40% { transform: scale(1.3); opacity: 1; }
  }

  .ai-proposal {
    background: var(--panel2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ai-proposal__title {
    font-size: 11px;
    font-weight: 600;
    color: #A32638;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .ai-proposal__course {
    padding: 8px 10px;
    background: var(--bg);
    border-radius: 6px;
    border-left: 3px solid #A32638;
  }
  .ai-proposal__code { font-size: 12px; font-weight: 600; color: var(--text); }
  .ai-proposal__meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .ai-proposal__apply {
    margin-top: 4px;
    width: 100%;
    padding: 9px;
    background: #A32638;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background .15s;
  }
  .ai-proposal__apply:hover { background: #8a1f2f; }

  .ai-panel__input {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    background: var(--panel2);
    flex-shrink: 0;
  }
  .ai-panel__input input {
    flex: 1;
    padding: 10px 13px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 13px;
    outline: none;
    transition: border-color .2s;
  }
  .ai-panel__input input:focus { border-color: #A32638; }
  .ai-panel__input input::placeholder { color: var(--muted); }
  .ai-panel__input button {
    width: 38px;
    height: 38px;
    background: #A32638;
    border: none;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background .15s;
  }
  .ai-panel__input button:hover:not(:disabled) { background: #8a1f2f; }
  .ai-panel__input button:disabled { opacity: 0.4; cursor: not-allowed; }
`;
