import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { can } from '../../core/permissions';
import { DECIMAL_UNITS, roundQty } from '../../core/pricing';
import { ADJUST_REASONS, type AdjustReason } from '../../core/stock';

type Auth = NonNullable<App.Locals['auth']>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class StockError extends Error {
	constructor(message: string, public status = 400) {
		super(message);
	}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

function requireStockPermission(auth: Auth) {
	if (!can(auth.permissions, 'stock.adjust')) throw new StockError('You are not allowed to change stock.', 403);
}

/** Checks a quantity is a sensible number and whole for items not sold by weight/volume. */
function checkQty(q: number, unit: string, name: string, { allowZero = false } = {}) {
	if (!Number.isFinite(q) || q < 0 || (!allowZero && q === 0) || q > 1_000_000) {
		throw new StockError(`Enter a valid quantity for ${name}.`);
	}
	if (!Number.isInteger(q) && !DECIMAL_UNITS.has(unit)) throw new StockError(`${name} is counted in whole ${unit}.`);
	return roundQty(q);
}

/** Current stock in the user's branch for the given products (sum of movements). */
export async function stockLevels(exec: typeof db | Tx, auth: Auth, productIds: string[]) {
	const levels = new Map<string, number>();
	if (productIds.length === 0) return levels;
	const rows = await exec
		.select({
			productId: schema.stockMovements.productId,
			qty: sql<number>`sum(${schema.stockMovements.quantity})`.mapWith(Number)
		})
		.from(schema.stockMovements)
		.where(
			and(
				eq(schema.stockMovements.tenantId, auth.tenantId),
				eq(schema.stockMovements.branchId, auth.branchId),
				inArray(schema.stockMovements.productId, productIds)
			)
		)
		.groupBy(schema.stockMovements.productId);
	for (const r of rows) levels.set(r.productId, roundQty(r.qty));
	return levels;
}

/** Stock per product in this branch, as a subquery to join against products. */
export function stockSubquery(auth: Auth) {
	return db
		.select({
			productId: schema.stockMovements.productId,
			qty: sql<number>`sum(${schema.stockMovements.quantity})`.as('qty')
		})
		.from(schema.stockMovements)
		.where(and(eq(schema.stockMovements.tenantId, auth.tenantId), eq(schema.stockMovements.branchId, auth.branchId)))
		.groupBy(schema.stockMovements.productId)
		.as('stock');
}

/** Active products that track stock, with their stock level — used by the product pickers. */
export async function listStockProducts(auth: Auth) {
	const stock = stockSubquery(auth);
	return db
		.select({
			id: schema.products.id,
			name: schema.products.name,
			sku: schema.products.sku,
			barcode: schema.products.barcode,
			unit: schema.products.unit,
			costPrice: schema.products.costPrice,
			categoryId: schema.products.categoryId,
			stock: sql<number>`coalesce(${stock.qty}, 0)`.mapWith(Number)
		})
		.from(schema.products)
		.leftJoin(stock, eq(stock.productId, schema.products.id))
		.where(
			and(
				eq(schema.products.tenantId, auth.tenantId),
				eq(schema.products.isActive, true),
				eq(schema.products.trackStock, true)
			)
		)
		.orderBy(asc(schema.products.name))
		.limit(5000);
}

async function loadTrackedProduct(exec: typeof db | Tx, auth: Auth, productId: string) {
	if (!isUuid(productId)) throw new StockError('Choose a product.');
	const [product] = await exec
		.select()
		.from(schema.products)
		.where(and(eq(schema.products.id, productId), eq(schema.products.tenantId, auth.tenantId)));
	if (!product) throw new StockError('Product not found.', 404);
	if (!product.trackStock) throw new StockError(`${product.name} does not track stock.`);
	return product;
}

// ─── Adjustments ────────────────────────────────────────────────────────────

export interface AdjustInput {
	productId: string;
	reason: string;
	direction: 'in' | 'out';
	quantity: number;
	note?: string;
}

/** Adds or removes stock by hand (damage, expiry, loss, corrections). */
export async function adjustStock(auth: Auth, input: AdjustInput) {
	requireStockPermission(auth);
	const reason = ADJUST_REASONS.find((r) => r.key === input.reason);
	if (!reason) throw new StockError('Choose a reason.');
	if (input.direction !== 'in' && input.direction !== 'out') throw new StockError('Choose add or remove.');
	if (reason.direction === 'out' && input.direction === 'in') {
		throw new StockError(`"${reason.label}" can only remove stock. Use Correction to add stock.`);
	}
	const note = input.note?.trim().slice(0, 300) || null;
	if (reason.key === 'adjustment' && !note) throw new StockError('Add a note explaining the correction.');

	return db.transaction(async (tx) => {
		const product = await loadTrackedProduct(tx, auth, input.productId);
		const qty = checkQty(Number(input.quantity), product.unit, product.name);
		const quantity = input.direction === 'out' ? -qty : qty;

		const [movement] = await tx
			.insert(schema.stockMovements)
			.values({
				tenantId: auth.tenantId,
				branchId: auth.branchId,
				productId: product.id,
				quantity,
				reason: reason.key as AdjustReason,
				note,
				userId: auth.userId
			})
			.returning();

		await tx.insert(schema.auditLog).values({
			tenantId: auth.tenantId,
			userId: auth.userId,
			action: 'stock.adjusted',
			entity: 'product',
			entityId: product.id,
			details: { name: product.name, quantity, reason: reason.key, note }
		});
		const levels = await stockLevels(tx, auth, [product.id]);
		return { movement, product, stock: levels.get(product.id) ?? 0 };
	});
}

// ─── Purchases (receiving stock) ────────────────────────────────────────────

export interface PurchaseInput {
	/** UUID made in the browser so a double submit saves the delivery only once. */
	id: string;
	supplierId?: string | null;
	/** Creates a new supplier with this name when no supplierId is given. */
	newSupplierName?: string;
	reference?: string;
	note?: string;
	updateCostPrices?: boolean;
	lines: { productId: string; quantity: number; unitCost: number }[];
}

export async function createPurchase(auth: Auth, input: PurchaseInput) {
	requireStockPermission(auth);
	if (!isUuid(input?.id)) throw new StockError('Invalid delivery ID.');

	const [existing] = await db
		.select({ id: schema.purchases.id, tenantId: schema.purchases.tenantId })
		.from(schema.purchases)
		.where(eq(schema.purchases.id, input.id));
	if (existing) {
		if (existing.tenantId !== auth.tenantId) throw new StockError('Invalid delivery ID.');
		return { id: existing.id, duplicate: true };
	}

	if (!Array.isArray(input.lines) || input.lines.length === 0) throw new StockError('Add at least one product.');
	if (input.lines.length > 500) throw new StockError('Too many lines in one delivery.');

	const ids = new Set<string>();
	for (const l of input.lines) {
		if (!isUuid(l?.productId)) throw new StockError('Invalid product in the list.');
		if (ids.has(l.productId)) throw new StockError('A product is listed twice. Combine them into one line.');
		ids.add(l.productId);
	}

	return db.transaction(async (tx) => {
		const products = await tx
			.select()
			.from(schema.products)
			.where(and(eq(schema.products.tenantId, auth.tenantId), inArray(schema.products.id, [...ids])));
		if (products.length !== ids.size) throw new StockError('Some products no longer exist.');
		const byId = new Map(products.map((p) => [p.id, p]));

		const lines = input.lines.map((l) => {
			const product = byId.get(l.productId)!;
			if (!product.trackStock) throw new StockError(`${product.name} does not track stock.`);
			const quantity = checkQty(Number(l.quantity), product.unit, product.name);
			const unitCost = Math.round(Number(l.unitCost));
			if (!Number.isFinite(unitCost) || unitCost < 0) throw new StockError(`Enter a valid cost for ${product.name}.`);
			return { product, quantity, unitCost, lineTotal: Math.round(quantity * unitCost) };
		});
		const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);

		let supplierId: string | null = null;
		if (input.supplierId) {
			if (!isUuid(input.supplierId)) throw new StockError('Supplier not found.');
			const [s] = await tx
				.select({ id: schema.suppliers.id })
				.from(schema.suppliers)
				.where(and(eq(schema.suppliers.id, input.supplierId), eq(schema.suppliers.tenantId, auth.tenantId)));
			if (!s) throw new StockError('Supplier not found.');
			supplierId = s.id;
		} else if (input.newSupplierName?.trim()) {
			const [s] = await tx
				.insert(schema.suppliers)
				.values({ tenantId: auth.tenantId, name: input.newSupplierName.trim().slice(0, 120) })
				.returning();
			supplierId = s.id;
		}

		await tx.insert(schema.purchases).values({
			id: input.id,
			tenantId: auth.tenantId,
			branchId: auth.branchId,
			supplierId,
			userId: auth.userId,
			reference: input.reference?.trim().slice(0, 100) || null,
			note: input.note?.trim().slice(0, 500) || null,
			total
		});

		await tx.insert(schema.purchaseItems).values(
			lines.map((l) => ({
				tenantId: auth.tenantId,
				purchaseId: input.id,
				productId: l.product.id,
				name: l.product.name,
				quantity: l.quantity,
				unitCost: l.unitCost,
				lineTotal: l.lineTotal
			}))
		);

		await tx.insert(schema.stockMovements).values(
			lines.map((l) => ({
				tenantId: auth.tenantId,
				branchId: auth.branchId,
				productId: l.product.id,
				quantity: l.quantity,
				reason: 'purchase' as const,
				refId: input.id,
				userId: auth.userId
			}))
		);

		// Keep cost prices current so profit and stock value stay accurate
		const costChanges: { name: string; from: number; to: number }[] = [];
		if (input.updateCostPrices) {
			for (const l of lines) {
				if (l.unitCost > 0 && l.unitCost !== l.product.costPrice) {
					await tx.update(schema.products).set({ costPrice: l.unitCost }).where(eq(schema.products.id, l.product.id));
					costChanges.push({ name: l.product.name, from: l.product.costPrice, to: l.unitCost });
				}
			}
		}

		await tx.insert(schema.auditLog).values({
			tenantId: auth.tenantId,
			userId: auth.userId,
			action: 'stock.received',
			entity: 'purchase',
			entityId: input.id,
			details: { lines: lines.length, total, supplierId, costChanges }
		});

		return { id: input.id, duplicate: false };
	});
}

