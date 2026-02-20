import { address } from "skittles";

export enum VaultStatus {
  Active,
  Paused,
}

export type StakeInfo = {
  amount: number;
  timestamp: number;
  account: address;
};
