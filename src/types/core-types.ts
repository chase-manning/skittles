export type address = string;

export const self: address = "0x00000000006c3852cbEf3e08E8dF289169EdE581";

export class block {
  // Current block miner’s address
  static get coinbase(): address {
    return "0x0000000000000000000000000000000000000000";
  }

  // Current block difficulty
  static get difficulty(): number {
    return 0;
  }

  // Current block number
  static get block(): number {
    return 0;
  }

  // Equivalent to blockhash(block.number - 1)
  static get prevhash(): number {
    return 0;
  }

  // Current block epoch timestamp
  static get timestamp(): number {
    return 0;
  }
}

export class chain {
  // Chain ID
  static get id(): number {
    return 0;
  }
}

export class msg {
  // Message data
  static get data(): string {
    return "";
  }

  // Sender of the message (current call)
  static get sender(): address {
    return "0x0000000000000000000000000000000000000000";
  }

  // Number of wei sent with the message
  static get value(): number {
    return 0;
  }
}

export class tx {
  // Gas price of current transaction in wei
  static get gasPrice(): number {
    return 0;
  }

  // Sender of the transaction (full call chain)
  static get origin(): address {
    return "0x0000000000000000000000000000000000000000";
  }
}
