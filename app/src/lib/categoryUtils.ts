/**
 * Smart Category Utilities
 * Auto-assigns icons and colors to custom categories based on keyword matching.
 */

// ─── Keyword → Icon Map ────────────────────────────────────────────────
// Each entry: [keywords[], materialIcon]
// Order matters — first match wins.
const ICON_RULES: [string[], string][] = [
  // Food & Drink
  [['coffee', 'cafe', 'starbucks', 'latte', 'espresso', 'tea'], 'local_cafe'],
  [['restaurant', 'dining', 'dinner', 'lunch', 'brunch'], 'restaurant'],
  [['food', 'meal', 'eat', 'snack', 'breakfast', 'grocery', 'groceries'], 'restaurant'],
  [['pizza', 'burger', 'fast food', 'takeout', 'takeaway'], 'fastfood'],
  [['bar', 'pub', 'drinks', 'alcohol', 'beer', 'wine', 'cocktail'], 'local_bar'],
  [['bakery', 'cake', 'pastry', 'dessert', 'sweets', 'chocolate', 'ice cream'], 'cake'],

  // Transport
  [['uber', 'lyft', 'taxi', 'cab', 'ride'], 'local_taxi'],
  [['car', 'auto', 'vehicle', 'gas', 'fuel', 'petrol', 'diesel', 'parking'], 'directions_car'],
  [['bus', 'metro', 'subway', 'train', 'transit', 'commute'], 'directions_bus'],
  [['flight', 'airplane', 'airline', 'airport', 'travel', 'trip', 'vacation', 'holiday'], 'flight_takeoff'],
  [['bike', 'bicycle', 'cycling'], 'pedal_bike'],
  [['boat', 'ship', 'cruise', 'ferry'], 'sailing'],

  // Home & Housing
  [['rent', 'mortgage', 'house', 'apartment', 'flat', 'home', 'housing'], 'home'],
  [['furniture', 'decor', 'ikea', 'interior'], 'chair'],
  [['maintenance', 'repair', 'plumbing', 'electrician', 'handyman'], 'build'],
  [['cleaning', 'maid', 'laundry', 'dry clean'], 'cleaning_services'],
  [['garden', 'plant', 'flower', 'lawn', 'landscaping'], 'yard'],

  // Bills & Utilities
  [['electric', 'electricity', 'power', 'energy'], 'bolt'],
  [['water', 'sewage', 'plumbing'], 'water_drop'],
  [['internet', 'wifi', 'broadband', 'fiber'], 'wifi'],
  [['phone', 'mobile', 'cellular', 'telecom', 'sim'], 'smartphone'],
  [['bill', 'utility', 'utilities'], 'receipt'],
  [['insurance', 'policy', 'premium', 'coverage'], 'shield'],
  [['tax', 'taxes', 'irs', 'vat', 'gst'], 'account_balance'],

  // Shopping & Fashion
  [['clothes', 'clothing', 'fashion', 'apparel', 'outfit', 'dress', 'shirt', 'shoes'], 'checkroom'],
  [['shop', 'shopping', 'mall', 'store', 'retail', 'purchase'], 'shopping_bag'],
  [['jewelry', 'jewellery', 'watch', 'accessory', 'accessories', 'luxury'], 'diamond'],
  [['gift', 'present', 'birthday', 'anniversary'], 'redeem'],
  [['cosmetic', 'makeup', 'beauty', 'skincare', 'salon', 'spa', 'haircut', 'barber'], 'spa'],

  // Health & Fitness
  [['gym', 'workout', 'exercise', 'fitness', 'crossfit', 'yoga', 'pilates'], 'fitness_center'],
  [['doctor', 'medical', 'hospital', 'clinic', 'health', 'healthcare'], 'health_and_safety'],
  [['medicine', 'pharmacy', 'drug', 'prescription', 'medication'], 'medication'],
  [['dental', 'dentist', 'teeth', 'orthodontist'], 'dentistry'],
  [['therapy', 'therapist', 'counseling', 'mental health', 'psychologist'], 'psychology'],
  [['vitamin', 'supplement', 'nutrition', 'protein'], 'nutrition'],

  // Education & Learning
  [['school', 'college', 'university', 'tuition', 'education'], 'school'],
  [['book', 'books', 'reading', 'library', 'textbook'], 'auto_stories'],
  [['course', 'class', 'lesson', 'tutorial', 'training', 'workshop', 'seminar'], 'cast_for_education'],
  [['exam', 'test', 'certification'], 'quiz'],

  // Entertainment & Leisure
  [['movie', 'cinema', 'film', 'theater', 'theatre', 'netflix', 'streaming'], 'theater_comedy'],
  [['music', 'concert', 'spotify', 'guitar', 'piano', 'instrument'], 'music_note'],
  [['game', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'esport'], 'sports_esports'],
  [['sport', 'sports', 'football', 'soccer', 'basketball', 'tennis', 'cricket', 'swim'], 'sports_soccer'],
  [['art', 'paint', 'drawing', 'gallery', 'museum', 'craft'], 'palette'],
  [['photo', 'photography', 'camera', 'video', 'recording'], 'camera_alt'],
  [['party', 'celebration', 'event', 'festival', 'wedding'], 'celebration'],

  // Tech & Digital
  [['software', 'app', 'subscription', 'saas', 'digital'], 'apps'],
  [['computer', 'laptop', 'pc', 'mac', 'desktop'], 'computer'],
  [['tech', 'gadget', 'electronics', 'device', 'hardware'], 'devices'],
  [['cloud', 'storage', 'hosting', 'server', 'aws', 'domain'], 'cloud'],
  [['ai', 'chatgpt', 'openai', 'copilot'], 'smart_toy'],

  // Finance & Investment
  [['crypto', 'bitcoin', 'ethereum', 'nft', 'blockchain', 'defi'], 'currency_bitcoin'],
  [['stock', 'stocks', 'trading', 'shares', 'equity', 'market', 'portfolio'], 'trending_up'],
  [['invest', 'investment', 'mutual fund', 'bond', 'etf', 'index fund'], 'trending_up'],
  [['bank', 'banking', 'atm', 'wire', 'transfer'], 'account_balance'],
  [['loan', 'debt', 'emi', 'installment', 'credit'], 'credit_card'],
  [['saving', 'savings', 'deposit', 'fixed deposit', 'fd'], 'savings'],
  [['salary', 'paycheck', 'wage', 'income', 'pay'], 'payments'],
  [['freelance', 'freelancing', 'gig', 'contract', 'consulting'], 'work'],
  [['business', 'company', 'startup', 'enterprise', 'corporate'], 'business_center'],
  [['dividend', 'interest', 'return', 'passive income', 'royalty'], 'monetization_on'],
  [['commission', 'bonus', 'tip', 'tips', 'incentive', 'reward'], 'military_tech'],
  [['refund', 'cashback', 'reimbursement'], 'currency_exchange'],

  // Pets
  [['pet', 'pets', 'dog', 'cat', 'puppy', 'kitten', 'vet', 'veterinary', 'animal'], 'pets'],

  // Kids & Family
  [['baby', 'child', 'children', 'kids', 'toy', 'toys', 'daycare', 'nursery', 'nanny'], 'child_care'],
  [['family', 'parent', 'parenting'], 'family_restroom'],

  // Charity & Donations
  [['charity', 'donation', 'donate', 'zakat', 'tithe', 'ngo', 'nonprofit'], 'volunteer_activism'],
  [['mosque', 'church', 'temple', 'religious', 'prayer'], 'mosque'],

  // Miscellaneous
  [['office', 'stationery', 'supplies', 'workspace', 'coworking'], 'work'],
  [['delivery', 'courier', 'shipping', 'post', 'postage', 'mail'], 'local_shipping'],
  [['subscription', 'membership', 'plan'], 'card_membership'],
  [['pocket money', 'allowance', 'miscellaneous', 'misc'], 'wallet'],
  [['emergency', 'urgent'], 'emergency'],
  [['moving', 'relocation', 'packing'], 'local_shipping'],
  [['legal', 'lawyer', 'attorney', 'court'], 'gavel'],
  [['tobacco', 'cigarette', 'smoking', 'vape'], 'smoking_rooms'],
];

