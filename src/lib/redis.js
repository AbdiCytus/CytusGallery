const { createClient } = require('redis');

let redisClient;
let isRedisConnected = false;

const initRedis = async () => {
  if (redisClient) return redisClient;

  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    socket: {
      reconnectStrategy: false
    }
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
    isRedisConnected = false;
  });

  redisClient.on('connect', () => {
    console.log('Connected to Redis');
    isRedisConnected = true;
  });

  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis, continuing without cache.', err.message);
    isRedisConnected = false;
  }

  return redisClient;
};

const getRedisClient = () => redisClient;
const isConnected = () => isRedisConnected;

module.exports = {
  initRedis,
  getRedisClient,
  isConnected
};
