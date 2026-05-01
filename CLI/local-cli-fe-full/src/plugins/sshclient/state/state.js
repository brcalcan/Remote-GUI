// Creates a persistent state ( in Localstorage ) which handles vault information
// and connection information and states which are shared globally across multiple components

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { hiddenStorage } from '../storage/session';

export const cliState = create(
  persist(
    (set, get) => ({
      credLocked: true,
      secretsCache: {},
      modalView: null,
      activeConnection: {},
      connectionsList: [],
      focusedTerminalId: null,

      setCredLocked: (lockedState) => set({ credLocked: lockedState }),

      cacheSecrets: (secrets) => set({ secretsCache: secrets }),

      clearSecretsCache: () => set({ secretsCache: {} }),

      setModalView: (name) => set({ modalView: name }),

      setFocusedTerminalId: (id) => set({ focusedTerminalId: id }),

      setConnectionsList: (connections) =>
        set({ connectionsList: connections }),

      addConnection: (connection) =>
        set((state) => ({
          connectionsList: [...state.connectionsList, connection],
        })),

      removeConnection: (id) =>
        set((state) => ({
          connectionsList: state.connectionsList.filter(
            (conn) => conn.id !== id,
          ),
        })),

      setActiveConnection: (id, conn) =>
        set((state) => ({
          activeConnection: {
            ...state.activeConnection,
            [id]: conn,
          },
        })),

      removeActiveConnection: (id) =>
        set((state) => {
          const updatedConnections = { ...state.activeConnection };
          delete updatedConnections[id];
          return { activeConnection: updatedConnections };
        }),

      setIsConnected: (id, connState) =>
        set((state) => {
          const connection = state.activeConnection[id];
          if (!connection) return state;
          return {
            activeConnection: {
              ...state.activeConnection,
              [id]: { ...connection, isConnected: connState },
            },
          };
        }),

      lockSession: () => {
        set({
          credLocked: true,
          secretsCache: {},
          activeConnection: {},
          modalView: null,
        });
        sessionStorage.removeItem('cli-session-state');
      },
    }),
    {
      name: 'cli-session-state',
      storage: createJSONStorage(() => hiddenStorage),

      partialize: (state) => ({
        credLocked: state.credLocked,
      }),
    },
  ),
);