// ─── Keyword → Color Map ───────────────────────────────────────────────
const COLOR_RULES: [string[], string][] = [
  // Warm tones
  [['food', 'restaurant', 'lunch', 'dinner', 'grocery', 'meal', 'eat', 'snack', 'pizza', 'burger', 'bakery'], 'orange'],
  [['coffee', 'cafe', 'tea', 'bar', 'pub', 'drinks'], 'amber'],
  [['gift', 'party', 'celebration', 'birthday', 'wedding'], 'rose'],
  [['beauty', 'cosmetic', 'salon', 'spa', 'fashion', 'jewelry'], 'fuchsia'],

  // Cool tones
  [['tech', 'software', 'computer', 'gadget', 'digital', 'ai', 'cloud'], 'sky'],
  [['education', 'school', 'book', 'course', 'class', 'learn'], 'cyan'],
  [['health', 'medical', 'doctor', 'gym', 'fitness', 'yoga'], 'emerald'],
  [['transport', 'car', 'bus', 'uber', 'taxi', 'flight', 'travel', 'trip'], 'indigo'],

  // Finance tones
  [['salary', 'income', 'pay', 'freelance', 'business'], 'teal'],
  [['invest', 'stock', 'crypto', 'saving', 'dividend', 'bank'], 'emerald'],
  [['bill', 'utility', 'rent', 'mortgage', 'insurance', 'tax'], 'blue'],
  [['loan', 'debt', 'credit'], 'rose'],

  // Other
  [['pet', 'dog', 'cat', 'animal'], 'amber'],
  [['baby', 'child', 'kids', 'family'], 'pink'],
  [['charity', 'donation', 'mosque', 'church'], 'teal'],
  [['game', 'gaming', 'esport', 'entertainment', 'movie', 'music'], 'indigo'],
  [['shopping', 'shop', 'store', 'mall'], 'fuchsia'],
];

