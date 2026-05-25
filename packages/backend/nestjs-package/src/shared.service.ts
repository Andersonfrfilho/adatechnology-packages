import { Inject, Injectable, Optional } from "@nestjs/common";
import type { ExampleOptions, ExampleServiceInterface } from "./types";
import { EXAMPLE_OPTIONS_TOKEN } from "./tokens";

@Injectable()
export class ExampleService implements ExampleServiceInterface {
  constructor(
    @Optional()
    @Inject(EXAMPLE_OPTIONS_TOKEN)
    private readonly options: ExampleOptions,
  ) {}

  getPrefix(): string {
    console.log("ExampleService options:", this.options);

    return this.options?.prefix ?? "app";
  }

  isEnabled(): boolean {
    return !!this.options?.enabled;
  }
}
