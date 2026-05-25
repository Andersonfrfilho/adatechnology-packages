import { DynamicModule, Module, Provider } from "@nestjs/common";
import { createLogger, format, transports, LoggerOptions } from "winston";
import { inspect } from "node:util";
import { WinstonLoggerProvider } from "./winston.logger.provider";
import {
  WINSTON_LOGGER,
  WINSTON_RAW,
  WINSTON_OBFUSCATOR,
} from "./winston.logger.token";
import type { LoggerConfig } from "../../logger.config";
import { DEFAULT_LOG_LEVEL } from "./winston.logger.constants";
import { buildDefaultObfuscator } from "../../obfuscator";

type WritableLogInfo = Record<string, unknown> & {
  level?: unknown;
  message?: unknown;
  timestamp?: unknown;
  requestId?: unknown;
  context?: unknown;
  source?: unknown;
  appName?: unknown;
  appVersion?: unknown;
  lib?: unknown;
  libVersion?: unknown;
  libMethod?: unknown;
  stack?: unknown;
  meta?: unknown;
  traceStack?: unknown;
};

type MetaLogContext = {
  className?: unknown;
  methodName?: unknown;
};

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function colorizeText(
  useColors: boolean,
  color: string,
  reset: string,
  text: string,
): string {
  return useColors ? `${color}${text}${reset}` : text;
}

function fillInfoFromMeta(info: WritableLogInfo): void {
  if (!info.meta || typeof info.meta !== "object") return;

  const meta = info.meta as Record<string, unknown>;
  const metadataKeys = [
    "requestId",
    "context",
    "source",
    "lib",
    "libVersion",
    "libMethod",
    "appName",
    "appVersion",
    "traceStack",
  ] as const;

  for (const key of metadataKeys) {
    if (meta[key] && !info[key]) {
      info[key] = meta[key];
      delete meta[key];
    }
  }

  const logContext = meta.logContext as MetaLogContext | undefined;
  if (!logContext || info.source) return;

  const className = asString(logContext.className);
  const methodName = asString(logContext.methodName);

  if (className && methodName) {
    info.source = `${className}.${methodName}`;
  } else if (className) {
    info.source = className;
  } else if (methodName) {
    info.source = methodName;
  }
}

function applyDefaultInfoValues(
  info: WritableLogInfo,
  config?: LoggerConfig,
): void {
  info.requestId = info.requestId || "no-request-id";
  info.context = info.context || config?.context || "App";
  info.appName = info.appName || config?.appName;
  info.appVersion = info.appVersion || config?.appVersion;
  info.lib = info.lib || config?.lib;
  info.libVersion = info.libVersion || config?.libVersion;
}

function buildMethodDisplays(params: {
  context: string;
  source?: string;
  lib?: string;
  libMethod?: string;
  colorize: (text: string) => string;
}): { sourceDisplay: string; libMethodDisplay: string } {
  const { context, source, lib, libMethod, colorize } = params;

  let sourceDisplay = "";
  let libMethodDisplay = "";

  if (source) {
    sourceDisplay = `[${colorize(source)}]`;
  }

  if (lib) {
    const methodPath = libMethod ? `${context}.${libMethod}` : context;
    libMethodDisplay = `[${colorize(methodPath)}]`;
    if (source === context || source === methodPath) {
      sourceDisplay = "";
    }
    return { sourceDisplay, libMethodDisplay };
  }

  // libMethod sem lib: ainda combina context.libMethod para mostrar ClassName.methodName
  if (libMethod) {
    const methodPath = `${context}.${libMethod}`;
    libMethodDisplay = `[${colorize(methodPath)}]`;
    if (source === context || source === methodPath) {
      sourceDisplay = "";
    }
    return { sourceDisplay, libMethodDisplay };
  }

  if (!source) {
    libMethodDisplay = `[${colorize(context)}]`;
    return { sourceDisplay, libMethodDisplay };
  }

  if (source.startsWith(`${context}.`) || source === context) {
    libMethodDisplay = `[${colorize(source)}]`;
    sourceDisplay = "";
    return { sourceDisplay, libMethodDisplay };
  }

  libMethodDisplay = `[${colorize(context)}]`;
  sourceDisplay = `[${colorize(source)}]`;
  return { sourceDisplay, libMethodDisplay };
}

