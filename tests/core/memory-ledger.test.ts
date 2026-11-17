import { createMemoryLedgerStore } from "../../src/testing/memory-store.js";
import { ledgerContract } from "../contract/ledger.contract.js";

ledgerContract("memoria", () => Promise.resolve({ store: createMemoryLedgerStore() }));
