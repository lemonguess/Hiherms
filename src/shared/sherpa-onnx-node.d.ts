// Type declarations for sherpa-onnx-node
// No @types package exists, so we provide minimal types

declare module 'sherpa-onnx-node' {
  interface OnlineRecognizerConfig {
    modelType: string;
    model: {
      modelPath: string;
      tokensPath: string;
      numThreads?: number;
      useGPU?: boolean;
    };
    wakeWord?: {
      words: string[];
      threshold?: number;
    };
    enableMicrophone?: boolean;
    streaming?: boolean;
  }

  interface OnlineRecognizer {
    start(): void;
    stop(): void;
    on(event: 'result', callback: (text: string, isFinal: boolean) => void): void;
    on(event: 'wake', callback: (word: string) => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    on(event: string, callback: (...args: any[]) => void): void;
  }

  export function createOnlineRecognizer(config: OnlineRecognizerConfig): OnlineRecognizer;
}
