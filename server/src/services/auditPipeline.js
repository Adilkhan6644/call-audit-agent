const AuditInstruction = require('../models/auditInstruction');
const storage = require('./storage');
const aiServiceClient = require('./aiServiceClient');
const { recordUsage } = require('./usage');

/**
 * Runs transcribe -> audit -> persist for a freshly-created pending job, and
 * returns it in its terminal state. No partial result is ever persisted —
 * either the validated AI result lands with status "completed", or status
 * becomes "failed" with a sanitized message (never the raw provider error,
 * which could include transcript content).
 */
async function runAuditPipeline(job, recording) {
  job.status = 'processing';
  await job.save();

  try {
    const audioBuffer = await storage.download(recording.storageKey);
    const transcriptResult = await aiServiceClient.transcribe(
      audioBuffer,
      recording.originalFilename,
      recording.contentType
    );

    const instruction = await AuditInstruction.findById(job.instructionId);
    const auditResult = await aiServiceClient.audit(transcriptResult.text, instruction.content);

    job.status = 'completed';
    job.result = auditResult;
    job.completedAt = new Date();
    await job.save();
    await recordUsage(job.ownerId, job._id);
  } catch (err) {
    // err.code === 'provider_quota_exceeded' is a hook point for the admin
    // alert wired up separately — the job itself always fails the same way.
    job.status = 'failed';
    job.result = null;
    job.errorMessage = 'Audit processing failed';
    job.completedAt = new Date();
    await job.save();
  }

  return job;
}

module.exports = { runAuditPipeline };
