const fs = require('fs');
let code = fs.readFileSync('src/app/(app)/tours/[id]/spendings/page.tsx', 'utf-8');

const imports = `import TourAddCostModal from '@/components/TourAddCostModal';
import TourTransactionDetailModal from '@/components/TourTransactionDetailModal';`;

code = code.replace(
  "import TourAddCostModal from '@/components/TourAddCostModal';",
  imports
);

code = code.replace(
  "  const [isAddModalOpen, setIsAddModalOpen] = useState(false);",
  "  const [isAddModalOpen, setIsAddModalOpen] = useState(false);\n  const [selectedTransaction, setSelectedTransaction] = useState<TourTransaction | null>(null);\n  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);\n  const [customCategories, setCustomCategories] = useState<{name: string, color: string}[]>([]);\n\n  useEffect(() => {\n    fetch('/api/categories?type=expense').then(res => res.json()).then(data => {\n      if (data.categories) setCustomCategories(data.categories);\n    }).catch(console.error);\n  }, []);\n"
);

// We need to pass the custom categories into TourTransactionDetailModal

const handleDelete = `
  const handleDeleteTransaction = async (tx: TourTransaction) => {
    if (!confirm('Are you sure you want to delete this cost?')) return;
    try {
      const res = await fetch(\`/api/bill-splits/tours/\${tour.id}/spendings/\${tx.id}\`, { method: 'DELETE' });
      if (res.ok) void fetchTourData();
    } catch (e) {
      console.error(e);
    }
  };
`;
code = code.replace(
  "  const getParticipantName = useCallback((id: number) => {",
  handleDelete + "\n  const getParticipantName = useCallback((id: number) => {"
);

const clickableArticle = `                        <motion.article
                          layoutId={\`tour-transaction-\${transaction.id}\`}
                          key={transaction.id}
                          onClick={() => { setSelectedTransaction(transaction); setIsDetailModalOpen(true); }}
                          initial={{ opacity: 0, x: -14 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={{ y: -2 }}
                          transition={{ ...spring, delay: index * 0.025 }}
                          className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white/78 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0d1117]/72"
                        >`;
code = code.replace(
  /<motion\.article\s+layoutId={`tour-transaction-\$\{transaction\.id\}`}[\s\S]*?className="group relative overflow-hidden rounded-\[1\.5rem\] border border-gray-200 bg-white\/78 p-4 shadow-\[0_12px_40px_rgba\(15,23,42,0\.05\)\] backdrop-blur-2xl dark:border-white\/10 dark:bg-\[#0d1117\]\/72"/,
  clickableArticle
);

const modals = `      <TourAddCostModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setSelectedTransaction(null); }}
        participants={participants}
        tourId={tour.id}
        initialTransaction={selectedTransaction}
        onSaveSuccess={() => {
          setIsAddModalOpen(false);
          setSelectedTransaction(null);
          void fetchTourData();
        }}
      />

      <TourTransactionDetailModal
        transaction={selectedTransaction}
        customCategories={customCategories}
        tourId={tour.id}
        onClose={() => { setIsDetailModalOpen(false); setSelectedTransaction(null); }}
        onEdit={(tx) => { setIsDetailModalOpen(false); setSelectedTransaction(tx); setIsAddModalOpen(true); }}
        onDelete={(tx) => { setIsDetailModalOpen(false); void handleDeleteTransaction(tx); }}
      />
    </>
  );
}`;

code = code.replace(
  /<TourAddCostModal[\s\S]*?\/>\s*<\/>\s*\);\s*}/,
  modals
);

fs.writeFileSync('src/app/(app)/tours/[id]/spendings/page.tsx', code);
console.log('Patched spendings page');
