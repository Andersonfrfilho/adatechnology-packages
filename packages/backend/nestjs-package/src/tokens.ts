export const EXAMPLE_OPTIONS_TOKEN = "EXAMPLE_OPTIONS";
export const EXAMPLE_SERVICE_PROVIDE = "EXAMPLE_SERVICE_PROVIDE";
export const EXAMPLE_LIB = "EXAMPLE_LIB";

export const createExampleOptionsToken = (name?: string) =>
  name ? `${EXAMPLE_OPTIONS_TOKEN}_${name}` : EXAMPLE_OPTIONS_TOKEN;
export const createExampleServiceToken = (name?: string) =>
  name ? `${EXAMPLE_SERVICE_PROVIDE}_${name}` : EXAMPLE_SERVICE_PROVIDE;
