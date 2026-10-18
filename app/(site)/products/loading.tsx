import { ProductsFrame, ProductsGridFallback } from "@/components/features/catalog/products-frame";

export default function ProductsLoading() {
  return (
    <ProductsFrame>
      <ProductsGridFallback />
    </ProductsFrame>
  );
}
