import { AppData, Customer, Transaction, BottleType } from '../types';
import { INITIAL_COUNTS } from '../constants';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, remove, runTransaction } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';

// --- Local Storage Configuration ---
const STORAGE_KEY = 'oxytrack_db_v1';
const EMPTY_DB: AppData = {
  customers: [],
  transactions: [],
  version: 1,
  storeLimits: { ...INITIAL_COUNTS }
};

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDG2FCFmrozJPANIMGLVJn27VUrhmqUfdU",
  authDomain: "alibonny.firebaseapp.com",
  databaseURL: "https://alibonny-default-rtdb.firebaseio.com",
  projectId: "alibonny",
  storageBucket: "alibonny.firebasestorage.app",
  messagingSenderId: "494647989910",
  appId: "1:494647989910:web:7fc1c261931b9add9b54b7",
  measurementId: "G-VEPGN258EE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const DB_REF_PATH = 'oxytrack/data';

// --- Local Data Management ---

export const saveToStorage = (data: AppData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to local storage", e);
  }
};

export const loadFromStorage = (): AppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DB;
    const parsed = JSON.parse(raw);
    // Ensure storeLimits exists for migration
    if (!parsed.storeLimits) parsed.storeLimits = { ...INITIAL_COUNTS };
    return parsed as AppData;
  } catch (e) {
    console.error("Corrupt data found", e);
    return EMPTY_DB;
  }
};

// --- Remote Sync Management ---

let lastReceivedJSON = '';

export const subscribeToRemoteData = (onDataReceived: (data: AppData) => void) => {
  const dataRef = ref(db, DB_REF_PATH);
  
  const unsubscribe = onValue(dataRef, (snapshot) => {
    const val = snapshot.val();
    
    // Helper to ensure we get an array, even if Firebase returns an object (which it does for sparse arrays)
    // or undefined/null (which it does for empty paths).
    const toArray = (obj: any): any[] => {
      if (!obj) return [];
      if (Array.isArray(obj)) return obj;
      return Object.values(obj);
    };

    const normalizedData: AppData = {
        customers: toArray(val?.customers),
        transactions: toArray(val?.transactions),
        version: val?.version || 1,
        storeLimits: val?.storeLimits || { ...INITIAL_COUNTS }
    };

    // Update tracking var and notify app
    lastReceivedJSON = JSON.stringify(normalizedData);
    onDataReceived(normalizedData);
  });

  return unsubscribe;
};

// Helper to compare and merge arrays of entities (3-way merge)
// Preserves items added by remote that local hasn't seen yet
const mergeArrays = <T extends { id: string }>(base: T[], remote: T[], local: T[]): T[] => {
  const baseMap = new Map(base.map(i => [i.id, i]));
  const remoteMap = new Map(remote.map(i => [i.id, i]));
  const localMap = new Map(local.map(i => [i.id, i]));
  
  const allIds = new Set([...remoteMap.keys(), ...localMap.keys()]);
  const merged: T[] = [];

  allIds.forEach(id => {
    const inBase = baseMap.has(id);
    const inRemote = remoteMap.has(id);
    const inLocal = localMap.has(id);

    if (inLocal) {
        const localItem = localMap.get(id)!;
        const baseItem = baseMap.get(id);
        const remoteItem = remoteMap.get(id);

        // If local is untouched from base but remote changed, accept remote update
        if (inRemote && baseItem) {
            const localStr = JSON.stringify(localItem);
            const baseStr = JSON.stringify(baseItem);
            
            if (localStr === baseStr) {
                 // Local didn't change it. Did remote?
                 if (JSON.stringify(remoteItem) !== baseStr) {
                     merged.push(remoteItem!);
                     return;
                 }
            }
        }
        // Otherwise Local wins (Local changed it, or Conflict where LWW prefers Local)
        merged.push(localItem);
    } else {
        // Not in local.
        // If in Remote and NOT in Base -> Remote Added it. Keep it.
        // If in Remote and IN Base -> Local Deleted it. Drop it.
        if (inRemote && !inBase) {
            merged.push(remoteMap.get(id)!);
        }
    }
  });

  return merged;
};

