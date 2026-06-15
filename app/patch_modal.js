const fs = require('fs');
let code = fs.readFileSync('src/components/TourAddCostModal.tsx', 'utf-8');

// Update imports
code = code.replace(
  "import { getApiErrorMessage } from '@/lib/api-errors';",
  "import { getApiErrorMessage } from '@/lib/api-errors';\nimport { getCategoryHex } from '@/lib/categoryUtils';"
);

// Add initialTransaction to Props
code = code.replace(
  "  onSaveSuccess: () => void;\n}",
  "  onSaveSuccess: () => void;\n  initialTransaction?: {\n    id: number;\n    amount: number;\n    description: string;\n    category: string;\n    date: string;\n    paidByParticipantId?: number;\n    paidBy?: number;\n    splitType: string;\n  } | null;\n}"
);

// Add customCategories state and fetcher
const fetcher = `
  const [customCategories, setCustomCategories] = useState<{ name: string; color: string }[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/categories?type=expense')
        .then(res => res.json())
        .then(data => {
           if (data.categories) setCustomCategories(data.categories);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const allCategories = useMemo(() => {
    const base = [
      { label: 'Travel', icon: 'flight_takeoff', color: 'blue' },
      { label: 'Food', icon: 'restaurant', color: 'orange' },
      { label: 'Hotel', icon: 'hotel', color: 'indigo' },
      { label: 'Transport', icon: 'directions_car', color: 'emerald' },
      { label: 'Tickets', icon: 'local_activity', color: 'rose' }
    ];
    const custom = customCategories.map(c => ({
      label: c.name,
      icon: 'label',
      color: c.color || 'gray'
    }));
    return [...base, ...custom];
  }, [customCategories]);

`;
code = code.replace(
  "export default function TourAddCostModal({",
  "export default function TourAddCostModal({"
);
code = code.replace(
  "const haptics = useHaptics();",
  "const haptics = useHaptics();\n" + fetcher
);

code = code.replace(
  "export default function TourAddCostModal({\n  isOpen,\n  onClose,\n  participants,\n  tourId,\n  onSaveSuccess,\n}: TourAddCostModalProps) {",
  "export default function TourAddCostModal({\n  isOpen,\n  onClose,\n  participants,\n  tourId,\n  onSaveSuccess,\n  initialTransaction,\n}: TourAddCostModalProps) {"
);

// Pre-fill state
code = code.replace(
  "const [amount, setAmount] = useState('');",
  "const [amount, setAmount] = useState('');"
);
code = code.replace(
  "useEffect(() => {\n    if (isOpen) {",
  "useEffect(() => {\n    if (isOpen) {\n      if (initialTransaction) {\n        setAmount(initialTransaction.amount.toString());\n        setDescription(initialTransaction.description);\n        setCategory(initialTransaction.category);\n        setDate(initialTransaction.date);\n        setPaidBy(initialTransaction.paidByParticipantId ?? initialTransaction.paidBy ?? participants[0]?.id ?? 0);\n        setSplitType(initialTransaction.splitType as SplitType);\n        setIncludeInMainLedger(false);\n      } else {\n        setAmount('');\n        setDescription('');\n        setCategory('Travel');\n        setDate(new Date().toISOString().split('T')[0]);\n        setPaidBy(participants[0]?.id ?? 0);\n        setSplitType('equal');\n        setIncludeInMainLedger(false);\n        setReceipt(null);\n        setReceiptPreview(null);\n      }\n"
);
// Remove duplicate effect resetting if there is any, actually the original is:
/*
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // It didn't reset state inside the effect previously, it was just overflow hidden.
*/

code = code.replace(
  "document.body.style.overflow = 'hidden';",
  "document.body.style.overflow = 'hidden';"
);

// Fix handleSubmit
const submitLogic = `
    try {
      const url = initialTransaction 
        ? \`/api/bill-splits/tours/\${tourId}/spendings/\${initialTransaction.id}\`
        : \`/api/bill-splits/tours/\${tourId}/spendings\`;
      const method = initialTransaction ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNumber,
          description: description.trim(),
          category: category.trim() || 'Travel',
          date,
          paidBy,
          paidByParticipantId: paidBy,
          splitType,
          includeInMainLedger,
        }),
      });
`;
code = code.replace(
  /try \{\s*const res = await fetch\(`\/api\/bill-splits\/tours\/\$\{tourId\}\/spendings`, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{[\s\S]*?\}\),\s*\}\);/,
  submitLogic.trim()
);

// Replace category input with custom selector
const categorySelector = `
                    <div className="relative">
                      <input
                        id="tour-cost-category"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        onFocus={() => setShowCategoryDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/10"
                        placeholder="Travel"
                        autoComplete="off"
                      />
                      {showCategoryDropdown && (
                        <div className="absolute z-10 mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#111827] shadow-xl custom-scrollbar">
                           {allCategories.map((c) => (
                              <button
                                key={c.label}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { setCategory(c.label); setShowCategoryDropdown(false); }}
                                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors"
                              >
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getCategoryHex(c.label, customCategories) }} />
                                <span className="text-sm font-semibold text-gray-200">{c.label}</span>
                              </button>
                           ))}
                        </div>
                      )}
                    </div>
`;
code = code.replace(
  /<input\s+id="tour-cost-category"[\s\S]*?\/>/,
  categorySelector.trim()
);

code = code.replace(
  "Add Cost</p>",
  "{initialTransaction ? 'Edit Cost' : 'Add Cost'}</p>"
);
code = code.replace(
  ">Add Cost<",
  ">{initialTransaction ? 'Save Changes' : 'Add Cost'}<"
);

// For receipt, disable if initialTransaction since attachments are in detail modal
const receiptLogic = `
                {!initialTransaction && (
                <div>
                  <label className="mb-2 ml-1 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Receipt Proof</label>
`;
code = code.replace(
  `<div>\n                  <label className="mb-2 ml-1 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Receipt Proof</label>`,
  receiptLogic
);
code = code.replace(
  `                    )}
                  </button>
                </div>

                <AnimatePresence>`,
  `                    )}
                  </button>
                </div>
                )}

                <AnimatePresence>`
);

// If editing, also disable 'Add to main transactions' checkbox because we can't easily sync an edit if it wasn't already synced, or maybe just hide it.
const includeInMainLedgerCode = `                {!initialTransaction && (
                <div>
                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-primary/35 hover:bg-white/[0.05] transition-colors">
`;
code = code.replace(
  `<div>\n                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-primary/35 hover:bg-white/[0.05] transition-colors">`,
  includeInMainLedgerCode
);
code = code.replace(
  `                  </label>
                </div>

                {!initialTransaction && (`,
  `                  </label>
                </div>
                )}

                {!initialTransaction && (`
);

fs.writeFileSync('src/components/TourAddCostModal.tsx', code);
console.log('Patched');
