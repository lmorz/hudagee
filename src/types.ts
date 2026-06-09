export type ServerGroup = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountEntry = {
  id: string;
  serverId: string;
  characterName: string;
  username: string;
  password: string;
  profession: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type VaultData = {
  schemaVersion: 1;
  servers: ServerGroup[];
  accounts: AccountEntry[];
  professions: string[];
};

export type VaultEnvelope = {
  schemaVersion: 1;
  crypto: {
    algorithm: "AES-GCM";
    kdf: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
    nonce: string;
  };
  ciphertext: string;
};

export type AccountForm = {
  serverId: string;
  characterName: string;
  username: string;
  password: string;
  profession: string;
  note: string;
};
