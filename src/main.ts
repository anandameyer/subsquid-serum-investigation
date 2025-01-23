import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes"
import { decodeInstruction } from '@project-serum/serum'
import { run } from '@subsquid/batch-processor'
import { augmentBlock } from '@subsquid/solana-objects'
import { DataSourceBuilder, SolanaRpcClient } from '@subsquid/solana-stream'
import { TypeormDatabase } from '@subsquid/typeorm-store'
import BN from "bn.js"
import fs from "node:fs/promises"
import { Order } from "./model"

export const SERUM_PROGRAMID = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

enum CloseOpenOrderAccount {
    Order,
    Owner,
    RentReceiver,
    Market
}

enum InitOpenOrderAccount {
    Order,
    Owner,
    Market,
}

enum MatchOrderAccount {
    Market,
    RequestQueue,
    EventQueue,
    Bids,
    Asks,
    Limit
}

enum CancelOrderV2Account {
    Market,
    Bids,
    Asks,
    Owner,
    EventQueue,
}

enum OpenOrderAccount {
    Market,
    Order,
    RequestQueue,
    EventQueue,
    Bids,
    Asks,
    TokenAccountOwner,
    Owner,
    TokenAccountQuote,
    TokenAccountBase
}


// First we create a DataSource - component,
// that defines where to get the data and what data should we get.
const dataSource = new DataSourceBuilder()
    // Provide Subsquid Network Gateway URL.
    .setGateway('https://v2.archive.subsquid.io/network/solana-mainnet')
    // Subsquid Network is always about 1000 blocks behind the head.
    // We must use regular RPC endpoint to get through the last mile
    // and stay on top of the chain.
    // This is a limitation, and we promise to lift it in the future!
    .setRpc(process.env.SOLANA_NODE == null ? undefined : {
        client: new SolanaRpcClient({
            url: process.env.SOLANA_NODE,
            rateLimit: 1 // requests per sec
        }),
        strideConcurrency: 1
    })
    // Currently only blocks from 254_625_450 and above are stored in Subsquid Network.
    // When we specify it, we must also limit the range of requested blocks.
    //
    // Same applies to RPC endpoint of a node that cleanups its history.
    //
    // NOTE, that block ranges are specified in heights, not in slots !!!
    //
    // .setBlockRange({ from: 254_625_450 })
    .setBlockRange({ from: 278_003_399 })
    // .setBlockRange({ from: 278_257_649 })


    //
    // Block data returned by the data source has the following structure:
    //
    // interface Block {
    //     header: BlockHeader
    //     transactions: Transaction[]
    //     instructions: Instruction[]
    //     logs: LogMessage[]
    //     balances: Balance[]
    //     tokenBalances: TokenBalance[]
    //     rewards: Reward[]
    // }
    //
    // For each block item we can specify a set of fields we want to fetch via `.setFields()` method.
    // Think about it as of SQL projection.
    //
    // Accurate selection of only required fields can have a notable positive impact
    // on performance when data is sourced from Subsquid Network.
    //
    // We do it below only for illustration as all fields we've selected
    // are fetched by default.
    //
    // It is possible to override default selection by setting undesired fields to `false`.
    .setFields({
        block: { // block header fields
            timestamp: true

        },
        transaction: { // transaction fields
            signatures: true
        },
        instruction: { // instruction fields
            programId: true,
            accounts: true,
            data: true
        },
        tokenBalance: { // token balance record fields
            preAmount: true,
            postAmount: true,
            preOwner: true,
            postOwner: true
        },
        balance: {
            pre: true,
            post: true,

        }
    })
    // By default, block can be skipped if it doesn't contain explicitly requested items.
    //
    // We request items via `.addXxx()` methods.
    //
    // Each `.addXxx()` method accepts item selection criteria
    // and also allows to request related items.
    //
    // .addTransaction({}) 
    .addInstruction({
        // select instructions, that:
        where: {
            programId: [SERUM_PROGRAMID],
            isCommitted: true, // where successfully committed
            // d8: ["9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"],
        },
        // for each instruction selected above
        // make sure to also include:
        include: {
            innerInstructions: true, // inner instructions
            logs: true,
            transaction: true, // transaction, that executed the given instruction
            transactionTokenBalances: true, // all token balance records of executed transaction
        }
    })
    // .addLog({where: {programId: ["9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"]}, include: {instruction:true, transaction: true}})
    .build()


// Once we've prepared a data source we can start fetching the data right away:
//
// for await (let batch of dataSource.getBlockStream()) {
//     for (let block of batch) {
//         console.log(block)
//     }
// }
//
// However, Subsquid SDK can also help to decode and persist the data.
//

// Data processing in Subsquid SDK is defined by four components:
//
//  1. Data source (such as we've created above)
//  2. Database
//  3. Data handler
//  4. Processor
//
// Database is responsible for persisting the work progress (last processed block)
// and for providing storage API to the data handler.
//
// Data handler is a user defined function which accepts consecutive block batches,
// storage API and is responsible for entire data transformation.
//
// Processor connects and executes above three components.
//

