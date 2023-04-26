export type LocalBranchData = {
  changeId: string | null;
  shortHash: string
  subject: string;
}

export type LocalBranchDataMap = {
  [branchName: string]: LocalBranchData;
}

export type GerritApproval = {
  type: 'SUBM';
  description: string;
  value: string;
  by: {
    name: string;
  }
}

export type GerritData = {
  currentPatchSet: {
    approvals: GerritApproval[]
  }
  id: string;
  status: 'MERGED' | 'ABANDONED';
  subject: string;
  url: string;
  wip: boolean;
  number: number
}

export type GerritDataMap = {
  [changeId: string]: GerritData;
}