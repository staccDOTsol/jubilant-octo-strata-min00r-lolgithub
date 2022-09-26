import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from 'fs'
import * as switchboard from "@switchboard-xyz/switchboard-v2";
import { json } from "stream/consumers";
process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err);
  });
  
let jares = {"3bTuuFXfPPcfpTAjbBrqGevnfBctu68JSKVx9h5jjKNF":
    new PublicKey("9fjxNUGMk1U9U15qxGUpdyGjfcKrFrvUVTwubFx4NvTK"),
    "Ap7Y4CHAMLsfCAfCYuCYhH1n7qpJLtfS6LbkjsutnpQw":
    new PublicKey("2PYVzDJ6Buks4yUVeDEhLwc14wKpxbehEsbeU6yM8J8d"),
    "77xobpfPguimoyy9UWyrXepJGbFbpD9GZkdopwJwcBFh":
    new PublicKey("ALLkkMm2TmGzo2Zy1QzpBwKQdRcW3PXue7JBN6gEcZDb"),
    "HTQhMV9d1b2irzJijVHzsbNJ42f3mRUWzj5ugkLiXzmh":
    new PublicKey("JCJtFvMZTmdH9pLgKdMLyJdpRUgScAtnBNB4GptuvxSD")}

let keys = [new PublicKey("3bTuuFXfPPcfpTAjbBrqGevnfBctu68JSKVx9h5jjKNF") //USDH
, new PublicKey("Ap7Y4CHAMLsfCAfCYuCYhH1n7qpJLtfS6LbkjsutnpQw") // USDC,
, new PublicKey("77xobpfPguimoyy9UWyrXepJGbFbpD9GZkdopwJwcBFh") //PAI
, new PublicKey("HTQhMV9d1b2irzJijVHzsbNJ42f3mRUWzj5ugkLiXzmh") // USDT
//, new PublicKey("CK74KYuhbzMN4RyhJLVkL8avY6L83AZMBQ52bD7eWXy6") // cUSDT why is it 1.06 fuck this
]
let results: any = {"3bTuuFXfPPcfpTAjbBrqGevnfBctu68JSKVx9h5jjKNF": 0.99844,
"Ap7Y4CHAMLsfCAfCYuCYhH1n7qpJLtfS6LbkjsutnpQw": 1,
"77xobpfPguimoyy9UWyrXepJGbFbpD9GZkdopwJwcBFh": 0.9997,
"HTQhMV9d1b2irzJijVHzsbNJ42f3mRUWzj5ugkLiXzmh": 1.0001}
const payer = Keypair.fromSecretKey((new Uint8Array(JSON.parse(( fs.readFileSync('/Users/jarettdunn/jaregm.json')).toString()))));
const connection = new Connection(clusterApiUrl("mainnet-beta"));

let solusdc: any = {}

async function ha ()  {
  const program = await switchboard.loadSwitchboardProgram(
    "mainnet-beta",
    connection,
    payer
  );
  var aggregatorKey = new PublicKey("3Fb4JXpEd6pCqcKctqHwhB4WgvguzbWFM1ioSAsZiLmM")
  try {
        const aggregatorAccount = new switchboard.AggregatorAccount({
          program: program,
          publicKey: aggregatorKey,
        });
        const result: any = await aggregatorAccount.getLatestValue();
      
      solusdc['sol'] = result.toNumber()
      } catch (err){
          
      }
  for (var key of keys){
    try {
  console.log("here " + key.toBase58()  );
  const aggregatorAccount = new switchboard.AggregatorAccount({
    program: program,
    publicKey: key,
  });
  const result: any = await aggregatorAccount.getLatestValue();

  results[key.toBase58()]=(result.toNumber());
} catch (err){
    console.log(err)
}
}
};
setInterval(async function(){
 ha()

})