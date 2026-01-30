export enum BottleType {
  OXYZONE_LARGE = 'Oxyzone Large',
  OXYZONE_SMALL = 'Oxyzone Small',
  CO2_LARGE = 'CO2 Large',
  CO2_SMALL = 'CO2 Small',
}

export enum TransactionType {
  OUTGOING = 'OUTGOING', // Store gives to Customer (Balance +)
  INCOMING = 'INCOMING', // Customer returns to Store (Balance -)
}

export interface InventoryCounts {
  [BottleType.OXYZONE_LARGE]: number;
  [BottleType.OXYZONE_SMALL]: number;
  [BottleType.CO2_LARGE]: number;
  [BottleType.CO2_SMALL]: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  balance: InventoryCounts; // Positive means customer has the bottles
  lastTransactionDate: number;
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  timestamp: number;
  type: TransactionType;
  items: InventoryCounts;
  note?: string;
}

export interface AppData {
  customers: Customer[];
  transactions: Transaction[];
  version: number;
  storeLimits?: InventoryCounts; // Total bottles owned by the business
}

// For the UI state
export type ViewState = 
  | 'LOGIN' 
  | 'DASHBOARD' 
  | 'CUSTOMERS_LIST' 
  | 'CUSTOMER_DETAIL' 
  | 'NEW_TRANSACTION' 
  | 'EDIT_TRANSACTION'
  | 'NEW_CUSTOMER'
  | 'SETTINGS'
  | 'INVENTORY_DETAIL';