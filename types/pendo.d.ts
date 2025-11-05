// Pendo TypeScript definitions
declare global {
  interface Window {
    pendo?: {
      initialize: (config: {
        visitor: {
          id: string;
          email?: string;
          full_name?: string;
          role?: string;
          [key: string]: any;
        };
        account?: {
          id: string;
          name?: string;
          plan_level?: string;
          [key: string]: any;
        };
      }) => void;
      identify: (config: { visitor: any; account?: any }) => void;
      updateOptions: (options: any) => void;
      pageLoad: () => void;
      track: (eventName: string, metadata?: Record<string, any>) => void;
      validateEnvironment: () => void;
      _q?: any[];
    };
  }
}

export {};
