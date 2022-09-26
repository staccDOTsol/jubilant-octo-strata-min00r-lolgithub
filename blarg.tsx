import { Account, Connection, Keypair, PublicKey } from "@solana/web3.js";
import JSBI from "jsbi";
import { clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Jupiter, RouteInfo, TOKEN_LIST_URL } from "@jup-ag/core";

import * as switchboard from "@switchboard-xyz/switchboard-v2";
import { PromisePool } from "@supercharge/promise-pool";
import { NodeWallet } from "@project-serum/common"; //TODO remove this; kek
import fs from "fs";
import {
  Fanout,
  FanoutClient,
  MembershipModel,
} from "../metaplex-program-library/hydra/js/src";
import { hash } from "@project-serum/anchor/dist/cjs/utils/sha256";
import * as anchor from "@project-serum/anchor";
import {
  createMint,
  createAtaAndMint,
  SplTokenMetadata,
  getTokenAccount,
} from "@strata-foundation/spl-utils";
import { SplTokenCollective } from "@strata-foundation/spl-token-collective";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  ExponentialCurve,
  ExponentialCurveConfig,
  ITokenBonding,
  SplTokenBonding,
  TimeCurveConfig,
  TimeDecayExponentialCurveConfig,
  TokenBondingV0,
} from "@strata-foundation/spl-token-bonding";
import { BondingPricing } from "@strata-foundation/spl-token-bonding";
import { AnchorWallet } from "@switchboard-xyz/switchboard-v2";
import { Transaction } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import Decimal from "decimal.js";
process.on("uncaughtException", function (err) {
  console.log("Caught exception: ", err);
});