function formatDevelopmentLog(
  infoInput: WritableLogInfo,
  useColors: boolean,
  levelColorizer: ReturnType<typeof format.colorize>,
): string {
  const info = infoInput;
  const level = asString(info.level) ?? "info";
  const message = asString(info.message) ?? "";
  const timestamp = asString(info.timestamp) ?? "";
  const requestId = asString(info.requestId) ?? "no-request-id";
  const context = asString(info.context) ?? "App";
  const source = asString(info.source);
  const appName = asString(info.appName);
  const appVersion = asString(info.appVersion);
  const lib = asString(info.lib);
  const libMethod = asString(info.libMethod);
  const libVersion = asString(info.libVersion);
  const stack = asString(info.stack);
  const traceStack = Array.isArray(info.traceStack)
    ? info.traceStack
    : undefined;

  const meta =
    info.meta && typeof info.meta === "object"
      ? (info.meta as Record<string, unknown>)
      : undefined;

  const colors = {
    reset: "\x1b[0m",
    gray: "\x1b[90m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    green: "\x1b[32m",
  };

  const coloredLevel = useColors
    ? levelColorizer.colorize(level, level.toUpperCase())
    : level.toUpperCase();

  const coloredTime = colorizeText(
    useColors,
    colors.gray,
    colors.reset,
    timestamp,
  );
  const coloredRequestId = colorizeText(
    useColors,
    colors.cyan,
    colors.reset,
    requestId,
  );

  let appDisplay = "";
  if (appName) {
    const appLabel = appVersion ? `${appName}:${appVersion}` : appName;
    appDisplay = `[${colorizeText(useColors, colors.green, colors.reset, appLabel)}]`;
  }

  let libDisplay = "";
  if (lib) {
    const libText = libVersion ? `${lib}:${libVersion}` : lib;
    libDisplay = `[${colorizeText(useColors, colors.yellow, colors.reset, libText)}]`;
  }

  const methodDisplays = buildMethodDisplays({
    context,
    source,
    lib,
    libMethod,
    colorize: (text) =>
      colorizeText(useColors, colors.magenta, colors.reset, text),
  });
  const { sourceDisplay } = methodDisplays;
  let libMethodDisplay = methodDisplays.libMethodDisplay;

  let traceStackDisplay = "";
  if (traceStack && traceStack.length > 0) {
    const stackItems = traceStack
      .map(
        (item) =>
          `[${colorizeText(useColors, colors.magenta, colors.reset, item)}]`,
      )
      .join("");
    traceStackDisplay = stackItems;

    // Suppress libMethodDisplay only when it would duplicate the last traceStack item.
    // This happens when the logging context is the same method that @TraceMethod pushed.
    // When a different class (e.g. InMemoryCacheProvider) logs within that context,
    // its method display must still appear.
    if (!lib) {
      const lastStackItem = traceStack[traceStack.length - 1];
      const currentMethod = source || context;
      if (currentMethod === lastStackItem) {
        libMethodDisplay = "";
      }
    }
  }

  let output = `[${coloredRequestId}][${coloredTime}]${appDisplay}${traceStackDisplay}${sourceDisplay}${libDisplay}${libMethodDisplay}[${coloredLevel}] - ${message}`;

  if (meta && typeof meta === "object" && Object.keys(meta).length > 0) {
    const inspectedMeta = inspect(meta, {
      colors: useColors,
      depth: null,
      compact: true,
      sorted: true,
      breakLength: Infinity,
    });
    output += ` - ${inspectedMeta}`;
  }

  if (stack) {
    output += `\n${colorizeText(useColors, colors.red, colors.reset, stack)}`;
  }

  return output;
}

@Module({})
export class WinstonImplementationModule {
  static forRoot(config?: LoggerConfig): DynamicModule {
    const providers = this.createProviders(config);

    return {
      module: WinstonImplementationModule,
      providers,
      exports: [WINSTON_LOGGER],
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory: (...args: any[]) => Promise<LoggerConfig> | LoggerConfig;
    inject?: any[];
  }): DynamicModule {
    return {
      module: WinstonImplementationModule,
      imports: options.imports || [],
      providers: [
        {
          provide: "LOGGER_CONFIG",
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: WINSTON_RAW,
          useFactory: (config: LoggerConfig) => {
            return this.createWinstonLogger(config);
          },
          inject: ["LOGGER_CONFIG"],
        },
        {
          provide: WINSTON_OBFUSCATOR,
          useFactory: (config: LoggerConfig) => {
            return (
              config?.obfuscator ??
              buildDefaultObfuscator(config?.obfuscatorKeys)
            );
          },
          inject: ["LOGGER_CONFIG"],
        },
        {
          provide: WINSTON_LOGGER,
          useClass: WinstonLoggerProvider,
        },
      ],
      exports: [WINSTON_LOGGER],
    };
  }

  private static createProviders(config?: LoggerConfig): Provider[] {
    const winstonLogger = this.createWinstonLogger(config);
    const obfuscator =
      config?.obfuscator ?? buildDefaultObfuscator(config?.obfuscatorKeys);

    return [
      {
        provide: "LOGGER_CONFIG",
        useValue: config,
      },
      {
        provide: WINSTON_RAW,
        useValue: winstonLogger,
      },
      {
        provide: WINSTON_OBFUSCATOR,
        useValue: obfuscator,
      },
      {
        provide: WINSTON_LOGGER,
        useClass: WinstonLoggerProvider,
      },
    ];
  }

  private static createWinstonLogger(config?: LoggerConfig) {
    const isProduction =
      config?.isProduction ?? process.env.NODE_ENV === "production";
    const useColors = config?.colorize !== false;

    // Standard fields we want to ensure are in the log object
    const standardFields = format((info) => {
      const writableInfo = info as WritableLogInfo;
      fillInfoFromMeta(writableInfo);
      applyDefaultInfoValues(writableInfo, config);
      return writableInfo;
    });

    const levelColorizer = format.colorize();

    // Custom format for development (colorful and intuitive)
    const developmentFormat = format.printf((info) =>
      formatDevelopmentLog(info as WritableLogInfo, useColors, levelColorizer),
    );

    const formats = [
      format.timestamp(),
      format.errors({ stack: true }),
      format.splat(),
      standardFields(),
    ];

    if (isProduction) {
      formats.push(format.json());
    } else {
      formats.push(developmentFormat);
    }

    const defaultFormat = format.combine(...formats);

    const consoleTransport = new transports.Console({
      format: defaultFormat,
    });

    const transportsList: any[] = [consoleTransport];

    if (config?.fileTransport?.enabled) {
      try {
        const DailyRotateFile = require("winston-daily-rotate-file");
        const fileTransport = new DailyRotateFile({
          dirname: config.fileTransport.dir ?? "logs",
          filename: config.fileTransport.filename ?? "app-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          maxSize: config.fileTransport.maxSize ?? "20m",
          maxFiles: config.fileTransport.maxFiles ?? "14d",
          format: isProduction ? format.json() : developmentFormat,
        });
        transportsList.push(fileTransport);
      } catch (error) {
        console.warn(
          "winston-daily-rotate-file not installed, skipping file transport",
        );
      }
    }

    const defaultOptions: LoggerOptions = {
      level:
        config?.level || (process.env.LOG_LEVEL as any) || DEFAULT_LOG_LEVEL,
      format: defaultFormat,
      transports: transportsList,
    };

    const mergedOptions: LoggerOptions = config?.loggerOptions
      ? { ...defaultOptions, ...config.loggerOptions }
      : defaultOptions;

    return createLogger(mergedOptions);
  }
}