export async function getPurchase(auth: Auth, purchaseId: string) {
	if (!isUuid(purchaseId)) return null;
	const [row] = await db
		.select({
			purchase: schema.purchases,
			supplier: schema.suppliers.name,
			receivedBy: schema.users.name
		})
		.from(schema.purchases)
		.leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.purchases.supplierId))
		.leftJoin(schema.users, eq(schema.users.id, schema.purchases.userId))
		.where(and(eq(schema.purchases.id, purchaseId), eq(schema.purchases.tenantId, auth.tenantId)));
	if (!row) return null;
	const items = await db
		.select({
			id: schema.purchaseItems.id,
			name: schema.purchaseItems.name,
			quantity: schema.purchaseItems.quantity,
			unitCost: schema.purchaseItems.unitCost,
			lineTotal: schema.purchaseItems.lineTotal,
			unit: schema.products.unit
		})
		.from(schema.purchaseItems)
		.leftJoin(schema.products, eq(schema.products.id, schema.purchaseItems.productId))
		.where(eq(schema.purchaseItems.purchaseId, purchaseId))
		.orderBy(asc(schema.purchaseItems.name));
	return { ...row, items };
}

// ─── Stock takes ────────────────────────────────────────────────────────────

/** Starts a count of every tracked product (or one category) in this branch. */
export async function startStockTake(auth: Auth, input: { categoryId?: string | null; note?: string }) {
	requireStockPermission(auth);
	if (input.categoryId && !isUuid(input.categoryId)) throw new StockError('Category not found.');

	return db.transaction(async (tx) => {
		const [open] = await tx
			.select({ id: schema.stockTakes.id })
			.from(schema.stockTakes)
			.where(
				and(
					eq(schema.stockTakes.tenantId, auth.tenantId),
					eq(schema.stockTakes.branchId, auth.branchId),
					eq(schema.stockTakes.status, 'counting')
				)
			);
		if (open) throw new StockError('A stock take is already in progress. Finish or cancel it first.', 409);

		const products = await tx
			.select({ id: schema.products.id })
			.from(schema.products)
			.where(
				and(
					eq(schema.products.tenantId, auth.tenantId),
					eq(schema.products.isActive, true),
					eq(schema.products.trackStock, true),
					input.categoryId ? eq(schema.products.categoryId, input.categoryId) : undefined
				)
			);
		if (products.length === 0) throw new StockError('There are no stock-tracked products to count.');

		const [take] = await tx
			.insert(schema.stockTakes)
			.values({
				tenantId: auth.tenantId,
				branchId: auth.branchId,
				userId: auth.userId,
				note: input.note?.trim().slice(0, 300) || null
			})
			.returning();

		await tx
			.insert(schema.stockTakeItems)
			.values(products.map((p) => ({ tenantId: auth.tenantId, stockTakeId: take.id, productId: p.id })));
		return take;
	});
}

