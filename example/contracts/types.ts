import { address } from "skittles";

export enum VaultStatus {
  Active,
  Paused,
}

export interface StakeInfo {
  amount: number;
  timestamp: number;
  account: address;
}
