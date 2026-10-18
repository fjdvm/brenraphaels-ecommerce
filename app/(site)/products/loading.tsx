import { ProductsFrame, ProductsGridFallback, ShopToolbarFallback } from "@/components/features/catalog/products-frame";

export default function ProductsLoading() {
  return (
    <ProductsFrame>
      <div className="flex flex-col gap-10">
        <ShopToolbarFallback />
        <ProductsGridFallback />
      </div>
    </ProductsFrame>
  );
}