/**
 * Resolve the best Material Symbols icon for a category name.
 * Falls back to 'category' if no keyword matches.
 */
export function resolveIcon(categoryName: string): string {
  const lower = categoryName.toLowerCase().trim();

  for (const [keywords, icon] of ICON_RULES) {
    for (const kw of keywords) {
      if (lower === kw || lower.includes(kw)) {
        return icon;
      }
    }
  }

  return 'category';
}

/**
 * Resolve the best color for a category name.
 * Falls back to 'gray' if no keyword matches.
 */
export function resolveColor(categoryName: string): string {
  const lower = categoryName.toLowerCase().trim();

  for (const [keywords, color] of COLOR_RULES) {
    for (const kw of keywords) {
      if (lower === kw || lower.includes(kw)) {
        return color;
      }
    }
  }

  // Deterministic fallback: generate from name hash
  const FALLBACK_COLORS = ['rose', 'orange', 'amber', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'fuchsia', 'pink'];
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = lower.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

// ─── Standard Categories ───────────────────────────────────────────────

export const CATEGORIES_EXPENSE = [
  { label: 'Food', icon: 'restaurant' },
  { label: 'Transport', icon: 'directions_car' },
  { label: 'Entertainment', icon: 'theater_comedy' },
  { label: 'Shopping', icon: 'checkroom' },
  { label: 'Bills', icon: 'receipt' },
  { label: 'Health', icon: 'health_and_safety' },
  { label: 'Education', icon: 'school' },
  { label: 'Housing', icon: 'home' },
  { label: 'Other', icon: 'category' },
];

export const CATEGORIES_INCOME = [
  { label: 'Salary', icon: 'payments' },
  { label: 'Freelance', icon: 'work' },
  { label: 'Investment', icon: 'trending_up' },
  { label: 'Business', icon: 'business_center' },
  { label: 'Savings', icon: 'savings' },
  { label: 'Other', icon: 'category' },
];

export const STANDARD_CATEGORY_ICONS: Record<string, string> = {
  Food: 'restaurant', Transport: 'directions_car', Housing: 'home', Utilities: 'bolt',
  Entertainment: 'theater_comedy', Shopping: 'checkroom', Health: 'health_and_safety',
  Education: 'school', Business: 'business_center', Savings: 'savings', Salary: 'payments',
  Freelance: 'work', Investment: 'trending_up', Bills: 'receipt', Other: 'category',
};

export const STANDARD_CATEGORY_COLORS: Record<string, string> = {
  Food: 'orange', Transport: 'indigo', Housing: 'blue', Utilities: 'amber',
  Entertainment: 'pink', Shopping: 'fuchsia', Health: 'emerald', Education: 'cyan',
  Business: 'sky', Savings: 'emerald', Salary: 'teal', Freelance: 'teal',
  Investment: 'emerald', Bills: 'rose', Other: 'gray',
};

export const CATEGORY_HEX_COLORS: Record<string, string> = {
  Food: '#f97316', Transport: '#8b5cf6', Housing: '#3b82f6', Utilities: '#eab308',
  Entertainment: '#ec4899', Shopping: '#6366f1', Health: '#10b981', Education: '#06b6d4',
  Business: '#0ea5e9', Savings: '#22c55e', Salary: '#14b8a6', Other: '#6b7280',
};

// Color name → hex for chart rendering
export const COLOR_NAME_TO_HEX: Record<string, string> = {
  rose: '#f43f5e', orange: '#f97316', amber: '#f59e0b', emerald: '#10b981',
  teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9', blue: '#3b82f6',
  indigo: '#6366f1', violet: '#8b5cf6', fuchsia: '#d946ef', pink: '#ec4899',
  gray: '#6b7280',
};

export const CUSTOM_CATEGORY_ICONS = [
  'restaurant', 'local_cafe', 'fastfood', 'cake', 'local_bar', 'shopping_bag',
  'checkroom', 'redeem', 'diamond', 'spa', 'directions_car', 'local_taxi',
  'directions_bus', 'flight_takeoff', 'pedal_bike', 'home', 'chair', 'bolt',
  'water_drop', 'wifi', 'smartphone', 'receipt', 'shield', 'fitness_center',
  'health_and_safety', 'medication', 'school', 'auto_stories', 'music_note',
  'theater_comedy', 'sports_esports', 'palette', 'camera_alt', 'celebration',
  'devices', 'computer', 'cloud', 'smart_toy', 'currency_bitcoin', 'trending_up',
  'account_balance', 'credit_card', 'savings', 'payments', 'work',
  'business_center', 'monetization_on', 'currency_exchange', 'volunteer_activism',
  'wallet', 'emergency', 'gavel', 'category',
];

export function normalizeCategoryName(categoryName: string): string {
  return categoryName.trim().replace(/\s+/g, ' ').toLowerCase();
}

function toTitleCase(categoryName: string): string {
  return categoryName
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
    .join(' ');
}

export function isStandardCategory(categoryName: string): boolean {
  const normalized = toTitleCase(categoryName);
  return Boolean(STANDARD_CATEGORY_ICONS[normalized] || STANDARD_CATEGORY_ICONS[categoryName]);
}

export function getIconCandidates(categoryName: string, limit = 40): string[] {
  const smartIcon = resolveIcon(categoryName);
  const unique = [smartIcon, ...CUSTOM_CATEGORY_ICONS].filter((icon, index, icons) => icons.indexOf(icon) === index);
  return unique.slice(0, limit);
}

/** Get hex color for any category (standard or custom) */
export function getCategoryHex(categoryName: string, customCategories?: { name: string; color: string }[]): string {
  const normalized = toTitleCase(categoryName);
  if (CATEGORY_HEX_COLORS[normalized]) return CATEGORY_HEX_COLORS[normalized];
  if (CATEGORY_HEX_COLORS[categoryName]) return CATEGORY_HEX_COLORS[categoryName];
  const categoryKey = normalizeCategoryName(categoryName);
  const custom = customCategories?.find(c => normalizeCategoryName(c.name) === categoryKey);
  if (custom) return COLOR_NAME_TO_HEX[custom.color] || '#6b7280';
  return COLOR_NAME_TO_HEX[resolveColor(categoryName)] || '#6b7280';
}

/** Get icon for any category (standard or custom) */
export function getCategoryIcon(categoryName: string, customCategories?: { name: string; icon: string }[]): string {
  const normalized = toTitleCase(categoryName);
  if (STANDARD_CATEGORY_ICONS[normalized]) return STANDARD_CATEGORY_ICONS[normalized];
  if (STANDARD_CATEGORY_ICONS[categoryName]) return STANDARD_CATEGORY_ICONS[categoryName];
  const categoryKey = normalizeCategoryName(categoryName);
  const custom = customCategories?.find(c => normalizeCategoryName(c.name) === categoryKey);
  if (custom) return custom.icon;
  return resolveIcon(categoryName);
}

// ─── Custom Category Style Helpers ─────────────────────────────────────

export const CUSTOM_COLORS = ['rose', 'orange', 'amber', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'fuchsia', 'pink'];

export const CUSTOM_COLOR_STYLES: Record<string, { bg: string; text: string; selected: string }> = {
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', selected: 'bg-rose-500 text-white shadow-sm' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-500', selected: 'bg-orange-500 text-white shadow-sm' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-500', selected: 'bg-amber-500 text-white shadow-sm' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-500', selected: 'bg-emerald-500 text-white shadow-sm' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-500', selected: 'bg-teal-500 text-white shadow-sm' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-500', selected: 'bg-cyan-500 text-white shadow-sm' },
  sky: { bg: 'bg-sky-500', text: 'text-sky-500', selected: 'bg-sky-500 text-white shadow-sm' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-500', selected: 'bg-blue-500 text-white shadow-sm' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-500', selected: 'bg-indigo-500 text-white shadow-sm' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-500', selected: 'bg-violet-500 text-white shadow-sm' },
  fuchsia: { bg: 'bg-fuchsia-500', text: 'text-fuchsia-500', selected: 'bg-fuchsia-500 text-white shadow-sm' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-500', selected: 'bg-pink-500 text-white shadow-sm' },
  gray: { bg: 'bg-gray-500', text: 'text-gray-500', selected: 'bg-gray-500 text-white shadow-sm' },
};

export const getColorStyle = (color?: string) => CUSTOM_COLOR_STYLES[color || ''] || CUSTOM_COLOR_STYLES.gray;
