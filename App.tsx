import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BottleType, 
  InventoryCounts, 
  TransactionType, 
  Customer, 
  Transaction, 
  AppData,
  ViewState
} from './types';
import { 
  INITIAL_COUNTS, 
  BOTTLE_CONFIG 
} from './constants';
import { 
  saveToStorage, 
  loadFromStorage, 
  exportDataToJSON, 
  exportDataToCSV,
  importDataFromJSON,
  subscribeToRemoteData,
  pushToRemoteData,
  clearRemoteData,
  loginUser,
  logoutUser,
  subscribeToAuth
} from './services/dataManager';
import { 
  HomeIcon, 
  UsersIcon, 
  SettingsIcon, 
  PlusIcon, 
  MinusIcon, 
  ArrowLeftIcon,
  UploadIcon,
  DownloadIcon, 
  BoxIcon,
  SearchIcon,
  PhoneIcon,
  PencilIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  UserPlusIcon,
  LogoutIcon,
  CloudCheckIcon,
  CloudSyncIcon,
  TrashIcon,
  TrendUpIcon
} from './components/Icons';

// UI Components
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Modal, ModalConfig } from './components/ui/Modal';
import { MobileWrapper } from './components/layout/MobileWrapper';

// --- Utils ---

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// --- Main Application ---

