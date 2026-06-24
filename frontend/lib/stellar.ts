import {
  isConnected,
  isAllowed,
  setAllowed,
  getAddress,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api";
import { Networks, TransactionBuilder, Account, BASE_FEE } from "@stellar/stellar-sdk";

const NETWORK =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK as "TESTNET" | "PUBLIC") ?? "TESTNET";
const PASSPHRASE =
  NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;

export async function getFreighterAddress(): Promise<string | null> {
  const conn = await isConnected();
  if (!conn?.isConnected) return null;
  const allowed = await isAllowed();
  if (!allowed?.isAllowed) return null;
  const res = await getAddress();
  return res?.address ?? null;
}

export async function connectFreighter(): Promise<string> {
  const allowed = await isAllowed();
  if (!allowed?.isAllowed) {
    const grant = await setAllowed();
    if (!grant?.isAllowed) throw new Error("freighter not allowed");
  }
  const res = await getAddress();
  if (!res?.address) throw new Error("no address");
  return res.address;
}

export async function getFreighterNetwork(): Promise<{
  network: string;
  networkPassphrase: string;
} | null> {
  const conn = await isConnected();
  if (!conn?.isConnected) return null;
  const net = await getNetwork();
  if (net?.error) return null;
  return { network: net.network, networkPassphrase: net.networkPassphrase };
}

export async function isNetworkMismatch(): Promise<boolean> {
  const walletNet = await getFreighterNetwork();
  if (!walletNet) return false;
  return walletNet.networkPassphrase !== PASSPHRASE;
}

export async function signRentPayment(_input: {
  propertyId: string;
  amount: number;
}): Promise<string> {
  const address = await connectFreighter();

  const placeholderAccount = new Account(address, "0");
  const tx = new TransactionBuilder(placeholderAccount, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .setTimeout(60)
    .build();

  const signed = await signTransaction(tx.toXDR(), {
    networkPassphrase: PASSPHRASE,
    address,
  });
  return signed?.signedTxXdr ?? "";
}