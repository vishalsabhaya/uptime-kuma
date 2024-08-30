const Redis = require('ioredis');
const { createAdapter } = require("@socket.io/redis-adapter");

// Configure Redis connection
const redisConnection = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    retryStrategy: function (times) {
        // Exponential backoff formula with a cap
        const delay = Math.max(Math.min(Math.exp(times), 20000), 1000);
        return delay;
    }
};

// cluster server
// const redisClient = new Redis.Cluster([redisConnection]);
// const pubClient = new Redis.Cluster([redisConnection]);
// const subClient = new Redis.Cluster([redisConnection]);

//local
// const redisClient = new Redis(redisConnection);
// const pubClient = new Redis(redisConnection);
// const subClient = new Redis(redisConnection);
const socketIoRedisAdapter = createAdapter(pubClient, subClient);

redisClient.on('error', (err) => {
    console.error('Redis Client encountered an error:', err);
});

pubClient.on('error', (err) => {
    console.error('Redis PubClient encountered an error:', err);
});

subClient.on('error', (err) => {
    console.error('Redis SubClient encountered an error:', err);
});


module.exports = {
    redisConnection,
    redisClient,
    pubClient,
    subClient,
    socketIoRedisAdapter
};
