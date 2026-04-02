import type { Course } from '../types';

type Tab = 'welcome' | 'info' | 'crn';

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  selectedCourse: Course | null;
  selectedCrns: string[];
};

function TabButton({ label, title, isActive, onClick }: { label: string; title: string; isActive: boolean; onClick: () => void }) {
  return (
    <button type="button" title={title} className={`sideTabs__tab ${isActive ? 'isActive' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

function Row({ label, value, alwaysShow }: { label: string; value: React.ReactNode; alwaysShow?: boolean }) {
  if (!alwaysShow && (!value || (typeof value === 'string' && value.trim() === '') || value === '—')) return null;
  return (
    <tr>
      <td className="infoK" style={{ verticalAlign: 'top', paddingTop: '5px' }}>{label}:</td>
      <td className="infoV" colSpan={3} style={{ paddingTop: '5px' }}>{value}</td>
    </tr>
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
            <p>Use the search box on the right to find courses. Hover over a result to preview it on the grid. Click to see details here, then press ☑ to add it to your schedule.</p>
            <div className="welcomeBox__hints">
              <div><b>Right-click</b> a course block to change its color</div>
              <div><b>Hover</b> a search result to preview on grid</div>
              <div><b>PDF ↗</b> to export your schedule</div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="infoBox">
            {!selectedCourse ? (
              <div className="emptyState">Select or hover a course to see details.</div>
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

                  <Row label="Instructor" value={selectedCourse.instructor} />
                  <Row label="Campus" value={selectedCourse.campus} />
                  <Row label="Section" value={selectedCourse.section} />
                  <Row label="Credits" value={selectedCourse.credits != null && selectedCourse.credits > 0 ? String(selectedCourse.credits) : 'N/A'} />
                  <Row label="Capacity" value={`${selectedCourse.capacity.enrolled} / ${selectedCourse.capacity.limit}`} />

                  {selectedCourse.attributes && (Array.isArray(selectedCourse.attributes) ? selectedCourse.attributes.length > 0 : selectedCourse.attributes) && (
                    <tr>
                      <td className="infoK" style={{ verticalAlign: 'top', paddingTop: '5px' }}>Attributes:</td>
                      <td className="infoV" colSpan={3} style={{ paddingTop: '5px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {selectedCourse.attributes.map((a, i) => (
                            <span key={i} style={{
                              backgroundColor: 'rgba(163,38,56,0.15)',
                              color: '#e07080',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '11px',
                              border: '1px solid rgba(163,38,56,0.3)',
                            }}>{a}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {selectedCourse.prerequisites && selectedCourse.prerequisites !== 'None' && (
                    <tr>
                      <td className="infoK" style={{ verticalAlign: 'top', paddingTop: '5px' }}>Prereqs:</td>
                      <td className="infoV" colSpan={3} style={{ paddingTop: '5px', color: '#f0c040', fontSize: '12px' }}>
                        {selectedCourse.prerequisites}
                      </td>
                    </tr>
                  )}

                  {selectedCourse.restrictions && selectedCourse.restrictions !== 'None' && (
                    <tr>
                      <td className="infoK" style={{ verticalAlign: 'top', paddingTop: '5px' }}>Restrictions:</td>
                      <td className="infoV" colSpan={3} style={{ paddingTop: '5px', color: '#f08040', fontSize: '12px' }}>
                        {selectedCourse.restrictions}
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td colSpan={4} className="infoSectionHeader">Sessions</td>
                  </tr>
                  <tr>
                    <td colSpan={4}>
                      <div className="sessions">
                        {selectedCourse.meetings.map((m, idx) => (
                          <div key={idx} className="sessionCard">
                            <div><span className="muted">Timing:</span> {m.days.join('')}&nbsp;{m.start}–{m.end}</div>
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
