import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MemetokenLaunchpadSolana } from "../target/types/memetoken_launchpad_solana";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  getMint,
  getMetadataPointerState,
  getTokenMetadata,
  TYPE_SIZE,
  LENGTH_SIZE,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  MINT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  createRemoveKeyInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import { getKeypairFromFile } from "@solana-developers/helpers";

async function mintAccountsetup(
  payer: Keypair,
  connection: Connection,
  mintKeypair: Keypair
) {
  // Transaction to send
  let transaction: Transaction;
  // Transaction signature returned from sent transaction
  let transactionSignature: string;

  // Address for Mint Account
  const mint = mintKeypair.publicKey;
  // Decimals for Mint Account
  const decimals = 2;
  // Authority that can mint new tokens
  const mintAuthority = payer.publicKey;
  // Authority that can update token metadata
  const updateAuthority = payer.publicKey;

  const metaData: TokenMetadata = {
    updateAuthority: updateAuthority,
    mint: mint,
    name: "Rishabh Jamwal",
    symbol: "RJ",
    uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json",
    additionalMetadata: [["description", "Only Possible On Solana"]],
  };
  // Size of MetadataExtension 2 bytes for type, 2 bytes for length
  const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
  // Size of metadata
  const metadataLen = pack(metaData).length;

  // Size of Mint Account with extension
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);

  // Minimum lamports required for Mint Account
  const lamports = await connection.getMinimumBalanceForRentExemption(
    mintLen + metadataExtension + metadataLen
  );

  // Instruction to invoke System Program to create new account
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
    newAccountPubkey: mint, // Address of the account to create
    space: mintLen, // Amount of bytes to allocate to the created account
    lamports, // Amount of lamports transferred to created account
    programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
  });
  // Instruction to initialize the MetadataPointer Extension
  const initializeMetadataPointerInstruction =
    createInitializeMetadataPointerInstruction(
      mint, // Mint Account address
      updateAuthority, // Authority that can set the metadata address
      mint, // Account address that holds the metadata
      TOKEN_2022_PROGRAM_ID
    );

  // Instruction to initialize Mint Account data
  const initializeMintInstruction = createInitializeMintInstruction(
    mint, // Mint Account Address
    decimals, // Decimals of Mint
    mintAuthority, // Designated Mint Authority
    null, // Optional Freeze Authority
    TOKEN_2022_PROGRAM_ID // Token Extension Program ID
  );

  // Instruction to initialize Metadata Account data
  const initializeMetadataInstruction = createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
    metadata: mint, // Account address that holds the metadata
    updateAuthority: updateAuthority, // Authority that can update the metadata
    mint: mint, // Mint Account address
    mintAuthority: mintAuthority, // Designated Mint Authority
    name: metaData.name,
    symbol: metaData.symbol,
    uri: metaData.uri,
  });

  // Instruction to update metadata, adding custom field
  const updateFieldInstruction = createUpdateFieldInstruction({
    programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
    metadata: mint, // Account address that holds the metadata
    updateAuthority: updateAuthority, // Authority that can update the metadata
    field: metaData.additionalMetadata[0][0], // key
    value: metaData.additionalMetadata[0][1], // value
  });

  // Add instructions to new transaction
  transaction = new Transaction().add(
    createAccountInstruction,
    initializeMetadataPointerInstruction,
    initializeMintInstruction,
    initializeMetadataInstruction,
    updateFieldInstruction
  );
  // Send transaction
  transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mintKeypair] // Signers
  );

  console.log(
    "\nCreate Mint Account:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
  );

  // Retrieve mint information
  const mintInfo = await getMint(
    connection,
    mint,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );

  // Retrieve and log the metadata pointer state
  const metadataPointer = getMetadataPointerState(mintInfo);
  console.log("\nMetadata Pointer:", JSON.stringify(metadataPointer, null, 2));

  // Retrieve and log the metadata state
  const metadata = await getTokenMetadata(
    connection,
    mint // Mint Account address
  );
  console.log("\nMetadata:", JSON.stringify(metadata, null, 2));

  // Instruction to remove a key from the metadata
  const removeKeyInstruction = createRemoveKeyInstruction({
    programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
    metadata: mint, // Address of the metadata
    updateAuthority: updateAuthority, // Authority that can update the metadata
    key: metaData.additionalMetadata[0][0], // Key to remove from the metadata
    idempotent: true, // If the idempotent flag is set to true, then the instruction will not error if the key does not exist
  });

  // Add instruction to new transaction
  transaction = new Transaction().add(removeKeyInstruction);

  // Send transaction
  transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer]
  );

  console.log(
    "\nRemove Additional Metadata Field:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
  );

  // Retrieve and log the metadata state
  const updatedMetadata = await getTokenMetadata(
    connection,
    mint // Mint Account address
  );
  console.log("\nUpdated Metadata:", JSON.stringify(updatedMetadata, null, 2));

  console.log(
    "\nMint Account:",
    `https://solana.fm/address/${mint}?cluster=devnet-solana`
  );
}

