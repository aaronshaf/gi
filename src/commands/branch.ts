import { execSync } from "child_process";
import { createInterface } from "readline";
import {
  abbreviateApproverDescription,
  bold,
  darkBrown,
  getGerritData,
  getLocalBranchData,
  getLocalBranchNames,
  green,
  grey,
  normalizeApproverName,
  normalizeValue,
  yellow,
} from "../utils";
import type {
  LocalBranchDataMap,
  LocalBranchData,
  GerritDataMap,
} from "../types.d";

const Table = require("cli-table3");

export function branch({
  v: isVerbose,
  d: shouldPromptForMergedBranchDeletion,
}: {
  v?: boolean;
  d?: boolean;
}) {
  const localBranchNameList = getLocalBranchNames();
  const localBranchDataMap = getLocalBranchData(localBranchNameList);
  const changeIds: string[] = Object.values<LocalBranchData>(localBranchDataMap)
    .map((b) => b.changeId)
    .filter(Boolean) as string[];
  const gerritOutputByChangeId = getGerritData(changeIds);

  const mergedBranches = localBranchNameList.filter((name) => {
    const changeId = localBranchDataMap[name].changeId;
    if (changeId) {
      const gerritData = gerritOutputByChangeId[changeId];
      return gerritData?.status === "MERGED";
    }
    return false;
  });

  output(
    localBranchNameList,
    localBranchDataMap,
    gerritOutputByChangeId,
    Boolean(isVerbose)
  );

  if (shouldPromptForMergedBranchDeletion) {
    promptForMergedBranchDeletion(mergedBranches);
  }
}

function output(
  localBranchNameList: string[],
  localBranchDataMap: LocalBranchDataMap,
  gerritOutputMap: GerritDataMap,
  isVerbose: boolean
) {
  const tableOptions = {
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: isVerbose ? "─" : "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: " ",
    },
    style: { "padding-left": 0, "padding-right": 0 },
  };
  const table = new Table(tableOptions);

  for (const localBranch of localBranchNameList) {
    const changeId = localBranchDataMap[localBranch].changeId;
    if (changeId && gerritOutputMap[changeId]) {
      const gerritData = gerritOutputMap[changeId];
      const subject = gerritData.subject;
      const isWip = gerritData.wip || subject.toLowerCase().startsWith("WIP");
      const isMerged = gerritData.status === "MERGED";
      const isAbandoned = gerritData.status === "ABANDONED";
      const labels = [
        isWip && darkBrown("WIP"),
        isAbandoned && grey("Abandoned"),
        isMerged && green("Merged"),
      ]
        .filter(Boolean)
        .map((str) => `[${str}]`) as string[];

      const approvals = (gerritData.currentPatchSet.approvals || []).map((a) => {
        let description = a.description;
        if (a.type === "SUBM" && !description) {
          description = "Submitted";
        }
        return isVerbose
          ? `${description || a.type}: ${normalizeValue(
              a.value
            )} (${normalizeApproverName(a.by.name)})`
          : `${abbreviateApproverDescription(
              description || a.type
            )}${normalizeValue(a.value)}`;
      });

      const approvalText = approvals.join(isVerbose ? "\n" : ", ");

      const topicText = gerritData.topic
        ? ` ${grey(`(${gerritData.topic})`)}`
        : "";

      if (isVerbose) {
        table.push([
          `${bold(localBranch)}${topicText}\n${localBranchDataMap[localBranch].shortHash}`,
          `${labels.join("\n")}`,
          `${subject}\n${yellow(gerritData.url.replace("https://", ""))}`,
          approvalText,
        ]);
      } else {
        table.push([
          localBranch,
          labels.join(" "),
          yellow(String(gerritData.number)),
          subject,
          approvalText,
        ]);
      }
    } else {
      if (isVerbose) {
        table.push([
          `${bold(localBranch)}\n${localBranchDataMap[localBranch].shortHash}`,
          "",
          localBranchDataMap[localBranch].subject,
          "",
        ]);
      } else {
        table.push([
          localBranch,
          "",
          "",
          localBranchDataMap[localBranch].subject,
          "",
        ]);
      }
    }
  }
  console.log(table.toString());
}

async function promptForMergedBranchDeletion(mergedBranches: string[]) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  for (const mergedLocalBranch of mergedBranches) {
    const answer: string = await new Promise((resolve) => {
      readline.question(
        `Delete merged local branch ${bold(mergedLocalBranch)}? (y/n) `,
        resolve
      );
    });
    if (answer.toLowerCase() === "y") {
      execSync(`git branch -D ${mergedLocalBranch}`);
      console.log(`  Deleted ${bold(mergedLocalBranch)}`);
    }
  }
  process.exit(0);
}
