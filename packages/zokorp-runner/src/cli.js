#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const config = {
  controlPlaneUrl: process.env.ZOKORP_CONTROL_PLANE_URL,
  runnerApiKey: process.env.ZOKORP_RUNNER_API_KEY,
  runnerName: process.env.ZOKORP_RUNNER_NAME ?? `runner-${Math.random().toString(36).slice(2, 8)}`,
  pollIntervalMs: Number(process.env.ZOKORP_RUNNER_POLL_INTERVAL_MS ?? "8000"),
  workDir: process.env.ZOKORP_RUNNER_WORK_DIR ?? "/tmp/zokorp-runner",
};

function requireConfig() {
  if (!config.controlPlaneUrl || !config.runnerApiKey) {
    console.error(
      "Missing ZOKORP_CONTROL_PLANE_URL or ZOKORP_RUNNER_API_KEY. See packages/zokorp-runner/README.md",
    );
    process.exit(1);
  }
}

async function callControlPlane(endpoint, options = {}) {
  const response = await fetch(`${config.controlPlaneUrl}${endpoint}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-zokorp-runner-key": config.runnerApiKey,
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Control plane request failed (${response.status} ${response.statusText}): ${payload.error ?? "unknown"}`,
    );
  }

  return payload;
}

function spawnProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);

    const stdout = [];
    const stderr = [];

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      stdout.push(...text.split(/\r?\n/).filter(Boolean));
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      stderr.push(...text.split(/\r?\n/).filter(Boolean));
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function uploadArtifact(job, filePath) {
  const stat = await fs.stat(filePath);

  const signedUpload = await fetch(`${config.controlPlaneUrl}/api/mlops/artifacts/signed-upload`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-zokorp-runner-key": config.runnerApiKey,
    },
    body: JSON.stringify({
      organizationSlug: job.organizationSlug,
      projectId: job.project.id,
      jobId: job.id,
      fileName: path.basename(filePath),
      sizeBytes: stat.size,
      contentType: "application/octet-stream",
    }),
  });

  const payload = await signedUpload.json().catch(() => ({}));
  if (!signedUpload.ok) {
    throw new Error(`Failed to create signed artifact upload: ${payload.error ?? "unknown"}`);
  }

  const fileBuffer = await fs.readFile(filePath);

  const uploadResponse = await fetch(payload.signedUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/octet-stream",
      "x-upsert": "false",
    },
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Artifact upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  return {
    artifactId: payload.artifactId,
    path: payload.path,
    sizeBytes: stat.size,
  };
}

async function processJob(job) {
  const startedAt = new Date().toISOString();
  console.log(`[${startedAt}] Claimed job ${job.id} (${job.name})`);

  const jobDir = path.join(config.workDir, job.id);
  await ensureDir(jobDir);

  const command = Array.isArray(job.command) ? job.command : [];
  const envMap = job.env && typeof job.env === "object" ? job.env : {};
  const dockerArgs = [
    "run",
    "--rm",
    "-v",
    `${jobDir}:/workspace`,
    "-w",
    "/workspace",
    ...Object.entries(envMap).flatMap(([key, value]) => ["-e", `${key}=${String(value)}`]),
    job.containerImage,
    ...command,
  ];

  const execution = await spawnProcess("docker", dockerArgs, {
    env: process.env,
  });

  const output = {
    exitCode: execution.code,
    startedAt,
    completedAt: new Date().toISOString(),
  };

  const logs = [...execution.stdout.slice(-120), ...execution.stderr.slice(-120)].slice(-200);

  const artifactRefs = [];
  const requestedArtifacts = Array.isArray(job.inputs?.artifactPaths)
    ? job.inputs.artifactPaths.filter((entry) => typeof entry === "string")
    : [];

  for (const artifactPathRaw of requestedArtifacts) {
    const artifactPath = path.isAbsolute(artifactPathRaw)
      ? artifactPathRaw
      : path.join(jobDir, artifactPathRaw);

    if (!(await exists(artifactPath))) {
      logs.push(`Artifact path not found, skipped: ${artifactPathRaw}`);
      continue;
    }

    try {
      const uploaded = await uploadArtifact(
        {
          ...job,
          organizationSlug: job.organizationSlug,
        },
        artifactPath,
      );
      artifactRefs.push(uploaded);
      logs.push(`Uploaded artifact ${uploaded.path}`);
    } catch (error) {
      logs.push(`Artifact upload failed for ${artifactPathRaw}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  const status = execution.code === 0 ? "SUCCEEDED" : "FAILED";

  await callControlPlane("/api/mlops/runner/report-job", {
    method: "POST",
    body: JSON.stringify({
      jobId: job.id,
      status,
      logs,
      outputs: {
        ...output,
        artifactRefs,
      },
      errorMessage: execution.code === 0 ? undefined : "Container process exited non-zero.",
    }),
  });

  return status;
}

async function runOnce() {
  const payload = await callControlPlane("/api/mlops/runner/pull-job", {
    method: "POST",
    body: JSON.stringify({
      runnerName: config.runnerName,
    }),
  });

  if (!payload.job) {
    console.log("No queued jobs.");
    return false;
  }

  await processJob(payload.job);
  return true;
}

async function workerLoop() {
  while (true) {
    try {
      await runOnce();
    } catch (error) {
      console.error("Runner loop error:", error instanceof Error ? error.message : error);
    }

    await sleep(config.pollIntervalMs);
  }
}

async function main() {
  requireConfig();
  await ensureDir(config.workDir);

  const mode = process.argv[2] ?? "worker";

  if (mode === "once") {
    await runOnce();
    return;
  }

  await workerLoop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