async function vaultAccountSetup(
  connection: Connection,
  program: Program<MemetokenLaunchpadSolana>
) {
  const [PDA, _] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_account", "utf8")],
    program.programId
  );
  console.log(`PDA: ${PDA}`);
  // const txn = await pg.program.methods
  //   .createVaultAccount()
  //   .accounts({
  //     vaultAccount: PDA,
  //   })
  //   .signers([pg.wallet.keypair])
  //   .rpc();

  console.log(
    "Balance of vault account before transfer:",
    (await connection.getBalance(PDA)) / LAMPORTS_PER_SOL
  );
}

async function ataSetup(
  payer: Keypair,
  mintKeypair: Keypair,
  connection: Connection,
  associatedTokenAccount: PublicKey
) {
  console.log("This is out ATA! Wohoo\n\n:", associatedTokenAccount.toBase58());
  let ATAtx = new Transaction();
  ATAtx.add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      associatedTokenAccount,
      payer.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );
  const wait = connection.sendTransaction(ATAtx, [payer]);
  wait.finally(() => {
    console.log("tx:", wait);
  });
  console.log(
    `create ata tx : ${await connection.sendTransaction(ATAtx, [payer])}`
  );
}

async function buy(
  payer: Keypair,
  mintKeypair: Keypair,
  connection: Connection,
  associatedTokenAccount: PublicKey,
  PDA: PublicKey,
  program: Program<MemetokenLaunchpadSolana>
) {
  const bid_amount = new anchor.BN(10 ** 9 * 2);
  const tx = await program.methods
    .mintToken(bid_amount)
    .accounts({
      mint: mintKeypair.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      userAccount: associatedTokenAccount,
      mintAuthority: payer.publicKey,
      user: payer.publicKey,
      vaultAccount: PDA,
    })
    .rpc();
  console.log("Minting and Sending SOL reciept", tx);
}
async function sell(
  payer: Keypair,
  mintKeypair: Keypair,
  associatedTokenAccount: PublicKey,
  PDA: PublicKey,
  program: Program<MemetokenLaunchpadSolana>
) {
  const bid_amount = new anchor.BN(10 ** 9 * 2);

  const burntxn = await program.methods
    .burnToken(bid_amount)
    .accounts({
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      tokenAccount: associatedTokenAccount,
      mint: mintKeypair.publicKey,
      vaultAccount: PDA,
      user: payer.publicKey,
    })
    .rpc();

  console.log(burntxn, "");
}

async function main() {
  const program = anchor.workspace
    .MemetokenLaunchpadSolana as Program<MemetokenLaunchpadSolana>;
  const payer = await getKeypairFromFile(
    "/home/webexpert/.config/solana/id.json"
  );
  // Connection to devnet cluster
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const mintKeypair = Keypair.generate();
  // Address for Mint Account
  const mint = mintKeypair.publicKey;
  //Get Associated Token Account
  const associatedTokenAccount = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  //Find PDA
  const [PDA, _] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_account", "utf8")],
    program.programId
  );
  await mintAccountsetup(payer, connection, mintKeypair);
  await ataSetup(payer, mintKeypair, connection, associatedTokenAccount);
  await vaultAccountSetup(connection, program);
  await buy(
    payer,
    mintKeypair,
    connection,
    associatedTokenAccount,
    PDA,
    program
  );
  await sell(payer, mintKeypair, associatedTokenAccount, PDA, program);
}
main();
