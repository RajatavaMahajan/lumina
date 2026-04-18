import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Columns, 
  X,
  Package,
  ArrowUpDown,
} from 'lucide-react';

// --- Types ---
interface Product {
  id: string;
  [key: string]: any;
}

interface StoreData {
  columns: string[];
  products: Product[];
}

const defaultStore: StoreData = {
  columns: ['Product Name', 'Rate'],
  products: [],
};

const requestData = async (): Promise<StoreData> => {
  const response = await fetch('/api/data');

  if (!response.ok) {
    throw new Error('Failed to load data from server.');
  }

  return response.json();
};

const saveData = async (payload: StoreData) => {
  const response = await fetch('/api/data', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to persist data.');
  }
};

const normalizeProductName = (value: unknown) => {
  return String(value || '')
    .toLowerCase()
    .replace(/\{\s*me\s*\}|\(\s*me\s*\)/gi, ' me ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

const parseRate = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl z-50 border border-slate-100"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  // --- State ---
  const [columns, setColumns] = useState<string[]>(['Product Name', 'Rate']);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [columnError, setColumnError] = useState('');
  const [bulkData, setBulkData] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkImportMode, setBulkImportMode] = useState<'add-only' | 'add-update'>('add-only');
  const lastSavedRef = useRef('');

  // --- Load Data on Mount ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await requestData();
        const nextData: StoreData = {
          columns: Array.isArray(data.columns) ? data.columns : defaultStore.columns,
          products: Array.isArray(data.products) ? data.products : defaultStore.products,
        };
        setColumns(nextData.columns);
        setProducts(nextData.products);
        lastSavedRef.current = JSON.stringify(nextData);
        setHasLoadedInitialData(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load data.';
        setSyncError(message);
        setHasLoadedInitialData(false);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  // --- Auto-sync to Server ---
  const syncPayload = useMemo(() => {
    return JSON.stringify({columns, products});
  }, [columns, products]);

  useEffect(() => {
    if (!hasLoadedInitialData || isLoading) {
      return;
    }

    if (syncPayload === lastSavedRef.current) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        await saveData({columns, products});
        lastSavedRef.current = syncPayload;
        setSyncError('');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to sync data.';
        setSyncError(message);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [columns, products, syncPayload, hasLoadedInitialData, isLoading]);

  // --- Handlers ---
  const handleAddProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newProduct: Product = { id: editingProduct?.id || crypto.randomUUID() };
    
    columns.forEach(col => {
      let val = formData.get(col);
      // Convert product name to uppercase and normalize {ME} to (ME)
      if (col === 'Product Name') {
        val = String(val || '')
          .toUpperCase()
          .replace(/\{\s*ME\s*\}/g, '(ME)');
      }
      newProduct[col] = col === 'Rate' ? Number(val) : val;
    });

    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? newProduct : p));
    } else {
      setProducts(prev => {
        const newKey = normalizeProductName(newProduct['Product Name']);
        if (!newKey) return prev;

        const duplicate = prev.find(p => normalizeProductName(p['Product Name']) === newKey);
        if (!duplicate) {
          return [...prev, newProduct];
        }

        if (parseRate(newProduct['Rate']) > parseRate(duplicate['Rate'])) {
          return prev.map(p => p.id === duplicate.id ? {...p, ...newProduct, id: duplicate.id} : p);
        }

        return prev;
      });
    }
    
    closeProductModal();
  };

  const handleDeleteProduct = () => {
    if (productToDelete) {
      setProducts(prev => prev.filter(p => p.id !== productToDelete));
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };

  const openDeleteModal = (id: string) => {
    setProductToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    setColumnError('');
    if (!newColumnName.trim()) return;
    if (columns.includes(newColumnName.trim())) {
      setColumnError('This column already exists.');
      return;
    }
    
    const cleanedName = newColumnName.trim();
    setColumns(prev => [...prev, cleanedName]);
    setProducts(prev => prev.map(p => ({ ...p, [cleanedName]: '' })));
    setNewColumnName('');
    setIsColumnModalOpen(false);
  };

  const handleBulkImport = (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError('');
    try {
      const parsed = JSON.parse(bulkData);
      if (!Array.isArray(parsed)) {
        throw new Error('Data must be an array of objects.');
      }

      const newProducts: Product[] = parsed.map(item => {
        const product = {
          id: item.id || crypto.randomUUID(),
          ...item
        };
        // Convert product name to uppercase
        if (product['Product Name']) {
          product['Product Name'] = String(product['Product Name'])
            .toUpperCase()
            .replace(/\{\s*ME\s*\}/g, '(ME)');
        }
        return product;
      });

      // Basic validation: ensure "Product Name" exists for each
      if (newProducts.some(p => !normalizeProductName(p['Product Name']))) {
        throw new Error('Each product must have a "Product Name".');
      }

      setProducts(prev => {
        const existingByKey = new Map<string, Product>();
        prev.forEach((product) => {
          const key = normalizeProductName(product['Product Name']);
          if (!key || existingByKey.has(key)) return;
          existingByKey.set(key, product);
        });

        if (bulkImportMode === 'add-only') {
          // Add new products only. Existing products remain unchanged.
          const additions = new Map<string, Product>();

          newProducts.forEach((product) => {
            const key = normalizeProductName(product['Product Name']);
            if (!key || existingByKey.has(key)) return;

            const normalizedProduct: Product = {
              ...product,
              Rate: parseRate(product['Rate']),
            };

            const current = additions.get(key);
            if (!current || parseRate(normalizedProduct['Rate']) > parseRate(current['Rate'])) {
              additions.set(key, normalizedProduct);
            }
          });

          return [...prev, ...Array.from(additions.values())];
        }

        // Add + Update mode: update existing product price regardless of greater/less, and add new products.
        const incomingByKey = new Map<string, Product>();
        newProducts.forEach((product) => {
          const key = normalizeProductName(product['Product Name']);
          if (!key) return;
          incomingByKey.set(key, {
            ...product,
            Rate: parseRate(product['Rate']),
          });
        });

        const updatedExisting = prev.map((product) => {
          const key = normalizeProductName(product['Product Name']);
          if (!key) return product;

          const incoming = incomingByKey.get(key);
          if (!incoming) return product;

          return {
            ...product,
            ...incoming,
            id: product.id,
          };
        });

        const additions: Product[] = [];
        incomingByKey.forEach((incoming, key) => {
          if (!existingByKey.has(key)) {
            additions.push(incoming);
          }
        });

        return [...updatedExisting, ...additions];
      });

      setBulkData('');
      setIsBulkModalOpen(false);
    } catch (err: any) {
      setBulkError(err.message || 'Invalid JSON format.');
    }
  };

  const getBulkTemplate = () => {
    const template = [
      {
        "Product Name": "Sample Product",
        "Rate": 99.99,
        ...columns.reduce((acc, col) => {
          if (col !== 'Product Name' && col !== 'Rate') acc[col] = "Value";
          return acc;
        }, {} as any)
      }
    ];
    return JSON.stringify(template, null, 2);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  // --- Computed ---
  const filteredAndSortedProducts = useMemo(() => {
    return products
      .filter(p => {
        const searchStr = searchQuery.toLowerCase();
        return columns.some(col => String(p[col] || '').toLowerCase().includes(searchStr));
      })
      .sort((a, b) => {
        const nameA = String(a['Product Name'] || '').toLowerCase();
        const nameB = String(b['Product Name'] || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [products, columns, searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] p-4 md:p-8 font-sans flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 card-shadow text-slate-600 font-medium">
          Loading products...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                <Package className="text-white" size={24} />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lumina</h1>
            </div>
            <p className="text-slate-500 font-medium flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2">
              <span>Manage your inventory with precision.</span>
              <span className="w-fit px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">
                {products.length} Products
              </span>
            </p>
            {syncError && (
              <p className="mt-2 text-sm text-rose-600 font-medium">{syncError}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setIsColumnModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all card-shadow"
            >
              <Columns size={18} />
              <span className="hidden sm:inline">Add Column</span>
              <span className="sm:hidden">Column</span>
            </button>
            <button 
              onClick={() => {
                setBulkData(getBulkTemplate());
                setIsBulkModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all card-shadow"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Bulk Import</span>
              <span className="sm:hidden">Bulk</span>
            </button>
            <button 
              onClick={() => setIsProductModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus size={18} />
              <span>Add Product</span>
            </button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="relative mb-8 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={20} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input 
            type="text"
            placeholder="Search across all columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all card-shadow text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-bottom border-slate-100">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className={`px-4 py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                        col === 'Product Name'
                          ? 'w-[62%] md:w-auto'
                          : col === 'Rate'
                            ? 'w-[24%] md:w-auto'
                            : 'w-auto'
                      }`}
                    >
                      <div className={`flex items-center gap-2 ${col === 'Rate' ? 'justify-end' : 'justify-start'}`}>
                        {col}
                        {col === 'Product Name' && <ArrowUpDown size={12} className="text-slate-400" />}
                      </div>
                    </th>
                  ))}
                  <th className="hidden md:table-cell w-[12%] md:w-auto px-3 py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredAndSortedProducts.map((product) => (
                    <React.Fragment key={product.id}>
                      <motion.tr 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {columns.map((col) => (
                          <td key={col} className={`px-4 py-3 md:px-6 md:py-4 ${col === 'Rate' ? 'text-right whitespace-nowrap' : 'text-left'}`}>
                            {col === 'Rate' ? (
                              <span className="font-mono text-slate-600 font-medium">
                                ₹{Number(product[col] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-700 font-medium wrap-break-word">{product[col] || '-'}</span>
                            )}
                          </td>
                        ))}
                        <td className="hidden md:table-cell px-2 py-2 md:px-6 md:py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openEditModal(product)}
                              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              aria-label="Edit product"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => openDeleteModal(product.id)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              aria-label="Delete product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>

                      <tr className="md:hidden border-t border-slate-100">
                        <td colSpan={columns.length} className="px-4 pb-3 pt-1">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openEditModal(product)}
                              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              aria-label="Edit product"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => openDeleteModal(product.id)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              aria-label="Delete product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </AnimatePresence>
                {filteredAndSortedProducts.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-16 md:px-6 md:py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-slate-50 rounded-full">
                          <Search size={32} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-medium">No products found matching your search.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      <Modal 
        isOpen={isProductModalOpen} 
        onClose={closeProductModal} 
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
      >
        <form onSubmit={handleAddProduct} className="space-y-4">
          {columns.map(col => (
            <div key={col}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{col}</label>
              <input 
                name={col}
                type={col === 'Rate' ? 'number' : 'text'}
                step={col === 'Rate' ? '0.01' : undefined}
                defaultValue={editingProduct ? editingProduct[col] : ''}
                required={col === 'Product Name' || col === 'Rate'}
                autoFocus={col === 'Product Name'}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-700"
                placeholder={`Enter ${col.toLowerCase()}...`}
              />
            </div>
          ))}
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={closeProductModal}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              {editingProduct ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Column Modal */}
      <Modal 
        isOpen={isColumnModalOpen} 
        onClose={() => {
          setIsColumnModalOpen(false);
          setColumnError('');
        }} 
        title="Add New Column"
      >
        <form onSubmit={handleAddColumn} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Column Name</label>
            <input 
              type="text"
              value={newColumnName}
              onChange={(e) => {
                setNewColumnName(e.target.value);
                setColumnError('');
              }}
              required
              autoFocus
              className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:outline-none focus:ring-4 transition-all text-slate-700 ${
                columnError ? 'border-rose-300 focus:ring-rose-500/10 focus:border-rose-500' : 'border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-500'
              }`}
              placeholder="e.g. Category, SKU, Stock..."
            />
            {columnError && (
              <p className="mt-2 text-sm text-rose-600 font-medium flex items-center gap-1">
                <X size={14} /> {columnError}
              </p>
            )}
          </div>
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={() => {
                setIsColumnModalOpen(false);
                setColumnError('');
              }}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              Add Column
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal 
        isOpen={isBulkModalOpen} 
        onClose={() => {
          setIsBulkModalOpen(false);
          setBulkError('');
        }} 
        title="Bulk Import Products"
      >
        <form onSubmit={handleBulkImport} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Import Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="bulkImportMode"
                  value="add-only"
                  checked={bulkImportMode === 'add-only'}
                  onChange={() => setBulkImportMode('add-only')}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-700">Add Only</span>
                  <span className="block text-xs text-slate-500">Existing products are untouched. New products are added.</span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="bulkImportMode"
                  value="add-update"
                  checked={bulkImportMode === 'add-update'}
                  onChange={() => setBulkImportMode('add-update')}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-700">Add + Update</span>
                  <span className="block text-xs text-slate-500">Updates existing products with imported price (higher or lower) and adds new products.</span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              JSON Data (Array of objects)
            </label>
            <textarea 
              value={bulkData}
              onChange={(e) => {
                setBulkData(e.target.value);
                setBulkError('');
              }}
              required
              rows={10}
              className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-4 transition-all text-slate-700 font-mono text-sm ${
                bulkError ? 'border-rose-300 focus:ring-rose-500/10 focus:border-rose-500' : 'border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-500'
              }`}
              placeholder='[{"Product Name": "Item 1", "Rate": 10}, ...]'
            />
            {bulkError && (
              <p className="mt-2 text-sm text-rose-600 font-medium flex items-center gap-1">
                <X size={14} /> {bulkError}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Paste a JSON array of objects. Each object should match the current column names.
            </p>
          </div>
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={() => {
                setIsBulkModalOpen(false);
                setBulkError('');
              }}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              Import Data
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Delete Product"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to delete this product? This action cannot be undone.
          </p>
          <div className="pt-4 flex gap-3">
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleDeleteProduct}
              className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