export default function App() {
  // Global Data State
  const [data, setData] = useState<AppData>({ customers: [], transactions: [], version: 1, storeLimits: { ...INITIAL_COUNTS } });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // View State
  const [view, setView] = useState<ViewState>('LOGIN');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedBottleType, setSelectedBottleType] = useState<BottleType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Transaction Form State
  const [txType, setTxType] = useState<TransactionType>(TransactionType.OUTGOING);
  const [txCounts, setTxCounts] = useState<InventoryCounts>(INITIAL_COUNTS);
  const [txNote, setTxNote] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // New Customer State
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Modal State
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
      isOpen: false,
      type: 'alert',
      title: '',
      message: ''
  });

  // Helper for Modals
  const showModal = (
      type: 'alert' | 'confirm' | 'danger', 
      title: string, 
      message: string, 
      onConfirm?: () => void
  ) => {
      setModalConfig({
          isOpen: true,
          type,
          title,
          message,
          onConfirm
      });
  };

  const closeModal = () => {
      setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Initialize & Offline handling
  useEffect(() => {
    // Load local data first
    const stored = loadFromStorage();
    setData(stored);
    
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    
    // Auth Listener
    const unsubscribeAuth = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        setView(v => v === 'LOGIN' ? 'DASHBOARD' : v);
      } else {
        setView('LOGIN');
      }
      setLoading(false);
    });

    // Initialize Firebase Database Subscription
    const unsubscribeData = subscribeToRemoteData((remoteData) => {
      setData(prev => {
        // Simple Deep Check
        if (JSON.stringify(prev) !== JSON.stringify(remoteData)) {
          return remoteData;
        }
        return prev;
      });
    });

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      unsubscribeAuth();
      unsubscribeData();
    };
  }, []);

  // Sync selectedCustomer with global data changes (e.g. from remote sync)
  useEffect(() => {
    if (selectedCustomer) {
      const updated = data.customers.find(c => c.id === selectedCustomer.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedCustomer)) {
        setSelectedCustomer(updated);
      }
    }
  }, [data.customers, selectedCustomer]);

  // Save on change (Local + Firebase)
  useEffect(() => {
    if (!loading && currentUser) {
      // 1. Save to local storage immediately
      saveToStorage(data);

      // 2. Trigger cloud sync with indicator
      // Only sync if data has actually changed or initially loaded
      if (data.customers.length > 0 || data.transactions.length > 0) {
        setIsSaving(true);
        const syncData = async () => {
            try {
            await pushToRemoteData(data);
            } catch (e) {
            console.error("Sync error", e);
            } finally {
            setIsSaving(false);
            }
        };
        syncData();
      }
    }
  }, [data, loading, currentUser]);

  // Auth Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    if (!navigator.onLine) {
        setAuthError("You are offline. You need an internet connection to log in. Once logged in, you can work offline.");
        return;
    }

    try {
      await loginUser(email, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
         setAuthError('Invalid email or password');
      } else if (err.code === 'auth/network-request-failed') {
         setAuthError('Network error. Check your connection.');
      } else {
         setAuthError('Login failed: ' + err.message);
      }
    }
  };

  const handleLogout = async () => {
    showModal('confirm', 'Log Out', 'You will need an internet connection to log back in. Are you sure?', async () => {
        try {
            await logoutUser();
            setEmail('');
            setPassword('');
            setView('LOGIN');
        } catch (e) {
            console.error("Logout failed", e);
        }
    });
  };

  // Import/Export/Clear Handlers
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const importedData = await importDataFromJSON(e.target.files[0]);
        showModal('confirm', 'Import Data', 'This will overwrite your current data. Do you want to continue?', () => {
            setData(importedData);
            showModal('alert', 'Success', 'Data imported successfully!');
        });
      } catch (err) {
        showModal('alert', 'Import Failed', 'Failed to import file. Please check the file format.');
      }
    }
  };

  const handleClearData = async () => {
    showModal('danger', 'Reset All Data', 'DANGER: This will permanently DELETE ALL customers and transactions. This cannot be undone. Are you sure?', () => {
        // Double confirm
        setTimeout(() => {
            showModal('danger', 'Final Confirmation', 'Are you absolutely sure? All data will be wiped from all devices immediately.', async () => {
                setIsSaving(true);
                try {
                  // 1. Force clear remote first
                  await clearRemoteData();
                  
                  // 2. Clear local state
                  const emptyState: AppData = { customers: [], transactions: [], version: 1, storeLimits: { ...INITIAL_COUNTS } };
                  setData(emptyState);
                  saveToStorage(emptyState);
                  
                  showModal('alert', 'Reset Complete', 'All data has been reset.', () => {
                    window.location.reload();
                  });
                } catch(e) {
                  showModal('alert', 'Error', 'Failed to clear cloud data. Please check connection.');
                  console.error(e);
                } finally {
                  setIsSaving(false);
                }
            });
        }, 200); // Small delay to allow modal transition
    });
  };

  // Helper to rebuild a customer's balance from their entire transaction history
  const recalculateCustomerStats = (customerId: string, allTransactions: Transaction[]): { balance: InventoryCounts, lastDate: number } => {
    const customerTransactions = allTransactions.filter(t => t.customerId === customerId);
    
    // Sort chronologically
    customerTransactions.sort((a,b) => a.timestamp - b.timestamp);

    const balance = { ...INITIAL_COUNTS };
    let lastDate = 0;

    customerTransactions.forEach(tx => {
        lastDate = Math.max(lastDate, tx.timestamp);
        Object.keys(tx.items).forEach(key => {
            const k = key as BottleType;
            if (tx.type === TransactionType.OUTGOING) {
                balance[k] += tx.items[k];
            } else {
                balance[k] -= tx.items[k];
            }
        });
    });

    return { balance, lastDate };
  };

  // Transaction Management
  const handleSaveTransaction = () => {
    if (!selectedCustomer) return;

    const totalBottles = (Object.values(txCounts) as number[]).reduce((a, b) => a + b, 0);
    if (totalBottles === 0) {
      showModal('alert', 'Empty Transaction', 'Please add at least one bottle.');
      return;
    }

    let updatedTransactions = [...data.transactions];
    
    if (editingTransaction) {
        // Update existing
        updatedTransactions = updatedTransactions.map(t => 
            t.id === editingTransaction.id 
            ? { ...t, type: txType, items: { ...txCounts }, note: txNote }
            : t
        );
    } else {
        // Create new
        const newTx: Transaction = {
            id: generateId(),
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            timestamp: Date.now(),
            type: txType,
            items: { ...txCounts },
            note: txNote
        };
        updatedTransactions.unshift(newTx);
    }

    // Recalculate customer state
    const { balance, lastDate } = recalculateCustomerStats(selectedCustomer.id, updatedTransactions);
    
    const updatedCustomer = {
      ...selectedCustomer,
      balance: balance,
      lastTransactionDate: lastDate || selectedCustomer.lastTransactionDate // fallback if no txs
    };

    setData(prev => {
        const customerIndex = prev.customers.findIndex(c => c.id === selectedCustomer.id);
        const newCustomers = [...prev.customers];
        if (customerIndex !== -1) {
            newCustomers[customerIndex] = updatedCustomer;
        }
        
        return {
            ...prev,
            customers: newCustomers,
            transactions: updatedTransactions,
            version: (prev.version || 1) + 1
        };
    });

    setSelectedCustomer(updatedCustomer);
    setTxCounts(INITIAL_COUNTS);
    setTxNote('');
    setEditingTransaction(null);
    setView('CUSTOMER_DETAIL');
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setTxCounts({ ...tx.items });
    setTxType(tx.type);
    setTxNote(tx.note || '');
    setView('EDIT_TRANSACTION');
  };

  const handleDeleteTransaction = (txId: string) => {
    if (!selectedCustomer) return;
    
    showModal('confirm', 'Delete Transaction', 'Are you sure you want to delete this transaction? This will automatically update the customer\'s balance.', () => {
        const updatedTransactions = data.transactions.filter(t => t.id !== txId);
        
        // Recalculate customer state
        const { balance, lastDate } = recalculateCustomerStats(selectedCustomer.id, updatedTransactions);

        const updatedCustomer = {
          ...selectedCustomer,
          balance: balance,
          lastTransactionDate: lastDate || Date.now() // If no transactions left, update activity timestamp to now
        };

        setData(prev => {
            const customerIndex = prev.customers.findIndex(c => c.id === selectedCustomer.id);
            const newCustomers = [...prev.customers];
            if (customerIndex !== -1) {
                newCustomers[customerIndex] = updatedCustomer;
            }
            return {
                ...prev,
                customers: newCustomers,
                transactions: updatedTransactions,
                version: (prev.version || 1) + 1
            };
        });
        
        setSelectedCustomer(updatedCustomer);
    });
  };

  const handleCreateCustomer = () => {
    if (!newCustomerName) {
      showModal('alert', 'Missing Information', 'Please enter a customer name.');
      return;
    }
    const newCustomer: Customer = {
      id: generateId(),
      name: newCustomerName,
      phone: newCustomerPhone,
      balance: { ...INITIAL_COUNTS },
      lastTransactionDate: Date.now()
    };
    setData(prev => ({ 
        ...prev, 
        customers: [...prev.customers, newCustomer],
        version: (prev.version || 1) + 1
    }));
    setSelectedCustomer(newCustomer);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setView('CUSTOMER_DETAIL');
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getDailyStats = () => {
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    const todayTxs = data.transactions.filter(t => t.timestamp >= startOfDay.getTime());
    
    let delivered = 0;
    let returned = 0;
    
    todayTxs.forEach(tx => {
      const total = (Object.values(tx.items) as number[]).reduce((a, b) => a + b, 0);
      if (tx.type === TransactionType.OUTGOING) delivered += total;
      else returned += total;
    });
    
    return { delivered, returned };
  };

  // --- Views ---

  if (loading) {
    return (
      <MobileWrapper className="items-center justify-center p-6">
         <div className="w-20 h-20 rounded-3xl bg-bonny-red flex items-center justify-center shadow-2xl shadow-rose-200 animate-pulse">
            <BoxIcon className="w-10 h-10 text-white" />
         </div>
      </MobileWrapper>
    );
  }

  if (view === 'LOGIN') {
    return (
      <MobileWrapper className="items-center justify-center p-6 text-slate-900">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-rose-100 opacity-60 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-100 opacity-60 blur-[80px] rounded-full pointer-events-none"></div>

        <div className="w-full relative z-10">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-bonny-red shadow-2xl shadow-rose-200 mb-6 transform rotate-3">
              <BoxIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
              Welcome Back
            </h1>
            <p className="text-slate-400 font-medium">Sign in to manage inventory</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="bg-white rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-slate-100">
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider ml-1">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-bonny-red focus:border-transparent transition-all placeholder-slate-400 font-semibold"
                    placeholder="name@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider ml-1">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-bonny-red focus:border-transparent transition-all placeholder-slate-400 font-semibold"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
            
            {authError && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 animate-pulse">
                <p className="text-red-500 text-sm text-center font-bold">{authError}</p>
              </div>
            )}
            
            <Button type="submit" className="w-full !py-4 text-lg !rounded-2xl !shadow-xl !shadow-rose-200 transform hover:-translate-y-1">
              Sign In
            </Button>
          </form>
          
          <p className="text-center text-slate-400 text-xs mt-8 font-medium">
            &copy; 2024 Oxytrack System
          </p>
        </div>
      </MobileWrapper>
    );
  }

  // Common Layout for logged in views
  return (
    <MobileWrapper>
      {/* Modal Overlay */}
      <Modal config={modalConfig} onClose={closeModal} />

      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        
        {/* Header - Conditional Rendering */}
        <div className="p-6 pb-2 sticky top-0 z-10 bg-slate-50/95 backdrop-blur-md">
          {view === 'DASHBOARD' && (
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-extrabold text-bonny-red tracking-tight">Oxytrack</h1>
              </div>
              <div className="flex gap-2 items-center">
                 {/* Sync Indicator */}
                 {isSaving ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 rounded-full text-yellow-700 text-xs font-bold shadow-sm">
                      <CloudSyncIcon className="w-4 h-4 animate-spin" />
                      Saving
                    </div>
                 ) : isOnline ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-full text-green-700 text-xs font-bold shadow-sm">
                      <CloudCheckIcon className="w-4 h-4" />
                      Synced
                    </div>
                 ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 rounded-full text-slate-500 text-xs font-bold shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      Offline
                    </div>
                 )}
                 
                 <button onClick={handleLogout} className="w-10 h-10 ml-2 rounded-full bg-white shadow-sm flex items-center justify-center text-bonny-red hover:bg-rose-50 transition-colors">
                   <LogoutIcon className="w-5 h-5" />
                 </button>
              </div>
            </div>
          )}

          {view === 'CUSTOMERS_LIST' && (
            <div className="space-y-4 pb-2">
                <div className="flex justify-between items-center">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Customers</h1>
                <button 
                    onClick={() => {
                    setNewCustomerName('');
                    setNewCustomerPhone('');
                    setView('NEW_CUSTOMER');
                    }}
                    className="w-12 h-12 rounded-full bg-bonny-red shadow-lg shadow-rose-200 text-white flex items-center justify-center active:scale-95 hover:bg-rose-600 transition-all"
                >
                    <UserPlusIcon className="w-6 h-6" />
                </button>
                </div>
                
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Find customer..." 
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-bonny-red text-slate-700 font-semibold placeholder:text-slate-400"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
            </div>
          )}

          {view === 'SETTINGS' && (
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
          )}

          {view === 'INVENTORY_DETAIL' && selectedBottleType && (
            <div className="flex justify-between items-center">
                <button 
                onClick={() => {
                    setView('DASHBOARD');
                    setSelectedBottleType(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                <ArrowLeftIcon className="w-6 h-6" />
                </button>
                <h2 className="text-lg font-bold">{BOTTLE_CONFIG[selectedBottleType].label}</h2>
                <div className="w-6"></div> {/* Spacer for centering */}
            </div>
          )}

          {(view === 'CUSTOMER_DETAIL' || view === 'NEW_TRANSACTION' || view === 'EDIT_TRANSACTION' || view === 'NEW_CUSTOMER') && (
            <div className="flex justify-between items-center">
              <button 
                onClick={() => {
                  if (view === 'NEW_TRANSACTION' || view === 'EDIT_TRANSACTION') {
                     setView('CUSTOMER_DETAIL');
                     setEditingTransaction(null);
                  }
                  else if (view === 'NEW_CUSTOMER') setView('CUSTOMERS_LIST');
                  else if (view === 'CUSTOMER_DETAIL' && selectedBottleType) setView('INVENTORY_DETAIL'); // Return to inventory list if applicable
                  else setView('CUSTOMERS_LIST');
                }}
                className="text-slate-400 hover:text-slate-600 p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
              
              {view === 'CUSTOMER_DETAIL' && (
                <Button 
                   variant="black" 
                   className="!py-2.5 !px-5 !rounded-full text-sm !font-bold"
                   onClick={() => {
                     setTxType(TransactionType.OUTGOING);
                     setTxCounts(INITIAL_COUNTS);
                     setTxNote('');
                     setEditingTransaction(null);
                     setView('NEW_TRANSACTION');
                   }}
                >
                  <PlusIcon className="w-4 h-4" /> New Transaction
                </Button>
              )}

              {(view === 'NEW_TRANSACTION' || view === 'EDIT_TRANSACTION') && (
                <h2 className="text-lg font-bold">{view === 'EDIT_TRANSACTION' ? 'Edit Transaction' : 'New Transaction'}</h2>
              )}

              {view === 'NEW_CUSTOMER' && (
                <h2 className="text-lg font-bold">Add Customer</h2>
              )}
            </div>
          )}
        </div>

        {/* Dashboard View */}
        {view === 'DASHBOARD' && (
          <div className="p-6 space-y-8">
            
            {/* Daily Pulse Widget */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                 <div className="w-5 h-5 rounded bg-indigo-100 text-indigo-500 flex items-center justify-center">
                   <TrendUpIcon className="w-3 h-3" />
                 </div>
                 <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase">Today's Pulse</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-50 flex flex-col items-center justify-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">DELIVERED</div>
                    <div className="text-4xl font-extrabold text-bonny-red">{getDailyStats().delivered}</div>
                    <div className="text-xs font-bold text-rose-300 mt-1">Bottles</div>
                 </div>
                 <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-50 flex flex-col items-center justify-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">RETURNED</div>
                    <div className="text-4xl font-extrabold text-green-600">{getDailyStats().returned}</div>
                    <div className="text-xs font-bold text-green-600 mt-1">Bottles</div>
                 </div>
              </div>
            </div>

            {/* Inventory Grid */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                 <div className="w-5 h-5 rounded bg-pink-100 text-pink-500 flex items-center justify-center">
                   <ArrowUpRightIcon className="w-3 h-3" />
                 </div>
                 <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase">Inventory Status</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {(Object.keys(BOTTLE_CONFIG) as BottleType[]).map(type => {
                  const distributed = data.customers.reduce((acc, c) => acc + (c.balance[type] || 0), 0);
                  const limit = data.storeLimits?.[type] || 0;
                  const warehouse = Math.max(0, limit - distributed);
                  const config = BOTTLE_CONFIG[type];
                  
                  return (
                    <Card 
                        key={type} 
                        onClick={() => {
                            setSelectedBottleType(type);
                            setView('INVENTORY_DETAIL');
                        }}
                        className="!p-5 flex flex-col justify-between h-44 cursor-pointer active:scale-95 transition-all hover:shadow-md relative overflow-hidden"
                    >
                       <div className="flex justify-between items-start mb-2">
                         <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center shadow-md`}>
                           <BoxIcon className={`w-5 h-5 ${config.iconColor}`} />
                         </div>
                         <div className="text-right">
                            <div className="text-2xl font-extrabold text-slate-900">{distributed}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">With Clients</div>
                         </div>
                       </div>
                       
                       <div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{config.label}</div>
                         {limit > 0 ? (
                           <div className="mt-2">
                             <div className="flex justify-between text-[10px] font-bold mb-1">
                               <span className="text-slate-400">Warehouse</span>
                               <span className="text-slate-800">{warehouse} left</span>
                             </div>
                             <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${warehouse < 10 ? 'bg-red-500' : 'bg-slate-800'}`} 
                                    style={{ width: `${Math.min(100, (warehouse / limit) * 100)}%` }}
                                ></div>
                             </div>
                           </div>
                         ) : (
                           <div className="text-[10px] text-slate-300 italic mt-2">No fleet limit set</div>
                         )}
                       </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Live Activity */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                 <div className="w-5 h-5 rounded bg-slate-200 text-slate-600 flex items-center justify-center">
                   <ArrowDownLeftIcon className="w-3 h-3" />
                 </div>
                 <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase">Live Activity</h2>
              </div>

              <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-50">
                {data.transactions.slice(0, 5).map((tx, idx) => {
                  // Calculate net change of biggest item to display summary
                  const entries = Object.entries(tx.items) as [BottleType, number][];
                  const maxEntry = entries.sort((a, b) => b[1] - a[1])[0];
                  const amount = maxEntry ? maxEntry[1] : 0;
                  const typeLabel = maxEntry ? BOTTLE_CONFIG[maxEntry[0]].short : '';
                  const isOut = tx.type === TransactionType.OUTGOING;

                  return (
                    <div key={tx.id} className={`flex items-center justify-between p-4 ${idx !== data.transactions.slice(0,5).length-1 ? 'border-b border-slate-50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-bonny-red flex items-center justify-center">
                          <ArrowUpRightIcon className={`w-5 h-5 transform ${isOut ? '' : 'rotate-180'}`} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{tx.customerName}</div>
                          <div className="text-xs font-semibold text-slate-400">{new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg ${isOut ? 'text-bonny-red' : 'text-green-500'}`}>
                          {isOut ? '+' : '-'}{amount}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{typeLabel}</div>
                      </div>
                    </div>
                  );
                })}
                {data.transactions.length === 0 && (
                  <div className="p-8 text-center text-slate-400 font-medium">No recent activity</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Inventory Detail View */}
        {view === 'INVENTORY_DETAIL' && selectedBottleType && (
            <div className="p-6 space-y-6">
                {/* Summary Card */}
                <div className={`rounded-[2rem] p-8 text-white relative overflow-hidden shadow-lg ${BOTTLE_CONFIG[selectedBottleType].color.replace('bg-', 'bg-').replace('text-', '')}`}>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="text-sm font-bold opacity-80 uppercase tracking-widest mb-2">Total Distributed</div>
                        <div className="text-6xl font-extrabold mb-2">
                            {data.customers.reduce((acc, c) => acc + (c.balance[selectedBottleType] || 0), 0)}
                        </div>
                        <div className="text-sm font-semibold opacity-80">{BOTTLE_CONFIG[selectedBottleType].sub} Bottles</div>
                    </div>
                    {/* Decor */}
                    <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-white opacity-10 blur-3xl rounded-full"></div>
                </div>

                {/* Breakdown List */}
                <div>
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="font-bold text-slate-900 text-lg">Customer Breakdown</h3>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                            {data.customers.filter(c => c.balance[selectedBottleType] > 0).length} Customers
                        </span>
                    </div>

                    <div className="space-y-3 pb-20">
                        {data.customers
                            .filter(c => c.balance[selectedBottleType] > 0)
                            .sort((a, b) => b.balance[selectedBottleType] - a.balance[selectedBottleType])
                            .map((customer, idx) => (
                                <div 
                                    key={customer.id}
                                    onClick={() => { setSelectedCustomer(customer); setView('CUSTOMER_DETAIL'); }}
                                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${idx < 3 ? 'bg-slate-900' : 'bg-slate-300'}`}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{customer.name}</div>
                                            {customer.phone && <div className="text-xs text-slate-400 font-semibold">{customer.phone}</div>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-slate-800">{customer.balance[selectedBottleType]}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Bottles</div>
                                    </div>
                                </div>
                            ))}
                        
                        {data.customers.filter(c => c.balance[selectedBottleType] > 0).length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <BoxIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium">No customers have this bottle type yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Customers View */}
        {view === 'CUSTOMERS_LIST' && (
          <div className="p-6 pt-2">
            
            <div className="space-y-4 pb-20">
              {data.customers
                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .sort((a, b) => b.lastTransactionDate - a.lastTransactionDate)
                .map(customer => {
                  const totalPending = (Object.values(customer.balance) as number[]).reduce((a, b) => a + b, 0);
                  
                  return (
                    <div 
                        key={customer.id} 
                        onClick={() => { setSelectedCustomer(customer); setView('CUSTOMER_DETAIL'); }} 
                        className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer hover:shadow-md"
                    >
                      {/* Header: Name and Status Badge */}
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">{customer.name}</h3>
                        <div className="bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            {totalPending} Pending
                        </div>
                      </div>
                      
                      {/* Inventory Stats Split Columns */}
                      <div className="flex gap-3">
                         {/* Oxygen Block */}
                         <div className="flex-1 bg-blue-50/50 rounded-2xl p-3 relative border border-blue-100/50">
                            {/* Vertical Accent Line */}
                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full"></div>
                            
                            <div className="pl-3 mb-3">
                              <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                OXYGEN
                              </span>
                            </div>
                            
                            <div className="flex items-center pl-2">
                                <div className="flex-1 text-center">
                                    <div className="text-xl font-bold text-slate-900 leading-none">{customer.balance[BottleType.OXYZONE_LARGE]}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wide">Standard</div>
                                </div>
                                <div className="w-px h-6 bg-blue-200/50 mx-1"></div>
                                <div className="flex-1 text-center">
                                    <div className="text-xl font-bold text-slate-900 leading-none">{customer.balance[BottleType.OXYZONE_SMALL]}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wide">Small</div>
                                </div>
                            </div>
                         </div>
                         
                         {/* CO2 Block */}
                         <div className="flex-1 bg-slate-50/80 rounded-2xl p-3 relative border border-slate-100">
                            {/* Vertical Accent Line */}
                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-slate-400 rounded-r-full"></div>

                            <div className="pl-3 mb-3">
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                CO2
                              </span>
                            </div>
                            
                            <div className="flex items-center pl-2">
                                <div className="flex-1 text-center">
                                    <div className="text-xl font-bold text-slate-900 leading-none">{customer.balance[BottleType.CO2_LARGE]}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wide">Standard</div>
                                </div>
                                <div className="w-px h-6 bg-slate-200/50 mx-1"></div>
                                <div className="flex-1 text-center">
                                    <div className="text-xl font-bold text-slate-900 leading-none">{customer.balance[BottleType.CO2_SMALL]}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wide">Small</div>
                                </div>
                            </div>
                         </div>
                      </div>
                    </div>
                  );
              })}
            </div>
          </div>
        )}

        {/* New/Edit Transaction View */}
        {(view === 'NEW_TRANSACTION' || view === 'EDIT_TRANSACTION') && selectedCustomer && (
          <div className="p-6 pt-2 pb-32">
            
            {/* Pink Customer Header Card */}
            <div className="bg-bonny-red rounded-3xl p-6 shadow-xl shadow-rose-200 text-white mb-8 relative overflow-hidden">
               <div className="flex items-center gap-4 relative z-10">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold backdrop-blur-sm border border-white/30">
                     {getInitials(selectedCustomer.name)}
                  </div>
                  <div>
                     <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">CUSTOMER</div>
                     <div className="text-xl font-extrabold">{selectedCustomer.name}</div>
                  </div>
               </div>
               {/* Decor circles */}
               <div className="absolute -right-4 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
            </div>

            {/* Toggle Type */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
              <button 
                className={`flex-1 py-4 rounded-xl text-sm font-extrabold uppercase tracking-wide transition-all ${txType === TransactionType.OUTGOING ? 'bg-white shadow-sm text-bonny-red' : 'text-slate-400'}`}
                onClick={() => setTxType(TransactionType.OUTGOING)}
              >
                OUT (DELIVER)
              </button>
              <button 
                className={`flex-1 py-4 rounded-xl text-sm font-extrabold uppercase tracking-wide transition-all ${txType === TransactionType.INCOMING ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
                onClick={() => setTxType(TransactionType.INCOMING)}
              >
                IN (COLLECT)
              </button>
            </div>

            {/* Counters */}
            <Card className="!p-0 overflow-hidden divide-y divide-slate-50">
              {(Object.keys(BOTTLE_CONFIG) as BottleType[]).map(type => (
                <div key={type} className="p-5 flex items-center justify-between">
                  <div>
                     <div className="font-bold text-slate-900 text-lg">{BOTTLE_CONFIG[type].short}</div>
                     <div className="text-xs font-semibold text-slate-400">{BOTTLE_CONFIG[type].sub} Cylinder</div>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl">
                    <button 
                      onClick={() => setTxCounts(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }))}
                      className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-600 active:scale-95 transition-transform"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center font-bold text-xl text-slate-800">{txCounts[type]}</span>
                    <button 
                      onClick={() => setTxCounts(prev => ({ ...prev, [type]: prev[type] + 1 }))}
                      className="w-10 h-10 rounded-lg bg-slate-900 shadow-sm flex items-center justify-center text-white active:scale-95 transition-transform"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </Card>

            <div className="mt-6">
              <input 
                type="text"
                placeholder="Add a note (optional)..."
                className="w-full p-4 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-200"
                value={txNote}
                onChange={e => setTxNote(e.target.value)}
              />
            </div>

            <div className="absolute bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-20">
               <Button onClick={handleSaveTransaction} className="w-full !py-4 !rounded-2xl !text-lg !shadow-xl !shadow-rose-200" variant={txType === TransactionType.OUTGOING ? 'primary' : 'black'}>
                 <BoxIcon className="w-5 h-5 mr-2" />
                 {view === 'EDIT_TRANSACTION' ? 'Update Transaction' : `Confirm ${txType === TransactionType.OUTGOING ? 'Delivery' : 'Collection'}`}
               </Button>
            </div>
          </div>
        )}

        {/* Settings/Sync View */}
        {view === 'SETTINGS' && (
          <div className="p-6 pt-2 space-y-6">
             <Card>
               <h3 className="font-bold text-lg mb-2">Fleet Management</h3>
               <p className="text-sm text-slate-400 mb-6 font-medium">Set the total number of bottles you own (warehouse stock) to track utilization.</p>
               
               <div className="space-y-4">
                 {(Object.keys(BOTTLE_CONFIG) as BottleType[]).map(type => (
                   <div key={type} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                      <div>
                        <div className="font-bold text-sm text-slate-900">{BOTTLE_CONFIG[type].short}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{BOTTLE_CONFIG[type].sub}</div>
                      </div>
                      <input 
                        type="number"
                        min="0"
                        className="w-20 bg-white border border-slate-200 rounded-lg p-2 text-center font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        value={data.storeLimits?.[type] || ''}
                        onChange={(e) => {
                           const val = parseInt(e.target.value) || 0;
                           setData(prev => ({
                              ...prev,
                              storeLimits: { ...prev.storeLimits, [type]: val }
                           }));
                        }}
                      />
                   </div>
                 ))}
               </div>
             </Card>

             <Card>
               <h3 className="font-bold text-lg mb-2">Reports & Backup</h3>
               <div className="space-y-4">
                 <Button variant="black" onClick={() => exportDataToCSV(data)} className="w-full">
                   <DownloadIcon className="w-5 h-5" /> Download Transactions (CSV)
                 </Button>

                 <div className="h-px bg-slate-100 w-full"></div>

                 <Button variant="outline" onClick={() => exportDataToJSON(data)} className="w-full">
                   <DownloadIcon className="w-5 h-5" /> Backup Data (JSON)
                 </Button>
                 
                 <div className="relative">
                   <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleImport}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   />
                   <Button variant="secondary" className="w-full">
                     <UploadIcon className="w-5 h-5" /> Restore Backup
                   </Button>
                 </div>
               </div>
             </Card>

             <Card className="!border-red-100">
               <h3 className="font-bold text-lg mb-2 text-red-600">Danger Zone</h3>
               <p className="text-sm text-slate-400 mb-6 font-medium">This action will delete all customers and transactions from the app and the cloud.</p>
               <Button variant="danger" onClick={handleClearData} className="w-full">
                 Clear / Reset Data
               </Button>
             </Card>

             <Card>
               <h3 className="font-bold text-lg mb-2">Account</h3>
               <p className="text-sm text-slate-400 mb-6 font-medium">Logged in as {currentUser?.email}</p>
               <Button variant="danger" onClick={handleLogout} className="w-full">
                 Log Out
               </Button>
             </Card>

             <div className="text-center text-xs font-bold text-slate-300 mt-10 uppercase tracking-widest">
               Oxytrack v2.1
             </div>
          </div>
        )}

      </div>

      {/* Bottom Navigation */}
      {(view === 'DASHBOARD' || view === 'CUSTOMERS_LIST' || view === 'SETTINGS') && (
        <div className="absolute bottom-0 w-full bg-white border-t border-slate-100 flex justify-around items-center h-24 pb-6 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl">
          <button 
            onClick={() => {
                setView('DASHBOARD');
                setSelectedBottleType(null);
            }}
            className={`flex flex-col items-center p-2 transition-colors ${view === 'DASHBOARD' ? 'text-bonny-red' : 'text-slate-300 hover:text-slate-400'}`}
          >
            <HomeIcon className={`w-7 h-7 mb-1`} />
          </button>
          
          <button 
            onClick={() => {
                setView('CUSTOMERS_LIST');
                setSelectedBottleType(null);
            }}
            className={`flex flex-col items-center justify-center -mt-8`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${view === 'CUSTOMERS_LIST' ? 'bg-bonny-red text-white shadow-rose-200' : 'bg-slate-900 text-white shadow-slate-200'}`}>
              <UsersIcon className="w-7 h-7" />
            </div>
          </button>
          
          <button 
            onClick={() => setView('SETTINGS')}
            className={`flex flex-col items-center p-2 transition-colors ${view === 'SETTINGS' ? 'text-bonny-red' : 'text-slate-300 hover:text-slate-400'}`}
          >
            <SettingsIcon className={`w-7 h-7 mb-1 ${view === 'SETTINGS' ? '' : ''}`} />
          </button>
        </div>
      )}
    </MobileWrapper>
  );
}