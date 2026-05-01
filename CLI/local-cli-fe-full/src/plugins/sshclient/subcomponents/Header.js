import { cliState } from '../state/state';
import '../styles/Header.css';

const Header = () => {
  const setModalView = cliState((state) => state.setModalView);
  const credLocked = cliState((state) => state.credLocked);

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">Remote Console</h1>
        <p className="header-subtitle">SSH and Manage your AnyLog Nodes</p>
      </div>

      <div className="header-right">
        <div className="cred-container">
          <div
            className="cred-status"
            style={{ color: credLocked ? '#92400e' : '#065f46' }}
          >
            <span className="cred-icon">{credLocked ? '🔒' : '🔓'}</span>
            <span>{credLocked ? 'Locked' : 'Unlocked'}</span>
          </div>

          <button className="manage-btn" onClick={() => setModalView('VAULT')}>
            Manage Credentials
          </button>
        </div>

        <button
          className="add-btn"
          onClick={() => setModalView('CUSTOM_CONNECTION')}
        >
          + Add Connection
        </button>
      </div>
    </header>
  );
};

export default Header;
