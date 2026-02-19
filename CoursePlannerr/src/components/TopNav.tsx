type Props = {
  appName: string;
  semesterLabel: string;
  semesterId: string;
  semesters: { id: string; label: string }[];
  lastUpdatedText: string;
  onSemesterChange: (id: string) => void;
};

export function TopNav({
  appName,
  semesterLabel,
  semesterId,
  semesters,
  lastUpdatedText,
  onSemesterChange,
}: Props) {
  return (
    <header className="topNav">
      <div className="topNav__brand">
        <div className="topNav__logo" aria-hidden="true">
          {appName.slice(0, 1)}
        </div>
        <span className="topNav__brandText">{appName}</span>
      </div>

      <nav className="topNav__links" aria-label="Primary">
        <a className="topNav__link" href="#">Home</a>
        <a className="topNav__link" href="#">About</a>
        <a className="topNav__link" href="#">Story</a>
      </nav>

      <div className="topNav__status" title={lastUpdatedText}>
        <span className="topNav__statusText">{semesterLabel} — {lastUpdatedText}</span>
      </div>

      <div className="topNav__controls">
        <span className="topNav__controlLabel">Change semester:</span>
        <select
          className="topNav__select"
          value={semesterId}
          onChange={(e) => onSemesterChange(e.target.value)}
          aria-label="Change semester"
        >
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="topNav__logout" type="button">Logout</button>
      </div>
    </header>
  );
}
