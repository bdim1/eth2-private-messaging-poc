import dotenv from "dotenv";
dotenv.config();

export default {
  DB_CONNECTION_STRING: process.env.DB_CONNECTION_STRING || "",
  MERKLE_TREE_LEVELS: parseInt(process.env.MERKLE_TREE_LEVELS || "31", 10),
  SPAM_TRESHOLD: parseInt(process.env.SPAM_TRESHOLD || "1", 10),
  ZERO_VALUE: BigInt(0),
  REGISTRY_SMART_CONTRACT_ADDRESS:
    process.env.REGISTRY_SMART_CONTRACT_ADDRESS || "",
  BLS_PRIVATE_KEY: process.env.BLS_PRIVATE_KEY || "", // the private key of the ETH2 validator
  BLS_PUBLIC_KEY: process.env.BLS_PUBLIC_KEY || "", // the public key of the ETH2 validator
  ETH_RPC_URL: process.env.ETH_RPC_URL || "http://localhost:8545",
};
