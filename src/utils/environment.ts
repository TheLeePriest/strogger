import { z } from "zod";

const LoggerEnvironmentSchema = z.object({
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]).optional(),
  STAGE: z.enum(["dev", "prod", "test"]).default("dev"),
  SERVICE_NAME: z.string().optional(),
  ENABLE_STRUCTURED_LOGGING: z
    .string()
    .transform((val: string) => val === "true")
    .optional(),
  CLOUDWATCH_LOG_GROUP: z.string().optional(),
  CLOUDWATCH_LOG_STREAM: z.string().optional(),
  AWS_REGION: z.string().optional(),
});

export type LoggerEnvironment = z.infer<typeof LoggerEnvironmentSchema>;

export const getEnvironment = (
  env: Record<string, string | undefined> = process.env,
): LoggerEnvironment & {
  isProduction: boolean;
  isDevelopment: boolean;
  logLevel: string | undefined;
  serviceName: string | undefined;
  enableStructuredLogging: boolean;
  stage: string;
} => {
  let config: LoggerEnvironment;
  try {
    config = LoggerEnvironmentSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn(
        "Environment validation failed, using defaults:",
        error.errors,
      );
    }
    config = { STAGE: "dev" } as LoggerEnvironment;
  }
  return {
    ...config,
    isProduction: config.STAGE === "prod",
    isDevelopment: config.STAGE === "dev",
    logLevel: config.LOG_LEVEL ?? undefined,
    serviceName: config.SERVICE_NAME ?? undefined,
    enableStructuredLogging: config.ENABLE_STRUCTURED_LOGGING ?? true,
    stage: config.STAGE,
  };
};
