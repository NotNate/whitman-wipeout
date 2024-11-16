export type TargetInfo = {
  name: string;
  safe: boolean;
};

export type DetailedTargetInfo = {
  fromName: string;
  toName: string;
  targetId: string;
  status: string;
};

export type TargetTeamInfo = {
  members: {
    name: string;
    safe: boolean;
    status: string;
  }[];
};