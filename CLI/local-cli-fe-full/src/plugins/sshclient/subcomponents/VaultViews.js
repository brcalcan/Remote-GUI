// Handles vault changes such as password / ssh key
// Allows for creation and removal of the above

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Vault } from '../storage/vault';
import { cliState } from '../state/state';
import { loadSecretsFromVault } from '../storage/stateStorage';
import {
  FormContainer,
  FormHeader,
  FormGrid,
  FormField,
  FormButton,
} from './ConnectionFormView';
import '../styles/VaultViews.css';

const VaultView = ({ onClose }) => {
  const [dbInstance, setDbInstance] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    const existingDb = Vault.getDb();
    if (existingDb && !cliState.getState().credLocked) {
      setDbInstance(existingDb);
    }
  }, []);

  const onUnlock = async () => {
    try {
      const db = await Vault.unlock(password);
      setDbInstance(db);
      setError('');
      await loadSecretsFromVault(db);
    } catch {
      setError('Invalid password.');
    }
  };

  const onReset = async () => {
    const confirmed = window.confirm(
      'Are you sure? This will delete all encrypted data. This cannot be undone.',
    );
    if (confirmed) {
      await Vault.reset();
      setDbInstance(null);
      setPassword('');
      setError('');
      cliState.getState().clearSecretsCache();
      cliState.getState().setCredLocked(true);
    }
  };

  const onLock = () => {
    Vault.lock();
    setDbInstance(null);
    setPassword('');
    cliState.getState().clearSecretsCache();
    cliState.getState().setCredLocked(true);
  };

  const handleClose = () => {
    setPassword('');
    if (onClose) onClose();
  };

  if (!dbInstance) {
    return (
      <div className="vault-locked">
        <div className="vault-lock-icon">🔒</div>
        <h2 className="vault-locked-title">Vault Locked</h2>

        <div className="vault-unlock-container">
          <input
            type="password"
            placeholder="Master Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`vault-password-input ${
              error ? 'vault-password-error' : ''
            }`}
            onKeyDown={(e) => e.key === 'Enter' && onUnlock()}
          />

          {error && <p className="vault-error-text">{error}</p>}

          <button onClick={onUnlock} className="vault-unlock-btn">
            Unlock Vault
          </button>

          <button onClick={onReset} className="vault-reset-btn">
            Reset Vault
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-main">
      <div className="vault-header">
        <h2 className="vault-header-title">Credential Manager</h2>

        <div className="vault-header-buttons">
          <button onClick={onLock} className="vault-lock-btn">
            🔒 Lock Manager
          </button>

          {onClose && (
            <button onClick={handleClose} className="vault-close-btn">
              Close
            </button>
          )}
        </div>
      </div>

      <VaultContent db={dbInstance} />
    </div>
  );
};

const VaultContent = ({ db }) => {
  const [form, setForm] = useState({
    hostname: '',
    username: '',
    type: 'PASSWORD',
    ref: '',
    credential: '',
  });

  const secrets = useLiveQuery(() => db.secrets.toArray()) || [];

  const secretsByHost = secrets.reduce((acc, secret) => {
    const host = secret.content.hostname;
    if (!acc[host]) acc[host] = [];
    acc[host].push(secret);
    return acc;
  }, {});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) =>
      setForm({ ...form, ref: file.name, credential: event.target.result });
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!form.hostname || !form.credential) {
      return alert('Please fill required fields (hostname and credential)');
    }

    await Vault.saveSecret({
      hostname: form.hostname,
      username: form.username || 'root',
      type: form.type,
      ref: form.ref,
      credential: form.credential,
    });

    await loadSecretsFromVault(db);

    setForm({
      hostname: '',
      username: '',
      type: 'PASSWORD',
      ref: '',
      credential: '',
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this credential?')) {
      await db.secrets.delete(id);
      await loadSecretsFromVault(db);
    }
  };

  return (
    <div className="vault-content">
      <FormContainer className="vault-form-container">
        <FormHeader
          title="Add Credential"
          description="Store encrypted credentials for your hosts"
        />

        <FormGrid>
          <FormField
            label="Hostname"
            name="hostname"
            placeholder="server.example.com"
            value={form.hostname}
            onChange={handleChange}
            required
          />

          <FormField
            label="Username"
            name="username"
            placeholder="root"
            value={form.username}
            onChange={handleChange}
          />

          <FormField
            label="Credential Type"
            name="type"
            value={form.type}
            onChange={(e) =>
              setForm({
                ...form,
                type: e.target.value,
                credential: '',
                ref: '',
              })
            }
            options={[
              { value: 'PASSWORD', label: 'Password' },
              { value: 'KEY', label: 'SSH Key' },
            ]}
          />

          {form.type === 'PASSWORD' ? (
            <FormField
              label="Password"
              name="credential"
              type="password"
              placeholder="Enter password"
              value={form.credential}
              onChange={handleChange}
              required
            />
          ) : (
            <FormField
              label="SSH Key File"
              name="keyfile"
              type="file"
              onFileChange={handleFileChange}
              accept=""
              required
            />
          )}

          <FormButton onClick={handleSave} className="vault-add-btn">
            Add Credential
          </FormButton>
        </FormGrid>
      </FormContainer>

      <div className="vault-list">
        {Object.entries(secretsByHost).map(([hostname, hostSecrets]) => (
          <div key={hostname} className="vault-host-card">
            <div className="vault-host-title">{hostname}</div>

            {hostSecrets.map((secret) => (
              <div key={secret.id} className="vault-secret-row">
                <div className="vault-secret-left">
                  <div className="vault-secret-meta">
                    <span
                      className={`vault-secret-badge ${
                        secret.content.type === 'KEY'
                          ? 'badge-key'
                          : 'badge-password'
                      }`}
                    >
                      {secret.content.type === 'PASSWORD'
                        ? 'PASSWORD'
                        : secret.content.ref}
                    </span>

                    {secret.content.username && (
                      <span className="vault-username">
                        User: {secret.content.username}
                      </span>
                    )}
                  </div>
                </div>

                <div className="vault-secret-right">
                  <span className="vault-date">
                    {new Date(secret.date).toLocaleString()}
                  </span>

                  <button
                    onClick={() => handleDelete(secret.id)}
                    className="vault-delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VaultView;
