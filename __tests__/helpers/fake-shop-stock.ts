import { StockRefusedError, type ShopStock, type StockLine, type StockState } from "../../lib/orders/stock";

/** Fake IMS boundary with the same lifetime/idempotency contract as ticket #335. */
export class FakeShopStock implements ShopStock {
  available = new Map<number, number>();
  reservations = new Map<string, StockLine & { state: StockState }>();
  unavailable = false;
  failProduct: number | undefined;
  loseReserveReplies = false;
  failReleaseProduct: number | undefined;
  failDeductProduct: number | undefined;
  deductions = 0;
  loseDeductReplies = false;
  productForSize(sizeId: number) { return sizeId + 100; }
  remaining(productId: number) { return this.available.get(productId) ?? 50; }
  async left(sizeId: number) { return (await this.read(sizeId)).available; }
  async read(sizeId: number) {
    if (this.unavailable) throw new Error("IMS offline");
    const productId = this.productForSize(sizeId);
    const reserved = [...this.reservations.values()].filter(r => r.productId === productId && r.state === "reserved").reduce((sum, r) => sum + r.quantity, 0);
    const available = this.remaining(productId);
    return { quantity: available + reserved, reserved, available };
  }
  async move(operation: "reserve" | "release" | "deduct" | "add_back", orderId: string, line: StockLine): Promise<StockState> {
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
    } else if (operation === "deduct") {
      if (this.failDeductProduct === line.productId) throw new Error("Deduction unavailable");
      if (!entry) throw new Error("Unreserved line");
      if (entry.state === "reserved") { entry.state = "deducted"; this.deductions++; }
      if (this.loseDeductReplies) throw new Error("Deduction reply lost");
    } else if (operation === "add_back") {
      if (!entry) throw new Error("Unreserved line");
      if (entry.state === "deducted") { entry.state = "added_back"; this.available.set(line.productId, this.remaining(line.productId) + line.quantity); }
    } else {
      if (this.failReleaseProduct === line.productId) throw new Error("Release unavailable");
      if (!entry) throw new Error("Unreserved line");
      if (entry.state === "reserved") {
        entry.state = "released";
        this.available.set(line.productId, this.remaining(line.productId) + line.quantity);
      }
    }
    return entry!.state;
  }
}
