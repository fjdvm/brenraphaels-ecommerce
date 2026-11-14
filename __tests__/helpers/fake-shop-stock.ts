import { StockRefusedError, type ShopStock, type StockLine, type StockState } from "../../lib/orders/stock";

/** Fake IMS boundary with the same lifetime/idempotency contract as ticket #335. */
export class FakeShopStock implements ShopStock {
  available = new Map<number, number>();
  reservations = new Map<string, StockLine & { state: StockState }>();
  unavailable = false;
  failProduct: number | undefined;
  loseReserveReplies = false;
  productForSize(sizeId: number) { return sizeId + 100; }
  remaining(productId: number) { return this.available.get(productId) ?? 50; }
  async move(operation: "reserve" | "release", orderId: string, line: StockLine): Promise<StockState> {
    if (this.unavailable) throw new Error("IMS offline");
    const key = `${orderId}:${line.lineId}`;
    let entry = this.reservations.get(key);
    if (operation === "reserve") {
      if (!entry) {
        if (this.failProduct === line.productId || this.remaining(line.productId) < line.quantity) throw new StockRefusedError();
        this.available.set(line.productId, this.remaining(line.productId) - line.quantity);
        entry = { ...line, state: "reserved" };
        this.reservations.set(key, entry);
      }
      if (this.loseReserveReplies) throw new Error("Reply lost after IMS commit");
    } else {
      if (!entry) throw new Error("Unreserved line");
      if (entry.state === "reserved") {
        entry.state = "released";
        this.available.set(line.productId, this.remaining(line.productId) + line.quantity);
      }
    }
    return entry!.state;
  }
}
