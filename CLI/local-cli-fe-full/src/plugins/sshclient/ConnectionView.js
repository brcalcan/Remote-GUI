import { useEffect } from 'react';
import '../../styles/CLIPage.css';
import TerminalView from './subcomponents/TerminalView';
import StatusBar from './subcomponents/StatusBar';
import { cliState } from './state/state';

/**
 * ConnectionView
 *
 * Renders one or more terminal sessions derived from the `conn` map.
 * Each entry in `conn` is displayed as an independent terminal card containing
 * a StatusBar and a TerminalView. When a terminal is programmatically focused
 * via global CLI state, this component scrolls it into view and resets the
 * focus target.
 *
 * @param {{ conn: Record<string, ConnectionConfig> }} props
 *   conn - A map of terminal IDs to their connection configuration objects.
 */
const ConnectionView = ({ conn }) => {
  const entries = Object.entries(conn);

  // Subscribe to the currently focused terminal ID from global CLI state.
  // Used to trigger auto-scroll when a terminal is selected externally
  // (e.g., from a sidebar or search result).
  const focusedTerminalId = cliState((s) => s.focusedTerminalId);
  const setFocusedTerminalId = cliState((s) => s.setFocusedTerminalId);

  /**
   * Auto-scroll effect: whenever `focusedTerminalId` is set, find the
   * corresponding terminal card by its DOM ID and scroll it smoothly into
   * view. After scrolling, clear the focused ID so this effect doesn't
   * re-trigger on unrelated renders.
   */
  useEffect(() => {
    if (!focusedTerminalId) return;
    const el = document.getElementById(`terminal-card-${focusedTerminalId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setFocusedTerminalId(null);
  }, [focusedTerminalId, setFocusedTerminalId]);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/*
       * Scrollable terminal list container.
       * Vertical scroll is enabled here while horizontal overflow is hidden
       * to keep terminal output contained within each card's bounds.
       */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {entries &&
          entries.map(([id, c]) => (
            /*
             * Terminal card wrapper.
             * - Single connection: grows to fill all available height (flex: 1 1 auto).
             * - Multiple connections: fixed at near-full viewport height so each card
             *   is independently scrollable without collapsing (flex: 0 0 auto).
             * - Starred connections receive a warm amber background as a visual cue.
             * - The DOM ID (terminal-card-{id}) is the scroll target for focusedTerminalId.
             */
            <div
              key={id}
              id={`terminal-card-${id}`}
              style={{
                flex: entries.length === 1 ? '1 1 auto' : '0 0 auto',
                ...(entries.length > 1 && {
                  height: 'calc(100vh - 200px)',
                  minHeight: 'calc(100vh - 200px)',
                }),
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: c.starred ? '#fffbeb' : 'white',
                transition: 'background-color 0.2s',
                overflow: 'hidden',
              }}
            >
              <StatusBar id={id} conn={c} />
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/*
                 * TerminalView: mounts an interactive SSH terminal session.
                 * `action` defaults to 'direct_ssh' when not explicitly provided
                 * by the connection config, supporting future action types.
                 */}
                <TerminalView
                  id={id}
                  name={c.name}
                  ip={c.ip}
                  user={c.user}
                  credential={c.credential}
                  action={c.action ?? 'direct_ssh'}
                  authType={c.authType}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default ConnectionView;
