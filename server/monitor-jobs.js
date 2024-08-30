const { log } = require("../src/util");
const { R } = require("redbean-node");
const { UptimeKumaServer } = require("./uptime-kuma-server");
const server = UptimeKumaServer.getInstance();
const io = module.exports.io = server.io;
const { Queue } = require('bullmq');
const { Worker } = require('bullmq');
const { redisConnection, redisClient } = require("./redis-setting");
const monitorJobQueue = new Queue('monitor-job-queue', { connection: redisConnection, prefix: 'bull:{monitor-job-queue}' });

class MonitorJob {

    /**
     * start numbre of worker in each server
     * @returns {Promise<void>}
     */
    static async runJob(job) {
        let monitor = await R.findOne("monitor", "active=1 and id = ?", [
            job.data.monitorID,
        ]);
        if (monitor) {
            await monitor.start(io, job);
        }
    }

    /**
     * start number of worker in each server
     * @returns {Promise<void>}
     */
    static startWorkers() {
        try{
            const workerA = new Worker('monitor-job-queue', async job => {
                log.debug("REDISWORKER", `workerA start`);
                MonitorJob.runJob(job);
                log.debug("REDISWORKER", `workerA end`);
            }, { connection: redisConnection, concurrency: 400, stalledInterval: 30000, lockDuration: 30000, prefix: 'bull:{monitor-job-queue}' });
            workerA.on('completed', (job) => {
                log.debug("REDISWORKER", `workerA ${job.id} completed`);
            });
            workerA.on('failed', (job, err) => {
                log.debug("REDISWORKER", `${job.id} has failed with error ${err.message}`);
            });

            workerA.on('stalled', (job) => {
                log.debug("REDISWORKER", `Job ${job.id} has stalled.`);
            });

            const workerB = new Worker('monitor-job-queue', async job => {
                log.debug("REDISWORKER", `workerB start`);
                MonitorJob.runJob(job);
                log.debug("REDISWORKER", `workerB end`);
            }, { connection: redisConnection, concurrency: 400, stalledInterval: 30000, lockDuration: 30000, prefix: 'bull:{monitor-job-queue}' });
            workerB.on('completed', (job) => {
                log.debug("REDISWORKER", `workerB ${job.id} completed`);
            });
            workerB.on('failed', (job, err) => {
                log.debug("REDISWORKER", `${job.id} has failed with error ${err.message}`);
            });

            workerB.on('stalled', (job) => {
                console.log(`Job ${job.id} has stalled.`);
            });
        } catch(e) {
            log.debug("REDISWORKER", `error1 ${e} `);
        }
    }

    /**
     * remove job
     * @param {object} monitor
     * @returns {Promise<void>}
     */
    static async removeScheduledJob(monitorID) {
        try{
            const jobId = await redisClient.hget('job_metadata', monitorID);
            if (jobId){
                const job = await monitorJobQueue.getJob(jobId);
                if (job) {
                    await monitorJobQueue.removeRepeatableByKey(job.repeatJobKey);
                }
            }
        } catch(e) {
            log.debug("JOB", `error ${e} `);
        }
    }

    /**
     * schedule/update/restart job
     * @param {object} monitor
     * @returns {Promise<void>}
     */
    static async scheduleJob(monitor) {
        try{
            let interval = (monitor.interval || 1) * 1000;
            await MonitorJob.removeScheduledJob(monitor.id);
            const job = await monitorJobQueue.add(monitor.id,
                { monitorID: monitor.id},
                { repeat: { every: interval }, removeOnFail: false }
            );
            await redisClient.hset('job_metadata', monitor.id, job.id);
        } catch(e) {
            log.debug("REDISWORKER", `error2 ${e} `);
        }
    }
}

module.exports = {
    MonitorJob,
};
