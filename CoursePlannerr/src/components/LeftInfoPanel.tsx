import type { Course } from '../types';

type Tab = 'welcome' | 'info' | 'crn';

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  selectedCourse: Course | null;
  selectedCrns: string[];
};

function TabButton({
  label,
  title,
  isActive,
  onClick,
}: {
  label: string;
  title: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      className={`sideTabs__tab ${isActive ? 'isActive' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function LeftInfoPanel({ activeTab, onTabChange, selectedCourse, selectedCrns }: Props) {
  return (
    <aside className="leftPanel">
      <div className="sideTabs" role="tablist" aria-label="Info tabs">
        <TabButton label="🏠" title="Welcome" isActive={activeTab === 'welcome'} onClick={() => onTabChange('welcome')} />
        <TabButton label="ℹ️" title="Course Information" isActive={activeTab === 'info'} onClick={() => onTabChange('info')} />
        <TabButton label="👤" title="Selected CRNs" isActive={activeTab === 'crn'} onClick={() => onTabChange('crn')} />
      </div>

      <div className="leftPanel__body">
        {activeTab === 'welcome' && (
          <div className="welcomeBox">
            <p><b>Welcome!</b> This is your AUB course discovery + scheduling workspace.</p>
            <p>Use the search box on the right to find courses. Click a result to see details here, then press ☑ to add it to your schedule.</p>
            <div className="welcomeBox__hints">
              <div><b>#</b> days (e.g. <b>#MWF</b>)</div>
              <div><b>@</b> time/campus (e.g. <b>@9</b>, <b>@Byblos</b>)</div>
              <div><b>|</b> multiple queries (e.g. <b>math 201 | phys 210</b>)</div>
              <div><b>-</b> filters (e.g. <b>-h</b>)</div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="infoBox">
            {!selectedCourse ? (
              <div className="emptyState">Select a course from the search results.</div>
            ) : (
              <table className="infoTable">
                <tbody>
                  <tr>
                    <td colSpan={4} className="infoTitle">
                      <span>{selectedCourse.code}</span>
                      <span className="infoCrn">CRN {selectedCourse.crn}</span>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="infoSubtitle">{selectedCourse.title}</td>
                  </tr>

                  <tr>
                    <td className="infoK">Campus:</td>
                    <td className="infoV" colSpan={3}>{selectedCourse.campus}</td>
                  </tr>
                  <tr>
                    <td className="infoK">Section:</td>
                    <td className="infoV" colSpan={3}>{selectedCourse.section}</td>
                  </tr>
                  <tr>
                    <td className="infoK">Credits:</td>
                    <td className="infoV" colSpan={3}>{selectedCourse.credits}</td>
                  </tr>
                  <tr>
                    <td className="infoK">Capacity:</td>
                    <td className="infoV" colSpan={3}>{selectedCourse.capacity.enrolled}/{selectedCourse.capacity.limit}</td>
                  </tr>
                  <tr>
                    <td className="infoK">Attributes:</td>
                    <td className="infoV" colSpan={3}>{selectedCourse.attributes.length ? selectedCourse.attributes.join(', ') : '—'}</td>
                  </tr>
                  <tr>
                    <td className="infoK">Prereqs:</td>
                    <td className="infoV" colSpan={3}>{selectedCourse.prerequisites ?? '—'}</td>
                  </tr>
                  <tr>
                    <td className="infoK">Restrictions:</td>
                    <td className="infoV" colSpan={3}>{selectedCourse.restrictions ?? '—'}</td>
                  </tr>

                  <tr>
                    <td colSpan={4} className="infoSectionHeader">Sessions</td>
                  </tr>
                  <tr>
                    <td colSpan={4}>
                      <div className="sessions">
                        {selectedCourse.meetings.map((m, idx) => (
                          <div key={idx} className="sessionCard">
                            <div><span className="muted">Timing:</span> {m.days.join('')}&nbsp; {m.start}–{m.end}</div>
                            <div><span className="muted">Instructor:</span> {selectedCourse.instructor}</div>
                            <div><span className="muted">Type:</span> {m.type ?? '—'}</div>
                            <div><span className="muted">Location:</span> {m.location ?? '—'}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'crn' && (
          <div className="crnBox">
            <div className="crnBox__title">Selected CRNs</div>
            {selectedCrns.length === 0 ? (
              <div className="emptyState">No courses added yet.</div>
            ) : (
              <ul className="crnList">
                {selectedCrns.map((crn) => (
                  <li key={crn}>{crn}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
