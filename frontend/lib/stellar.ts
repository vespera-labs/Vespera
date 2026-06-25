
import {
  isConnected,
  isAllowed,
  setAllowed,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import {
  Networks,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";

const NETWORK =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK as "TESTNET" | "PUBLIC") ??
  "TESTNET";
const PASSPHRASE =
  NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (NETWORK === "PUBLIC"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");
const CONTRACT_ID = process.env.NEXT_PUBLIC_RENTAL_CONTRACT_ID ?? "";

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
    if (!grant?.isAllowed) throw new Error("Freighter wallet not allowed");
  }
  const res = await getAddress();
  if (!res?.address) throw new Error("No Stellar address found in Freighter");
  return res.address;
}

/**
 * FIX #7: signRentPayment now loads the real account sequence from Horizon
 * and builds a real payment operation to the rental contract.
 *
 * Previously: Used new Account(address, "0") with no operations — the resulting
 * XDR encoded an empty transaction with a fake sequence that can never submit.
 * propertyId and amount were accepted but completely unused.
 */
export async function signRentPayment(input: {
  propertyId: string;
  amount: number;
  assetCode?: string;
  assetIssuer?: string;
}): Promise<string> {
  if (!CONTRACT_ID) {
    throw new Error(
      "NEXT_PUBLIC_RENTAL_CONTRACT_ID is not configured. " +
        "Cannot build rent payment transaction.",
    );
  }

  const address = await connectFreighter();

  // Load real account with correct sequence number from Horizon
  const accountRes = await fetch();
  if (!accountRes.ok) {
    throw new Error(
      ,
    );
  }
  const accountData = (await accountRes.json()) as {
    sequence: string;
  };

  const account = new Account(address, accountData.sequence);

  // Build real payment operation to the rental contract
  const asset =
    input.assetCode && input.assetIssuer
      ? new Asset(input.assetCode, input.assetIssuer)
      : Asset.native();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: CONTRACT_ID,
        asset,
        amount: input.amount.toFixed(7),
      }),
    )
    .addMemo(
      // Encode propertyId so the contract can identify the agreement
      // Using text memo for simplicity; binary hash preferred if propertyId is a hash
      { type: "text", value: input.propertyId.slice(0, 28) } as Parameters<
        typeof TransactionBuilder.prototype.addMemo
      >[0],
    )
    .setTimeout(180)
    .build();

  const signed = await signTransaction(tx.toXDR(), {
    networkPassphrase: PASSPHRASE,
    address,
  });

  if (!signed?.signedTxXdr) {
    throw new Error("Freighter did not return a signed transaction");
  }

  return signed.signedTxXdr;
}
