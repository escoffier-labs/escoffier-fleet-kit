#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(repoRoot, "publishing", "manifest.json");
const defaultReposDir = process.env.ESCOFFIER_REPOS_DIR || path.join(os.homedir(), "repos");
const defaultReceiptDir = path.join(
  os.homedir(),
  ".openclaw",
  "workspace",
  "logs",
  "escoffier-publishing"
);

function git(repo, args) {
  try {
    return execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    return null;
  }
}

function clawhubInspect(slug) {
  if (process.env.ESCOFFIER_PUBLISHING_LIVE === "0") return null;
  try {
    const raw = execFileSync("npx", ["-y", "clawhub", "inspect", slug, "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000
    });
    return JSON.parse(raw);
  } catch (error) {
    return {
      error: error.stderr?.toString().trim() || error.message
    };
  }
}

function isoStamp() {
  return new Date().toISOString();
}

function compactStatus(status) {
  const lines = status.split("\n").filter(Boolean);
  if (lines.length === 0) return "clean";
  return `${lines.length} changed line${lines.length === 1 ? "" : "s"}`;
}

function loadManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function resolveLocalRepo(entry) {
  if (entry.localRepo) return entry.localRepo;
  if (entry.repoDir) return path.join(defaultReposDir, entry.repoDir);
  return null;
}

function inspectEntry(entry) {
  const localRepo = resolveLocalRepo(entry);
  const repoExists = localRepo ? existsSync(localRepo) : false;
  const sourceAbs = repoExists
    ? path.resolve(localRepo, entry.sourcePath)
    : null;
  const sourceExists = sourceAbs ? existsSync(sourceAbs) : false;
  const head = repoExists ? git(localRepo, ["rev-parse", "HEAD"]) : null;
  const branch = repoExists
    ? git(localRepo, ["rev-parse", "--abbrev-ref", "HEAD"])
    : null;
  const status = repoExists
    ? git(localRepo, ["status", "--short"]) ?? "git-status-failed"
    : "repo-missing";

  const blockers = [];
  if (entry.blocker) blockers.push(entry.blocker);
  if (!repoExists) blockers.push("repo_missing");
  if (!sourceExists) blockers.push("source_path_missing");
  if (status && status !== "clean" && status.trim().length > 0) {
    blockers.push("working_tree_not_clean");
  }
  if (entry.status === "staged-needed") blockers.push("artifact_not_created");

  const live =
    entry.type === "clawhub-skill" && entry.status === "published"
      ? clawhubInspect(entry.slug)
      : null;
  const liveSkill = live?.skill ?? null;
  const liveStats = liveSkill?.stats ?? null;
  const liveModeration = live?.moderation ?? null;

  if (live?.error) blockers.push("clawhub_inspect_failed");
  if (liveModeration?.verdict && liveModeration.verdict !== "clean") {
    blockers.push(`clawhub_${liveModeration.verdict}`);
  }

  return {
    ...entry,
    localRepo,
    repoExists,
    sourceExists,
    sourceAbs,
    head,
    branch,
    workingTree: compactStatus(status || ""),
    blockers,
    live: live
      ? {
          error: live.error ?? null,
          version: live.latestVersion?.version ?? null,
          stats: liveStats,
          moderation: liveModeration
            ? {
                verdict: liveModeration.verdict,
                summary: liveModeration.summary
              }
            : null,
          updatedAt: liveSkill?.updatedAt ?? null
        }
      : null
  };
}

function buildMarkdown(manifest, inspected) {
  const title = "Escoffier publishing watchdog";
  const lines = [`**${title}**`, `Checked: ${isoStamp()}`, ""];

  const groups = new Map();
  for (const entry of inspected) {
    if (!groups.has(entry.type)) groups.set(entry.type, []);
    groups.get(entry.type).push(entry);
  }

  for (const [type, entries] of groups) {
    lines.push(`**${type}**`);
    for (const entry of entries.sort((a, b) => a.priority - b.priority)) {
      const blockerText = entry.blockers.length === 0 ? "ok" : entry.blockers.join(", ");
      const stats = entry.live?.stats
        ? `, installs ${entry.live.stats.installsAllTime}, downloads ${entry.live.stats.downloads}, stars ${entry.live.stats.stars}`
        : "";
      const verdict = entry.live?.moderation?.verdict
        ? `, scan ${entry.live.moderation.verdict}`
        : "";
      lines.push(
        `- ${entry.slug}: ${entry.status}, ${entry.workingTree}, ${blockerText}${stats}${verdict}`
      );
    }
    lines.push("");
  }

  const statsChannel = manifest.discord?.statsChannel;
  if (!statsChannel?.id && statsChannel?.status !== "configured-out-of-band") {
    lines.push(
      "Stats channel is not configured yet. Candidate names: " +
        (statsChannel?.candidates ?? []).join(", ")
    );
  }

  return lines.join("\n").trimEnd();
}

function main() {
  const manifest = loadManifest();
  const inspected = manifest.entries.map(inspectEntry);
  const receipt = {
    schema: "escoffier.publishing.watchdog.receipt.v1",
    checkedAt: isoStamp(),
    manifestPath,
    entries: inspected
  };

  const receiptDir = process.env.ESCOFFIER_PUBLISHING_LOG_DIR || defaultReceiptDir;
  mkdirSync(receiptDir, { recursive: true });
  const receiptPath = path.join(
    receiptDir,
    `${receipt.checkedAt.replace(/[:.]/g, "-")}.json`
  );
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");

  console.log(buildMarkdown(manifest, inspected));
  console.log("");
  console.log(`Receipt: ${receiptPath}`);
}

main();
