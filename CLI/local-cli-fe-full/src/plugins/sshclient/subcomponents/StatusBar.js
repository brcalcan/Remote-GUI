// Status bar used for each terminal to display ID, time online, hostname

import { useEffect, useState } from 'react';
import { cliState } from '../state/state';
import { FaCircle } from 'react-icons/fa6';
import '../styles/StatusBar.css';

export const TimeCounter = ({ customStart, enabled }) => {
  const [seconds, setSeconds] = useState(customStart || 0);

  useEffect(() => {
    if (enabled) {
      setSeconds(customStart || 0);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
  };

  return <div className="time-counter">{formatTime(seconds)}</div>;
};

const StatusBar = ({ id, conn }) => {
  const { removeActiveConnection } = cliState();
  const isConnected = cliState(
    (state) => state.activeConnection[id]?.isConnected ?? false,
  );

  const getConnID = (id) => {
    const uniqueID = id?.split('-')[1];
    return uniqueID;
  };

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span
          className="exit-button"
          onClick={() => removeActiveConnection(id)}
        >
          Exit
        </span>
      </div>

      <div className="statusbar-center">
        <FaCircle
          size={10}
          color={isConnected ? 'green' : 'red'}
          className="status-icon"
        />
        <span className="hostname">
          {conn.hostname ?? 'Host'}({conn.ip ?? 'IP'})
        </span>
      </div>

      <div className="connection-id">T-ID:{getConnID(id)}</div>

      <TimeCounter enabled={isConnected} />
    </div>
  );
};

export default StatusBar;
