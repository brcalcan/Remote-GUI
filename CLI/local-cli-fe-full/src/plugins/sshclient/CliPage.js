import { useEffect, useState } from 'react';
import ConnectionSelectorView from './ConnectionSelectorView';
import ConnectionView from './ConnectionView';
import Header from './subcomponents/Header';
import { cliState } from './state/state';
import AddConnectionView from './subcomponents/AddConnectionView';
import Modal from '@mui/material/Modal';
import { Box } from '@mui/material';
import VaultView from './subcomponents/VaultViews';

// Main SSHClient frontend page. Found by loader.js

// Store modal mappings to show on top of whatever current view. Key: String, Value: Component
const MODAL_MAPPINGS = {
  CUSTOM_CONNECTION: AddConnectionView,
  VAULT: VaultView,
};

// Plugin metadata - used by the plugin loader
export const pluginMetadata = {
  name: 'SSH Client',
  icon: null,
};

export default function CliPage() {
  const [numberOfActiveConnections, SetNumberOfActiveConnections] = useState(0);
  const [newConnection, setNewConnection] = useState({
    hostname: '',
    ip: '',
    user: '',
    credential: '',
    status: 'active',
    starred: false,
  });
  const [connections, setConnections] = useState([]);

  // Retrieve active connection, active modal, and modal-setter from SSHClient global state
  const activeConnection = cliState((state) => state.activeConnection);
  const modalView = cliState((state) => state.modalView);
  const setModalView = cliState((state) => state.setModalView);

  // Retrieve active modal component(if any)
  const ActiveModalComponent = MODAL_MAPPINGS[modalView];

  // Prefill active connections on-mount
  useEffect(() => {
    SetNumberOfActiveConnections(Object.values(activeConnection).length);
  }, [activeConnection]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <Header
        newConnection={newConnection}
        setNewConnection={setNewConnection}
        connections={connections}
        setConnections={setConnections}
      />
      <div
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            flex: '0 0 400px',
            width: '400px',
            minWidth: '400px',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ConnectionSelectorView
            connections={connections}
            setConnections={setConnections}
          />
        </div>

        {numberOfActiveConnections > 0 ? (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ConnectionView conn={activeConnection} />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            No open terminal
          </div>
        )}
      </div>
      {modalView !== null && ActiveModalComponent !== null && (
        // If modal set in global state, show
        <div
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            height: '100%',
          }}
        >
          <Modal open={modalView !== null} onClose={() => setModalView(null)}>
            <Box sx={modalStyle}>
              <div
                style={{
                  display: 'flex',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: '50vw',
                  height: '100%',
                  flexDirection: 'column',
                  gap: 16,
                  // padding: 16,
                  background: '#fafafa',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                }}
              >
                {<ActiveModalComponent />}
              </div>
            </Box>
          </Modal>
        </div>
      )}
    </div>
  );
}

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: '90vw',
  maxHeight: '40vw',
  bgcolor: 'background.paper',
  boxShadow: 24,
  overflow: 'hidden',
  borderRadius: 3,
  p: 0,
};