export async function getStockTake(auth: Auth, takeId: string) {
	if (!isUuid(takeId)) return null;
	const [take] = await db
		.select({ take: schema.stockTakes, startedBy: schema.users.name })
		.from(schema.stockTakes)
		.leftJoin(schema.users, eq(schema.users.id, schema.stockTakes.userId))
		.where(and(eq(schema.stockTakes.id, takeId), eq(schema.stockTakes.tenantId, auth.tenantId)));
	if (!take) return null;

	const items = await db
		.select({
			productId: schema.stockTakeItems.productId,
			countedQty: schema.stockTakeItems.countedQty,
			expectedQty: schema.stockTakeItems.expectedQty,
			unitCost: schema.stockTakeItems.unitCost,
			name: schema.products.name,
			sku: schema.products.sku,
			barcode: schema.products.barcode,
			unit: schema.products.unit,
			costPrice: schema.products.costPrice,
			category: schema.categories.name
		})
		.from(schema.stockTakeItems)
		.innerJoin(schema.products, eq(schema.products.id, schema.stockTakeItems.productId))
		.leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
		.where(eq(schema.stockTakeItems.stockTakeId, takeId))
		.orderBy(asc(schema.categories.name), asc(schema.products.name));

	// While counting, compare against live stock. Once completed, use the saved snapshot.
	const live =
		take.take.status === 'counting' ? await stockLevels(db, auth, items.map((i) => i.productId)) : new Map<string, number>();

	return {
		...take,
		items: items.map((i) => ({
			...i,
			systemQty: take.take.status === 'counting' ? (live.get(i.productId) ?? 0) : (i.expectedQty ?? 0),
			cost: i.unitCost ?? i.costPrice
		}))
	};
}