export const pushToRemoteData = async (data: AppData): Promise<void> => {
  // Don't push if it matches what we just received to avoid loops
  const currentJSON = JSON.stringify(data);
  if (currentJSON === lastReceivedJSON) {
    return Promise.resolve();
  }

  const dataRef = ref(db, DB_REF_PATH);
  
  try {
      await runTransaction(dataRef, (currentData) => {
        if (currentData === null) {
            return data; // Initial create if DB empty
        }
        
        // 1. Normalize Remote Data
        const toArray = (obj: any): any[] => {
            if (!obj) return [];
            if (Array.isArray(obj)) return obj;
            return Object.values(obj);
        };
        
        const remote: AppData = {
            customers: toArray(currentData.customers),
            transactions: toArray(currentData.transactions),
            version: currentData.version || 1,
            storeLimits: currentData.storeLimits || { ...INITIAL_COUNTS }
        };

        // 2. Parse Base Data (Last known state)
        let base: AppData = { customers: [], transactions: [], version: 0, storeLimits: { ...INITIAL_COUNTS } };
        try {
            if (lastReceivedJSON) base = JSON.parse(lastReceivedJSON);
        } catch(e) {}

        // 3. Merge
        const mergedCustomers = mergeArrays(base.customers, remote.customers, data.customers);
        const mergedTransactions = mergeArrays(base.transactions, remote.transactions, data.transactions);
        
        // 4. Return Merged State
        return {
            customers: mergedCustomers,
            transactions: mergedTransactions,
            version: (remote.version || 0) + 1,
            storeLimits: data.storeLimits // For settings, we let local overwrite
        };
      });
  } catch (err: any) {
      console.warn("Sync failed or offline:", err.message);
  }
};

// Explicit function to wipe data from cloud
export const clearRemoteData = async (): Promise<void> => {
  const dataRef = ref(db, DB_REF_PATH);
  // Reset tracking so next sync is accepted
  lastReceivedJSON = ''; 
  // We explicitly set the structure to empty arrays instead of removing the node.
  await set(dataRef, {
    customers: {}, // Empty object acts as empty list in Firebase
    transactions: {}, 
    version: 1,
    storeLimits: { ...INITIAL_COUNTS }
  });
};

// --- Auth Management ---

export const loginUser = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async () => {
  return signOut(auth);
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// --- Import/Export ---

export const exportDataToJSON = (data: AppData) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `oxytrack_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportDataToCSV = (data: AppData) => {
  // CSV Headers
  const headers = [
    'Date',
    'Time',
    'Customer Name',
    'Type',
    'Note',
    'Oxy Large',
    'Oxy Small',
    'CO2 Large',
    'CO2 Small'
  ];

  // Map transactions to rows
  const rows = data.transactions.map(tx => {
    const dateObj = new Date(tx.timestamp);
    const date = dateObj.toLocaleDateString('en-GB');
    const time = dateObj.toLocaleTimeString();
    
    return [
      date,
      time,
      `"${tx.customerName}"`, // Quote name to handle commas
      tx.type,
      `"${tx.note || ''}"`,
      tx.items[BottleType.OXYZONE_LARGE],
      tx.items[BottleType.OXYZONE_SMALL],
      tx.items[BottleType.CO2_LARGE],
      tx.items[BottleType.CO2_SMALL]
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `oxytrack_report_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const importDataFromJSON = async (file: File): Promise<AppData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result);
        if (!parsed.customers || !parsed.transactions) {
          throw new Error("Invalid backup file format");
        }
        // Migration support
        if (!parsed.storeLimits) parsed.storeLimits = { ...INITIAL_COUNTS };
        resolve(parsed as AppData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};