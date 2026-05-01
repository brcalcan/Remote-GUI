import { useState } from 'react';
import {
  FormContainer,
  FormHeader,
  FormGrid,
  FormField,
  FormButton,
} from './ConnectionFormView';
import { cliState } from '../state/state';

const AddConnectionView = () => {
  const [newConnection, setNewConnection] = useState({
    hostname: '',
    ip: '',
    user: 'root',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewConnection((prev) => ({ ...prev, [name]: value }));
  };

  // When connection is created, add to connection state
  const handleSubmit = () => {
    if (!newConnection.hostname || !newConnection.ip || !newConnection.user) {
      alert('Please fill in all required fields');
      return;
    }

    const connectionToAdd = {
      id: `temp-${Date.now()}`,
      hostname: newConnection.hostname,
      ip: newConnection.ip,
      user: newConnection.user,
      status: 'active',
      starred: false,
    };

    cliState.getState().addConnection(connectionToAdd);

    console.log('Added connection:', connectionToAdd);

    setNewConnection({
      hostname: '',
      ip: '',
      user: 'root',
    });

    alert(`Connection "${newConnection.hostname}" added successfully!`);
  };

  return (
    <FormContainer>
      <FormHeader
        title="Add Connection"
        description="Add a temporary connection to the current session."
      />
      <FormGrid>
        <FormField
          label="Hostname"
          name="hostname"
          placeholder="anylog-block1"
          value={newConnection.hostname}
          onChange={handleChange}
          fullWidth
          required
        />
        <FormField
          label="IP Address"
          name="ip"
          placeholder="192.168.1.100"
          value={newConnection.ip}
          onChange={handleChange}
          required
        />
        <FormField
          label="Username"
          name="user"
          placeholder="root"
          value={newConnection.user}
          onChange={handleChange}
          required
        />

        <FormButton onClick={handleSubmit} fullWidth primary>
          Add Connection
        </FormButton>
      </FormGrid>
    </FormContainer>
  );
};

export default AddConnectionView;
