import { sendCommand } from '../../../services/api';

export const fetchAllNodes = async () => {
  const node = localStorage.getItem('dashboard-selected-node');

  const commands = {
    operator: 'blockchain get operator',
    master: 'blockchain get master',
    query: 'blockchain get query',
  };

  try {
    const entries = await Promise.all(
      Object.entries(commands).map(async ([key, command]) => {
        const result = await sendCommand({
          connectInfo: node,
          method: 'GET',
          command,
        });

        return [key, result];
      }),
    );

    return Object.fromEntries(entries);
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

const extractNodes = (items = []) =>
  items.map((item) => {
    const node = Object.values(item)[0];

    return {
      name: node.name,
      ip: node.ip,
      hostname: node.hostname,
      rest_port: node.rest_port,
    };
  });

export const normalizeNodes = (allNodeData) => {
  return {
    operator: extractNodes(allNodeData.operator?.data),
    master: extractNodes(allNodeData.master?.data),
    query: extractNodes(allNodeData.query?.data),
  };
};
