import React, { createContext, useContext, useState } from 'react';
import api from '../services/api';

type ModuleContextType = {
  modules: string[];
  loading: boolean;
  loadModules: () => Promise<void>;
  hasModule: (key: string) => boolean;
  clearModules: () => void;
};

const ModuleContext = createContext<ModuleContextType>({
  modules: [],
  loading: false,
  loadModules: async () => {},
  hasModule: () => false,
  clearModules: () => {},
});

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadModules = async () => {
    try {
      setLoading(true);

      const res = await api.get('/restaurant/my-modules');

      const keys = res.data?.moduleKeys || [];

      setModules(keys);
      console.log('Allowed Modules:', keys);
    } catch (error: any) {
      console.log('Module load error:', error.response?.data || error.message);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  const hasModule = (key: string) => {
    return modules.includes(key);
  };

  const clearModules = () => {
    setModules([]);
  };

  return (
    <ModuleContext.Provider
      value={{
        modules,
        loading,
        loadModules,
        hasModule,
        clearModules,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export const useModules = () => useContext(ModuleContext);