import { IndexedDBProductAdapter } from "@/lib/adapters/IndexedDBProductAdapter";
import { IProductAdapter } from "@/lib/adapters/types";

const adapter: IProductAdapter = new IndexedDBProductAdapter();

export default adapter;
export * from "@/lib/adapters/types";