// Below we create a `TypeormDatabase`.
//
// It provides restricted subset of [TypeORM EntityManager API](https://typeorm.io/working-with-entity-manager)
// as a persistent storage interface and works with any Postgres-compatible database.
//
// Note, that we don't pass any database connection parameters.
// That's because `TypeormDatabase` expects a certain project structure
// and environment variables to pick everything it needs by convention.
// Companion `@subsquid/typeorm-migration` tool works in the same way.
//
// For full configuration details please consult
// https://github.com/subsquid/squid-sdk/blob/278195bd5a5ed0a9e24bfb99ee7bbb86ff94ccb3/typeorm/typeorm-config/src/config.ts#L21
const database = new TypeormDatabase({})

const ordersFile = "orders.json"

// Now we are ready to start data processing
run(dataSource, database, async ctx => {
    // Block items that we get from `ctx.blocks` are flat JS objects.
    //
    // We can use `augmentBlock()` function from `@subsquid/solana-objects`
    // to enrich block items with references to related objects and
    // with convenient getters for derived data (e.g. `Instruction.d8`).
    let blocks = ctx.blocks.map(augmentBlock);

    const orders: Order[] = [];

    for (const b of blocks) {
        for (const i of b.instructions) {

            if (i.programId === SERUM_PROGRAMID) {

                let order: Order | undefined;
                let id: string | undefined;
                let orderIdx: number = -1;
                let bids: string | undefined;
                let asks: string | undefined;
                let market: string | undefined;
                let requestQueue: string | undefined;
                let eventQueue: string | undefined;

                // decode serum instruction data, the result either `closeOpenOrders`, `settleFunds`, 
                // `newOrderV3`, `initOpenOrders`, `matchOrders`, `cancelOrderV2`, or `consumeEvents`.
                const decoded = decodeInstruction(bs58.decode(i.data));

                // lets mapping each of action we decoded from instruction.
                switch (Object.keys(decoded)[0]) {
                    case "closeOpenOrders":

                        id = i.accounts.at(CloseOpenOrderAccount.Order);
                        order = orders.find(e => e.id === id);
                        if (!order) order = await ctx.store.findOneBy(Order, { id: id });
                        if (!order) break

                        order.closedAt = new Date(i.block.timestamp * 1000);
                        order.closedTx = i.getTransaction().signatures[0];
                        order.closedBlock = b.header.height;
                        order.state = 'closed';

                        orderIdx = orders.findIndex(e => e.id === id);
                        if (orderIdx > -1) {
                            orders[orderIdx] = order;
                        } else {
                            orders.push(order);
                        }

                        break

                    case "settleFunds":
                        // we are not interested with settleFunds where the operation of transfering token between taker and make happens.
                        break
                        
                    case "newOrderV3":

                        id = i.accounts.at(OpenOrderAccount.Order);
                        order = orders.find(e => e.id === id);
                        if (!order) order = await ctx.store.findOneBy(Order, { id: id });
                        if (!order) order = new Order({ id: id, state: 'opened' });

                        const decodedData: Record<string, any> = decoded["newOrderV3"];

                        order.side = (decodedData["side"] as string);
                        order.limitPrice = BigInt((decodedData["limitPrice"] as BN)?.toString());
                        order.maxBaseQuantity = BigInt((decodedData["maxBaseQuantity"] as BN)?.toString());
                        order.maxQuoteQuantity = BigInt((decodedData["maxQuoteQuantity"] as BN)?.toString());
                        order.selfTradeBehavior = (decodedData["selfTradeBehavior"] as string);
                        order.orderType = (decodedData["orderType"] as string);
                        order.clientId = BigInt((decodedData["clientId"] as BN)?.toString());
                        order.limit = (decodedData["limit"] as number);
                        order.openOrderTx = i.getTransaction().signatures.at(0);
                        order.openedAt = new Date(b.header.timestamp * 1000);
                        order.openedBlock = b.header.height;
                        order.market = i.accounts[OpenOrderAccount.Market];
                        order.bids = i.accounts[OpenOrderAccount.Bids];
                        order.asks = i.accounts[OpenOrderAccount.Asks];
                        order.requestQueue = i.accounts[OpenOrderAccount.RequestQueue];
                        order.eventQueue = i.accounts[OpenOrderAccount.EventQueue];



                        if ((decodedData["side"] as string) === "sell") {
                            order.maker = i.accounts[OpenOrderAccount.Owner]
                        } else {
                            order.taker = i.accounts[OpenOrderAccount.Owner]
                        }

                        orderIdx = orders.findIndex(e => e.id === id);
                        if (orderIdx > -1) {
                            orders[orderIdx] = order;
                        } else {
                            orders.push(order);
                        }

                        break
                    case "initOpenOrders":

                        id = i.accounts.at(InitOpenOrderAccount.Order);
                        order = orders.find(e => e.id === id);
                        if (!order) order = await ctx.store.findOneBy(Order, { id: id });
                        if (!order) order = new Order({ id: id, state: 'closed' });

                        order.market = i.accounts.at(InitOpenOrderAccount.Market);

                        orderIdx = orders.findIndex(e => e.id === id);
                        if (orderIdx > -1) {
                            orders[orderIdx] = order;
                        } else {
                            orders.push(order);
                        }

                        break

                    case "matchOrders":

                        bids = i.accounts.at(MatchOrderAccount.Bids);
                        asks = i.accounts.at(MatchOrderAccount.Asks);
                        market = i.accounts.at(MatchOrderAccount.Asks);
                        requestQueue = i.accounts.at(MatchOrderAccount.RequestQueue);
                        eventQueue = i.accounts.at(MatchOrderAccount.EventQueue);
                        order = orders.find(e => e.bids === bids && e.asks === asks && e.market === market && e.requestQueue === requestQueue && e.eventQueue === eventQueue);
                        if (!order) order = await ctx.store.findOneBy(Order, { bids, asks, market, requestQueue, eventQueue });
                        if (!order) break

                        order.matchedOrderTx = i.getTransaction().signatures.at(0);
                        order.matchedAt = new Date(b.header.timestamp * 1000);
                        order.mathedBlock = b.header.height;
                        orderIdx = orders.findIndex(e => e.id === order?.id);
                        if (orderIdx > -1) {
                            orders[orderIdx] = order;
                        } else {
                            orders.push(order);
                        }

                        // if (!order) order = new Order({ id: id, state: 'closed' });

                        // console.log("============= matchOrders ================");
                        // console.dir(decoded);
                        // console.log(i.transaction?.signatures);
                        // if (i.inner && i.inner.length > 0) {
                        //     console.dir(i.inner);
                        //     for (let inn of i.inner) {
                        //         console.dir(inn);
                        //         decodeTokenInstructionData(bs58.decode(inn.data));
                        //     }
                        // }
                        // if (i.accounts && i.accounts.length > 0) console.dir(i.accounts);
                        // console.log("============= matchOrders ================");

                        break

                    case "cancelOrderV2":

                        bids = i.accounts.at(CancelOrderV2Account.Bids);
                        asks = i.accounts.at(CancelOrderV2Account.Asks);
                        market = i.accounts.at(CancelOrderV2Account.Asks);
                        eventQueue = i.accounts.at(CancelOrderV2Account.EventQueue);
                        order = orders.find(e => e.bids === bids && e.asks === asks && e.market === market && e.eventQueue === eventQueue);
                        if (!order) order = await ctx.store.findOneBy(Order, { bids, asks, market, eventQueue });
                        if (!order) break

                        order.cancelledTx = i.getTransaction().signatures.at(0);
                        order.cancelledAt = new Date(b.header.timestamp * 1000);
                        order.cancelledBlock = b.header.height;
                        orderIdx = orders.findIndex(e => e.id === order?.id);
                        if (orderIdx > -1) {
                            orders[orderIdx] = order;
                        } else {
                            orders.push(order);
                        }

                        // console.log("============= cancelOrderV2 ================");
                        // console.dir(decoded);
                        // console.log(i.transaction?.signatures);
                        // if (i.inner && i.inner.length > 0) {
                        //     console.dir(i.inner);
                        //     for (let inn of i.inner) {
                        //         console.dir(inn);
                        //         decodeTokenInstructionData(bs58.decode(inn.data));
                        //     }
                        // }
                        // if (i.accounts && i.accounts.length > 0) console.dir(i.accounts);
                        // console.log("============= cancelOrderV2 ================");

                        break

                    case "consumeEvents":
                        // we are not interested with consumeEvents where the process try to lookup open order in queue.
                        break

                    default:
                        console.log(i.programId, i.inner, i.data, i.getTransaction().signatures.at(0), new Date(b.header.timestamp * 1000), b.header.height);
                        console.dir(decoded);
                        console.dir(Object.keys(decoded));
                        break
                }
            }
        }
    }

    if (orders.length > 0) {
        await ctx.store.upsert(orders);
        const fileContent = await readFile(ordersFile);
        const oldOrder: Order[] = fileContent !== "" ? JSON.parse(fileContent) : [];

        for (let o of orders) {
            if (o.side) {
                console.dir(o, { depth: null });
                const idx = oldOrder.findIndex(e => e.id === o.id);
                if (idx > -1) {
                    oldOrder[idx] = o;
                } else {
                    oldOrder.push(o);
                }
            }
        }

        await writeFile(ordersFile, oldOrder);
    }
})

async function readFile(file: string) {
    try {
        const data = await fs.readFile(file, { encoding: 'utf8' });
        return data;
    } catch (err) {
        console.error(err);
        return "";
    }
}

async function writeFile(file: string, content: any) {
    try {

        await fs.writeFile(file, JSON.stringify(content, replacer, " "));
    } catch (err) {
        console.log(err);
    }
}

function replacer(key: string, value: any) {
    if (typeof value === 'bigint') {
        return value.toString();
    } else if (value === null) {
        return undefined
    } else {
        return value
    }
}