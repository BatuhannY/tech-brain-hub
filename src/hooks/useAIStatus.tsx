import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AIStatusContextType {
  isAIOffline: boolean;
  markAIOffline: () => void;
  markAIOnline: () => void;
  checkAIError: (error: any) => boolean; // returns true if it's a payment/credit error
}

const AIStatusContext = createContext<AIStatusContextType>({
  isAIOffline: false,
  markAIOffline: () => {},
  markAIOnline: () => {},
  checkAIError: () => false,
});

export const AIStatusProvider = ({ children }: { children: ReactNode }) => {
  const [isAIOffline, setIsAIOffline] = useState(false);

  const markAIOffline = useCallback(() => setIsAIOffline(true), []);
  const markAIOnline = useCallback(() => setIsAIOffline(false), []);

  const checkAIError = useCallback((data: any): boolean => {
    const errorStr = typeof data === 'string' ? data : data?.error || '';
    if (
      errorStr.includes('Payment') ||
      errorStr.includes('402') ||
      errorStr.includes('credits') ||
      errorStr.includes('add funds')
    ) {
      setIsAIOffline(true);
      return true;
    }
    return false;
  }, []);

  return (
    <AIStatusContext.Provider value={{ isAIOffline, markAIOffline, markAIOnline, checkAIError }}>
      {children}
    </AIStatusContext.Provider>
  );
};

export const useAIStatus = () => useContext(AIStatusContext);
