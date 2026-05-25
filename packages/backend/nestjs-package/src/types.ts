export interface ExampleOptions {
  prefix?: string;
  enabled?: boolean;
}

// Example interface alias that consumers can use for typing when injecting the token
export interface ExampleLibInterface extends ExampleOptions {}

// Interface describing the public surface of ExampleService for consumers who want to inject by token
export abstract class ExampleSharedServiceInterface {
  abstract getPrefix(): string;
  abstract isEnabled(): boolean;
}

// backward-compatible alias
export type ExampleServiceInterface = ExampleSharedServiceInterface;
