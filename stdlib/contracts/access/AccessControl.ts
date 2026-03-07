import { address, bytes32, msg, SkittlesEvent, SkittlesError, Indexed, keccak256 } from "skittles";

/**
 * Contract module that allows children to implement role-based access
 * control mechanisms. Roles are referred to by their `bytes32` identifier,
 * which should be exposed in the external API via `public static readonly`
 * constants.
 * Based on OpenZeppelin Contracts v5.
 *
 * Skittles does not have Solidity-style modifiers. Instead, call
 * `this._checkRole(role)` at the start of any function that should be
 * restricted to holders of that role.
 *
 * Each role has an associated admin role. Only accounts with a role's admin
 * role can call `grantRole` and `revokeRole`. By default the admin role
 * for every role is `DEFAULT_ADMIN_ROLE`.
 */
export class AccessControl {
  static readonly DEFAULT_ADMIN_ROLE: bytes32 = 0;

  RoleGranted: SkittlesEvent<{
    role: Indexed<bytes32>;
    account: Indexed<address>;
    sender: Indexed<address>;
  }>;

  RoleRevoked: SkittlesEvent<{
    role: Indexed<bytes32>;
    account: Indexed<address>;
    sender: Indexed<address>;
  }>;

  RoleAdminChanged: SkittlesEvent<{
    role: Indexed<bytes32>;
    previousAdminRole: Indexed<bytes32>;
    newAdminRole: Indexed<bytes32>;
  }>;

  AccessControlUnauthorizedAccount: SkittlesError<{
    account: address;
    neededRole: bytes32;
  }>;

  AccessControlBadConfirmation: SkittlesError<{}>;

  private _roles: Record<bytes32, Record<address, boolean>> = {};
  private _roleAdmin: Record<bytes32, bytes32> = {};

  public hasRole(role: bytes32, account: address): boolean {
    return this._roles[role][account];
  }

  protected _checkRole(role: bytes32): void {
    if (!this._roles[role][msg.sender]) {
      throw this.AccessControlUnauthorizedAccount(msg.sender, role);
    }
  }

  public getRoleAdmin(role: bytes32): bytes32 {
    return this._roleAdmin[role];
  }

  public grantRole(role: bytes32, account: address): void {
    this._checkRole(this._roleAdmin[role]);
    this._grantRole(role, account);
  }

  public revokeRole(role: bytes32, account: address): void {
    this._checkRole(this._roleAdmin[role]);
    this._revokeRole(role, account);
  }

  public renounceRole(role: bytes32, callerConfirmation: address): void {
    if (callerConfirmation != msg.sender) {
      throw this.AccessControlBadConfirmation();
    }
    this._revokeRole(role, msg.sender);
  }

  protected _grantRole(role: bytes32, account: address): boolean {
    if (!this._roles[role][account]) {
      this._roles[role][account] = true;
      this.RoleGranted.emit(role, account, msg.sender);
      return true;
    }
    return false;
  }

  protected _revokeRole(role: bytes32, account: address): boolean {
    if (this._roles[role][account]) {
      this._roles[role][account] = false;
      this.RoleRevoked.emit(role, account, msg.sender);
      return true;
    }
    return false;
  }

  protected _setRoleAdmin(role: bytes32, adminRole: bytes32): void {
    let previousAdminRole: bytes32 = this._roleAdmin[role];
    this._roleAdmin[role] = adminRole;
    this.RoleAdminChanged.emit(role, previousAdminRole, adminRole);
  }
}
