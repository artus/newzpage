import validator from "valivalue";

const validateEnv = (value: string | undefined, subject: string) => {
  validator.objects.validateNotNullOrUndefined(value, `ENV Variable '${subject}'`);
  return validator.strings.validateNotEmpty(value!, `ENV Variable '${subject}'`);
}

export const CONFIG = {
  ORIGIN: validateEnv(process.env.ORIGIN, "ORIGIN"),
  OPENAI: {
    API_KEY: validateEnv(process.env.OPENAI_API_KEY, "OPENAI_API_KEY"),
    API_URL: validateEnv(process.env.OPENAI_API_URL, "OPENAI_API_URL"),
    MODEL: validateEnv(process.env.OPENAI_MODEL, "OPENAI_MODEL")
  },
  MONGODB: {
    URL: validateEnv(process.env.MONGODB_URL, "MONGODB_URL"),
    DB: validateEnv(process.env.MONGODB_DB, "MONGODB_DB"),
    USER: validateEnv(process.env.MONGODB_USER, "MONGODB_USER"),
    PASSWORD: validateEnv(process.env.MONGODB_PASSWORD, "MONGODB_PASSWORD"),
    RSS_COLLECTION: validateEnv(process.env.MONGODB_RSS_COLLECTION, "MONGODB_RSS_COLLECTION"),
    ARTICLE_COLLECTION: validateEnv(process.env.MONGODB_ARTICLE_COLLECTION, "MONGODB_ARTICLE_COLLECTION"),
  },
  LOGGING: {
    LEVEL: validateEnv(process.env.LOGGING_LEVEL, "LOGGING_LEVEL")
  }
}

