import { BigIntColumn, DateTimeColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity("orders")
export class Order {
    constructor(props?: Partial<Order>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @StringColumn({ nullable: true })
    side?: string

    @BigIntColumn({ nullable: true })
    limitPrice?: bigint

    @BigIntColumn({ nullable: true })
    maxBaseQuantity?: bigint

    @BigIntColumn({ nullable: true })
    maxQuoteQuantity?: bigint

    @StringColumn({ nullable: true })
    selfTradeBehavior?: string

    @StringColumn({ nullable: true })
    orderType?: string

    @BigIntColumn({ nullable: true })
    clientId?: bigint

    @IntColumn({ nullable: true })
    limit?: number

    @Index()
    @StringColumn({ nullable: false })
    state!: 'opened' | 'closed'

    @Index()
    @StringColumn({ nullable: true })
    bids?: string

    @Index()
    @StringColumn({ nullable: true })
    asks?: string

    @Index()
    @StringColumn({ nullable: true })
    requestQueue?: string

    @Index()
    @StringColumn({ nullable: true })
    eventQueue?: string

    @Index()
    @StringColumn({ nullable: true })
    maker?: string

    @Index()
    @StringColumn({ nullable: true })
    taker?: string

    @Index()
    @StringColumn({ nullable: true })
    market?: string

    @StringColumn({ nullable: true })
    openOrderTx?: string

    @DateTimeColumn({ nullable: true })
    openedAt?: Date

    @IntColumn({ nullable: true })
    openedBlock?: number

    @StringColumn({ nullable: true })
    matchedOrderTx?: string

    @DateTimeColumn({ nullable: true })
    matchedAt?: Date

    @IntColumn({ nullable: true })
    mathedBlock?: number

    @StringColumn({ nullable: true })
    cancelledTx?: string

    @DateTimeColumn({ nullable: true })
    cancelledAt?: Date

    @IntColumn({ nullable: true })
    cancelledBlock?: number

    @StringColumn({ nullable: true })
    closedTx?: string

    @DateTimeColumn({ nullable: true })
    closedAt?: Date

    @IntColumn({ nullable: true })
    closedBlock?: number
}