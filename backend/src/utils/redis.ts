import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL as string);

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

export default redis;
