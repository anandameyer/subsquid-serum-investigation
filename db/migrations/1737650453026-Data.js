module.exports = class Data1737650453026 {
    name = 'Data1737650453026'

    async up(db) {
        await db.query(`CREATE TABLE "orders" ("id" character varying NOT NULL, "side" text, "limit_price" numeric, "max_base_quantity" numeric, "max_quote_quantity" numeric, "self_trade_behavior" text, "order_type" text, "client_id" numeric, "limit" integer, "state" text NOT NULL, "bids" text, "asks" text, "request_queue" text, "event_queue" text, "maker" text, "taker" text, "market" text, "open_order_tx" text, "opened_at" TIMESTAMP WITH TIME ZONE, "opened_block" integer, "matched_order_tx" text, "matched_at" TIMESTAMP WITH TIME ZONE, "mathed_block" integer, "cancelled_tx" text, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancelled_block" integer, "closed_tx" text, "closed_at" TIMESTAMP WITH TIME ZONE, "closed_block" integer, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_c97ed5e639aa4e53ae1ba96ec5" ON "orders" ("state") `)
        await db.query(`CREATE INDEX "IDX_22e7018decfdf0d118216351e0" ON "orders" ("bids") `)
        await db.query(`CREATE INDEX "IDX_6ec69d56abb84d75501db006e5" ON "orders" ("asks") `)
        await db.query(`CREATE INDEX "IDX_54347f814e5177e6c756d355d4" ON "orders" ("request_queue") `)
        await db.query(`CREATE INDEX "IDX_a870dae42ea0d5a928de3032ec" ON "orders" ("event_queue") `)
        await db.query(`CREATE INDEX "IDX_e3f9ee9fdff1479a797ea2fdca" ON "orders" ("maker") `)
        await db.query(`CREATE INDEX "IDX_8276b82d241593d41076f6a195" ON "orders" ("taker") `)
        await db.query(`CREATE INDEX "IDX_ba7d261dede7523314fcec4c56" ON "orders" ("market") `)
    }

    async down(db) {
        await db.query(`DROP TABLE "orders"`)
        await db.query(`DROP INDEX "public"."IDX_c97ed5e639aa4e53ae1ba96ec5"`)
        await db.query(`DROP INDEX "public"."IDX_22e7018decfdf0d118216351e0"`)
        await db.query(`DROP INDEX "public"."IDX_6ec69d56abb84d75501db006e5"`)
        await db.query(`DROP INDEX "public"."IDX_54347f814e5177e6c756d355d4"`)
        await db.query(`DROP INDEX "public"."IDX_a870dae42ea0d5a928de3032ec"`)
        await db.query(`DROP INDEX "public"."IDX_e3f9ee9fdff1479a797ea2fdca"`)
        await db.query(`DROP INDEX "public"."IDX_8276b82d241593d41076f6a195"`)
        await db.query(`DROP INDEX "public"."IDX_ba7d261dede7523314fcec4c56"`)
    }
}