let somebals = 0;
let arrsomebals: number[] = [];
const executeSwap = async ({
  jupiter,
  routeInfo,
}: {
  jupiter: Jupiter;
  routeInfo: RouteInfo;
}) => {
  try {
    // Prepare execute exchange
    const { execute } = await jupiter.exchange({
      routeInfo,
    });

    // Execute swap
    const swapResult: any = await execute(); // Force any to ignore TS misidentifying SwapResult type

    if (swapResult.error) {
      console.log(swapResult.error);
    } else {
      console.log(`https://explorer.solana.com/tx/${swapResult.txid}`);
      console.log(
        `inputAddress=${swapResult.inputAddress.toString()} outputAddress=${swapResult.outputAddress.toString()}`
      );
      console.log(
        `inputAmount=${swapResult.inputAmount} outputAmount=${swapResult.outputAmount}`
      );
    }
  } catch (error) {
    throw error;
  }
};
const getRoutes = async ({
  jupiter,
  inputToken,
  outputToken,

  inputAmount,
  slippage,
}: {
  jupiter: Jupiter;
  inputToken?: Token;
  outputToken?: Token;
  inputAmount: number;
  slippage: number;
}) => {
  try {
    if (!inputToken || !outputToken) {
      return null;
    }

    console.log(
      // @ts-ignore
      `Getting routes for ${inputAmount} ${inputToken.symbol} -> ${outputToken.symbol}...`
    );
    // @ts-ignore
    let is = inputToken.symbol;
    // @ts-ignore
    let os = outputToken.symbol;
    const inputAmountInSmallestUnits = inputToken
      ? // @ts-ignore
        Math.round(inputAmount * 10 ** inputToken.decimals)
      : 0;
    const routes =
      inputToken && outputToken
        ? await jupiter.computeRoutes({
            inputMint: new PublicKey(mints[is]),
            outputMint: new PublicKey(mints[os]),
            amount: JSBI.BigInt(inputAmountInSmallestUnits), // raw input amount of tokens
            slippage,
            forceFetch: false,
          })
        : null;

    if (routes && routes.routesInfos) {
      console.log("Possible number of routes:", routes.routesInfos.length);
      console.log(
        "Best quote: ",
        new Decimal(routes.routesInfos[0].outAmount.toString())
          // @ts-ignore
          .div(10 ** outputToken.decimals)
          .toString(),
        // @ts-ignore
        `(${outputToken.symbol})`
      );
      return routes;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

let jares : any = {
  "3bTuuFXfPPcfpTAjbBrqGevnfBctu68JSKVx9h5jjKNF": new PublicKey(
    "9fjxNUGMk1U9U15qxGUpdyGjfcKrFrvUVTwubFx4NvTK"
  ),

  "77xobpfPguimoyy9UWyrXepJGbFbpD9GZkdopwJwcBFh": new PublicKey(
    "ALLkkMm2TmGzo2Zy1QzpBwKQdRcW3PXue7JBN6gEcZDb"
  ),
  HTQhMV9d1b2irzJijVHzsbNJ42f3mRUWzj5ugkLiXzmh: new PublicKey(
    "JCJtFvMZTmdH9pLgKdMLyJdpRUgScAtnBNB4GptuvxSD"
  ),
};

let keys = [
  new PublicKey("3bTuuFXfPPcfpTAjbBrqGevnfBctu68JSKVx9h5jjKNF"), //USDH
  new PublicKey("77xobpfPguimoyy9UWyrXepJGbFbpD9GZkdopwJwcBFh"), //PAI
  new PublicKey("HTQhMV9d1b2irzJijVHzsbNJ42f3mRUWzj5ugkLiXzmh"), // USDT
  //, new PublicKey("CK74KYuhbzMN4RyhJLVkL8avY6L83AZMBQ52bD7eWXy6") // cUSDT why is it 1.06 fuck this
];
let results: any = {
  "3bTuuFXfPPcfpTAjbBrqGevnfBctu68JSKVx9h5jjKNF": 0.9844,
  "77xobpfPguimoyy9UWyrXepJGbFbpD9GZkdopwJwcBFh": 0.997,
  HTQhMV9d1b2irzJijVHzsbNJ42f3mRUWzj5ugkLiXzmh: 1.0001,
};
const payer = Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(fs.readFileSync("/Users/jarettdunn/jaregm.json").toString())
  )
);
const connection = new Connection(clusterApiUrl("mainnet-beta"));

async function ha() {
  // Configure the client to use the local cluster.
  const connection = new Connection(
    "https://solana--mainnet.datahub.figment.io/apikey/1fc6d8319bddaed4e21e37e49c16b4c2",
    "finalized"
  );
  let authorityWallet: Keypair;
  let fanoutSdk: FanoutClient;
  authorityWallet = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(
        (await fs.readFileSync("/Users/jarettdunn/jaregm.json")).toString()
      )
    )
  );
  //await airdrop(connection, authorityWallet.publicKey, LAMPORTS_PER_SOL * 10);
  fanoutSdk = new FanoutClient(
    connection,
    new NodeWallet(
      new Account(
        new Uint8Array(
          JSON.parse(
            (await fs.readFileSync("/Users/jarettdunn/jaregm.json")).toString()
          )
        )
      )
    )
  );
  const ENV = "mainnet-beta";
  const tokens: Token[] = await (await fetch(TOKEN_LIST_URL[ENV])).json();
  const jupiter = await Jupiter.load({
    connection,
    cluster: ENV,
    user: authorityWallet,
  });
  const routeMap = jupiter.getRouteMap();

  // @ts-ignore
  const tokenBondingProgram = await SplTokenBonding.init(fanoutSdk.provider);
  // @ts-ignore
  const tokenMetadataSdk = await SplTokenMetadata.init(fanoutSdk.provider);
  let me = authorityWallet.publicKey;

  const payer = authorityWallet;
  const program = await switchboard.loadSwitchboardProgram(
    "mainnet-beta",
    connection,
    payer
  );
  var aggregatorKey = new PublicKey(
    "3Fb4JXpEd6pCqcKctqHwhB4WgvguzbWFM1ioSAsZiLmM"
  );
  try {
    const aggregatorAccount = new switchboard.AggregatorAccount({
      program: program,
      publicKey: aggregatorKey,
    });
    const result: any = await aggregatorAccount.getLatestValue();

    solusdc["sol"] = result.toNumber();
  } catch (err) {}
  for (var key of keys) {
    try {
      console.log("here " + key.toBase58());
      const aggregatorAccount = new switchboard.AggregatorAccount({
        program: program,
        publicKey: key,
      });
      const result: any = await aggregatorAccount.getLatestValue();

      results[key.toBase58()] = result.toNumber();
    } catch (err) {
      console.log(err);
    }
  }
  let t = 0;
  for (var price of Object.values(results)) {
    t += (price as number) / 1 - 1;
  }
  console.log("t: " + t.toString());
  let opps: any = {};
  let c = 0;
  console.log(results);
  for (var price of Object.values(results)) {
    let opp = ((price as number) / 1 - 1) / t;
    if (opp < 0) {
      opp = opp;
    }
    opps[Object.keys(results)[c]] = opp;
    c++;
  }
  console.log(opps);
  console.log(results);
  console.log(results);
  console.log(results);
  console.log(results);
  var aggregatorKey = new PublicKey(
    "3Fb4JXpEd6pCqcKctqHwhB4WgvguzbWFM1ioSAsZiLmM"
  );
  try {
    const aggregatorAccount = new switchboard.AggregatorAccount({
      program: program,
      publicKey: aggregatorKey,
    });
    const result: any = await aggregatorAccount.getLatestValue();

    solusdc["sol"] = result.toNumber();
  } catch (err) {}
  let b: number = ( await (
    await connection.getTokenAccountBalance(new PublicKey("2PYVzDJ6Buks4yUVeDEhLwc14wKpxbehEsbeU6yM8J8d"))
  ).value.uiAmount as number)
  b += (await (
    await connection.getTokenAccountBalance(
      new PublicKey("2PYVzDJ6Buks4yUVeDEhLwc14wKpxbehEsbeU6yM8J8d")
    )
  ).value.uiAmount) as number;
  for (var i of Object.keys(jares)) {
    if (Object.keys(opps).includes(i)) {
      // @ts-ignore
      let balance = await (
        await connection.getTokenAccountBalance(jares[i])
      ).value.uiAmount;
      b += balance as number;
    }
  }
  let wanteds: any = {};
  console.log(b);
  let abc = 0;
   somebals = 0
   
   somebals +=( await connection.getTokenAccountBalance(
      new PublicKey("2PYVzDJ6Buks4yUVeDEhLwc14wKpxbehEsbeU6yM8J8d")
  )).value.uiAmount as number
 
  
  for (var i of Object.keys(jares)) {
    if (Object.keys(opps).includes(i)) {
      let b1 = await (
        await connection.getTokenAccountBalance(
          (fanoutSdk.provider,
          (
            await connection.getTokenAccountsByOwner(me, {
              mint: (
                await tokenBondingProgram.getTokenBonding(
                  new PublicKey(oldbondings[abc][0]) as PublicKey
                )
              )?.targetMint as PublicKey,
            })
          ).value[0].pubkey)
        )
      ).value.uiAmount;

      let b2 = await (
        await connection.getTokenAccountBalance(
          (fanoutSdk.provider,
          (
            await connection.getTokenAccountsByOwner(
              me,

              {
                mint: (
                  await tokenBondingProgram.getTokenBonding(
                    new PublicKey(oldbondings[abc][1]) as PublicKey
                  )
                )?.targetMint as PublicKey,
              }
            )
          ).value[0].pubkey)
        )
      ).value.uiAmount;


    somebals += await (
      await connection.getTokenAccountBalance(Object.values(jares)[abc] as PublicKey)
    ).value.uiAmount as number
    somebals+=b1 as number 
    somebals += b2 as number
      let abswantsi = wanteds[i] * -1;
      // @ts-ignore
      if (b1 > abswantsi) {
        await tokenBondingProgram.sell({
          tokenBonding: new PublicKey(oldbondings[abc][0]) as PublicKey,
          targetAmount: parseInt(
            (((b1 as number) - abswantsi) * 0.75).toString()
          ),
          slippage: 0.9,
        });
      } // @ts-ignore
      else if (b2 > abswantsi) {
        await tokenBondingProgram.sell({
          tokenBonding: new PublicKey(oldbondings[abc][1]) as PublicKey,
          targetAmount: parseInt(
            (((b1 as number) - abswantsi) * 0.75).toString()
          ),
          slippage: 0.9,
        });
      }
      // @ts-ignore
      if (opps[i] < 0 && b1 > 0) {
        try {
          await tokenBondingProgram.sell({
            tokenBonding: new PublicKey(oldbondings[abc][0]),
            targetAmount: parseInt(((b1 as number) * 0.75).toString()),
            slippage: 0.9,
          });
        } catch (err) {}
      } // @ts-ignore
      else if (opps[i] > 0 && b2 > 0) {
        try {
          await tokenBondingProgram.sell({
            tokenBonding: new PublicKey(oldbondings[abc][1]),
            targetAmount: parseInt(((b2 as number) * 0.75).toString()),
            slippage: 0.9,
          });
        } catch (err) {}
      }
      if (opps[i] < 0) {
        // @ts-ignore

        wanteds[i] = opps[i] * b * 0.9 - b2;
      } else {
        // @ts-ignore

        wanteds[i] = opps[i] * b * 0.9 - b1;
      }

      abc++;
    }
  }
  console.log(wanteds);

  abc = -1;
  for (var i of Object.keys(jares)) {
    abc++;
    let b2 = await (
      await connection.getTokenAccountBalance(
        (fanoutSdk.provider,
        (
          await connection.getTokenAccountsByOwner(me, {
            mint: (
              await tokenBondingProgram.getTokenBonding(
                new PublicKey(oldbondings[abc][1]) as PublicKey
              )
            )?.baseMint as PublicKey,
          })
        ).value[0].pubkey)
      )
    ).value.uiAmount;
    somebals += b2 as number;
    console.log(wanteds);
    console.log(wanteds[i]);
    if (wanteds[i] < 0) {
      let absi = wanteds[i] as number;
      if (absi < 0) {
        absi = absi * -1;
      }
      if ((b2 as number) < parseInt((absi as number).toString())) {
        //  Get routeMap, which maps each tokenMint and their respective tokenMints that are swappable
        const routeMap = jupiter.getRouteMap();
        let apub = (
          await tokenBondingProgram.getTokenBonding(
            new PublicKey(oldbondings[abc][1]) as PublicKey
          )
        )?.baseMint;

        // If you know which input/output pair you want
        // @ts-ignore
        const inputToken = tokens.find(
          (t) =>
          // @ts-ignore
            t.address ==
            new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
        ); // USDC Mint Info
        // @ts-ignore
        const outputToken = tokens.find(
          // @ts-ignore
          (t) => t.address == (apub as PublicKey)
        ); // USDT Mint Info

        if (inputToken != outputToken) {
          try {
            const routes = await getRoutes({
              jupiter,
              inputToken,
              outputToken,
              // @ts-ignore
              inputAmount: (parseInt((absi * 0.9).toString()) - b2) as number,
              slippage: 0.9,
            });
            await executeSwap({ jupiter, routeInfo: routes!.routesInfos[0] });
          } catch (err) {
            console.log(err);
          }
        }
      } else {
        let absi = wanteds[i] as number;
        if (absi < 0) {
          absi = absi * -1;
        }
        // If you know which input/output pair you want
        let apub = (
          await tokenBondingProgram.getTokenBonding(
            new PublicKey(oldbondings[abc][1]) as PublicKey
          )
        )?.baseMint;
        //  Get routeMap, which maps each tokenMint and their respective tokenMints that are swappable
        const routeMap = jupiter.getRouteMap();
        // @ts-ignore
        const outputToken = tokens.find(
          (t) =>
          // @ts-ignore
            t.address ==
            new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
        ); // USDC Mint Info
        // @ts-ignore
        const inputToken = tokens.find((t) => t.address == (apub as PublicKey)); // USDT Mint Info

        if (inputToken != outputToken) {
          try {
            const routes = await getRoutes({
              jupiter,
              inputToken,
              outputToken,
              // @ts-ignore
              inputAmount: (b2 as number) - absi * 0.9,
              slippage: 0.9,
            });
            await executeSwap({ jupiter, routeInfo: routes!.routesInfos[0] });
          } catch (err) {
            console.log(err);
          }
        }
      }
      absi = wanteds[i] as number;
      if (absi < 0) {
        absi = absi * -1;
      }
      try {
        await tokenBondingProgram.buy({
          tokenBonding: new PublicKey(oldbondings[abc][1]),
          baseAmount: parseFloat(((absi as number) * 0.75).toString()),
          slippage: 0.9,
        });
      } catch (err) {}
    } else {
      b2 = await (
        await connection.getTokenAccountBalance(
          (fanoutSdk.provider,
          (
            await connection.getTokenAccountsByOwner(me, {
              mint: (
                await tokenBondingProgram.getTokenBonding(
                  new PublicKey(oldbondings[abc][0]) as PublicKey
                )
              )?.baseMint as PublicKey,
            })
          ).value[0].pubkey)
        )
      ).value.uiAmount;
      console.log(b2);
      let absi = wanteds[i] as number;
      if (absi < 0) {
        absi = absi * -1;
      }
      if ((b2 as number) < parseInt((absi as number).toString())) {
        let apub = (
          await tokenBondingProgram.getTokenBonding(
            new PublicKey(oldbondings[abc][0]) as PublicKey
          )
        )?.baseMint;

        //  Get routeMap, which maps each tokenMint and their respective tokenMints that are swappable
        const routeMap = jupiter.getRouteMap();
        // @ts-ignore
        const inputToken = tokens.find(
          (t) =>
          // @ts-ignore
            t.address ==
            new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
        ); // USDC Mint Info
        // @ts-ignore
        const outputToken = tokens.find((t) => t.address == apub); // USDT Mint Info
        if (inputToken != outputToken) {
          try {
            const routes = await getRoutes({
              jupiter,
              inputToken,
              outputToken,
              // @ts-ignore
              inputAmount: (absi * 0.9 - b2) as number,
              slippage: 0.9,
            });
            await executeSwap({ jupiter, routeInfo: routes!.routesInfos[0] });
          } catch (err) {
            console.log(err);
          }
        }
      } else {
        let absi = wanteds[i] as number;
        if (absi < 0) {
          absi = absi * -1;
        }

        console.log({
          jupiter,
          outputToken: new PublicKey(
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
          ),
          intputMint: (
            await tokenBondingProgram.getTokenBonding(
              new PublicKey(oldbondings[abc][1]) as PublicKey
            )
          )?.baseMint as PublicKey,
          // @ts-ignore
          amount: (b2 as number) - parseInt(absi.toString()),
          slippage: 0.9,
          forceFetch: false,
        });
        let apub = (
          await tokenBondingProgram.getTokenBonding(
            new PublicKey(oldbondings[abc][0]) as PublicKey
          )
        )?.baseMint;

        //  Get routeMap, which maps each tokenMint and their respective tokenMints that are swappable
        const routeMap = jupiter.getRouteMap();
        // @ts-ignore
        const outputToken = tokens.find(
          (t) =>
          // @ts-ignore
            t.address ==
            new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
        ); // USDC Mint Info
        // @ts-ignoreR
        const inputToken = tokens.find((t) => t.address == (apub as PublicKey)); // USDT Mint Info
        if (inputToken != outputToken) {
          try {
            const routes = await getRoutes({
              jupiter,
              inputToken,
              outputToken,
              // @ts-ignore
              inputAmount: (b2 as number) - parseInt((absi * 0.9).toString()),
              slippage: 0.9,
            });
            await executeSwap({ jupiter, routeInfo: routes!.routesInfos[0] });
          } catch (err) {
            console.log(err);
          }
        }
      }

      absi = wanteds[i] as number;
      if (absi < 0) {
        absi = absi * -1;
      }
      try {
        await tokenBondingProgram.buy({
          tokenBonding: new PublicKey(oldbondings[abc][0]),
          baseAmount: parseFloat((absi * 0.75).toString()),
          slippage: 0.9,
        });
      } catch (err) {}
    }
  }
  arrsomebals.push(somebals);
  fs.writeFileSync("bals.json", JSON.stringify(arrsomebals));
}
setInterval(async function () {
  await ha();

}, 5 * 60 * 1000);
setTimeout(async function(){
await ha();
})
let solusdc: any = { sol: 33 }; // USDT}
/*
("3bTuuFXfPPcfpTAjbBrqGevnfBctu68JSKVx9h5jjKNF") //USDH
, new PublicKey("Ap7Y4CHAMLsfCAfCYuCYhH1n7qpJLtfS6LbkjsutnpQw") // USDC,
, new PublicKey("77xobpfPguimoyy9UWyrXepJGbFbpD9GZkdopwJwcBFh") //PAI
, new PublicKey("HTQhMV9d1b2irzJijVHzsbNJ42f3mRUWzj5ugkLiXzmh") // USDT
*/
let mints: any = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDH: "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX",
  PAI: "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

