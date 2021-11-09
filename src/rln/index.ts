import * as path from "path";
import * as fs from "fs";
import config from "../config";
import {
  WakuMessage,
  RateLimitProof,
  WakuMessageStatus,
  RLNcredentials,
  Witness,
} from "../utils/types";
import {
  Rln,
  genSignalHash,
  genExternalNullifier,
  FullProof,
} from "@libsem/protocols";
import MessageStats from "../db/models/MessageStats/MessageStats.model";
import User from "../db/models/User/User.model";
import poseidonHash from "../utils/hasher";
import { serialize, deserialize } from "v8";
import { genEpoch } from "./utils";
const PROVER_KEY_PATH: string = path.join("./circuitFiles", "rln_final.zkey");
const CIRCUIT_PATH: string = path.join("./circuitFiles", "rln.wasm");
const VERIFIER_KEY_PATH: string = path.join(
  "./circuitFiles",
  "verification_key.json"
);

const verifierKey: any = JSON.parse(
  fs.readFileSync(VERIFIER_KEY_PATH, "utf-8")
);

export const verifyProof = async (
  rlnProof: RateLimitProof
): Promise<WakuMessageStatus> => {
  console.log("verifiying proof...");
  const fullProof: FullProof = {
    proof: deserialize(rlnProof.proof),
    publicSignals: [
      BigInt(rlnProof.shareY.toString()),
      BigInt(rlnProof.merkleRoot.toString()),
      BigInt(rlnProof.nullifier.toString()),
      genSignalHash(rlnProof.shareX.toString()),
      genEpoch(), // epoch to be handled properly
      BigInt(config.RLN_IDENTIFIER),
    ],
  };

  const status = await Rln.verifyProof(verifierKey, fullProof);
  console.log("Proof verification status...", status);
  if (!status) {
    return WakuMessageStatus.INVALID;
  }
  return WakuMessageStatus.VALID;
};

export const generateProof = async (
  message: WakuMessage,
  witness: Witness,
  rlnSecret: string
): Promise<RateLimitProof> => {


  // const epoch = genExternalNullifier(message.timestamp.toString());
  const epoch = genEpoch();

  const signal = `${message.payload.toString()}${message.contentTopic}`;
  const signalHash = genSignalHash(signal);

  const rlnIdentifier = BigInt(config.RLN_IDENTIFIER);
  const identitySecret = BigInt(rlnSecret);

  const proofWitness: FullProof = Rln.genWitness(
    identitySecret,
    witness,
    epoch,
    signal,
    rlnIdentifier
  );

  const fullProof: FullProof = await Rln.genProof(
    proofWitness,
    CIRCUIT_PATH,
    PROVER_KEY_PATH
  );

  const [y, nullifier] = Rln.calculateOutput(
    identitySecret,
    BigInt(epoch),
    rlnIdentifier,
    signalHash
  );

  const proofSerlialized = serialize(fullProof.proof);

  const proof: RateLimitProof = {
    // TODO: encode the fullProof.proof field here
    proof: proofSerlialized,
    nullifier: Buffer.from(nullifier.toString(), "utf-8"),
    shareX: Buffer.from(signal, "utf-8"),
    shareY: Buffer.from(y.toString(), "utf-8"),
    epoch: Buffer.from(epoch, "utf-8"),
    merkleRoot: Buffer.from(witness.root, "utf-8"),
  };

  return proof;
};

export const retreiveCredentials = async (
  proof: RateLimitProof
): Promise<RLNcredentials> => {
  const requestStats = await MessageStats.getSharesByEpochForUser(
    proof.epoch.toString(),
    proof.nullifier.toString()
  );

  const sharesX = requestStats.map((stats) => BigInt(stats.xShare));
  const sharesY = requestStats.map((stats) => BigInt(stats.yShare));

  const secret: bigint = Rln.retrieveSecret(
    sharesX[0],
    genSignalHash(proof.shareX.toString()),
    sharesY[0],
    BigInt(proof.shareY.toString())
  );
  const idCommitment = poseidonHash([secret]).toString();

  return {
    secret: secret.toString(),
    idCommitment,
  };
};
