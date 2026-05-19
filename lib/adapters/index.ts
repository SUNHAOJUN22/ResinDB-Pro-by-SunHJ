import { IndexedDBProductAdapter } from "./IndexedDBProductAdapter";
import { IProductAdapter } from "./types";

const adapter: IProductAdapter = new IndexedDBProductAdapter();

export default adapter;
export * from "./types";