async function lockCountingTake(tx: Tx, auth: Auth, takeId: string) {
	if (!isUuid(takeId)) throw new StockError('Stock take not found.', 404);
	const [take] = await tx
		.select()
		.from(schema.stockTakes)
		.where(and(eq(schema.stockTakes.id, takeId), eq(schema.stockTakes.tenantId, auth.tenantId)))
		.for('update');
	if (!take) throw new StockError('Stock take not found.', 404);
	if (take.status !== 'counting') throw new StockError('This stock take is already finished.');
	return take;
}

/** Saves counted quantities. A blank count (null) means "not counted yet". */
export async function saveCounts(auth: Auth, takeId: string, counts: Record<string, number | null>) {
	requireStockPermission(auth);
	return db.transaction(async (tx) => {
		await lockCountingTake(tx, auth, takeId);
		const items = await tx
			.select({ id: schema.stockTakeItems.id, productId: schema.stockTakeItems.productId, countedQty: schema.stockTakeItems.countedQty, unit: schema.products.unit, name: schema.products.name })
			.from(schema.stockTakeItems)
			.innerJoin(schema.products, eq(schema.products.id, schema.stockTakeItems.productId))
			.where(eq(schema.stockTakeItems.stockTakeId, takeId));

		let changed = 0;
		for (const item of items) {
			if (!(item.productId in counts)) continue;
			const raw = counts[item.productId];
			const value = raw === null ? null : checkQty(Number(raw), item.unit, item.name, { allowZero: true });
			if (value === item.countedQty) continue;
			await tx.update(schema.stockTakeItems).set({ countedQty: value }).where(eq(schema.stockTakeItems.id, item.id));
			changed++;
		}
		return { changed };
	});
}

/**
 * Finishes the count: for every counted product, stock is corrected to what was on the shelf.
 * The difference is measured against stock at this moment, so sales made during the
 * count are still taken into account.
 */
