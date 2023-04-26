import { execSync } from "child_process";
import {
  GerritData,
  GerritDataMap,
  LocalBranchData,
  LocalBranchDataMap,
} from "./types.d";

type Row = string[];

export function bold(text: string) {
  return `\x1b[1m${text}\x1b[0m`;
}

// grey with transparent background
export function grey(text: string) {
  return `\x1b[37m\x1b[40m${text}\x1b[0m`;
}

// brown with transparent background
export function darkBrown(text: string) {
  // return `\x1b[43m\x1b[30m${text}\x1b[0m`;
  return `\x1b[33m${text}\x1b[0m`;
}

export function green(text: string) {
  return `\x1b[42m\x1b[30m${text}\x1b[0m`;
}

// yellow text with transparent background
export function yellow(text: string) {
  // return `\x1b[33m\x1b[40m${text}\x1b[0m`;
  return `\x1b[33m${text}\x1b[0m`;
}

export function getChangeIdFromCommitMessage(message: string) {
  // Extract the Change-Id
  const regex = /Change-Id: .{41}/;
  const change_id_match = message.match(regex);

  if (change_id_match) {
    const change_id = change_id_match[0].substring(11);
    return change_id;
  }
  return null;
}

export function getLocalBranchNames(): string[] {
  // Extract local branch names
  const stdout = execSync(
    `git for-each-ref --sort=committerdate refs/heads/ --format='%(refname:lstrip=2)' | grep -v '^master$'`
  );
  return stdout.toString().trim().split("\n");
}

export function getGerritData(changeIds: string[]) {
  const query = changeIds.map((cid) => `change:${cid}`).join(" OR ");

  // if query is empty
  if (!query) {
    console.log("No change IDs found");
    process.exit(0);
  }

  // Run the gerrit query command
  const gerrit_output = execSync(
    `ssh gerrit "gerrit query --current-patch-set --format=JSON '${query}'"`
  )
    .toString()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as GerritData);

  return gerrit_output.reduce<GerritDataMap>((acc, change) => {
    return {
      ...acc,
      [change.id]: change,
    };
  }, {});
}

export function getLocalBranchData(branchNames: string[]) {
  return branchNames.reduce<LocalBranchDataMap>((acc, branchName) => {
    // Get the latest commit SHA and message
    const gitLogOutput = execSync(`git log -1 --pretty=format:%h%n%B ${branchName}`)
      .toString()
      .trim();

    // Split the output into commit SHA and message
    const [shortHash, ...commitMessageLines] = gitLogOutput.split("\n");

    const localBranchData: LocalBranchData = {
      changeId: getChangeIdFromCommitMessage(commitMessageLines.join("\n")) || null,
      subject: commitMessageLines[0],
      shortHash,
    };

    return {
      ...acc,
      [branchName]: localBranchData,
    };
  }, {});
}

export const normalizeValue = (value: string) => {
  if (value === "1" || value === "2") {
    return `+${value}`;
  }
  return value;
};

export function normalizeApproverName(name: string) {
  return name
    .replace(" (Bot)", "")
    .replace("Service Cloud Jenkins", "Jenkins")
    .replace("Larry Gergich", "Gergich");
}

export function abbreviateApproverDescription(name: string) {
  if (name === "Lint-Review") {
    return `Lint `;
  }
  if (name === "Code-Review") {
    return `CR `;
  }
  if (name === "Product-Review") {
    return `PR `;
  }
  if (name === "QA-Review") {
    return `QA `;
  }
  return `${name} `;
}
