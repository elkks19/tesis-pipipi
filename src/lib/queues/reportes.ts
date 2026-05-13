import "server-only";

import { Queue } from "bullmq";

export const reportesQueueName = "reportes";
export const reporteHistoriaJobName = "reporteHistoria";

export type ReporteHistoriaJobData = {
  historiaId: string;
  requestedBy: string;
};

let reportesQueue: Queue<ReporteHistoriaJobData> | null = null;

function getRedisConnection() {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function getReportesQueue() {
  if (!reportesQueue) {
    reportesQueue = new Queue<ReporteHistoriaJobData>(reportesQueueName, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          delay: 5000,
          type: "exponential",
        },
        removeOnComplete: {
          age: 60 * 60 * 24,
          count: 100,
        },
        removeOnFail: {
          age: 60 * 60 * 24 * 7,
          count: 200,
        },
      },
    });
  }

  return reportesQueue;
}

export async function enqueueReporteHistoria(data: ReporteHistoriaJobData) {
  const queue = getReportesQueue();

  return queue.add(reporteHistoriaJobName, data);
}