export async function completeStockTake(auth: Auth, takeId: string) {
	requireStockPermission(auth);
	return db.transaction(async (tx) => {
		const take = await lockCountingTake(tx, auth, takeId);
		const items = await tx
			.select({ item: schema.stockTakeItems, costPrice: schema.products.costPrice, name: schema.products.name })
			.from(schema.stockTakeItems)
			.innerJoin(schema.products, eq(schema.products.id, schema.stockTakeItems.productId))
			.where(and(eq(schema.stockTakeItems.stockTakeId, takeId), isNotNull(schema.stockTakeItems.countedQty)));
		if (items.length === 0) throw new StockError('Count at least one product before completing.');

		const levels = await stockLevels(tx, auth, items.map((i) => i.item.productId));
		let valueChange = 0;
		const movements = [];
		for (const { item, costPrice } of items) {
			const expected = levels.get(item.productId) ?? 0;
			const diff = roundQty(item.countedQty! - expected);
			await tx
				.update(schema.stockTakeItems)
				.set({ expectedQty: expected, unitCost: costPrice })
				.where(eq(schema.stockTakeItems.id, item.id));
			if (diff !== 0) {
				valueChange += Math.round(diff * costPrice);
				movements.push({
					tenantId: auth.tenantId,
					branchId: take.branchId,
					productId: item.productId,
					quantity: diff,
					reason: 'stock_take' as const,
					refId: takeId,
					userId: auth.userId
				});
			}
		}
		if (movements.length) await tx.insert(schema.stockMovements).values(movements);

		// Products that weren't counted are left out of the result
		await tx
			.delete(schema.stockTakeItems)
			.where(and(eq(schema.stockTakeItems.stockTakeId, takeId), sql`${schema.stockTakeItems.countedQty} is null`));

		await tx
			.update(schema.stockTakes)
			.set({ status: 'completed', completedAt: new Date(), completedBy: auth.userId })
			.where(eq(schema.stockTakes.id, takeId));

		await tx.insert(schema.auditLog).values({
			tenantId: auth.tenantId,
			userId: auth.userId,
			action: 'stock_take.completed',
			entity: 'stock_take',
			entityId: takeId,
			details: { counted: items.length, adjusted: movements.length, valueChange }
		});
		return { counted: items.length, adjusted: movements.length, valueChange };
	});
}

export async function cancelStockTake(auth: Auth, takeId: string) {
	requireStockPermission(auth);
	return db.transaction(async (tx) => {
		await lockCountingTake(tx, auth, takeId);
		await tx.update(schema.stockTakes).set({ status: 'cancelled', completedAt: new Date(), completedBy: auth.userId }).where(eq(schema.stockTakes.id, takeId));
		await tx.insert(schema.auditLog).values({
			tenantId: auth.tenantId,
			userId: auth.userId,
			action: 'stock_take.cancelled',
			entity: 'stock_take',
			entityId: takeId
		});
	});
}

/** Recent stock takes with how many products were counted and how many changed. */
export async function listStockTakes(auth: Auth) {
	return db
		.select({
			id: schema.stockTakes.id,
			status: schema.stockTakes.status,
			note: schema.stockTakes.note,
			startedAt: schema.stockTakes.startedAt,
			completedAt: schema.stockTakes.completedAt,
			startedBy: schema.users.name,
			items: sql<number>`(select count(*) from ${schema.stockTakeItems} where ${schema.stockTakeItems.stockTakeId} = ${schema.stockTakes.id})`.mapWith(Number),
			counted: sql<number>`(select count(*) from ${schema.stockTakeItems} where ${schema.stockTakeItems.stockTakeId} = ${schema.stockTakes.id} and ${schema.stockTakeItems.countedQty} is not null)`.mapWith(Number)
		})
		.from(schema.stockTakes)
		.leftJoin(schema.users, eq(schema.users.id, schema.stockTakes.userId))
		.where(and(eq(schema.stockTakes.tenantId, auth.tenantId), eq(schema.stockTakes.branchId, auth.branchId)))
		.orderBy(desc(schema.stockTakes.startedAt))
		.limit(50);
}

// ─── Movement history ───────────────────────────────────────────────────────

export async function listMovements(
	auth: Auth,
	opts: { productId?: string | null; reason?: string | null; limit?: number; offset?: number } = {}
) {
	return db
		.select({
			id: schema.stockMovements.id,
			productId: schema.stockMovements.productId,
			product: schema.products.name,
			unit: schema.products.unit,
			quantity: schema.stockMovements.quantity,
			reason: schema.stockMovements.reason,
			refId: schema.stockMovements.refId,
			note: schema.stockMovements.note,
			user: schema.users.name,
			createdAt: schema.stockMovements.createdAt
		})
		.from(schema.stockMovements)
		.innerJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
		.leftJoin(schema.users, eq(schema.users.id, schema.stockMovements.userId))
		.where(
			and(
				eq(schema.stockMovements.tenantId, auth.tenantId),
				eq(schema.stockMovements.branchId, auth.branchId),
				isUuid(opts.productId) ? eq(schema.stockMovements.productId, opts.productId) : undefined,
				opts.reason ? eq(schema.stockMovements.reason, opts.reason as (typeof schema.stockReasons)[number]) : undefined
			)
		)
		.orderBy(desc(schema.stockMovements.createdAt), desc(schema.stockMovements.id))
		.limit(opts.limit ?? 50)
		.offset(opts.offset ?? 0);
}
