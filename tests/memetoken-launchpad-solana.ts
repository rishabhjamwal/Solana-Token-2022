import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MemetokenLaunchpadSolana } from "../target/types/memetoken_launchpad_solana";
import { getKeypairFromFile } from "@solana-developers/helpers";
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
  getOrCreateAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
  MINT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  mintTo,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  createRemoveKeyInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import { BN, min } from "bn.js";

describe("memetoken-launchpad-solana", async () => {
  async function waitForAccountToBeVisible(
    account: PublicKey,
    connection: Connection,
    retries = 10
  ) {
    for (let i = 0; i < retries; i++) {
      try {
        let info = await connection.getAccountInfo(account, "finalized");
        if (info) {
          console.log("Account found: ", account.toString());
          return info;
        }
      } catch (e) {
        console.log("Waiting for account to be visible...", account.toString());
      }
      await new Promise((resolve) => setTimeout(resolve, 2000)); // wait for 2 seconds
    }
    throw new Error(
      "Account not visible after multiple retries: " + account.toString()
    );
  }
  anchor.setProvider(anchor.AnchorProvider.env());
  // Configure the client to use the local cluster.
  console.log("Start");

  // anchor.setProvider(anchor.AnchorProvider.env());

  console.log("ertyui");

  const program = anchor.workspace
    .MemetokenLaunchpadSolana as Program<MemetokenLaunchpadSolana>;
  console.log("3456789");
  // let payer = undefined;
  // let connection = undefined;
  // let mintKeypair = undefined;
  // let associatedTokenAccount = undefined;
  // let PDA = undefined;
  // let _ = undefined;

  // console.log(PDA);

  it("Create Mint-Account and Set Token Metadata", async () => {
    console.log("1");
    const payer = await getKeypairFromFile(
      "/home/webexpert/.config/solana/id.json"
    );

    // Connection to devnet cluster
    const connection = new Connection("https://api.devnet.solana.com", {
      commitment: "finalized",
    });

    // Transaction to send
    let transaction: Transaction;
    // Transaction signature returned from sent transaction
    let transactionSignature: string;

    // Generate new keypair for Mint Account
    const mintKeypair = Keypair.generate();
    // Address for Mint Account
    const mint = mintKeypair.publicKey;
    // Decimals for Mint Account
    const decimals = 2;
    // Authority that can mint new tokens
    const mintAuthority = payer.publicKey;
    // Authority that can update token metadata
    const updateAuthority = payer.publicKey;
    console.log("2");
    // Metadata to store in Mint Account
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
    console.log(
      "\nMetadata Pointer:",
      JSON.stringify(metadataPointer, null, 2)
    );

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
    // console.log(
    //   "\nUpdated Metadata:",
    //   JSON.stringify(updatedMetadata, null, 2)
    // );

    // console.log(
    //   "\nMint Account:",
    //   `https://solana.fm/address/${mint}?cluster=devnet-solana`
    // );
    // console.log("latest blockhash:", await connection.getLatestBlockhash());

    const [PDA, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_account", "utf8"), mint.toBuffer()],
      program.programId
    );
    console.log("247");
    console.log("object", await connection.getLatestBlockhash());
    // connection.getRecentBlockhash();

    const txn = await program.methods
      .createVaultAccount()
      .accounts({
        vaultAccount: PDA,
        mint: mintKeypair.publicKey,
      })
      .signers([payer])
      .rpc();
    console.log("ts555555777x->", txn);

    // setTimeout(async () => {
    //   const txn = await program.methods
    //     .createVaultAccount()
    //     .accounts({
    //       vaultAccount: PDA,
    //       mint: mintKeypair.publicKey,
    //     })
    //     .signers([payer])
    //     .rpc();
    //   console.log("HERE, vault account txn", txn);
    // }, 2000);

    const TokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      PDA,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log("This is our ATA! Wohoo\n\n:278", TokenAccount.toBase58());
    let ATAtx = new Transaction();
    ATAtx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        TokenAccount,
        PDA,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    const tx = await connection.sendTransaction(ATAtx, [payer], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    await waitForAccountToBeVisible(TokenAccount, connection);

    try {
      await mintTo(
        connection,
        payer,
        mint,
        TokenAccount,
        payer.publicKey,
        100000000000,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
    } catch (error) {
      console.log(error);
    }

    const UserTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      payer.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("This is the user's ATA", UserTokenAccount.toBase58());

    let userATAtx = new Transaction();
    userATAtx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        UserTokenAccount,
        payer.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    const txForUserATA = await connection.sendTransaction(userATAtx, [payer], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    await waitForAccountToBeVisible(UserTokenAccount, connection);
    const solAmount = new BN(1000000000);
    const testtxn1 = await program.methods
      .mintToken(solAmount)
      .accounts({
        vaultAccount: PDA,
        mint: mint,
        user: payer.publicKey,
        userAccount: UserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        mintAuthority: mintAuthority,
      })
      .rpc();
    console.log("mint1", testtxn1);
    const testtxn2 = await program.methods
      .mintToken(solAmount)
      .accounts({
        vaultAccount: PDA,
        mint: mint,
        user: payer.publicKey,
        userAccount: UserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        mintAuthority: mintAuthority,
      })
      .rpc();
    console.log("mint2", testtxn2);

    const tokensToBurn = new anchor.BN(99935509);
    const burntxn = await program.methods
      .burnToken(tokensToBurn)
      .accounts({
        mint: mint,
        user: payer.publicKey,
        tokenAccount: UserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        vaultAccount: PDA,
      })
      .rpc();
    console.log("Burn tx", burntxn);

    // const burnTxnCopy = await program.methods
    //   .burnToken2(tokensToBurn)
    //   .accounts({
    //     mint: mint,
    //     user: payer.publicKey,
    //     tokenAccount: UserTokenAccount,
    //     tokenProgram: TOKEN_2022_PROGRAM_ID,
    //     vaultAccount: PDA,
    //   })
    //   .rpc();
    //   console.log("Burn tx Copy", burnTxnCopy);

    const testtxn3 = await program.methods
      .mintToken(solAmount)
      .accounts({
        vaultAccount: PDA,
        mint: mint,
        user: payer.publicKey,
        userAccount: UserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        mintAuthority: mintAuthority,
      })
      .rpc();

    console.log("mint3", testtxn3);

    // const vault_account_creation = await program.methods
    //   .createVaultAccount()
    //   .accounts({
    //     vaultAccount:PDA
    //   })
    //   .rpc();
    // console.log(vault_account_creation, "vault_account_creation");

    // console.log(
    //   "Balance of vault account before transfer:",
    //   (await connection.getBalance(PDA)) / LAMPORTS_PER_SOL
    // );
    // const associatedTokenAccount = await getAssociatedTokenAddress(
    //   mintKeypair.publicKey,
    //   payer.publicKey
    // );
    // console.log(associatedTokenAccount, "1234567890");

    // const ATAtx = new anchor.web3.Transaction().add(
    //   createAssociatedTokenAccountInstruction(
    //     payer.publicKey,
    //     associatedTokenAccount,
    //     payer.publicKey,
    //     mintKeypair.publicKey
    //   )
    // );

    // const res = await sendAndConfirmTransaction(connection, ATAtx, [payer]);
    // console.log(res);

    // console.log(await connection.getParsedAccountInfo(mintKeypair.publicKey));
    // const bid_amount = new anchor.BN(10 ** 9 * 2);
    // const tx = await program.methods
    //   .mintToken(bid_amount)
    //   .accounts({
    //     mint: mintKeypair.publicKey,
    //     tokenProgram: TOKEN_2022_PROGRAM_ID,
    //     userAccount: ata,
    //     mintAuthority: payer.publicKey,
    //     user: payer.publicKey,
    //     vaultAccount: PDA,
    //   })
    //   .rpc();
    // console.log("Minting and Sending SOL reciept", tx);
    // const minted = await connection.getParsedAccountInfo(ata);
    // console.log(minted, "asdfghjk");
  });
  it("", async () => {
    console.log("360");
    // const [PDA, _] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("vault_account", "utf8"), mint.toBuffer()],
    //   program.programId
    // );
  });

  it("Mint and transfer SOL-to-PDA i.e (Our vault account)", async () => {
    // const mintKeypair = new PublicKey("FHdfaTcvypP4VNTG91E7ZnpRCd79WaJHJkfoFDD4x4pE")
    // const payer = await getKeypairFromFile(
    //   "/home/webexpert/.config/solana/id.json"
    // );
    // // Connection to devnet cluster
    // const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    // const [PDA, _] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("vault_account", "utf8")],
    //   program.programId
    // );
    // console.log(`PDA: ${PDA}`);
    // console.log("here");
    // // const vault_account_creation = await program.methods
    // //   .createVaultAccount()
    // //   .accounts({
    // //     vaultAccount:PDA
    // //   })
    // //   .rpc();
    // // console.log(vault_account_creation, "vault_account_creation");
    // console.log(
    //   "Balance of vault account before transfer:",
    //   (await connection.getBalance(PDA)) / LAMPORTS_PER_SOL
    // );
    // const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
    //   connection,
    //   payer,
    //   mintKeypair,
    //   payer.publicKey
    // );
    // console.log(associatedTokenAccount, "1234567890");
    // // const ATAtx = new anchor.web3.Transaction().add(
    // //   createAssociatedTokenAccountInstruction(
    // //     payer.publicKey,
    // //     associatedTokenAccount,
    // //     payer.publicKey,
    // //     mintKeypair
    // //   )
    // // );
    // // const res = await sendAndConfirmTransaction(connection, ATAtx, [payer]);
    // // console.log(res);
    // console.log(await connection.getParsedAccountInfo(mintKeypair));
    // const bid_amount = new anchor.BN(10 ** 9 * 2);
    // const tx = await program.methods
    //   .mintToken(bid_amount)
    //   .accounts({
    //     mint: mintKeypair,
    //     tokenProgram: TOKEN_2022_PROGRAM_ID,
    //     userAccount: associatedTokenAccount.address,
    //     mintAuthority: payer.publicKey,
    //     user: payer.publicKey,
    //     vaultAccount: PDA,
    //   })
    //   .rpc();
    // console.log("Minting and Sending SOL reciept", tx);
    // const minted = await connection.getParsedAccountInfo(
    //   associatedTokenAccount.address
    // );
    // console.log(minted, "asdfghjk");
  });

  it("Burn Token and retrieve balance from PDA", async () => {
    // const bid_amount = new anchor.BN(10 ** 9 * 2);
    // const burntxn = await program.methods
    // .burnToken(bid_amount)
    // .accounts({
    //   tokenProgram: TOKEN_2022_PROGRAM_ID,
    //   tokenAccount: associatedTokenAccount,
    //   mintToken: mintKeypair.publicKey,
    //   vaultAccount: PDA,
    //   user: payer.publicKey,
    // })
    // .rpc();
    // console.log(burntxn, "1234567890");
  });
});