let oldbondings: any = [
  [
    "GFRuBqAC4kKLmuArEBpwyMy37yRzee7dhZ7Y3XosBSX8",
    "D3WQ4w13hWe5srmnC8ZPznpkickLT44J9bmd4bjik1ts",
  ],
  [
    "a6MwRLCWxZJ88JXkyE3n9sfwsxp8JBwqysSq3vkPs15",
    "FY6xL5HnH5YkLxwysLd792ATFcHTq38JkEwaoALuf8DR",
  ],
  [
    "BneJenhCuP8SNXUCKkwCgoyVzAhP3qnWfeusXdocGuyG",
    "7yScwR32p8kVWx5xY8r2Ss98AezZujSwEQseZ7Uho4LT",
  ],
];
let bondings: any = {
  "3bTuuFXfPPcfpTAjbBrqGevnfBctu68JSKVx9h5jjKNF": [
    "62jaENHaaLGY2Fy7svNTu9JhcHXPvbdApZzA5gzEgFvv",
    "BrTTbUW6g6yYHqTfqLnN8QSuaUcAbsNn1pCj7wcU8pPt",
  ],
  Ap7Y4CHAMLsfCAfCYuCYhH1n7qpJLtfS6LbkjsutnpQw: [
    "GFRuBqAC4kKLmuArEBpwyMy37yRzee7dhZ7Y3XosBSX8",
    "D3WQ4w13hWe5srmnC8ZPznpkickLT44J9bmd4bjik1ts",
  ],
  "77xobpfPguimoyy9UWyrXepJGbFbpD9GZkdopwJwcBFh": [
    "BneJenhCuP8SNXUCKkwCgoyVzAhP3qnWfeusXdocGuyG",
    "7yScwR32p8kVWx5xY8r2Ss98AezZujSwEQseZ7Uho4LT",
  ],
  HTQhMV9d1b2irzJijVHzsbNJ42f3mRUWzj5ugkLiXzmh: [
    "a6MwRLCWxZJ88JXkyE3n9sfwsxp8JBwqysSq3vkPs15",
    "FY6xL5HnH5YkLxwysLd792ATFcHTq38JkEwaoALuf8DR",
  ],
};
setTimeout(async function () {
  function percent(percent: number): number {
    return Math.floor((percent / 100) * 4294967295); // uint32 max value
  }
  let longshorts: number[][] = [];

  setInterval(async function () {
    // Configure the client to use the local cluster.
    const connection = new Connection(
      "https://solana-mainnet.g.alchemy.com/v2/Zf8WbWIes5Ivksj_dLGL_txHMoRA7-Kr",
      "finalized"
    );
    let authorityWallet: Keypair;
    let fanoutSdk: FanoutClient;
    authorityWallet = Keypair.fromSecretKey(
      new Uint8Array(
        JSON.parse(
          (await fs.readFileSync("/Users/jarettdunn/jaregm.json")).toString()
        )
      )
    );
    //await airdrop(connection, authorityWallet.publicKey, LAMPORTS_PER_SOL * 10);
    fanoutSdk = new FanoutClient(
      connection,
      new NodeWallet(
        new Account(
          new Uint8Array(
            JSON.parse(
              (
                await fs.readFileSync("/Users/jarettdunn/jaregm.json")
              ).toString()
            )
          )
        )
      )
    );
    // @ts-ignore
    const tokenCollectiveProgram = await SplTokenCollective.init(
      // @ts-ignore
      fanoutSdk.provider
    );
    // @ts-ignore
    const tokenBondingProgram = await SplTokenBonding.init(fanoutSdk.provider);
    // @ts-ignore
    const tokenMetadataSdk = await SplTokenMetadata.init(fanoutSdk.provider);
    let me = authorityWallet.publicKey;

    const payer = authorityWallet;
    for (var key of keys) {
      var aggregatorKey = new PublicKey(key);
      const program = await switchboard.loadSwitchboardProgram(
        "mainnet-beta",
        connection,
        payer
      );
      console.log("here");
      try {
        const aggregatorAccount = new switchboard.AggregatorAccount({
          program: program,
          publicKey: aggregatorKey,
        });
        const result: any = await aggregatorAccount.getLatestValue();

        console.log(result.toNumber());
        solusdc[key.toBase58()] = result.toNumber();
        // Also ensure zero sum.
        const initLamports =
          (await fanoutSdk.provider.connection.getAccountInfo(me))!;
        console.log(initLamports);

        console.log("here");
        let dummy = Keypair.generate();
        try {
          const airdropSignature = await connection.requestAirdrop(
            dummy.publicKey,
            LAMPORTS_PER_SOL
          );
        } catch (err) {}
        let tx = new Transaction().add(
          // trasnfer SOL
          SystemProgram.transfer({
            fromPubkey: authorityWallet.publicKey,
            toPubkey: dummy.publicKey,
            lamports: 0.005 * 10 ** 9,
          })
        );
        sendAndConfirmTransaction(connection, tx, [authorityWallet]);

        let winner: PublicKey;
        if (result.toNumber() < solusdc[key.toBase58()]) {
          // new value 0.9 old value 1, we down
          // downbad
          console.log("down");
          let diff = solusdc[key.toBase58()] / result.toNumber() - 1; // 35 / 33 === badmath

          diff = diff * -1; //0.000020355598369770078
          console.log(diff);
          diff = diff + 1; //1.000020355598369770078
          diff = diff ** 10; //1.0002035746
          diff = diff - 1; // 0.0002035746
          console.log(diff);
          solusdc[key.toBase58()] = result.toNumber();
          await tokenBondingProgram.transferReserves({
            tokenBonding: bondings[key.toBase58()][0] as PublicKey,
            amount:
              ((
                await connection.getTokenAccountBalance(
                  (
                    await tokenBondingProgram.getTokenBonding(
                      bondings[key.toBase58()][0] as PublicKey
                    )
                  )?.baseStorage as PublicKey
                )
              ).value.uiAmount as number) * diff,
            destinationWallet: dummy.publicKey,
          });

          winner = (
            await tokenBondingProgram.getTokenBonding(
              bondings[key.toBase58()][1] as PublicKey
            )
          )?.baseStorage as PublicKey;
          setTimeout(async function () {
            let tx = new Transaction().add(
              // trasnfer SOL
              SystemProgram.transfer({
                fromPubkey: dummy.publicKey,
                toPubkey: winner,
                lamports:
                  (await connection.getBalance(dummy.publicKey)) -
                  0.000005 * 10 ** 9,
              })
            );
            sendAndConfirmTransaction(connection, tx, [dummy]);

            setTimeout(async function () {
              console.log("value in pools: ");
              console.log("long");
              let long = (
                await connection.getTokenAccountBalance(
                  (
                    await tokenBondingProgram.getTokenBonding(
                      bondings[key.toBase58()][0]
                    )
                  )?.baseStorage as PublicKey
                )
              ).value.uiAmount as number;
              let short = (
                await connection.getTokenAccountBalance(
                  (
                    await tokenBondingProgram.getTokenBonding(
                      bondings[key.toBase58()][1]
                    )
                  )?.baseStorage as PublicKey
                )
              ).value.uiAmount as number;
              longshorts.push([long, short]);
              fs.writeFileSync("bla.json", JSON.stringify(longshorts));
              console.log(
                (
                  await connection.getTokenAccountBalance(
                    (
                      await tokenBondingProgram.getTokenBonding(
                        bondings[key.toBase58()][0]
                      )
                    )?.baseStorage as PublicKey
                  )
                ).value.uiAmount as number
              );
              console.log("short");
              console.log(
                (
                  await connection.getTokenAccountBalance(
                    (
                      await tokenBondingProgram.getTokenBonding(
                        bondings[key.toBase58()][1]
                      )
                    )?.baseStorage as PublicKey
                  )
                ).value.uiAmount as number
              );
            }, 5000);
          }, 30000);
        } else if (result.toNumber() > solusdc[key.toBase58()]) {
          let diff = solusdc[key.toBase58()] / result.toNumber() - 1;
          // 30.2 / 30 -1
          solusdc[key.toBase58()] = result.toNumber();
          //upgood
          console.log("up");
          console.log(diff);
          diff = diff + 1;
          diff = diff ** 10;
          diff = diff - 1;
          console.log(diff);
          await tokenBondingProgram.transferReserves({
            tokenBonding: bondings[key.toBase58()][1],
            amount:
              ((
                await connection.getTokenAccountBalance(
                  (
                    await tokenBondingProgram.getTokenBonding(
                      bondings[key.toBase58()][1]
                    )
                  )?.baseStorage as PublicKey
                )
              ).value.uiAmount as number) * diff,
            destinationWallet: dummy.publicKey,
          });
          winner = (
            await tokenBondingProgram.getTokenBonding(
              bondings[key.toBase58()][0]
            )
          )?.baseStorage as PublicKey;
          setTimeout(async function () {
            let tx = new Transaction().add(
              // trasnfer SOL
              SystemProgram.transfer({
                fromPubkey: dummy.publicKey,
                toPubkey: winner,
                lamports:
                  (await connection.getBalance(dummy.publicKey)) -
                  (1 - 0.000005) * 10 ** 9,
              })
            );
            sendAndConfirmTransaction(connection, tx, [dummy]);

            setTimeout(async function () {
              console.log("value in pools: ");
              console.log("long");
              let long = (
                await connection.getTokenAccountBalance(
                  (
                    await tokenBondingProgram.getTokenBonding(
                      bondings[key.toBase58()][0]
                    )
                  )?.baseStorage as PublicKey
                )
              ).value.uiAmount as number;
              let short = (
                await connection.getTokenAccountBalance(
                  (
                    await tokenBondingProgram.getTokenBonding(
                      bondings[key.toBase58()][1]
                    )
                  )?.baseStorage as PublicKey
                )
              ).value.uiAmount as number;
              longshorts.push([long, short]);
              fs.writeFileSync("bla.json", JSON.stringify(longshorts));
              console.log(
                (
                  await connection.getTokenAccountBalance(
                    (
                      await tokenBondingProgram.getTokenBonding(
                        bondings[key.toBase58()][0]
                      )
                    )?.baseStorage as PublicKey
                  )
                ).value.uiAmount as number
              );
              console.log("short");
              console.log(
                (
                  await connection.getTokenAccountBalance(
                    (
                      await tokenBondingProgram.getTokenBonding(
                        bondings[key.toBase58()][1]
                      )
                    )?.baseStorage as PublicKey
                  )
                ).value.uiAmount as number
              );
            }, 5000);
          }, 30000);
        } //(await tokenBondingProgram.getTokenBonding(bondings[key.toBase58()][0]))?.baseStorage
      } catch (err) {}
    }
  }, 5 * 60000);
  //-10%
});
setTimeout(async function () {
  //await airdrop(connection, authorityWallet.publicKey);
  let membershipMint = new PublicKey(
    "EsEiqh4GfLw1WNEcanDZfKcCWphbgnQyNHYgnqqUumRh"
  );
  /*
     
    let nfts = new PublicKey("BXyrHAq72V8C2x7PYsbi3HfGeVDBgJFrr1qdWswTs2mj")
      //let nfts = new PublicKey("883jFGyUQMZesuYpptujUuhD3KccNckpboj3937tBd9F")
      const nftFo = await fanoutSdk.fetch<Fanout>(nfts, Fanout);
      let [holdingAccount2, _] = await FanoutClient.nativeAccount(nfts)
      console.log('nft fanout: ' + nfts.toBase58())
      console.log('nft fanout sol hodling account: ' + holdingAccount2.toBase58())
      console.log('lol')
      console.log(nftFo)
console.log(nftFo.totalAvailableShares)
// ugh do with threads or some shit idk. not as bad w 250 I guess
    const { membershipAccount } = await fanoutSdk.addMemberNft({
      fanout: nfts,
      fanoutNativeAccount: holdingAccount2,
      membershipKey: new PublicKey("4HeKDqVCVDonqnk3SnCVfNGe6g3xjXMujejPM5nSe7LC"),
      shares: parseInt(nftFo.totalAvailableShares.toString()), // lol fuck with the nash of it later idk 
      // actually. yes this is ideal. so on new print edition, after v0.1.0, wen v0.1.138?
      // anyways
      // we simply fuckin double these ones in v0.1.0 and new entries are 1,
      // subsequently, exponentially lol kek goddamn
      // sigh
      // anyways if then v0.2.x
      // new ones are shares 1,
      // v0.1.138 are 2
      // // and now; magik! eh alice
      // and the og for the culture and outstanding contributions to the tech @4 
      // leslie rejoices, eh @redacted_noah
    });
  
   // Anyways

   // and now; the third membership model!

   // cheers @_austbot 

   // let's see if our collab werks out of box, 21 days lata

  /*
  cool; prob nothin
  // cool https://hydra.cardinal.so/raindrops
  // cool https://hydra.cardinal.so/cupcakes
  // how did they do amperfuckerystandy https://hydra.cardinal.so/Rain&Cakes
  
  // kek

  // fuck doing it again to iterate the stupid many details objs
  // I mean, all y'all will wanna see it prob. sigh
  /// CHECKed or w/e lol: do the work for the normies, it ends up being worth it

  // // cool, cool, cool

  // everybody be cool this is a r o b b e r y https://open.spotify.com/track/0AwxXvGoYpioYfJeafgvTD?si=60fe2880f34e44f5

  // tl; dr:

  stacc@staccs-MacBook-Air hydra % yarn
zsh: command not found: yarn
stacc@staccs-MacBook-Air hydra % source ~/.bashrc 
yarn%                                                          
stacc@staccs-MacBook-Air hydra % yarn
➤ YN0000: ┌ Resolution step
➤ YN0032: │ fsevents@npm:2.3.2: Implicit dependencies on node-gyp are discouraged
➤ YN0032: │ secp256k1@npm:4.0.3: Implicit dependencies on node-gyp are discouraged
➤ YN0061: │ querystring@npm:0.2.1 is deprecated: The querystring API is considered Legacy. new code should use the URLSearchParams API instead.
➤ YN0032: │ bigint-buffer@npm:1.1.5: Implicit dependencies on node-gyp are discouraged
➤ YN0032: │ utf-8-validate@npm:5.0.9: Implicit dependencies on node-gyp are discouraged
➤ YN0032: │ bufferutil@npm:4.0.6: Implicit dependencies on node-gyp are discouraged
➤ YN0032: │ node-addon-api@npm:2.0.2: Implicit dependencies on node-gyp are discouraged
➤ YN0060: │ @glasseaters/hydra-sdk@workspace:packages/sdk provides @solana/web3.js (p1cc91) with version 1.43.5, which doesn't satisfy what @project-serum/common requests
➤ YN0002: │ @glasseaters/hydra-sdk@workspace:packages/sdk doesn't provide webpack (pc6c34), requested by style-loader
➤ YN0002: │ @glasseaters/hydra-sdk@workspace:packages/sdk doesn't provide webpack (pce339), requested by ts-loader
➤ YN0060: │ @strata-foundation/spl-utils@npm:3.7.0 provides @metaplex-foundation/mpl-token-metadata (pc358a) with version 1.2.5, which doesn't satisfy what @metaplex/js requests
➤ YN0002: │ react-dev-utils@npm:12.0.1 doesn't provide typescript (p59348), requested by fork-ts-checker-webpack-plugin
➤ YN0002: │ react-dev-utils@npm:12.0.1 doesn't provide webpack (p1012e), requested by fork-ts-checker-webpack-plugin
➤ YN0000: │ Some peer dependencies are incorrectly met; run yarn explain peer-requirements <hash> for details, where <hash> is the six-letter p-prefixed code
➤ YN0000: └ Completed in 10s 269ms
➤ YN0000: ┌ Fetch step
➤ YN0013: │ yn@npm:2.0.0 can't be found in the cache and will 
➤ YN0013: │ yn@npm:3.1.1 can't be found in the cache and will 
➤ YN0013: │ yocto-queue@npm:0.1.0 can't be found in the cache 
➤ YN0013: │ zwitch@npm:1.0.5 can't be found in the cache and w
➤ YN0013: │ typescript@npm:4.7.3 can't be found in the cache a
➤ YN0066: │ typescript@patch:typescript@npm%3A4.7.3#~builtin<compat/typescript>::version=4.7.3&hash=142761: Cannot apply hunk #3
➤ YN0000: └ Completed in 26s 966ms
➤ YN0000: ┌ Link step
➤ YN0007: │ bigint-buffer@npm:1.1.5 must be built because it never has been before or the last one failed
➤ YN0007: │ secp256k1@npm:4.0.3 must be built because it never has been before or the last one failed
➤ YN0007: │ core-js@npm:3.22.8 must be built because it never has been before or the last one failed
➤ YN0007: │ bufferutil@npm:4.0.6 must be built because it never has been before or the last one failed
➤ YN0007: │ utf-8-validate@npm:5.0.9 must be built because it never has been before or the last one failed
➤ YN0007: │ core-js-pure@npm:3.22.8 must be built because it never has been before or the last one failed
➤ YN0000: └ Completed in 12s 314ms
➤ YN0000: Done with warnings in 49s 679ms
stacc@staccs-MacBook-Air hydra % solana transfer 8QEKNRBovF4YggpGtKk8qaErWv7NcWM7AboZkKBipszy ALL -k ~/id.json  
Error: Account F9Z3JWZhBmChENpmg96y7q6YBzu4eky9EYDByDzHPdbS has insufficient funds for spend (0 SOL) + fee (0.000005 SOL)
stacc@staccs-MacBook-Air hydra % solana balance 8QEKNRBovF4YggpGtKk8qaErWv7NcWM7AboZkKBipszy
stacc@staccs-MacBook-Air hydra % mv ~/.config/solana/newnew.json ../oldold.json
stacc@staccs-MacBook-Air hydra % mv ~/raindrops/js/jare.json ~/.config/solana/newnew
.json
stacc@staccs-MacBook-Air hydra % solana address -k ~/.config/solana/newnew.json 
JARehRjGUkkEShpjzfuV4ERJS25j8XhamL776FAktNGm
stacc@staccs-MacBook-Air hydra % solana transfer JARehRjGUkkEShpjzfuV4ERJS25j8XhamL776FAktNGm ALL -k ../oldold.json 
Error: The recipient address (JARehRjGUkkEShpjzfuV4ERJS25j8XhamL776FAktNGm) is not funded. Add `--allow-unfunded-recipient` to complete the transfer 
stacc@staccs-MacBook-Air hydra % solana transfer JARehRjGUkkEShpjzfuV4ERJS25j8XhamL776FAktNGm ALL -k ../oldold.json --allow-unfunded-recipient

Signature: 3hQRNq31fWZaYmJjf1NhutLvqp6cHsa2RWE3vRkdwpzMyWRCtySg3VATjDRSEbrpeVbgxZ7Uu3WEC997F6nXzgnp

stacc@staccs-MacBook-Air hydra % ya 
stacc@staccs-MacBook-Air hydra % yarn add @glasseaters/hydra-sdk
➤ YN0000: ┌ Resolution step
➤ YN0060: │ @glasseaters/hydra-sdk@workspace:packages/sdk provides @solana/web3.js (p1cc91) with version 1.43.5, which doesn't satisfy what @project-serum/common requests
➤ YN0002: │ @glasseaters/hydra-sdk@workspace:packages/sdk doesn't provide webpack (pc6c34), requested by style-loader
➤ YN0002: │ @glasseaters/hydra-sdk@workspace:packages/sdk doesn't provide webpack (pce339), requested by ts-loader
➤ YN0060: │ @strata-foundation/spl-utils@npm:3.7.0 provides @metaplex-foundation/mpl-token-metadata (pc358a) with version 1.2.5, which doesn't satisfy what @metaplex/js requests
➤ YN0002: │ react-dev-utils@npm:12.0.1 doesn't provide typescript (p59348), requested by fork-ts-checker-webpack-plugin
➤ YN0002: │ react-dev-utils@npm:12.0.1 doesn't provide webpack (p1012e), requested by fork-ts-checker-webpack-plugin
➤ YN0000: │ Some peer dependencies are incorrectly met; run yarn explain peer-requirements <hash> for details, where <hash> is the six-letter p-prefixed code
➤ YN0000: └ Completed
➤ YN0000: ┌ Fetch step
➤ YN0000: └ Completed in 0s 267ms
➤ YN0000: ┌ Link step
➤ YN0008: │ bigint-buffer@npm:1.1.5 must be rebuilt because its dependency tree changed
➤ YN0008: │ secp256k1@npm:4.0.3 must be rebuilt because its dependency tree changed
➤ YN0008: │ bufferutil@npm:4.0.6 must be rebuilt because its dependency tree changed
➤ YN0008: │ utf-8-validate@npm:5.0.9 must be rebuilt because its dependency tree changed
➤ YN0000: └ Completed in 1s 984ms
➤ YN0000: Done with warnings in 2s 510ms
stacc@staccs-MacBook-Air hydra % cp ../
usage: cp [-R [-H | -L | -P]] [-fi | -n] [-apvXc] source_file target_file
       cp [-R [-H | -L | -P]] [-fi | -n] [-apvXc] source_file ... target_directory
stacc@staccs-MacBook-Air hydra % cp tests/token.test.ts ../
stacc@staccs-MacBook-Air hydra % cd ..
stacc@staccs-MacBook-Air prs % yarn add @glasseaters/hydra-sdk @project-serum/common
 @solana/web3.js
yarn add v1.22.18
info No lockfile found.
[1/4] 🔍  Resolving packages...
[2/4] 🚚  Fetching packages...
[3/4] 🔗  Linking dependencies...
warning " > @project-serum/common@0.0.1-beta.3" has incorrect peer dependency "@solana/web3.js@^0.87.1".
warning " > @project-serum/common@0.0.1-beta.3" has incorrect peer dependency "@solana/web3.js@^0.87.1".
[4/4] 🔨  Building fresh packages...
success Saved lockfile.
warning Your current version of Yarn is out of date. The latest version is "1.22.19", while you're on "1.22.18".
info To upgrade, run the following command:
$ curl --compressed -o- -L https://yarnpkg.com/install.sh | bash
success Saved 63 new dependencies.
info Direct dependencies
├─ @glasseaters/hydra-sdk@0.3.2
├─ @project-serum/common@0.0.1-beta.3
└─ @solana/web3.js@1.43.5
info All dependencies
├─ @ethersproject/bytes@5.6.1
├─ @glasseaters/hydra-sdk@0.3.2
├─ @metaplex-foundation/beet-solana@0.0.6
├─ @metaplex-foundation/beet@0.0.8
├─ @metaplex-foundation/mpl-core@0.0.2
├─ @metaplex-foundation/mpl-token-metadata@1.2.5
├─ @project-serum/anchor@0.11.1
├─ @project-serum/borsh@0.2.5
├─ @project-serum/common@0.0.1-beta.3
├─ @solana/spl-token@0.1.8
├─ @solana/web3.js@1.43.5
├─ @types/connect@3.4.35
├─ @types/express-serve-static-core@4.17.28
├─ @types/lodash@4.14.182
├─ @types/qs@6.9.7
├─ @types/range-parser@1.2.4
├─ @types/ws@7.4.7
├─ base-x@3.0.9
├─ base64-js@1.5.1
├─ bindings@1.5.0
├─ brorand@1.1.0
├─ bufferutil@4.0.6
├─ camelcase@5.3.1
├─ commander@2.20.3
├─ crypto-hash@1.3.0
├─ delay@5.0.0
├─ dot-case@3.0.4
├─ dotenv@10.0.0
├─ elliptic@6.5.4
├─ es6-promise@4.2.8
├─ es6-promisify@5.0.0
├─ eyes@0.1.8
├─ file-uri-to-path@1.0.0
├─ find@0.3.0
├─ hash.js@1.1.7
├─ hmac-drbg@1.0.1
├─ inherits@2.0.4
├─ isomorphic-ws@4.0.1
├─ js-sha256@0.9.0
├─ json-stringify-safe@5.0.1
├─ jsonparse@1.3.1
├─ JSONStream@1.3.5
├─ kind-of@6.0.3
├─ lodash@4.17.21
├─ lower-case@2.0.2
├─ minimalistic-assert@1.0.1
├─ ms@2.1.2
├─ no-case@3.0.4
├─ node-addon-api@2.0.2
├─ pako@2.0.4
├─ regenerator-runtime@0.13.9
├─ safe-buffer@5.2.1
├─ snake-case@3.0.4
├─ text-encoding-utf-8@1.0.2
├─ through@2.3.8
├─ tiny-invariant@1.2.0
├─ toml@3.0.0
├─ tr46@0.0.3
├─ traverse-chain@0.1.0
├─ utf-8-validate@5.0.9
├─ webidl-conversions@3.0.1
├─ whatwg-url@5.0.0
└─ ws@7.5.8
✨  Done in 9.81s.
stacc@staccs-MacBook-Air prs % yarn add ts-node
yarn add v1.22.18
warning package.json: No license field
warning No license field
[1/4] 🔍  Resolving packages...
[2/4] 🚚  Fetching packages...
[3/4] 🔗  Linking dependencies...
warning " > @project-serum/common@0.0.1-beta.3" has incorrect peer dependency "@solana/web3.js@^0.87.1".
warning " > ts-node@10.8.1" has unmet peer dependency "@types/node@*".
warning " > ts-node@10.8.1" has unmet peer dependency "typescript@>=2.7".
[4/4] 🔨  Building fresh packages...
success Saved lockfile.
warning No license field
success Saved 17 new dependencies.
info Direct dependencies
└─ ts-node@10.8.1
info All dependencies
├─ @cspotcode/source-map-support@0.8.1
├─ @jridgewell/resolve-uri@3.0.7
├─ @jridgewell/sourcemap-codec@1.4.13
├─ @jridgewell/trace-mapping@0.3.9
├─ @tsconfig/node10@1.0.8
├─ @tsconfig/node12@1.0.9
├─ @tsconfig/node14@1.0.1
├─ @tsconfig/node16@1.0.2
├─ acorn-walk@8.2.0
├─ acorn@8.7.1
├─ arg@4.1.3
├─ create-require@1.1.1
├─ diff@4.0.2
├─ make-error@1.3.6
├─ ts-node@10.8.1
├─ v8-compile-cache-lib@3.0.1
└─ yn@3.1.1
✨  Done in 1.94s.
stacc@staccs-MacBook-Air prs % yarn ts-node token.test.ts 
yarn run v1.22.18
warning package.json: No license field
$ /Users/stacc/prs/node_modules/.bin/ts-node token.test.ts
node:internal/modules/cjs/loader:936
  throw err;
  ^

Error: Cannot find module 'typescript'
Require stack:
- /Users/stacc/prs/node_modules/ts-node/dist/util.js
- /Users/stacc/prs/node_modules/ts-node/dist/bin.js
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:933:15)
    at Function.resolve (node:internal/modules/cjs/helpers:108:19)
    at projectLocalResolveHelper (/Users/stacc/prs/node_modules/ts-node/dist/util.js:117:24)
    at resolveCompiler (/Users/stacc/prs/node_modules/ts-node/dist/configuration.js:227:22)
    at resolveAndLoadCompiler (/Users/stacc/prs/node_modules/ts-node/dist/configuration.js:220:26)
    at findAndReadConfig (/Users/stacc/prs/node_modules/ts-node/dist/configuration.js:48:28)
    at phase3 (/Users/stacc/prs/node_modules/ts-node/dist/bin.js:255:67)
    at bootstrap (/Users/stacc/prs/node_modules/ts-node/dist/bin.js:44:30)
    at main (/Users/stacc/prs/node_modules/ts-node/dist/bin.js:32:12)
    at Object.<anonymous> (/Users/stacc/prs/node_modules/ts-node/dist/bin.js:526:5) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    '/Users/stacc/prs/node_modules/ts-node/dist/util.js',
    '/Users/stacc/prs/node_modules/ts-node/dist/bin.js'
  ]
}
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
stacc@staccs-MacBook-Air prs % cp hydra/package.json ./
stacc@staccs-MacBook-Air prs % yarn add @glasseaters/hydra-sdk @project-serum/common @solana/web3.js
yarn add v1.22.18
error Running this command will add the dependency to the workspace root rather than the workspace itself, which might not be what you want - if you really meant it, make it explicit by running this command again with the -W flag (or --ignore-workspace-root-check).
info Visit https://yarnpkg.com/en/docs/cli/add for documentation about this command.
stacc@staccs-MacBook-Air prs % yarn add @glasseaters/hydra-sdk @project-serum/common @solana/web3.js -W
yarn add v1.22.18
[1/4] 🔍  Resolving packages...
[2/4] 🚚  Fetching packages...
warning Pattern ["@project-serum/common@^0.0.1-beta.3"] is trying to unpack in the same destination "/Users/stacc/Library/Caches/Yarn/v6/npm-@project-serum-common-0.0.1-beta.3-53586eaff9d9fd7e8938b1e12080c935b8b6ad07-integrity/node_modules/@project-serum/common" as pattern ["@project-serum/common@0.0.1-beta.3"]. This could result in non-deterministic behavior, skipping.
warning Pattern ["@solana/web3.js@^1.43.5"] is trying to unpack in the same destination "/Users/stacc/Library/Caches/Yarn/v6/npm-@solana-web3-js-1.43.5-ab12bb6ab3fff0a08e8c7453b4fc4cda9f66df11-integrity/node_modules/@solana/web3.js" as pattern ["@solana/web3.js@^1.31.0","@solana/web3.js@^1.31.0","@solana/web3.js@^1.21.0","@solana/web3.js@^1.32.0","@solana/web3.js@^1.30.2","@solana/web3.js@^1.11.0","@solana/web3.js@^1.9.1","@solana/web3.js@^1.31.0","@solana/web3.js@^1.31.0","@solana/web3.js@^1.31.0","@solana/web3.js@^1.31.0","@solana/web3.js@^1.35.0","@solana/web3.js@^1.36.0","@solana/web3.js@^1.31.0","@solana/web3.js@^1.36.0","@solana/web3.js@^1.31.0","@solana/web3.js@^1.31.0","@solana/web3.js@^1.21.0","@solana/web3.js@^1.17.0"]. This could result in non-deterministic behavior, skipping.
[3/4] 🔗  Linking dependencies...
warning "@strata-foundation/spl-utils > @metaplex/js@4.12.0" has unmet peer dependency "@metaplex-foundation/mpl-auction@^0.0.2".
warning "@strata-foundation/spl-utils > @metaplex/js@4.12.0" has unmet peer dependency "@metaplex-foundation/mpl-core@^0.0.2".
warning "@strata-foundation/spl-utils > @metaplex/js@4.12.0" has unmet peer dependency "@metaplex-foundation/mpl-metaplex@^0.0.5".
warning "@strata-foundation/spl-utils > @metaplex/js@4.12.0" has incorrect peer dependency "@metaplex-foundation/mpl-token-metadata@^0.0.2".
warning "@strata-foundation/spl-utils > @metaplex/js@4.12.0" has unmet peer dependency "@metaplex-foundation/mpl-token-vault@^0.0.2".
warning "@strata-foundation/spl-utils > @metaplex/js@4.12.0" has unmet peer dependency "@solana/spl-token@^0.1.8".
warning "@glasseaters/hydra-sdk > @project-serum/common@0.0.1-beta.3" has incorrect peer dependency "@solana/web3.js@^0.87.1".
warning " > @project-serum/common@0.0.1-beta.3" has incorrect peer dependency "@solana/web3.js@^0.87.1".
[4/4] 🔨  Building fresh packages...
success Saved lockfile.
success Saved 142 new dependencies.
info Direct dependencies
├─ @glasseaters/hydra-sdk@0.3.2
├─ @project-serum/common@0.0.1-beta.3
└─ @solana/web3.js@1.43.5
info All dependencies
├─ @glasseaters/hydra-sdk@0.3.2
├─ @hapi/topo@5.1.0
├─ @metaplex-foundation/beet@0.2.0
├─ @metaplex-foundation/mpl-metaplex@0.0.5
├─ @metaplex/arweave-cost@1.0.4
├─ @metaplex/js@4.12.0
├─ @project-serum/borsh@0.2.5
├─ @project-serum/common@0.0.1-beta.3
├─ @sideway/address@4.1.4
├─ @sideway/formula@3.0.0
├─ @sideway/pinpoint@2.0.0
├─ @solana/spl-name-service@0.1.4
├─ @solana/spl-token-registry@0.2.4316
├─ @solana/web3.js@1.43.5
├─ @types/bn.js@4.11.6
├─ @types/bs58@4.0.1
├─ @types/json5@0.0.29
├─ @ungap/promise-all-settled@1.1.2
├─ aggregate-error@3.1.0
├─ ansi-colors@4.1.1
├─ ansi-escapes@4.3.2
├─ ansi-regex@5.0.1
├─ anymatch@3.1.2
├─ argparse@2.0.1
├─ arrify@1.0.1
├─ assertion-error@1.1.0
├─ asynckit@0.4.0
├─ balanced-match@1.0.2
├─ binary-extensions@2.2.0
├─ braces@3.0.2
├─ browser-stdout@1.3.1
├─ buffer-from@1.1.2
├─ chokidar@3.5.3
├─ clean-stack@2.2.0
├─ cli-cursor@3.1.0
├─ cli-truncate@3.1.0
├─ color-convert@2.0.1
├─ color-name@1.1.4
├─ combined-stream@1.0.8
├─ commander@9.3.0
├─ concat-map@0.0.1
├─ cross-fetch@3.1.5
├─ cross-spawn@7.0.3
├─ date-fns@2.28.0
├─ debug@4.3.4
├─ decamelize@4.0.0
├─ deep-eql@3.0.1
├─ delayed-stream@1.0.0
├─ diff@5.0.0
├─ eastasianwidth@0.2.0
├─ emoji-regex@8.0.0
├─ escape-string-regexp@4.0.0
├─ execa@5.1.1
├─ fill-range@7.0.1
├─ find-up@5.0.0
├─ flat@5.0.2
├─ follow-redirects@1.15.1
├─ form-data@4.0.0
├─ fs.realpath@1.0.0
├─ fsevents@2.3.2
├─ get-stream@6.0.1
├─ glob-parent@5.1.2
├─ glob@7.2.0
├─ growl@1.10.5
├─ he@1.2.0
├─ human-signals@2.1.0
├─ indent-string@4.0.0
├─ inflight@1.0.6
├─ is-binary-path@2.1.0
├─ is-extglob@2.1.1
├─ is-glob@4.0.3
├─ is-number@7.0.0
├─ is-plain-obj@2.1.0
├─ is-stream@2.0.1
├─ is-unicode-supported@0.1.0
├─ isexe@2.0.0
├─ joi@17.6.0
├─ js-yaml@4.1.0
├─ json5@1.0.1
├─ lilconfig@2.0.5
├─ listr2@4.0.5
├─ localstorage-memory@1.0.3
├─ locate-path@6.0.0
├─ log-symbols@4.1.0
├─ log-update@4.0.0
├─ loupe@2.3.4
├─ merge-stream@2.0.0
├─ micromatch@4.0.5
├─ mime-db@1.52.0
├─ mime-types@2.1.35
├─ mimic-fn@2.1.0
├─ minimatch@4.2.1
├─ minimist@1.2.6
├─ mkdirp@0.5.6
├─ nanoid@3.3.1
├─ npm-run-path@4.0.1
├─ object-inspect@1.12.2
├─ onetime@5.1.2
├─ p-limit@3.1.0
├─ p-locate@5.0.0
├─ p-map@4.0.0
├─ path-exists@4.0.0
├─ path-is-absolute@1.0.1
├─ path-key@3.1.1
├─ pathval@1.1.1
├─ picomatch@2.3.1
├─ pidtree@0.5.0
├─ randombytes@2.1.0
├─ readdirp@3.6.0
├─ restore-cursor@3.1.0
├─ rfdc@1.3.0
├─ rxjs@7.5.5
├─ serialize-javascript@6.0.0
├─ shebang-command@2.0.0
├─ shebang-regex@3.0.0
├─ shell-quote@1.7.3
├─ signal-exit@3.0.7
├─ slice-ansi@5.0.0
├─ source-map-support@0.5.21
├─ source-map@0.6.1
├─ spawn-command@0.0.2-1
├─ spok@1.4.3
├─ string-argv@0.3.1
├─ strip-bom@3.0.0
├─ strip-final-newline@2.0.0
├─ strip-json-comments@3.1.1
├─ supports-color@8.1.1
├─ text-table@0.2.0
├─ to-regex-range@5.0.1
├─ tree-kill@1.2.2
├─ tsconfig-paths@3.14.1
├─ tslib@2.4.0
├─ type-detect@4.0.8
├─ type-fest@0.21.3
├─ wait-on@6.0.1
├─ which@2.0.2
├─ workerpool@6.2.0
├─ yaml@1.10.2
├─ yargs-parser@20.2.4
├─ yargs-unparser@2.0.0
├─ yargs@17.5.1
└─ yocto-queue@0.1.0
$ husky install
fatal: not a git repository (or any of the parent directories): .git
✨  Done in 20.27s.
stacc@staccs-MacBook-Air prs % yarn ts-node token.test.ts
yarn run v1.22.18
$ /Users/stacc/prs/node_modules/.bin/ts-node token.test.ts
rainy fanout: GNJEof2B3uveqMFzdqDwf7mRppbFBacKe4SPbcrECAnR
rainy fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
rainy fanout many details: [object Object]
1
2
/Users/stacc/prs/node_modules/@solana/web3.js/src/connection.ts:2975
          throw new TransactionExpiredTimeoutError(
                ^
TransactionExpiredTimeoutError: Transaction was not confirmed in 30.00 seconds. It is unknown if it succeeded or failed. Check signature 4NewRi1USZuX5shBP7ETnDvFFTV1KJ5DPfMVDqQ3hdLL5ZgV6J4k4rqVvbEyJcHpBnKYgAGhBzp8VfQeKxceNV4p using the Solana Explorer or CLI tools.
    at Connection.confirmTransaction (/Users/stacc/prs/node_modules/@solana/web3.js/src/connection.ts:2975:17) {
  signature: '4NewRi1USZuX5shBP7ETnDvFFTV1KJ5DPfMVDqQ3hdLL5ZgV6J4k4rqVvbEyJcHpBnKYgAGhBzp8VfQeKxceNV4p'
}
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
stacc@staccs-MacBook-Air prs % yarn ts-node token.test.ts
yarn run v1.22.18
$ /Users/stacc/prs/node_modules/.bin/ts-node token.test.ts
rainy fanout: GNJEof2B3uveqMFzdqDwf7mRppbFBacKe4SPbcrECAnR
rainy fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
rainy fanout many details: [object Object]
^C
stacc@staccs-MacBook-Air prs % yarn ts-node token.test.ts
yarn run v1.22.18
$ /Users/stacc/prs/node_modules/.bin/ts-node token.test.ts
rainy fanout: GNJEof2B3uveqMFzdqDwf7mRppbFBacKe4SPbcrECAnR
rainy fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
rainy fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'raindrops',
  accountKey: PublicKey {
    _bn: <BN: f6cc653d995df0444f4a82d476222cab2d70f35cb428e16d57b829fc330919f7>
stacc@staccs-MacBook-Air prs % yarn ts-node token.test.ts
yarn run v1.22.18
$ /Users/stacc/prs/node_modules/.bin/ts-node token.test.ts
rainy fanout: GNJEof2B3uveqMFzdqDwf7mRppbFBacKe4SPbcrECAnR
rainy fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
rainy fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'raindrops',
  accountKey: PublicKey {
    _bn: <BN: f6cc653d995df0444f4a82d476222cab2d70f35cb428e16d57b829fc330919f7>
  },
  totalShares: <BN: 0>,
  totalMembers: <BN: 0>,
  totalInflow: <BN: 0>,
  lastSnapshotAmount: <BN: 0>,
  bumpSeed: 254,
  accountOwnerBumpSeed: 0,
  totalAvailableShares: <BN: 0>,
  membershipModel: 1,
  membershipMint: PublicKey {
    _bn: <BN: 64402158a77c770e85eed54ead902eff794f2a54123dd3023aa2054f59e59a6c>
  },
  totalStakedShares: <BN: 0>
}
null
blah
nft fanout: 883jFGyUQMZesuYpptujUuhD3KccNckpboj3937tBd9F
nft fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
nft fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'cupcakes',
  accountKey: PublicKey {
    _bn: <BN: d36f59a30da7ae9486b3c9a90f89b3d71161aa5e08f8afeae28ecf5c68cf4e76>
  },
  totalShares: <BN: 0>,
  totalMembers: <BN: 0>,
  totalInflow: <BN: 0>,
  lastSnapshotAmount: <BN: 0>,
  bumpSeed: 254,
  accountOwnerBumpSeed: 0,
  totalAvailableShares: <BN: 0>,
  membershipModel: 2,
  membershipMint: null,
  totalStakedShares: null
}
1
2
3
tiptop fanout: cRfqkEEbgGsDkKnSEYoZZ1smLyWHbN7nMN4oaHTJ1WG
tiptop fanout sol hodling account: FycvXPVjj8eMtmma4r6nqpMtiSbWhDLnXhJyqSv4MuRe
tiptop fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'Rain&Cakes',
  accountKey: PublicKey {
    _bn: <BN: de84c2a60f8cd2eae050e43db12058b2eafaf9f95424768dd02d98612f6c6395>
  },
  totalShares: <BN: 2>,
  totalMembers: <BN: 0>,
  totalInflow: <BN: 0>,
  lastSnapshotAmount: <BN: 0>,
  bumpSeed: 255,
  accountOwnerBumpSeed: 0,
  totalAvailableShares: <BN: 2>,
  membershipModel: 0,
  membershipMint: null,
  totalStakedShares: null
}

{
  blockTime: 1654487949,
  meta: {
    err: { InstructionError: [Array] },
    fee: 5000,
    innerInstructions: [ [Object] ],
    logMessages: [
      'Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL invoke [1]',
      'Program log: Create',
      'Program 11111111111111111111111111111111 invoke [2]',
      'Allocate: account Address { address: 9LxZ1tGjsXwHwsp5H8g6FFXZKHZrioNnguQ6mSPYNWyj, base: None } already in use',
      'Program 11111111111111111111111111111111 failed: custom program error: 0x0',
      'Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL consumed 6513 of 1400000 compute units',
      'Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL failed: custom program error: 0x0'
    ],
    postBalances: [
      130227822,   2978880,
        2039280,   2282880,
              1,   1461600,
      853073280,   1141440,
        1009200, 953185920
    ],
    postTokenBalances: [ [Object] ],
    preBalances: [
      130232822,   2978880,
        2039280,   2282880,
              1,   1461600,
      853073280,   1141440,
        1009200, 953185920
    ],
    preTokenBalances: [ [Object] ],
    rewards: [],
    status: { Err: [Object] }
  },
  slot: 136519282,
  transaction: Transaction {
    signatures: [ [Object] ],
    feePayer: PublicKey {
      _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
    },
    instructions: [ [TransactionInstruction], [TransactionInstruction] ],
    recentBlockhash: 'bMSC6TVAkBDb8shiL7hqFSQwnacZ7e2Fvszpf9WHrSC',
    lastValidBlockHeight: undefined,
    nonceInfo: undefined,
    _message: Message {
      header: [Object],
      accountKeys: [Array],
      recentBlockhash: 'bMSC6TVAkBDb8shiL7hqFSQwnacZ7e2Fvszpf9WHrSC',
      instructions: [Array],
      indexToProgramIds: [Map]
    },
    _json: {
      recentBlockhash: 'bMSC6TVAkBDb8shiL7hqFSQwnacZ7e2Fvszpf9WHrSC',
      feePayer: 'JARehRjGUkkEShpjzfuV4ERJS25j8XhamL776FAktNGm',
      nonceInfo: null,
stacc@staccs-MacBook-Air prs % yarn ts-node token.test.ts
yarn run v1.22.18
$ /Users/stacc/prs/node_modules/.bin/ts-node token.test.ts
rainy fanout: GNJEof2B3uveqMFzdqDwf7mRppbFBacKe4SPbcrECAnR
rainy fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
rainy fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'raindrops',
  accountKey: PublicKey {
    _bn: <BN: f6cc653d995df0444f4a82d476222cab2d70f35cb428e16d57b829fc330919f7>
  },
  totalShares: <BN: 0>,
  totalMembers: <BN: 0>,
  totalInflow: <BN: 0>,
  lastSnapshotAmount: <BN: 0>,
  bumpSeed: 254,
  accountOwnerBumpSeed: 0,
  totalAvailableShares: <BN: 0>,
  membershipModel: 1,
  membershipMint: PublicKey {
    _bn: <BN: 64402158a77c770e85eed54ead902eff794f2a54123dd3023aa2054f59e59a6c>
  },
  totalStakedShares: <BN: 0>
}
nft fanout: 883jFGyUQMZesuYpptujUuhD3KccNckpboj3937tBd9F
nft fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
nft fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'cupcakes',
stacc@staccs-MacBook-Air prs % yarn ts-node token.test.ts
yarn run v1.22.18
$ /Users/stacc/prs/node_modules/.bin/ts-node token.test.ts
/Users/stacc/prs/node_modules/ts-node/src/index.ts:843
    return new TSError(diagnosticText, diagnosticCodes, diagnostics);
           ^
TSError: ⨯ Unable to compile TypeScript:
token.test.ts:157:54 - error TS2304: Cannot find name 'init'.

157  console.log('tiptop fanout sol hodling account: ' + init.nativeAccount.toBase58())
                                                         ~~~~

    at createTSError (/Users/stacc/prs/node_modules/ts-node/src/index.ts:843:12)
    at reportTSError (/Users/stacc/prs/node_modules/ts-node/src/index.ts:847:19)
stacc@staccs-MacBook-Air prs % yarn ts-node token.test.ts
yarn run v1.22.18
$ /Users/stacc/prs/node_modules/.bin/ts-node token.test.ts
rainy fanout: GNJEof2B3uveqMFzdqDwf7mRppbFBacKe4SPbcrECAnR
rainy fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
rainy fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'raindrops',
  accountKey: PublicKey {
    _bn: <BN: f6cc653d995df0444f4a82d476222cab2d70f35cb428e16d57b829fc330919f7>
  },
  totalShares: <BN: 0>,
  totalMembers: <BN: 0>,
  totalInflow: <BN: 0>,
  lastSnapshotAmount: <BN: 0>,
  bumpSeed: 254,
  accountOwnerBumpSeed: 0,
  totalAvailableShares: <BN: 0>,
  membershipModel: 1,
  membershipMint: PublicKey {
    _bn: <BN: 64402158a77c770e85eed54ead902eff794f2a54123dd3023aa2054f59e59a6c>
  },
  totalStakedShares: <BN: 0>
}
nft fanout: 883jFGyUQMZesuYpptujUuhD3KccNckpboj3937tBd9F
nft fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
nft fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'cupcakes',
  accountKey: PublicKey {
    _bn: <BN: d36f59a30da7ae9486b3c9a90f89b3d71161aa5e08f8afeae28ecf5c68cf4e76>
  },
  totalShares: <BN: 0>,
  totalMembers: <BN: 0>,
  totalInflow: <BN: 0>,
  lastSnapshotAmount: <BN: 0>,
  bumpSeed: 254,
  accountOwnerBumpSeed: 0,
  totalAvailableShares: <BN: 0>,
  membershipModel: 2,
  membershipMint: null,
  totalStakedShares: null
}
tiptop fanout: cRfqkEEbgGsDkKnSEYoZZ1smLyWHbN7nMN4oaHTJ1WG
tiptop fanout sol hodling account: HcQ4bhmwL7vm4ADUpYAecBKyYKnKAky26oWJiuMY6ysC
tiptop fanout many details: [object Object]
lol
Fanout {
  authority: PublicKey {
    _bn: <BN: ff00c6dd5bb35fd9ebfce6ebb8ec53217d531df0f936c154b569afea10e00bce>
  },
  name: 'Rain&Cakes',
  accountKey: PublicKey {
    _bn: <BN: de84c2a60f8cd2eae050e43db12058b2eafaf9f95424768dd02d98612f6c6395>
  },
  totalShares: <BN: 2>,
  totalMembers: <BN: 2>,
  totalInflow: <BN: 0>,
  lastSnapshotAmount: <BN: 0>,
  bumpSeed: 255,
  accountOwnerBumpSeed: 0,
  totalAvailableShares: <BN: 0>,
  membershipModel: 0,
  membershipMint: null,
  totalStakedShares: null
}
blegh
1
2
3
✨  Done in 75.64s.
stacc@staccs-MacBook-Air prs % 

  // your move, hydra rain strata dtp naysayers

  

  */
  // wtf is this doing here lol }

  /*
      const membershipMint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const distBot = new Keypair();
      //await airdrop(connection, distBot.publicKey, 1);
      const supply = 1000000 * 10 ** 6;
      const tokenAcct = await membershipMint.createAccount(
        authorityWallet.publicKey
      );
      const { fanout } = await fanoutSdk.initializeFanout({
        totalShares: 0,
        name: `Test${Date.now()}`,
        membershipModel: MembershipModel.Token,
        mint: membershipMint.publicKey,
      });
      const mint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      let mintAcctAuthority = await mint.createAssociatedTokenAccount(
        authorityWallet.publicKey
      );
      const { fanoutForMint, tokenAccount } =
        await fanoutSdk.initializeFanoutForMint({
          fanout,
          mint: mint.publicKey,
        });

      const fanoutMintAccount = await fanoutSdk.fetch<FanoutMint>(
        fanoutForMint,
        FanoutMint
      );

      expect(fanoutMintAccount.mint.toBase58()).to.equal(
        mint.publicKey.toBase58()
      );
      expect(fanoutMintAccount.fanout.toBase58()).to.equal(fanout.toBase58());
      expect(fanoutMintAccount.tokenAccount.toBase58()).to.equal(
        tokenAccount.toBase58()
      );
      expect(fanoutMintAccount.totalInflow.toString()).to.equal("0");
      expect(fanoutMintAccount.lastSnapshotAmount.toString()).to.equal("0");
      let totalStaked = 0;
      let members = [];
      await membershipMint.mintTo(
        tokenAcct,
        authorityWallet.publicKey,
        [],
        supply
      );
      for (let index = 0; index <= 4; index++) {
        let member = new Keypair();
        let pseudoRng = Math.floor(supply * Math.random() * 0.138);
        //await airdrop(connection, member.publicKey, 1);
        const tokenAcctMember =
          await membershipMint.createAssociatedTokenAccount(member.publicKey);
        let mintAcctMember = await mint.createAssociatedTokenAccount(
          member.publicKey
        );
        await membershipMint.transfer(
          tokenAcct,
          tokenAcctMember,
          authorityWallet.publicKey,
          [],
          pseudoRng
        );
        totalStaked += pseudoRng;
        const ixs = await fanoutSdk.stakeTokenMemberInstructions({
          shares: pseudoRng,
          fanout: fanout,
          membershipMintTokenAccount: tokenAcctMember,
          membershipMint: membershipMint.publicKey,
          member: member.publicKey,
          payer: member.publicKey,
        });
        const tx = await fanoutSdk.sendInstructions(
          ixs.instructions,
          [member],
          member.publicKey
        );
        if (!!tx.RpcResponseAndContext.value.err) {
          const txdetails = await connection.getConfirmedTransaction(
            tx.TransactionSignature
          );
          console.log(txdetails, tx.RpcResponseAndContext.value.err);
        }
        const voucher = await fanoutSdk.fetch<FanoutMembershipVoucher>(
          ixs.output.membershipVoucher,
          FanoutMembershipVoucher
        );

        expect(voucher.shares?.toString()).to.equal(`${pseudoRng}`);
        expect(voucher.membershipKey?.toBase58()).to.equal(
          member.publicKey.toBase58()
        );
        expect(voucher.fanout?.toBase58()).to.equal(fanout.toBase58());
        const stake = await membershipMint.getAccountInfo(
          ixs.output.stakeAccount
        );
        expect(stake.amount.toString()).to.equal(`${pseudoRng}`);
        members.push({
          member,
          membershipTokenAccount: tokenAcctMember,
          fanoutMintTokenAccount: mintAcctMember,
          shares: pseudoRng,
        });
      }
      let runningTotal = 0;
      for (let index = 0; index <= 4; index++) {
        const sent = Math.floor(Math.random() * 100 * 10 ** 6);
        await mint.mintTo(
          mintAcctAuthority,
          authorityWallet.publicKey,
          [],
          sent
        );
        await mint.transfer(
          mintAcctAuthority,
          tokenAccount,
          authorityWallet.publicKey,
          [],
          sent
        );
        runningTotal += sent;
        let member = members[index];
        let ix = await fanoutSdk.distributeTokenMemberInstructions({
          distributeForMint: true,
          fanoutMint: mint.publicKey,
          membershipMint: membershipMint.publicKey,
          fanout: fanout,
          member: member.member.publicKey,
          payer: distBot.publicKey,
        });
        // @ts-ignore
        const tx = await fanoutSdk.sendInstructions(
          ix.instructions,
          [distBot],
          distBot.publicKey
        );

        if (!!tx.RpcResponseAndContext.value.err) {
          const txdetails = await connection.getConfirmedTransaction(
            tx.TransactionSignature
          );
          console.log(txdetails, tx.RpcResponseAndContext.value.err);
        }
        const tokenAcctInfo = await connection.getTokenAccountBalance(
          member.fanoutMintTokenAccount,
          "confirmed"
        );
        let diff = ((supply - totalStaked) * sent) / totalStaked;
        let amountDist = (member.shares * diff) / supply;
        expect(tokenAcctInfo.value.amount, `${amountDist}`);
        // @ts-ignore
      }
    });

    it("Init", async () => {
      const membershipMint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const supply = 1000000 * 10 ** 6;
      const tokenAcct = await membershipMint.createAccount(
        authorityWallet.publicKey
      );
      await membershipMint.mintTo(
        tokenAcct,
        authorityWallet.publicKey,
        [],
        supply
      );
      const { fanout } = await fanoutSdk.initializeFanout({
        totalShares: 0,
        name: `Test${Date.now()}`,
        membershipModel: MembershipModel.Token,
        mint: membershipMint.publicKey,
      });

      const fanoutAccount = await fanoutSdk.fetch<Fanout>(fanout, Fanout);
      expect(fanoutAccount.membershipModel).to.equal(MembershipModel.Token);
      expect(fanoutAccount.lastSnapshotAmount.toString()).to.equal("0");
      expect(fanoutAccount.totalMembers.toString()).to.equal("0");
      expect(fanoutAccount.totalInflow.toString()).to.equal("0");
      expect(fanoutAccount.totalAvailableShares.toString()).to.equal("0");
      expect(fanoutAccount.totalShares.toString()).to.equal(supply.toString());
      expect(fanoutAccount.membershipMint?.toBase58()).to.equal(
        membershipMint.publicKey.toBase58()
      );
      expect(fanoutAccount.totalStakedShares?.toString()).to.equal("0");
    });

    it("Init For mint", async () => {
      const membershipMint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const supply = 1000000 * 10 ** 6;
      const tokenAcct = await membershipMint.createAccount(
        authorityWallet.publicKey
      );
      await membershipMint.mintTo(
        tokenAcct,
        authorityWallet.publicKey,
        [],
        supply
      );
      const { fanout } = await fanoutSdk.initializeFanout({
        totalShares: 0,
        name: `Test${Date.now()}`,
        membershipModel: MembershipModel.Token,
        mint: membershipMint.publicKey,
      });
      const mint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const { fanoutForMint, tokenAccount } =
        await fanoutSdk.initializeFanoutForMint({
          fanout,
          mint: mint.publicKey,
        });

      const fanoutMintAccount = await fanoutSdk.fetch<FanoutMint>(
        fanoutForMint,
        FanoutMint
      );

      expect(fanoutMintAccount.mint.toBase58()).to.equal(
        mint.publicKey.toBase58()
      );
      expect(fanoutMintAccount.fanout.toBase58()).to.equal(fanout.toBase58());
      expect(fanoutMintAccount.tokenAccount.toBase58()).to.equal(
        tokenAccount.toBase58()
      );
      expect(fanoutMintAccount.totalInflow.toString()).to.equal("0");
      expect(fanoutMintAccount.lastSnapshotAmount.toString()).to.equal("0");
    });

    it("Stakes Members", async () => {
      const membershipMint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const supply = 1000000 * 10 ** 6;
      const member = new Keypair();
      //await airdrop(connection, member.publicKey, 1);
      const tokenAcct = await membershipMint.createAccount(
        authorityWallet.publicKey
      );
      const tokenAcctMember = await membershipMint.createAssociatedTokenAccount(
        member.publicKey
      );
      await membershipMint.mintTo(
        tokenAcct,
        authorityWallet.publicKey,
        [],
        supply
      );
      await membershipMint.transfer(
        tokenAcct,
        tokenAcctMember,
        authorityWallet.publicKey,
        [],
        supply * 0.1
      );

      const { fanout } = await fanoutSdk.initializeFanout({
        totalShares: 0,
        name: `Test${Date.now()}`,
        membershipModel: MembershipModel.Token,
        mint: membershipMint.publicKey,
      });
      const ixs = await fanoutSdk.stakeTokenMemberInstructions({
        shares: supply * 0.1,
        fanout: fanout,
        membershipMintTokenAccount: tokenAcctMember,
        membershipMint: membershipMint.publicKey,
        member: member.publicKey,
        payer: member.publicKey,
      });
      const tx = await fanoutSdk.sendInstructions(
        ixs.instructions,
        [member],
        member.publicKey
      );
      if (!!tx.RpcResponseAndContext.value.err) {
        const txdetails = await connection.getConfirmedTransaction(
          tx.TransactionSignature
        );
        console.log(txdetails, tx.RpcResponseAndContext.value.err);
      }
      const voucher = await fanoutSdk.fetch<FanoutMembershipVoucher>(
        ixs.output.membershipVoucher,
        FanoutMembershipVoucher
      );

      expect(voucher.shares?.toString()).to.equal(`${supply * 0.1}`);
      expect(voucher.membershipKey?.toBase58()).to.equal(
        member.publicKey.toBase58()
      );
      expect(voucher.fanout?.toBase58()).to.equal(fanout.toBase58());
      const stake = await membershipMint.getAccountInfo(
        ixs.output.stakeAccount
      );
      expect(stake.amount.toString()).to.equal(`${supply * 0.1}`);
      const fanoutAccountData = await fanoutSdk.fetch<Fanout>(fanout, Fanout);
      expect(fanoutAccountData.totalShares?.toString()).to.equal(`${supply}`);
      expect(fanoutAccountData.totalStakedShares?.toString()).to.equal(
        `${supply * 0.1}`
      );
    });

    it("Allows Authority to Stake Members", async () => {
      const membershipMint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const supply = 1000000 * 10 ** 6;
      const member = new Keypair();
      //await airdrop(connection, member.publicKey, 1);
      const tokenAcct = await membershipMint.createAccount(
        authorityWallet.publicKey
      );
      await membershipMint.mintTo(
        tokenAcct,
        authorityWallet.publicKey,
        [],
        supply
      );

      const { fanout } = await fanoutSdk.initializeFanout({
        totalShares: 0,
        name: `Test${Date.now()}`,
        membershipModel: MembershipModel.Token,
        mint: membershipMint.publicKey,
      });
      const ixs = await fanoutSdk.stakeForTokenMemberInstructions({
        shares: supply * 0.1,
        fanout: fanout,
        membershipMintTokenAccount: tokenAcct,
        membershipMint: membershipMint.publicKey,
        fanoutAuthority: authorityWallet.publicKey,
        member: member.publicKey,
        payer: authorityWallet.publicKey,
      });
      const tx = await fanoutSdk.sendInstructions(
        ixs.instructions,
        [],
        authorityWallet.publicKey
      );
      if (!!tx.RpcResponseAndContext.value.err) {
        const txdetails = await connection.getConfirmedTransaction(
          tx.TransactionSignature
        );
        console.log(txdetails, tx.RpcResponseAndContext.value.err);
      }
      const voucher = await fanoutSdk.fetch<FanoutMembershipVoucher>(
        ixs.output.membershipVoucher,
        FanoutMembershipVoucher
      );

      expect(voucher.shares?.toString()).to.equal(`${supply * 0.1}`);
      expect(voucher.membershipKey?.toBase58()).to.equal(
        member.publicKey.toBase58()
      );
      expect(voucher.fanout?.toBase58()).to.equal(fanout.toBase58());
      const stake = await membershipMint.getAccountInfo(
        ixs.output.stakeAccount
      );
      expect(stake.amount.toString()).to.equal(`${supply * 0.1}`);
      const fanoutAccountData = await fanoutSdk.fetch<Fanout>(fanout, Fanout);
      expect(fanoutAccountData.totalShares?.toString()).to.equal(`${supply}`);
      expect(fanoutAccountData.totalStakedShares?.toString()).to.equal(
        `${supply * 0.1}`
      );
    });

    it("Distribute a Native Fanout with Token Members", async () => {
      const membershipMint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const distBot = new Keypair();
      //await airdrop(connection, distBot.publicKey, 1);
      let builtFanout = await builtTokenFanout(
        membershipMint,
        authorityWallet,
        fanoutSdk,
        100,
        5
      );
      expect(
        builtFanout.fanoutAccountData.totalAvailableShares.toString()
      ).to.equal("0");
      expect(builtFanout.fanoutAccountData.totalMembers.toString()).to.equal(
        "5"
      );
      expect(builtFanout.fanoutAccountData.totalShares?.toString()).to.equal(
        `${100 ** 6}`
      );
      expect(
        builtFanout.fanoutAccountData.totalStakedShares?.toString()
      ).to.equal(`${100 ** 6}`);
      expect(
        builtFanout.fanoutAccountData.lastSnapshotAmount.toString()
      ).to.equal("0");
      const sent = 10;
      //await airdrop(connection, builtFanout.fanoutAccountData.accountKey, sent);
      const firstSnapshot = sent * LAMPORTS_PER_SOL;
      const firstMemberAmount = firstSnapshot * 0.2;
      let member1 = builtFanout.members[0];
      let ix = await fanoutSdk.distributeTokenMemberInstructions({
        distributeForMint: false,
        membershipMint: membershipMint.publicKey,
        fanout: builtFanout.fanout,
        member: member1.wallet.publicKey,
        payer: distBot.publicKey,
      });
      const memberBefore = await fanoutSdk.connection.getAccountInfo(
        member1.wallet.publicKey
      );
      const tx = await fanoutSdk.sendInstructions(
        ix.instructions,
        [distBot],
        distBot.publicKey
      );

      if (!!tx.RpcResponseAndContext.value.err) {
        const txdetails = await connection.getConfirmedTransaction(
          tx.TransactionSignature
        );
        console.log(txdetails, tx.RpcResponseAndContext.value.err);
      }
      const voucher = await fanoutSdk.fetch<FanoutMembershipVoucher>(
        ix.output.membershipVoucher,
        FanoutMembershipVoucher
      );
      const memberAfter = await fanoutSdk.connection.getAccountInfo(
        member1.wallet.publicKey
      );
      expect(voucher.lastInflow.toString()).to.equal(`${firstSnapshot}`);
      expect(voucher.shares.toString()).to.equal(`${100 ** 6 / 5}`);
      // @ts-ignore
      expect(memberAfter?.lamports - memberBefore?.lamports).to.equal(
        firstMemberAmount
      );
    });

    it("Unstake a Native Fanout with Token Members", async () => {
      const membershipMint = await Token.createMint(
        connection,
        authorityWallet,
        authorityWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const distBot = new Keypair();
      //await airdrop(connection, distBot.publicKey, 1);
      let builtFanout = await builtTokenFanout(
        membershipMint,
        authorityWallet,
        fanoutSdk,
        100,
        5
      );
      const sent = 10;
      const beforeUnstake = await fanoutSdk.fetch<Fanout>(
        builtFanout.fanout,
        Fanout
      );
      //await airdrop(connection, builtFanout.fanoutAccountData.accountKey, sent);
      const firstSnapshot = sent * LAMPORTS_PER_SOL;
      const firstMemberAmount = firstSnapshot * 0.2;
      let member1 = builtFanout.members[0];

      const memberFanoutSdk = new FanoutClient(
        connection,
        new NodeWallet(new Account(member1.wallet.secretKey))
      );
      let ix = await memberFanoutSdk.distributeTokenMemberInstructions({
        distributeForMint: false,
        membershipMint: membershipMint.publicKey,
        fanout: builtFanout.fanout,
        member: member1.wallet.publicKey,
        payer: member1.wallet.publicKey,
      });
      const voucherBefore =
        await memberFanoutSdk.fetch<FanoutMembershipVoucher>(
          ix.output.membershipVoucher,
          FanoutMembershipVoucher
        );
      await memberFanoutSdk.unstakeTokenMember({
        fanout: builtFanout.fanout,
        member: member1.wallet.publicKey,
        payer: member1.wallet.publicKey,
      });
      const afterUnstake = await memberFanoutSdk.fetch<Fanout>(
        builtFanout.fanout,
        Fanout
      );
      const memberAfter = await memberFanoutSdk.connection.getAccountInfo(
        member1.wallet.publicKey
      );
      expect(afterUnstake.totalStakedShares?.toString()).to.equal(
        `${(beforeUnstake?.totalStakedShares as BN).sub(
          voucherBefore.shares as BN
        )}`
      );
    }); 
  }); */
}, 1);
